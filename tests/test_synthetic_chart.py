"""Ground-truth test on a chart we drew ourselves.

The corpus is the arbiter for real charts, but it is not in git — this keeps a
fresh clone honest, and it is the only test that knows the true Cell colours
rather than just the Chart's shape.
"""

import numpy as np
import pytest
from scipy import ndimage

from kpp import parse_chart

PITCH = 20
MARGIN = 7
COLOURS = [(255, 255, 255), (20, 20, 20), (178, 96, 72)]
GRIDLINE = 128


def synthetic_chart(rows=6, cols=10):
    """Flat Cells, 1px grey gridlines, a background margin standing in for a gutter."""
    pattern = np.array([[(r * 3 + c) % len(COLOURS) for c in range(cols)] for r in range(rows)])
    image = np.full((rows * PITCH + 2 * MARGIN, cols * PITCH + 2 * MARGIN, 3), 255, np.uint8)
    for r in range(rows):
        for c in range(cols):
            y, x = MARGIN + r * PITCH, MARGIN + c * PITCH
            image[y : y + PITCH, x : x + PITCH] = COLOURS[pattern[r, c]]
    for r in range(rows + 1):
        image[MARGIN + r * PITCH, MARGIN : MARGIN + cols * PITCH] = GRIDLINE
    for c in range(cols + 1):
        image[MARGIN : MARGIN + rows * PITCH, MARGIN + c * PITCH] = GRIDLINE
    return image, pattern


@pytest.fixture(scope="module")
def parsed():
    image, pattern = synthetic_chart()
    # a crop a couple of px off in each direction, as a finger-drawn one would be
    crop = (MARGIN - 2, MARGIN + 2, pattern.shape[1] * PITCH + 3, pattern.shape[0] * PITCH - 1)
    return parse_chart(image, crop), pattern


def test_recovers_the_grid_and_palette(parsed):
    chart, pattern = parsed
    assert (chart["dimensions"]["rows"], chart["dimensions"]["cols"]) == pattern.shape
    assert len(chart["palette"]) == len(COLOURS)


def test_recovers_the_actual_cell_colours(parsed):
    """Palette indices are arbitrary; the colour each Cell resolves to is not."""
    chart, pattern = parsed
    palette = np.array([entry["rgb"] for entry in chart["palette"]])
    recovered = palette[np.array(chart["cells"])]
    expected = np.array(COLOURS)[pattern]
    assert np.abs(recovered - expected).max() <= 8


def test_crop_slop_is_absorbed(parsed):
    chart, _ = parsed
    assert chart["confidence"]["chart"] > 0.5


def test_a_crop_edge_between_two_gridlines_scores_worse(parsed):
    """The half-Cell crop is the coin flip `confidence.chart` exists to report."""
    image, pattern = synthetic_chart()
    rows, cols = pattern.shape
    aligned = parse_chart(image, (MARGIN, MARGIN, cols * PITCH, rows * PITCH))
    half = PITCH // 2
    ambiguous = parse_chart(
        image, (MARGIN + half, MARGIN + half, (cols - 1) * PITCH, (rows - 1) * PITCH)
    )
    assert ambiguous["confidence"]["chart"] < aligned["confidence"]["chart"]


def test_origin_marks_the_chart_corner(parsed):
    """`source.origin` is in source px, and snaps to the corner either side of the crop.

    The fixture crop starts 2px left of the corner and 2px into it; both edges
    snap to the same gridline, which is the one the knitter meant.
    """
    chart, _ = parsed
    assert chart["source"]["origin"] == pytest.approx([MARGIN, MARGIN], abs=1.5)


def rotated(degrees):
    """The synthetic chart on a skewed page, plus where its corner ended up."""
    image, pattern = synthetic_chart()
    spin = dict(reshape=False, order=1, mode="nearest")
    skewed = np.clip(ndimage.rotate(image.astype(float), degrees, **spin), 0, 255)
    corner = np.zeros(image.shape[:2])
    corner[MARGIN, MARGIN] = 1.0
    moved = np.unravel_index(np.argmax(ndimage.rotate(corner, degrees, **spin)), corner.shape)
    return skewed, pattern, (moved[1], moved[0])


def test_recovers_an_injected_skew():
    """A skewed page must be measured, not shrugged off: pitch dies without it."""
    skewed, pattern, _ = rotated(2.0)
    chart = parse_chart(skewed, (0, 0, skewed.shape[1], skewed.shape[0]))
    assert chart["source"]["skew_deg"] == pytest.approx(-2.0, abs=0.2)
    assert (chart["dimensions"]["rows"], chart["dimensions"]["cols"]) == pattern.shape


def test_origin_is_reported_in_the_skewed_source_frame():
    """Not in the deskewed one — else the client's overlay drifts with the skew."""
    skewed, _, corner = rotated(2.0)
    chart = parse_chart(skewed, (0, 0, skewed.shape[1], skewed.shape[0]))
    assert chart["source"]["origin"] == pytest.approx(list(corner), abs=2.0)


def test_rejects_a_float_image_in_zero_to_one():
    """Silently parsing a normalised array yields a one-colour Chart, not an error."""
    image, _ = synthetic_chart()
    with pytest.raises(ValueError):
        parse_chart(image / 255.0, (MARGIN, MARGIN, 10 * PITCH, 6 * PITCH))


def test_rejects_a_crop_outside_the_image(parsed):
    image, _ = synthetic_chart()
    with pytest.raises(ValueError):
        parse_chart(image, (0, 0, image.shape[1] + 1, image.shape[0]))


def test_rejects_a_crop_too_small_to_hold_a_chart(parsed):
    image, _ = synthetic_chart()
    with pytest.raises(ValueError):
        parse_chart(image, (0, 0, 8, 8))
