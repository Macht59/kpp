"""One process: the static client and the parse endpoint, same origin.

`python server.py` and the knitter has an app. The web layer is a caller of
`kpp.parse_chart` and nothing about serving reaches inside it.

The parser's `ValueError`s are all things the knitter can act on — the crop
fell outside the image, was too small, or held no recoverable grid — so the
message is passed through with a 400. Anything else is a 500.
"""

from flask import Flask, jsonify, request
from PIL import UnidentifiedImageError

from kpp import parse_chart

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # a truncated image parses into a plausible, wrong Chart

app = Flask(__name__, static_folder="web", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES


@app.get("/")
def client():
    return app.send_static_file("index.html")


@app.post("/api/parse")
def parse():
    image = request.files.get("image")
    if image is None:
        return jsonify(error="no image uploaded"), 400
    try:
        crop = [int(request.form[field]) for field in ("x", "y", "w", "h")]
    except KeyError as missing:
        return jsonify(error=f"crop field {missing.args[0]} is missing"), 400
    except ValueError:
        return jsonify(error="crop fields x, y, w, h must be whole numbers"), 400

    try:
        return jsonify(parse_chart(image.read(), crop))
    except UnidentifiedImageError:
        return jsonify(error=f"{image.filename} is not an image this app can read"), 400
    except ValueError as bad_crop:
        return jsonify(error=str(bad_crop)), 400


@app.errorhandler(413)
def too_large(_):
    return jsonify(error=f"images must be under {MAX_UPLOAD_BYTES // 1024 // 1024} MB"), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
