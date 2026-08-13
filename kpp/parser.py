"""The chart parsing service: `parse_chart(image, crop) -> Chart`.

One high seam. A cropped chart screenshot plus the rectangle the knitter drew
go in; a Chart dict matching the schema-1 contract comes out, ready to
`json.dumps`. The service is stateless and retains nothing.

Pipeline: decode -> deskew -> lattice recovery -> crop-snap -> Cell sampling ->
Palette recovery -> serialise. The lattice is *extrapolated* from a recovered
pitch, never traced line by line: per-line support drops out over saturated and
gridline-over-fill regions.

Non-stitch is never auto-detected (v1 emits no `-1`), symbols are absorbed as
noise by interior-median sampling, and `reading_direction_default` is omitted —
the gutter numbers it would be read from are outside the knitter's crop.

`prototype/extraction-spike/` is the reference this was written from.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.hierarchy import fcluster, linkage
from skimage.color import deltaE_ciede2000, lab2rgb, rgb2lab

SCHEMA_VERSION = 1

MIN_PITCH, MAX_PITCH = 6.0, 120.0  # px between gridlines we are willing to believe
SNAP_TOLERANCE = 0.5  # Cells; the worst an edge can miss its gridline by, once snapped
SKEW_RANGE, SKEW_STEP = 3.0, 0.25  # degrees swept, then refined at 0.05
SKEW_PITCH_FLOOR = 8.0  # downsample the skew estimate no finer than this pitch
SKEW_WINDOW = 512  # px; central window the angle sweep rotates
SKEW_DETOUR = 5.0  # deg; every candidate rotates via this, so none skips interpolation
OUTLIER_MADS = 5.0  # MADs from a Chart's own median at which a Cell stops being ordinary
SPREAD_FLOOR = 2.0  # a couple of 8-bit levels of mottling is not doubt, however crisp
MARGIN_CEILING = 10.0  # dE to the 2nd-nearest Palette entry above which nothing is doubtful
MARGIN_FLOOR = 1.0  # ...and below which everything is
FLAG_BELOW = 0.5  # Cell confidence under this is flagged for review


def parse_chart(image, crop) -> dict:
    """Parse a cropped chart screenshot into a Chart.

    `image` is a path, bytes, file-like, PIL image or RGB array; `crop` is the
    knitter's rectangle `(x, y, w, h)` in source pixels, gutters excluded.

    Returns the schema-1 Chart dict. Structural doubt (was the crop good?) is
    `confidence.chart`; per-Cell doubt is the sparse `confidence.cells` list.
    The two are never averaged — a bad crop is redone, a doubtful Cell is tapped.
    """
    rgb = _decode(image)
    x, y, w, h = _validated_crop(crop, rgb.shape)
    sub = rgb[y : y + h, x : x + w]

    skew = _estimate_skew(_luma(sub))
    if abs(skew) > 1e-3:
        sub = _spin(sub, skew)

    lattice = _recover_lattice(sub)
    medians, spread = _sample_cells(sub, lattice)
    palette, cells, margin = _recover_palette(medians)

    return {
        "schema_version": SCHEMA_VERSION,
        "dimensions": {"rows": cells.shape[0], "cols": cells.shape[1]},
        "palette": [{"rgb": [int(c) for c in entry], "name": None} for entry in palette],
        "cells": cells.tolist(),
        "source": {
            "image_width": rgb.shape[1],
            "image_height": rgb.shape[0],
            "crop": [x, y, w, h],
            "pitch": [round(float(p), 3) for p in lattice["pitch"]],
            "origin": [
                round(float(o + d), 3)
                for o, d in zip(_undo_skew(lattice["origin"], skew, (w, h)), (x, y))
            ],
            "skew_deg": skew,
        },
        "confidence": {
            "chart": _chart_confidence(lattice),
            "cells": _flagged_cells(spread, margin),
        },
    }


# ---------- decode ----------


def _decode(image) -> np.ndarray:
    if isinstance(image, np.ndarray):
        if image.ndim != 3 or image.shape[2] < 3:
            raise ValueError(f"expected an RGB array, got shape {image.shape}")
        if np.issubdtype(image.dtype, np.floating) and image.max() <= 1.0:
            raise ValueError("expected 0-255 RGB values, got floats in [0, 1]")
        return image[..., :3].astype(np.float64)
    if isinstance(image, bytes):
        image = io.BytesIO(image)
    if not isinstance(image, Image.Image):
        image = Image.open(image)
    return np.asarray(image.convert("RGB"), dtype=np.float64)


def _validated_crop(crop, shape) -> tuple[int, int, int, int]:
    """The crop comes from a client; a bad one must fail loudly, not sample air."""
    x, y, w, h = (int(v) for v in crop)
    height, width = shape[:2]
    if w < 2 * MIN_PITCH or h < 2 * MIN_PITCH:
        raise ValueError(f"crop {crop} is too small to hold a Chart")
    if x < 0 or y < 0 or x + w > width or y + h > height:
        raise ValueError(f"crop {crop} falls outside the {width}x{height} image")
    return x, y, w, h


def _luma(rgb: np.ndarray) -> np.ndarray:
    return rgb @ np.array([0.299, 0.587, 0.114])


def _spin(image: np.ndarray, angle: float) -> np.ndarray:
    """Rotate about the array's own centre, replicating the edge rather than filling black."""
    return ndimage.rotate(image, angle, reshape=False, order=1, mode="nearest")


# ---------- lattice ----------


def _grad_profiles(g: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Summed |gradient| projected onto each axis. Peaks sit on gridlines."""
    gy, gx = np.gradient(g)
    return np.abs(gx).sum(axis=0), np.abs(gy).sum(axis=1)


def _dft_pitch(profile: np.ndarray) -> float:
    """Dominant spatial period of a gradient profile, in px.

    Zero-padded DFT with parabolic refinement around the peak bin: the pitch is
    rarely an integer, and rounding one to 9.0 that is really 8.852 drifts ~2
    Cells across a 150-Row Chart.
    """
    p = (profile - profile.mean()) * np.hanning(len(profile))
    n_pad = int(2 ** np.ceil(np.log2(len(p) * 4)))
    mag = np.abs(np.fft.rfft(p, n_pad))
    freqs = np.fft.rfftfreq(n_pad)
    pitch_of = np.where(freqs > 0, 1.0 / np.where(freqs > 0, freqs, 1.0), np.inf)
    band = (pitch_of >= MIN_PITCH) & (pitch_of <= MAX_PITCH)
    peak = int(np.arange(len(mag))[band][np.argmax(mag[band])])
    delta = 0.0
    if 0 < peak < len(mag) - 1:
        a, b, c = mag[peak - 1], mag[peak], mag[peak + 1]
        denom = a - 2 * b + c
        delta = 0.5 * (a - c) / denom if denom else 0.0
    return n_pad / (peak + delta)


def _best_offset(profile: np.ndarray, pitch: float) -> float:
    """Lattice phase: the offset in [0, pitch) whose comb sits on the gridlines."""
    idx = np.arange(len(profile))
    offsets = np.linspace(0, pitch, 60, endpoint=False)
    scores = [
        np.interp(np.arange(o, len(profile) - 1, pitch), idx, profile).mean() for o in offsets
    ]
    return float(offsets[int(np.argmax(scores))])


def _estimate_skew(g: np.ndarray) -> float:
    """Angle (deg) at which the gridline ripple stands out sharpest.

    Mandatory: a quarter of a degree of skew silently returns a wrong pitch.
    Two traps sit between here and measuring it. Spectral peak *share* — the
    obvious metric — is maximised by destroying the signal rather than by
    aligning it: rotate a crisp chart 3 degrees off and the smeared profile is
    nothing *but* its own fundamental, which scores better than the real
    answer. And any measure of profile contrast is depressed by the
    interpolation the rotation itself costs, so zero (the one angle that
    resamples nothing) wins by default on a real chart. Hence: detrend the
    profile so the metric sees the gridline ripple rather than the content
    envelope, and route every candidate through the same fixed detour so no
    angle, zero included, is cheaper than its neighbours.

    The ~50 rotations this costs would otherwise dominate the pipeline, so the
    wide coarse sweep runs on a decimated central window; the 0.05-degree
    refinement that follows sees the full crop, because that is where the
    precision has to be real. A coarse answer one step out still lands inside
    its span.
    """

    def sharpness_of(image):
        windows = [max(3, int(round(2 * _dft_pitch(p)))) for p in _grad_profiles(image)]

        def sharpness(angle: float) -> float:
            spun = _spin(_spin(image, angle - SKEW_DETOUR), SKEW_DETOUR)
            return sum(_ripple(p, w) for p, w in zip(_grad_profiles(spun), windows))

        return sharpness

    coarse = max(
        np.arange(-SKEW_RANGE, SKEW_RANGE + 1e-9, SKEW_STEP),
        key=sharpness_of(_centre_window(_decimate(g))),
    )
    fine = max(
        np.arange(coarse - SKEW_STEP, coarse + SKEW_STEP + 1e-9, 0.05),
        key=sharpness_of(g),
    )
    return round(float(fine), 3)


def _ripple(profile: np.ndarray, window: int) -> float:
    """How strongly the profile ripples over its own local level, per unit gradient.

    The detrend is what separates gridlines from content: a chart with a dark
    region has a gradient envelope far larger than its gridline ripple, and a
    raw contrast measure just tracks the envelope, which no rotation changes.
    """
    detrended = profile - ndimage.uniform_filter1d(profile, window)
    return float(detrended.std() / max(profile.mean(), 1e-9))


def _decimate(g: np.ndarray) -> np.ndarray:
    """Box-filter and decimate, stopping short of SKEW_PITCH_FLOOR.

    A coarse-pitch chart shrinks ~10x for free; a fine-pitch one is left alone,
    because a grid decimated past a few px per Cell is a grid the DFT can no
    longer see.
    """
    pitch = min(_dft_pitch(p) for p in _grad_profiles(g))
    factor = max(1, int(pitch // SKEW_PITCH_FLOOR))
    if factor == 1:
        return g
    return ndimage.uniform_filter(g, factor)[::factor, ::factor]


def _centre_window(g: np.ndarray) -> np.ndarray:
    half_y, half_x = min(SKEW_WINDOW, g.shape[0]) // 2, min(SKEW_WINDOW, g.shape[1]) // 2
    cy, cx = g.shape[0] // 2, g.shape[1] // 2
    return g[cy - half_y : cy + half_y, cx - half_x : cx + half_x]


def _undo_skew(origin, skew: float, size) -> tuple[float, float]:
    """Map the lattice origin out of the deskewed frame and back into crop px.

    The contract's `origin` is in source pixels, but the lattice was recovered
    after rotating the crop about its own centre, which is where ndimage spins
    it. Without this the client's overlay drifts by ~sin(skew) * crop size.
    """
    t = np.radians(skew)
    centre = ((size[0] - 1) / 2.0, (size[1] - 1) / 2.0)
    dx, dy = origin[0] - centre[0], origin[1] - centre[1]
    return (centre[0] + dx * np.cos(t) - dy * np.sin(t),
            centre[1] + dx * np.sin(t) + dy * np.cos(t))


def _recover_lattice(sub: np.ndarray) -> dict:
    """Pitch and origin per axis (Cells may be non-square), plus the crop snap.

    Snapping the crop edges to the `origin + n*pitch` comb — not the raw edges —
    is what gives the Cell count; raw edges overcount by up to 24%.
    """
    height, width = sub.shape[:2]
    profiles = _grad_profiles(_luma(sub))
    lengths = (width, height)
    pitch, origin, count, slop = [], [], [], []
    for profile, length in zip(profiles, lengths):
        p = _dft_pitch(profile)
        offset = _best_offset(profile, p)
        lo = offset + round((0 - offset) / p) * p
        hi = offset + round((length - offset) / p) * p
        pitch.append(p)
        origin.append(lo)
        count.append(int(round((hi - lo) / p)))
        slop.append(max(abs(lo), abs(length - hi)) / p)
    if min(count) < 1:
        raise ValueError(f"no grid found in the crop: recovered pitch {pitch} over {lengths}")
    return {"pitch": pitch, "origin": origin, "count": count, "slop": slop}


# ---------- sampling ----------


def _sample_cells(sub: np.ndarray, lattice: dict) -> tuple[np.ndarray, np.ndarray]:
    """Interior-median (central 50%) RGB per Cell, plus its within-Cell spread.

    Sampling the interior is what keeps the overlay layer cheap: black outlines
    crossing Cell boundaries corrupt <=0.4% of Cells, where a naive mean over the
    whole Cell corrupts six times as many. The spread is a free confidence signal.
    """
    height, width = sub.shape[:2]
    (px, py), (ox, oy), (nx, ny) = lattice["pitch"], lattice["origin"], lattice["count"]
    medians = np.zeros((ny, nx, 3))
    spread = np.zeros((ny, nx))
    half_x, half_y = 0.25 * px, 0.25 * py
    for j in range(ny):
        cy = oy + (j + 0.5) * py
        y0, y1 = max(0, int(cy - half_y)), min(height, int(cy + half_y) + 1)
        for i in range(nx):
            cx = ox + (i + 0.5) * px
            x0, x1 = max(0, int(cx - half_x)), min(width, int(cx + half_x) + 1)
            patch = sub[y0:y1, x0:x1].reshape(-1, 3)
            median = np.median(patch, axis=0)
            medians[j, i] = median
            spread[j, i] = np.median(np.abs(patch - median))
    return medians, spread


# ---------- palette ----------


def _recover_palette(medians: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Cluster the sampled Cell colours into a Palette; return (rgb, cells, margin).

    Sample first, cluster second — harvesting flat pixels before sampling finds
    nothing on a noisy chart. The merge threshold is *swept* and the count at the
    widest plateau wins; a fixed dE 3.0 over-segments a noisy chart by 13x. No
    blend-rejection pass: the plateau already merges gridline blends, and testing
    Lab-collinearity on top removes rare-but-real yarns.
    """
    ny, nx, _ = medians.shape
    unique, inverse = np.unique(
        np.round(medians.reshape(-1, 3)).astype(int), axis=0, return_inverse=True
    )
    labs = rgb2lab((unique / 255.0)[None, :, :])[0]
    if len(unique) == 1:
        return unique, np.zeros((ny, nx), dtype=int), np.full(ny * nx, MARGIN_CEILING)

    rows, cols = np.triu_indices(len(unique), 1)
    tree = linkage(deltaE_ciede2000(labs[rows], labs[cols]), method="complete")
    clusters = fcluster(tree, t=_plateau_threshold(tree), criterion="distance")[inverse]

    cell_labs = labs[inverse]
    centroids = np.array(
        [cell_labs[clusters == k].mean(axis=0) for k in range(1, clusters.max() + 1)]
    )
    distances = np.stack(
        [deltaE_ciede2000(cell_labs, np.tile(c, (len(cell_labs), 1))) for c in centroids], axis=1
    )
    nearest = np.sort(distances, axis=1)
    margin = (
        nearest[:, 1] - nearest[:, 0]
        if distances.shape[1] > 1
        else np.full(len(nearest), MARGIN_CEILING)
    )
    palette = np.clip(lab2rgb(centroids[None, :, :])[0] * 255.0, 0, 255).round().astype(int)
    return palette, distances.argmin(axis=1).reshape(ny, nx), margin


def _plateau_threshold(tree: np.ndarray) -> float:
    """The merge threshold at the widest plateau of the cluster-count sweep.

    A plateau is a Palette size that survives a wide range of thresholds — the
    real colours. Over-segmented noise and under-merged blends both live on
    narrow steps.
    """
    thresholds = np.arange(1.0, 41.0, 0.5)
    counts = np.array([fcluster(tree, t=t, criterion="distance").max() for t in thresholds])
    edges = np.flatnonzero(np.diff(counts)) + 1
    runs = list(zip([0, *edges], [*edges, len(counts)]))
    start, stop = max(runs, key=lambda r: r[1] - r[0])
    return float(thresholds[(start + stop) // 2])


# ---------- confidence ----------


def _chart_confidence(lattice: dict) -> float:
    """Structural confidence: how cleanly the crop snapped to the lattice.

    Slop is an edge's distance to the gridline it snapped to, and snapping to
    the *nearest* line bounds it at half a Cell by construction. So 1.0 means
    the edges landed on gridlines and 0.0 means an edge sat exactly between two
    — the snap was a coin flip and the Cell count may be off by one. It says
    nothing about a crop drawn *inside* the Chart: a crop one Cell in is a
    perfect crop of a smaller Chart, and no amount of looking at it says
    otherwise. Only the knitter can catch that, which is what review is for.
    """
    # ponytail: no grid-clarity term multiplied in. The obvious one — DFT peak
    # strength against a reference — scored 0.03 for a structurally perfect
    # 112x150 parse, because peak strength falls with image size and there are
    # four corpus charts to calibrate a reference against. A crop with no
    # recoverable grid already fails loudly in _recover_lattice. Add the term
    # when there is a chart to fit it on.
    return round(max(0.0, 1.0 - max(lattice["slop"]) / SNAP_TOLERANCE), 2)


def _flagged_cells(spread: np.ndarray, margin: np.ndarray) -> list[dict]:
    """The sparse review list: only the Cells worth a second look.

    Two independent doubts, combined by the worse of the two — the Cell was
    mottled, or its colour sat between two Palette entries. Both are judged
    against this Chart's *own* distribution, because a scan's typical Cell is
    noisier than a screenshot's worst one and a nine-yarn Palette is inherently
    tighter than a two-yarn one. Absolute bounds keep a uniform Chart from
    flagging its own median as an outlier.
    """
    mottled = max(_mads_from_median(spread, OUTLIER_MADS), SPREAD_FLOOR)
    ambiguous = min(max(_mads_from_median(margin, -OUTLIER_MADS), MARGIN_FLOOR), MARGIN_CEILING)
    score = np.minimum(
        np.clip(1.0 - spread / (2 * mottled), 0.0, 1.0),
        np.clip(margin.reshape(spread.shape) / (2 * ambiguous), 0.0, 1.0),
    )
    return [
        {"r": int(r), "c": int(c), "score": round(float(score[r, c]), 2)}
        for r, c in zip(*np.nonzero(score < FLAG_BELOW))
    ]


def _mads_from_median(values: np.ndarray, mads: float) -> float:
    """Where this Chart's own distribution stops being ordinary, above or below."""
    median = float(np.median(values))
    return median + mads * float(np.median(np.abs(values - median)))
