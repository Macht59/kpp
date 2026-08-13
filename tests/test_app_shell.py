"""The app shell seam: what the service worker precaches has to be servable.

A single file in the precache list that 404s makes `cache.addAll` reject, the
worker never installs, and the app is silently online-only — the one failure
that cannot be seen by opening the app on a desk with wifi. So the list is read
out of `sw.js` and every entry fetched.
"""

import json
import re
from pathlib import Path

import pytest

from server import app

WEB = Path(__file__).parent.parent / "web"
SHELL = re.compile(r"const SHELL = \[(.*?)\]", re.DOTALL)


@pytest.fixture
def client():
    return app.test_client()


def precached():
    listed = SHELL.search((WEB / "sw.js").read_text())
    assert listed, "sw.js no longer declares a SHELL list"
    return re.findall(r'"([^"]+)"', listed.group(1))


@pytest.mark.parametrize("path", precached())
def test_every_precached_shell_file_is_served(client, path):
    assert client.get(path).status_code == 200


def test_the_shell_holds_every_module_the_client_loads(client):
    """A module added to the client and forgotten here is an app that dies offline.

    The worker itself is not shell: the browser keeps and updates it, and a
    cached copy of it is how an app gets stuck on an old one.
    """
    modules = {
        f"/{module.name}"
        for module in WEB.glob("*.js")
        if not module.name.endswith(".test.js") and module.name != "sw.js"
    }

    assert modules <= set(precached())


def test_the_service_worker_is_served_from_the_root_so_it_can_claim_the_whole_app(client):
    response = client.get("/sw.js")

    assert response.status_code == 200
    assert "javascript" in response.content_type


def test_the_manifest_makes_the_app_installable(client):
    response = client.get("/manifest.webmanifest")
    manifest = json.loads(response.data)

    assert response.status_code == 200
    assert manifest["display"] == "standalone"  # opens without browser chrome
    assert manifest["icons"]
    assert client.get(manifest["icons"][0]["src"]).status_code == 200
