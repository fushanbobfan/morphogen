import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GrayScott } from '../src/grayscott.js';
import { PRESETS, DEFAULT_PRESET_ID, presetById, applyLayout, applyPreset } from '../src/presets.js';

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

test('presets have unique ids and complete fields', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.equal(typeof p.name, 'string');
    assert.ok(p.description.length > 20);
    assert.ok(['few', 'many', 'blobs'].includes(p.layout));
    // The interesting part of the Pearson map.
    assert.ok(p.feed > 0.005 && p.feed < 0.11, `${p.id} feed out of range`);
    assert.ok(p.kill > 0.04 && p.kill < 0.075, `${p.id} kill out of range`);
  }
  assert.ok(ids.has(DEFAULT_PRESET_ID));
});

test('presetById finds presets and returns null otherwise', () => {
  assert.equal(presetById('coral').name, 'Coral');
  assert.equal(presetById('nope'), null);
});

test('each layout seeds some B and nothing else', () => {
  for (const layout of ['few', 'many', 'blobs']) {
    const g = new GrayScott(60, 40);
    applyLayout(g, layout, mulberry32(1));
    const s = g.stats();
    assert.ok(s.coverage > 0, `${layout} should seed B`);
    assert.ok(s.coverage < 0.5, `${layout} should not flood the grid`);
    assert.equal(g.steps, 0);
  }
});

test('layouts are reproducible with a seeded random source', () => {
  const g1 = new GrayScott(50, 50);
  const g2 = new GrayScott(50, 50);
  applyLayout(g1, 'blobs', mulberry32(9));
  applyLayout(g2, 'blobs', mulberry32(9));
  assert.deepEqual(Array.from(g1.b), Array.from(g2.b));
});

test('unknown layouts are rejected', () => {
  assert.throws(() => applyLayout(new GrayScott(10, 10), 'spiral'), /unknown layout/);
});

test('applyPreset sets the rates and seeds the grid', () => {
  const g = new GrayScott(40, 40);
  applyPreset(g, presetById('worms'), mulberry32(3));
  assert.equal(g.params.feed, 0.078);
  assert.equal(g.params.kill, 0.061);
  assert.ok(g.stats().coverage > 0);
});

test('every preset keeps a pattern alive on a small grid', () => {
  for (const p of PRESETS) {
    const g = new GrayScott(128, 96);
    applyPreset(g, p, mulberry32(11));
    // Some regimes (holes especially) pass through near-uniform moments, so
    // look for structure at any of several checkpoints rather than one.
    let structured = false;
    let s;
    for (let i = 0; i < 3; i++) {
      g.step(500);
      s = g.stats();
      assert.ok(Number.isFinite(s.meanB), `${p.id} produced non-finite values`);
      if (s.maxB - s.minB > 0.1) structured = true;
    }
    assert.ok(s.coverage > 0.005, `${p.id} died out (coverage ${s.coverage})`);
    assert.ok(structured, `${p.id} never formed a pattern`);
  }
});
