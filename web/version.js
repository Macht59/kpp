// Which release this shell is, for the foot of the page. A knitter reporting
// something from a phone that has had the app installed for months is reporting
// it about a version, and this is the only place either of them can read it.
//
// The literal is rewritten at image build (see the Dockerfile); `dev` is what
// local development and the tests see. `sw.js` declares its own copy in the same
// form — a service worker cannot import a module, and its own bytes are what a
// browser compares to notice a release — and one command stamps both, so they
// cannot come out of a build disagreeing.
export const VERSION = "dev";
