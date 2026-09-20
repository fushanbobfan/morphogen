import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GrayScott, DEFAULT_PARAMS } from '../src/grayscott.js';

function finite(field) {
  for (let i = 0; i < field.length; i++) {
    if (!Number.isFinite(field[i])) return false;
  }
  return true;
}

test('starts as all A and no B with default parameters', () => {
  const g = new GrayScott(8, 6);
  assert.equal(g.width, 8);
  assert.equal(g.height, 6);
  assert.equal(g.a.length, 48);
  assert.ok(g.a.every((v) => v === 1));
  assert.ok(g.b.every((v) => v === 0));
  assert.deepEqual(g.params, { ...DEFAULT_PARAMS });
  assert.equal(g.steps, 0);
});

test('rejects grids too small for the stencil', () => {
  assert.throws(() => new GrayScott(2, 10), RangeError);
  assert.throws(() => new GrayScott(10, 2.5), RangeError);
});

test('the empty state is a fixed point', () => {
  const g = new GrayScott(16, 16);
  g.step(50);
  assert.ok(g.a.every((v) => v === 1));
  assert.ok(g.b.every((v) => v === 0));
  assert.equal(g.steps, 50);
});

test('seed sets B inside the disc and leaves the outside alone', () => {
  const g = new GrayScott(20, 20);
  g.seed(10, 10, 3);
  assert.equal(g.b[g.index(10, 10)], 1);
  assert.equal(g.a[g.index(10, 10)], 0.5);
  assert.equal(g.b[g.index(13, 10)], 1);
  assert.equal(g.b[g.index(14, 10)], 0);
  assert.equal(g.b[g.index(0, 0)], 0);
});

test('seed near the edge is clipped rather than wrapped', () => {
  const g = new GrayScott(20, 20);
  g.seed(0, 0, 3);
  assert.equal(g.b[g.index(0, 0)], 1);
  assert.equal(g.b[g.index(19, 19)], 0);
  assert.equal(g.b[g.index(19, 0)], 0);
});

test('erase restores the empty state inside the disc', () => {
  const g = new GrayScott(20, 20);
  g.seed(10, 10, 5);
  g.erase(10, 10, 2);
  assert.equal(g.b[g.index(10, 10)], 0);
  assert.equal(g.a[g.index(10, 10)], 1);
  assert.equal(g.b[g.index(10, 14)], 1);
});

test('paint can touch one component without the other', () => {
  const g = new GrayScott(10, 10);
  g.paint(5, 5, 1, { b: 0.25 });
  assert.equal(g.b[g.index(5, 5)], 0.25);
  assert.equal(g.a[g.index(5, 5)], 1);
});

test('scatter uses the supplied random source', () => {
  const g = new GrayScott(30, 30);
  const values = [0.5, 0.5, 0.1, 0.9];
  let i = 0;
  g.scatter(2, 2, () => values[i++ % values.length]);
  assert.equal(g.b[g.index(15, 15)], 1);
  assert.equal(g.b[g.index(3, 27)], 1);
  assert.equal(g.b[g.index(27, 3)], 0);
});

test('a seed spreads B into neighbouring cells', () => {
  const g = new GrayScott(32, 32);
  g.seed(16, 16, 3);
  const before = g.stats();
  g.step(100);
  const after = g.stats();
  assert.ok(after.coverage > before.coverage, 'pattern should grow from the seed');
  assert.ok(finite(g.a) && finite(g.b));
});

test('fields stay within [0, 1] under the default parameters', () => {
  const g = new GrayScott(40, 40);
  g.scatter(6, 3, mulberry32(7));
  g.step(300);
  for (let i = 0; i < g.a.length; i++) {
    assert.ok(g.a[i] >= 0 && g.a[i] <= 1);
    assert.ok(g.b[i] >= 0 && g.b[i] <= 1);
  }
});

test('diffusion is periodic across the grid edges', () => {
  const g = new GrayScott(24, 24, { feed: 0, kill: 0 });
  g.paint(0, 12, 0.5, { b: 1 });
  g.step(1);
  // The right-hand neighbour of column 0 wraps to column 23.
  assert.ok(g.b[g.index(23, 12)] > 0, 'B should leak across the left edge');
  assert.ok(g.b[g.index(1, 12)] > 0);
  assert.equal(g.b[g.index(23, 12)], g.b[g.index(1, 12)]);
});

test('a uniform field has no diffusive flux', () => {
  const g = new GrayScott(12, 12, { feed: 0, kill: 0, diffA: 1, diffB: 1 });
  g.a.fill(0.3);
  g.b.fill(0.4);
  g.step(1);
  // Only the reaction term acts: A loses A*B^2, B gains it.
  const reaction = 0.3 * 0.4 * 0.4;
  for (let i = 0; i < g.a.length; i++) {
    assert.ok(Math.abs(g.a[i] - (0.3 - reaction)) < 1e-6);
    assert.ok(Math.abs(g.b[i] - (0.4 + reaction)) < 1e-6);
  }
});

test('setParams changes the rates used on the next step', () => {
  const g = new GrayScott(10, 10);
  g.setParams({ feed: 0.1 });
  assert.equal(g.params.feed, 0.1);
  assert.equal(g.params.kill, DEFAULT_PARAMS.kill);
  // With B absent, A relaxes towards 1 at rate feed; start it low to see it.
  g.a.fill(0);
  g.step(1);
  assert.ok(Math.abs(g.a[0] - 0.1) < 1e-6);
});

test('clear resets fields and the step counter', () => {
  const g = new GrayScott(10, 10);
  g.seed(5, 5, 2);
  g.step(3);
  g.clear();
  assert.ok(g.b.every((v) => v === 0));
  assert.equal(g.steps, 0);
});

// Small deterministic PRNG for tests.
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
