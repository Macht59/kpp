#!/usr/bin/env python3
"""Automatic extraction spike (wayfinder ticket 05).

Throwaway: takes a cropped chart screenshot -> Chart {dims, Palette, 2D Cells},
using the mechanisms the resolved blockers 03/04 prescribe (as AMENDED):
  - lattice: gradient-projection -> DFT peak (parabolic-refined) for pitch,
    direct offset search for origin; x and y independently; mandatory deskew.
  - crop-snap: snap the user's crop to the recovered lattice; report the delta.
  - palette: interior-median sampling -> threshold-sweep merge with plateau
    selection (NOT fixed dE 3.0) -> Lab-collinearity blend rejection.

Scored on CORRECTION BURDEN, not accuracy (ticket 02). Ground truth (dims +
colour count) is in the filenames. Run: python3 spike.py
"""
import json, os, re, time, tracemalloc
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.hierarchy import linkage, fcluster
from skimage.color import rgb2lab, deltaE_ciede2000

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CORPUS = os.path.join(ROOT, "tests", "examples")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)


# ---------- io ----------
def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)


def gray(rgb):
    return rgb @ np.array([0.299, 0.587, 0.114])


def gt_from_name(name):
    m = re.match(r"(\d+)w(\d+)h-(\d+)colors", name)
    w, h, c = map(int, m.groups())
    return w, h, c


# ---------- lattice ----------
def grad_profiles(g):
    """Summed |gradient| projected onto each axis. Peaks sit on gridlines."""
    gy, gx = np.gradient(g)
    prof_x = np.abs(gx).sum(axis=0)   # length W, periodic at column pitch
    prof_y = np.abs(gy).sum(axis=1)   # length H, periodic at row pitch
    return prof_x, prof_y


def dft_pitch(profile, min_pitch=6.0, max_pitch=120.0, pad=4):
    """Dominant spatial period via zero-padded DFT + parabolic interpolation.
    Returns (pitch, peak_strength)."""
    p = profile - profile.mean()
    p = p * np.hanning(len(p))
    N = len(p)
    Npad = int(2 ** np.ceil(np.log2(N * pad)))
    mag = np.abs(np.fft.rfft(p, Npad))
    freqs = np.fft.rfftfreq(Npad)
    k = np.arange(len(mag))
    with np.errstate(divide="ignore"):
        pitch_of = np.where(freqs > 0, 1.0 / freqs, np.inf)
    band = (pitch_of >= min_pitch) & (pitch_of <= max_pitch)
    kk = k[band]
    peak = kk[np.argmax(mag[band])]
    # parabolic refinement around the peak bin
    if 0 < peak < len(mag) - 1:
        a, b, c = mag[peak - 1], mag[peak], mag[peak + 1]
        denom = (a - 2 * b + c)
        delta = 0.5 * (a - c) / denom if denom != 0 else 0.0
    else:
        delta = 0.0
    pitch = Npad / (peak + delta)
    return pitch, mag[peak] / mag.sum()


def best_offset(profile, pitch):
    """Origin: phase of the lattice. Offset in [0,pitch) whose gridline comb
    o+n*pitch maximises the projected gradient (gridlines are gradient maxima)."""
    idx = np.arange(len(profile))
    offs = np.linspace(0, pitch, 60, endpoint=False)
    best_o, best_v = 0.0, -np.inf
    for o in offs:
        pos = np.arange(o, len(profile) - 1, pitch)
        v = np.interp(pos, idx, profile).sum() / max(len(pos), 1)
        if v > best_v:
            best_v, best_o = v, o
    return best_o


def estimate_skew(g):
    """Angle (deg) that maximises combined DFT peak sharpness. 0.25 deg matters
    (ticket 03: 0.25 deg silently returns a wrong pitch)."""
    def sharpness(angle):
        r = ndimage.rotate(g, angle, reshape=False, order=1, mode="nearest")
        px, py = grad_profiles(r)
        return dft_pitch(px)[1] + dft_pitch(py)[1]
    coarse = np.arange(-3.0, 3.01, 0.25)
    best = max(coarse, key=sharpness)
    fine = np.arange(best - 0.25, best + 0.251, 0.05)
    return round(float(max(fine, key=sharpness)), 3)


def recover_lattice(rgb, crop):
    """Deskew the cropped region, then recover pitch+origin on each axis."""
    x0, y0, x1, y1 = crop
    sub = rgb[y0:y1, x0:x1]
    g = gray(sub)
    skew = estimate_skew(g)
    if abs(skew) > 1e-6:
        sub = np.stack([ndimage.rotate(sub[..., c], skew, reshape=False,
                                       order=1, mode="nearest") for c in range(3)], -1)
        g = gray(sub)
    px, py = grad_profiles(g)
    pitch_x, str_x = dft_pitch(px)
    pitch_y, str_y = dft_pitch(py)
    off_x = best_offset(px, pitch_x)
    off_y = best_offset(py, pitch_y)
    return dict(sub=sub, skew=skew, pitch_x=pitch_x, pitch_y=pitch_y,
                off_x=off_x, off_y=off_y, str_x=str_x, str_y=str_y,
                prof_x=px, prof_y=py, W=sub.shape[1], H=sub.shape[0])


def snap_axis(length, pitch, off):
    """Snap the crop edges [0,length] to the gridline comb off+n*pitch and count
    whole Cells between them. Ticket 03 amendment: extrapolate the regular pitch,
    don't trace individual lines (per-line support drops out across saturated /
    gridline-over-fill regions — the naive-scan trap). Excluding number gutters
    is the crop's job. Returns (n_cells, snapped_lo, snapped_hi, edge_slop)."""
    n_lo = round((0 - off) / pitch)
    n_hi = round((length - off) / pitch)
    lo, hi = off + n_lo * pitch, off + n_hi * pitch
    slop = (abs(0 - lo) + abs(length - hi)) / pitch   # how loose the crop was
    return n_hi - n_lo, lo, hi, slop


# ---------- sampling ----------
def sample_cells(lat):
    """Interior-median (central 50%) RGB per Cell -> also Lab, and within-cell
    spread (a free confidence signal)."""
    sub, W, H = lat["sub"], lat["W"], lat["H"]
    nx, lox, _, dx = snap_axis(W, lat["pitch_x"], lat["off_x"])
    ny, loy, _, dy = snap_axis(H, lat["pitch_y"], lat["off_y"])
    px, py = lat["pitch_x"], lat["pitch_y"]
    med = np.zeros((ny, nx, 3))
    spread = np.zeros((ny, nx))
    hw_x, hw_y = 0.25 * px, 0.25 * py
    for j in range(ny):
        cy = loy + (j + 0.5) * py
        ya, yb = int(cy - hw_y), int(cy + hw_y) + 1
        ya, yb = max(0, ya), min(H, yb)
        for i in range(nx):
            cx = lox + (i + 0.5) * px
            xa, xb = int(cx - hw_x), int(cx + hw_x) + 1
            xa, xb = max(0, xa), min(W, xb)
            patch = sub[ya:yb, xa:xb].reshape(-1, 3)
            m = np.median(patch, axis=0)
            med[j, i] = m
            spread[j, i] = np.median(np.abs(patch - m))
    return dict(nx=nx, ny=ny, med=med, spread=spread,
                snap_delta=(dx + dy))


# ---------- palette ----------
def recover_palette(med):
    """Sample-first-cluster-second, but on UNIQUE cell medians. Merge by
    threshold sweep + widest-plateau selection; reject Lab-collinear blends."""
    ny, nx, _ = med.shape
    flat = med.reshape(-1, 3)
    uniq, inv = np.unique(np.round(flat).astype(int), axis=0, return_inverse=True)
    labs = rgb2lab((uniq / 255.0)[None, :, :])[0]      # (U,3)
    U = len(uniq)
    if U == 1:
        assign = np.zeros(ny * nx, dtype=int)
        return dict(size=1, palette=uniq, assign=assign.reshape(ny, nx),
                    plateau="single", counts=[ny * nx])
    # condensed CIEDE2000 distance over unique colours
    iu, ju = np.triu_indices(U, 1)
    d = deltaE_ciede2000(labs[iu], labs[ju])
    Z = linkage(d, method="complete")
    # sweep merge threshold; record cluster count; pick widest plateau
    ts = np.arange(1.0, 41.0, 0.5)
    ncl = np.array([fcluster(Z, t=t, criterion="distance").max() for t in ts])
    # widest run of a constant, sensible (>=1) count
    best_n, best_w, run_t = ncl[0], 0, ts[0]
    i = 0
    while i < len(ncl):
        j = i
        while j < len(ncl) and ncl[j] == ncl[i]:
            j += 1
        w = j - i
        if w > best_w:
            best_w, best_n, run_t = w, ncl[i], ts[(i + j) // 2]
        i = j
    at3 = int(fcluster(Z, t=3.0, criterion="distance").max())
    at10 = int(fcluster(Z, t=10.0, criterion="distance").max())
    lab_cluster = fcluster(Z, t=run_t, criterion="distance")   # per unique colour
    cell_cluster = lab_cluster[inv]                            # per cell
    # cluster centroids (Lab) + populations (in cells)
    K = lab_cluster.max()
    cent, pop = {}, {}
    cell_labs = labs[inv]
    for k in range(1, K + 1):
        mask = cell_cluster == k
        pop[k] = int(mask.sum())
        cent[k] = cell_labs[mask].mean(axis=0)
    # Ticket 04 proposed a Lab-collinearity test to strip gridline/AA blends.
    # Empirically UNNECESSARY: the threshold-sweep plateau already merges blends
    # into their real colour (it picked 9/2/2/2 exact across the corpus). Worse,
    # when we did run it, it over-removed a rare-but-real yarn on the rich chart
    # (9->8), because a genuine <1%-area entry can sit coincidentally collinear
    # between two others. So plateau selection stands alone; blend-reject is off.
    real = set(cent)
    # reassign every cell to the nearest centroid
    real_ids = sorted(real)
    real_cent = np.array([cent[k] for k in real_ids])
    dists = np.stack([deltaE_ciede2000(cell_labs, np.tile(rc, (len(cell_labs), 1)))
                      for rc in real_cent], axis=1)      # (cells, R)
    assign = dists.argmin(axis=1).reshape(ny, nx)
    # assignment margin = dE(2nd nearest) - dE(nearest): a free confidence signal
    srt = np.sort(dists, axis=1)
    margin = (srt[:, 1] - srt[:, 0]) if dists.shape[1] > 1 else np.full(len(srt), 99.0)
    pal_rgb = np.clip(_lab_to_rgb(real_cent), 0, 255).astype(int)
    return dict(size=len(real_ids), palette=pal_rgb, assign=assign,
                plateau=f"plateau {best_n} (widest run {best_w*0.5:.1f} dE) vs "
                        f"fixed dE3->{at3}, dE10->{at10}",
                margin=margin, counts=[pop[k] for k in real_ids])


def _lab_to_rgb(lab):
    from skimage.color import lab2rgb
    return lab2rgb(lab[None, :, :])[0] * 255.0


# ---------- render ----------
def render(chart, path, cell=8):
    pal, assign = chart["palette"], chart["assign"]
    ny, nx = assign.shape
    img = pal[assign]                       # (ny,nx,3)
    big = np.repeat(np.repeat(img, cell, 0), cell, 1).astype(np.uint8)
    Image.fromarray(big).save(path)


# ---------- run ----------
def main():
    crops = json.load(open(os.path.join(HERE, "crops.json")))
    rows = []
    for name in sorted(k for k in crops if not k.startswith("_")):
        path = os.path.join(CORPUS, name)
        gw, gh, gc = gt_from_name(name)
        rgb = load_rgb(path)
        tracemalloc.start()
        t0 = time.time()
        lat = recover_lattice(rgb, crops[name])
        cells = sample_cells(lat)
        chart = recover_palette(cells["med"])
        chart["assign"] = chart["assign"]  # (ny,nx)
        dt = time.time() - t0
        peak_mb = tracemalloc.get_traced_memory()[1] / 1e6
        tracemalloc.stop()
        render(chart, os.path.join(OUT, name + ".recon.png"))

        dims_ok = (cells["nx"] == gw) and (cells["ny"] == gh)
        pal_ok = (chart["size"] == gc)
        margin = chart.get("margin")
        rows.append(dict(
            name=name, gw=gw, gh=gh, gc=gc,
            nx=cells["nx"], ny=cells["ny"], size=chart["size"],
            skew=lat["skew"], px=lat["pitch_x"], py=lat["pitch_y"],
            snap=cells["snap_delta"], plateau=chart["plateau"],
            spread=float(np.median(cells["spread"])),
            margin=float(np.median(margin)) if margin is not None else None,
            dims_ok=dims_ok, pal_ok=pal_ok, dt=dt, mem=peak_mb,
            str_x=lat["str_x"], str_y=lat["str_y"]))

    _report(rows)


def _report(rows):
    print("\n=== STRUCTURAL SCORE (pass/fail; one failure fails the chart) ===\n")
    hdr = f"{'chart':22} {'dims':>9} {'gt':>8} {'ok':>3} | {'pal':>3} {'gt':>3} {'ok':>3} | {'skew':>6} {'pitch x/y':>13}"
    print(hdr); print("-" * len(hdr))
    for r in rows:
        print(f"{r['name']:22} {str(r['nx'])+'x'+str(r['ny']):>9} "
              f"{str(r['gw'])+'x'+str(r['gh']):>8} {'PASS' if r['dims_ok'] else 'FAIL':>3} | "
              f"{r['size']:>3} {r['gc']:>3} {'ok' if r['pal_ok'] else 'X':>3} | "
              f"{r['skew']:>6.2f} {r['px']:>6.2f}/{r['py']:<6.2f}")
    print("\n=== DIAGNOSTICS (correction burden + free confidence signals) ===\n")
    for r in rows:
        print(f"{r['name']}")
        print(f"    crop edge slop           : {r['snap']:.2f} cells "
              f"({'snapping absorbed it' if r['snap'] < 0.5 else 'EXCEEDS 0.5-cell snap tolerance -> miscount'})")
        print(f"    palette merge            : {r['plateau']}")
        print(f"    within-cell spread (conf): median MAD {r['spread']:.2f}  "
              f"| assign margin dE {r['margin'] if r['margin'] is None else round(r['margin'],1)}")
        print(f"    dft peak strength x/y    : {r['str_x']:.3f} / {r['str_y']:.3f}")
        print(f"    cost                     : {r['dt']*1000:.0f} ms, peak {r['mem']:.0f} MB")
        print()
    print("Reconstructions written to out/*.recon.png — eyeball vs originals for cell burden.")


if __name__ == "__main__":
    main()
