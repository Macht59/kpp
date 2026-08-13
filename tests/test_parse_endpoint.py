"""Endpoint test for the parse seam.

`parse_chart` is already covered against the corpus, so this tests only what
the endpoint adds: status codes and the contract passed through unchanged.

Follows the corpus test's conventions — a corpus image is the fixture for the
success case, and its absence skips rather than fails.
"""

import io
import json
from pathlib import Path

import pytest

from server import MAX_UPLOAD_BYTES, app

EXAMPLES = Path(__file__).parent / "examples"
CROPS = {k: v for k, v in json.loads((EXAMPLES / "crops.json").read_text()).items()
         if not k.startswith("_")}
CHART = "8w37h-2colors.png"  # the corpus's smallest, so the endpoint test is quick


@pytest.fixture
def client():
    return app.test_client()


@pytest.fixture
def image():
    path = EXAMPLES / CHART
    if not path.exists():
        pytest.skip(f"corpus image {CHART} not present")
    return path.read_bytes()


def form(image, crop, filename=CHART):
    x, y, w, h = crop
    return {"image": (io.BytesIO(image), filename), "x": x, "y": y, "w": w, "h": h}


def test_a_well_formed_request_returns_the_schema_1_contract(client, image):
    from kpp import parse_chart

    response = client.post("/api/parse", data=form(image, CROPS[CHART]))

    assert response.status_code == 200
    assert response.get_json() == parse_chart(EXAMPLES / CHART, CROPS[CHART])


def test_a_crop_outside_the_image_is_400_with_the_parsers_message(client, image):
    response = client.post("/api/parse", data=form(image, [0, 0, 99999, 99999]))

    assert response.status_code == 400
    assert "outside" in response.get_json()["error"]


def test_a_crop_too_small_is_400_with_the_parsers_message(client, image):
    response = client.post("/api/parse", data=form(image, [0, 0, 4, 4]))

    assert response.status_code == 400
    assert "too small" in response.get_json()["error"]


def test_an_image_with_no_recoverable_grid_is_400_not_500(client):
    """A flat grey field smaller than any pitch the parser will believe."""
    from PIL import Image

    blank = io.BytesIO()
    Image.new("RGB", (15, 15), (128, 128, 128)).save(blank, format="PNG")

    response = client.post("/api/parse", data=form(blank.getvalue(), [0, 0, 15, 15], "blank.png"))

    assert response.status_code == 400
    assert "no grid" in response.get_json()["error"]


def test_an_oversize_body_is_413_rather_than_truncated_and_parsed(client):
    oversize = b"\x00" * (MAX_UPLOAD_BYTES + 1)

    response = client.post("/api/parse", data=form(oversize, [0, 0, 100, 100], "big.png"))

    assert response.status_code == 413


def test_a_request_missing_the_image_is_rejected(client):
    response = client.post("/api/parse", data={"x": 0, "y": 0, "w": 100, "h": 100})

    assert response.status_code == 400
    assert response.get_json()["error"]


@pytest.mark.parametrize("missing", ["x", "y", "w", "h"])
def test_a_request_missing_a_crop_field_is_rejected(client, image, missing):
    data = form(image, [0, 0, 100, 100])
    del data[missing]

    response = client.post("/api/parse", data=data)

    assert response.status_code == 400
    assert response.get_json()["error"]


def test_a_non_numeric_crop_field_is_rejected(client, image):
    data = form(image, [0, 0, 100, 100]) | {"w": "wide"}

    response = client.post("/api/parse", data=data)

    assert response.status_code == 400


def test_an_undecodable_image_is_400_not_500(client):
    response = client.post("/api/parse", data=form(b"not an image", [0, 0, 100, 100], "x.png"))

    assert response.status_code == 400


def test_the_client_is_served_from_the_same_origin(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.content_type
