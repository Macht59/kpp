# 09 — Install and work offline

**What to build:** A knitter works with the phone propped up beside them — on a
train, in a chair, away from wifi. The app opens from the home screen like an
app, and every Chart they have already parsed is fully usable with no
connection: Select a Row, read it, advance, and Repaint a Cell they spot is
wrong.

Parsing is the one thing that needs the network, and it says so plainly rather
than failing obscurely. The parse happens once per Chart, at a table, on wifi;
the knitting session is the offline case, and it is read-plus-Repaint.

No background-sync queue to retry an offline upload later — that is
infrastructure for a once-per-Chart operation.

A PWA rather than a native app is the deliberate choice recorded in
[ADR-0004](../../../docs/adr/0004-vanilla-canvas-pwa-client.md): home-screen
install and offline are the two things that actually matter to a knitter, and
both come without an engine download or a second toolchain.

**Blocked by:** 07 — The Chart library on the device.

**Status:** ready-for-agent

- [ ] The app can be installed to the home screen and opens without browser chrome
- [ ] The app shell loads with no connection
- [ ] A stored Chart can be Selected, read, advanced through and Repainted offline
- [ ] Attempting to parse with no connection gives a plain message saying parsing needs one
- [ ] No background-sync queue
