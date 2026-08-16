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

ROOT = Path(__file__).parent.parent
WEB = ROOT / "web"
SHELL = re.compile(r"const SHELL = \[(.*?)\]", re.DOTALL)
STAMPED = re.compile(r'const VERSION = "([^"]*)"')


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


def test_the_release_stamp_reaches_every_file_that_names_a_version():
    """One `sed` in the Dockerfile rewrites this declaration wherever it is held.

    The worker's cache name and the version at the foot of the page are the same
    release said twice — a worker imports no modules, so it cannot share the
    page's copy. A file that holds one and is not named on that command keeps
    saying `dev` in production, silently: the app tells a knitter it is a version
    it is not, or a release lands and never turns the cache over.
    """
    holders = {
        module.name: STAMPED.findall(module.read_text())
        for module in WEB.glob("*.js")
        if not module.name.endswith(".test.js")
    }
    declared = {name: found for name, found in holders.items() if found}

    assert set(declared) == {"sw.js", "version.js"}
    assert set(map(tuple, declared.values())) == {("dev",)}  # one each, unstamped in the repo

    stamping = [
        line for line in (ROOT / "Dockerfile").read_text().splitlines() if line.startswith("RUN sed")
    ]
    assert len(stamping) == 1, "the Dockerfile no longer stamps the version in one command"
    assert all(f"web/{name}" in stamping[0] for name in declared)


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
