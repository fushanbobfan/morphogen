import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GrayScott } from '../src/grayscott.js';
import {
  PALETTES,
  DEFAULT_PALETTE_ID,
  paletteById,
  buildLut,
  CHANNELS,
  channelValue,
  paintField,
  defaultWindow,
} from '../src/render.js';

test('palettes have unique ids and stops that climb from 0 to 1', () => {
  const ids = new Set();
  for (const p of PALETTES) {
    assert.ok(!ids.has(p.id));
    ids.add(p.id);
    assert.equal(p.stops[0][0], 0);
    assert.equal(p.stops[p.stops.length - 1][0], 1);
    for (let i = 1; i < p.stops.length; i++) {
      assert.ok(p.stops[i][0] > p.stops[i - 1][0], `${p.id} stops must increase`);
    }
    for (const [, rgb] of p.stops) {
      assert.equal(rgb.length, 3);
      for (const c of rgb) assert.ok(c >= 0 && c <= 255);
    }
  }
  assert.ok(ids.has(DEFAULT_PALETTE_ID));
  assert.equal(paletteById('zzz'), null);
  assert.equal(paletteById('ember').name, 'Ember');
});

test('buildLut interpolates linearly between stops', () => {
  const lut = buildLut(
    [
      [0, [0, 0, 0]],
      [1, [255, 100, 0]],
    ],
    3
  );
  assert.deepEqual(Array.from(lut), [0, 0, 0, 128, 50, 0, 255, 100, 0]);
});

test('buildLut hits every stop colour exactly at its position', () => {
  const stops = [
    [0, [10, 20, 30]],
    [0.5, [200, 100, 50]],
    [1, [0, 0, 255]],
  ];
  const lut = buildLut(stops, 5);
  assert.deepEqual(Array.from(lut.slice(0, 3)), [10, 20, 30]);
  assert.deepEqual(Array.from(lut.slice(6, 9)), [200, 100, 50]);
  assert.deepEqual(Array.from(lut.slice(12, 15)), [0, 0, 255]);
});

test('buildLut rejects empty palettes and defaults to 256 entries', () => {
  assert.throws(() => buildLut([]), RangeError);
  assert.equal(buildLut([[0, [0, 0, 0]], [1, [1, 1, 1]]]).length, 256 * 3);
});

test('channelValue reads the requested field', () => {
  const g = new GrayScott(4, 4);
  g.a[5] = 0.7;
  g.b[5] = 0.2;
  assert.ok(Math.abs(channelValue(g, 5, 'a') - 0.7) < 1e-6);
  assert.ok(Math.abs(channelValue(g, 5, 'b') - 0.2) < 1e-6);
  assert.ok(Math.abs(channelValue(g, 5, 'difference') - 0.5) < 1e-6);
  assert.ok(CHANNELS.some((c) => c.id === 'difference'));
});

test('paintField maps the window onto the palette and clamps outside it', () => {
  const g = new GrayScott(3, 3);
  g.b[0] = 0;
  g.b[1] = 0.25;
  g.b[2] = 0.9;
  const lut = buildLut([[0, [0, 0, 0]], [1, [255, 255, 255]]]);
  const out = new Uint8ClampedArray(9 * 4);
  paintField(g, out, lut, { channel: 'b', lo: 0, hi: 0.5 });
  assert.deepEqual(Array.from(out.slice(0, 4)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(out.slice(4, 8)), [128, 128, 128, 255]);
  assert.deepEqual(Array.from(out.slice(8, 12)), [255, 255, 255, 255]);
});

test('paintField refuses a buffer that is too small', () => {
  const g = new GrayScott(4, 4);
  const lut = buildLut([[0, [0, 0, 0]], [1, [1, 1, 1]]]);
  assert.throws(() => paintField(g, new Uint8ClampedArray(10), lut), RangeError);
});

test('defaultWindow gives a sensible span per channel', () => {
  for (const c of CHANNELS) {
    const w = defaultWindow(c.id);
    assert.ok(w.hi > w.lo);
  }
  assert.deepEqual(defaultWindow('b'), { lo: 0, hi: 0.5 });
});
