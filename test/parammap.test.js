import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_RANGE, rateToPixel, pixelToRate, mapDistance, nearestPreset, snapRate } from '../src/parammap.js';
import { PRESETS } from '../src/presets.js';

const W = 201;
const H = 101;

test('map corners land on the range extremes', () => {
  assert.deepEqual(rateToPixel({ feed: MAP_RANGE.feed.min, kill: MAP_RANGE.kill.min }, W, H), { x: 0, y: H - 1 });
  assert.deepEqual(rateToPixel({ feed: MAP_RANGE.feed.max, kill: MAP_RANGE.kill.max }, W, H), { x: W - 1, y: 0 });
});

test('feed increases upward and kill increases rightward', () => {
  const low = rateToPixel({ feed: 0.02, kill: 0.05 }, W, H);
  const moreFeed = rateToPixel({ feed: 0.06, kill: 0.05 }, W, H);
  const moreKill = rateToPixel({ feed: 0.02, kill: 0.07 }, W, H);
  assert.ok(moreFeed.y < low.y);
  assert.equal(moreFeed.x, low.x);
  assert.ok(moreKill.x > low.x);
  assert.equal(moreKill.y, low.y);
});

test('rateToPixel and pixelToRate are inverses inside the range', () => {
  for (const feed of [0.01, 0.037, 0.09]) {
    for (const kill of [0.045, 0.06, 0.072]) {
      const px = rateToPixel({ feed, kill }, W, H);
      const back = pixelToRate(px, W, H);
      assert.ok(Math.abs(back.feed - feed) < 1e-9, `feed ${feed}`);
      assert.ok(Math.abs(back.kill - kill) < 1e-9, `kill ${kill}`);
    }
  }
});

test('out-of-range rates and pixels clamp to the map edge', () => {
  assert.deepEqual(rateToPixel({ feed: 1, kill: -1 }, W, H), { x: 0, y: 0 });
  const r = pixelToRate({ x: -50, y: 10 * H }, W, H);
  assert.equal(r.kill, MAP_RANGE.kill.min);
  assert.equal(r.feed, MAP_RANGE.feed.min);
});

test('mapDistance is symmetric and zero on itself', () => {
  const a = { feed: 0.03, kill: 0.06 };
  const b = { feed: 0.05, kill: 0.05 };
  assert.equal(mapDistance(a, a), 0);
  assert.equal(mapDistance(a, b), mapDistance(b, a));
  assert.ok(mapDistance(a, b) > 0);
});

test('every preset is its own nearest preset', () => {
  for (const p of PRESETS) {
    assert.equal(nearestPreset({ feed: p.feed, kill: p.kill }, PRESETS), p);
  }
});

test('nearestPreset returns null far from every preset', () => {
  assert.equal(nearestPreset({ feed: 0.105, kill: 0.041 }, PRESETS), null);
  assert.equal(nearestPreset({ feed: 0.03, kill: 0.06 }, []), null);
});

test('nearestPreset honours a custom radius', () => {
  const p = PRESETS[0];
  const nearby = { feed: p.feed + 0.001, kill: p.kill };
  assert.equal(nearestPreset(nearby, PRESETS, 0.001), null);
  assert.equal(nearestPreset(nearby, PRESETS, 0.5), p);
});

test('snapRate rounds to the slider step', () => {
  assert.ok(Math.abs(snapRate(0.03723) - 0.037) < 1e-12);
  assert.ok(Math.abs(snapRate(0.03727) - 0.0375) < 1e-12);
  assert.ok(Math.abs(snapRate(0.061, 0.001) - 0.061) < 1e-12);
});
