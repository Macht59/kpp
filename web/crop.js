// Crop geometry, in image pixels. Pure — no DOM, no canvas.

/** The rectangle spanned by two points, clamped to the image, w and h never negative. */
export function rectFrom(anchor, point, bounds) {
  const left = clamp(Math.min(anchor.x, point.x), bounds.width);
  const right = clamp(Math.max(anchor.x, point.x), bounds.width);
  const top = clamp(Math.min(anchor.y, point.y), bounds.height);
  const bottom = clamp(Math.max(anchor.y, point.y), bounds.height);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * The rectangle on whole pixels. Edges are rounded, not position and size
 * separately: a rectangle dragged flush to the right edge must not round its
 * way one pixel outside the image, which the parser rejects.
 */
export function wholePixels({ x, y, w, h }) {
  const [left, top] = [Math.round(x), Math.round(y)];
  return { x: left, y: top, w: Math.round(x + w) - left, h: Math.round(y + h) - top };
}

/** The four corners, in drawing order. */
export function corners({ x, y, w, h }) {
  return [
    { x, y },
    { x: x + w, y },
    { x, y: y + h },
    { x: x + w, y: y + h },
  ];
}

/**
 * The corner opposite the one within `tolerance` of `point`, so dragging that
 * handle keeps the rest of the rectangle where the knitter put it. Null if the
 * touch landed on no handle.
 */
export function grabbedAnchor(rect, point, tolerance) {
  const away = (c) => Math.hypot(c.x - point.x, c.y - point.y);
  // nearest, not first: on a rectangle smaller than a fingertip several corners are in reach
  const [grabbed] = corners(rect).sort((a, b) => away(a) - away(b));
  if (away(grabbed) > tolerance) return null;
  return {
    x: grabbed.x === rect.x ? rect.x + rect.w : rect.x,
    y: grabbed.y === rect.y ? rect.y + rect.h : rect.y,
  };
}

const clamp = (value, limit) => Math.min(Math.max(value, 0), limit);
