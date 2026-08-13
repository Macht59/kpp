// node --test "web/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";

import { rectFrom, grabbedAnchor, wholePixels } from "./crop.js";

const BOUNDS = { width: 100, height: 80 };

test("a drag in any direction gives the same positive rectangle", () => {
  const forwards = rectFrom({ x: 10, y: 20 }, { x: 40, y: 60 }, BOUNDS);
  const backwards = rectFrom({ x: 40, y: 60 }, { x: 10, y: 20 }, BOUNDS);
  assert.deepEqual(forwards, { x: 10, y: 20, w: 30, h: 40 });
  assert.deepEqual(backwards, forwards);
});

test("a drag off the edge is clamped to the image", () => {
  assert.deepEqual(rectFrom({ x: 50, y: 40 }, { x: 999, y: -999 }, BOUNDS), {
    x: 50,
    y: 0,
    w: 50,
    h: 40,
  });
});

test("a rectangle flush to the edge stays inside the image once rounded", () => {
  const flush = rectFrom({ x: 50.4, y: 40.4 }, { x: 999, y: 999 }, BOUNDS);
  const whole = wholePixels(flush);
  assert.deepEqual(whole, { x: 50, y: 40, w: 50, h: 40 });
  assert.ok(whole.x + whole.w <= BOUNDS.width && whole.y + whole.h <= BOUNDS.height);
});

test("grabbing a corner anchors the drag to the opposite one", () => {
  const rect = { x: 10, y: 20, w: 30, h: 40 };
  assert.deepEqual(grabbedAnchor(rect, { x: 11, y: 21 }, 5), { x: 40, y: 60 });
  assert.deepEqual(grabbedAnchor(rect, { x: 40, y: 20 }, 5), { x: 10, y: 60 });
  assert.deepEqual(grabbedAnchor(rect, { x: 10, y: 60 }, 5), { x: 40, y: 20 });
  assert.deepEqual(grabbedAnchor(rect, { x: 40, y: 60 }, 5), { x: 10, y: 20 });
});

test("on a rectangle smaller than a fingertip the nearest corner wins", () => {
  const tiny = { x: 10, y: 10, w: 6, h: 6 };
  assert.deepEqual(grabbedAnchor(tiny, { x: 16, y: 16 }, 40), { x: 10, y: 10 });
});

test("a touch away from every corner grabs nothing", () => {
  assert.equal(grabbedAnchor({ x: 10, y: 20, w: 30, h: 40 }, { x: 25, y: 40 }, 5), null);
});
