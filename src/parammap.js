// The feed/kill plane as a clickable map.
//
// Pearson's map of the Gray–Scott model puts kill on the horizontal axis and
// feed on the vertical one, feed increasing upward. This module handles the
// geometry (rate <-> pixel), plus a nearest-preset lookup so a click can be
// labelled with the regime it landed closest to.

export const MAP_RANGE = Object.freeze({
  kill: { min: 0.04, max: 0.075 },
  feed: { min: 0.005, max: 0.11 },
});

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Pixel position of a (feed, kill) pair on a width x height map.
export function rateToPixel({ feed, kill }, width, height, range = MAP_RANGE) {
  const u = (kill - range.kill.min) / (range.kill.max - range.kill.min);
  const v = (feed - range.feed.min) / (range.feed.max - range.feed.min);
  return {
    x: clamp(u, 0, 1) * (width - 1),
    y: (1 - clamp(v, 0, 1)) * (height - 1),
  };
}

// The (feed, kill) pair under a pixel. Pixels outside the map clamp to its edge.
export function pixelToRate({ x, y }, width, height, range = MAP_RANGE) {
  const u = clamp(x / (width - 1), 0, 1);
  const v = 1 - clamp(y / (height - 1), 0, 1);
  return {
    kill: range.kill.min + u * (range.kill.max - range.kill.min),
    feed: range.feed.min + v * (range.feed.max - range.feed.min),
  };
}

// Distance in normalised map units, so a step in feed and a step in kill
// count the same on screen.
export function mapDistance(a, b, range = MAP_RANGE) {
  const dk = (a.kill - b.kill) / (range.kill.max - range.kill.min);
  const df = (a.feed - b.feed) / (range.feed.max - range.feed.min);
  return Math.hypot(dk, df);
}

// The preset nearest to a rate pair, or null if none is within `maxDistance`
// (normalised units; 0.05 is about a slider tick's worth in each direction).
export function nearestPreset(rates, presets, maxDistance = 0.05, range = MAP_RANGE) {
  let best = null;
  let bestDistance = Infinity;
  for (const preset of presets) {
    const d = mapDistance(rates, preset, range);
    if (d < bestDistance) {
      best = preset;
      bestDistance = d;
    }
  }
  return best && bestDistance <= maxDistance ? best : null;
}

// Round to the slider's resolution so map clicks and slider positions agree.
export function snapRate(v, step = 0.0005) {
  return Math.round(v / step) * step;
}
