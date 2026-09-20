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
  DEFAULT_LIGHT,
  lightVector,
  reliefFactors,
  applyShading,
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

test('lightVector points down-and-across for the default light and straight down at 90 degrees', () => {
  const l = lightVector();
  assert.ok(Math.abs(Math.hypot(l.x, l.y, l.z) - 1) < 1e-9, 'unit length');
  assert.ok(l.x < 0 && l.y < 0 && l.z > 0, 'north-west, above the surface');
  const overhead = lightVector(0, 90);
  assert.ok(Math.abs(overhead.z - 1) < 1e-9);
  assert.ok(Math.abs(overhead.x) < 1e-9 && Math.abs(overhead.y) < 1e-9);
  assert.equal(DEFAULT_LIGHT.azimuth, 315);
});

test('a flat field shades to exactly 1 everywhere', () => {
  const g = new GrayScott(6, 5);
  g.b.fill(0.3);
  const out = reliefFactors(g, new Float32Array(30));
  for (const f of out) assert.ok(Math.abs(f - 1) < 1e-6);
});

test('slopes facing the light brighten and slopes facing away darken', () => {
  // A ridge in B along column 4. Its east flank faces east, its west flank faces west.
  const g = new GrayScott(9, 3);
  for (let y = 0; y < 3; y++) g.b[g.index(4, y)] = 1;
  const light = lightVector(90, 45); // from the right (east)
  const out = reliefFactors(g, new Float32Array(27), { light });
  const west = out[g.index(3, 1)];
  const east = out[g.index(5, 1)];
  assert.ok(east > 1, `east flank should brighten, got ${east}`);
  assert.ok(west < 1, `west flank should darken, got ${west}`);
  assert.ok(Math.abs(out[g.index(0, 1)] - 1) < 1e-6, 'flat cells unchanged');
});

test('relief and strength scale the effect, and the buffer is checked', () => {
  const g = new GrayScott(9, 3);
  for (let y = 0; y < 3; y++) g.b[g.index(4, y)] = 1;
  // The east flank faces away from the default north-west light, so it only gets darker
  // as the ridge gets steeper; factors never go below zero.
  const mild = reliefFactors(g, new Float32Array(27), { relief: 2 })[g.index(5, 1)];
  const steep = reliefFactors(g, new Float32Array(27), { relief: 20 })[g.index(5, 1)];
  const weak = reliefFactors(g, new Float32Array(27), { relief: 20, strength: 0.25 })[g.index(5, 1)];
  assert.ok(steep < mild && mild < 1);
  assert.ok(steep >= 0);
  assert.ok(weak > steep);
  assert.throws(() => reliefFactors(g, new Float32Array(5)), RangeError);
});

test('applyShading scales RGB, clamps through the typed array and leaves alpha alone', () => {
  const pixels = new Uint8ClampedArray([100, 200, 50, 255, 100, 100, 100, 255]);
  applyShading(pixels, [1.5, 0.5], 2);
  assert.deepEqual(Array.from(pixels), [150, 255, 75, 255, 50, 50, 50, 255]);
});
