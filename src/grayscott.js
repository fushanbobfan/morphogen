// Gray–Scott reaction–diffusion on a periodic grid.
//
// Two chemicals live in every cell: A is fed in at a constant rate and B eats
// it (A + 2B -> 3B), while B is removed at the kill rate. Both diffuse, A
// faster than B. With the right feed/kill pair the interplay of local
// activation and longer-range inhibition produces the spots, stripes and
// blobs the model is known for.
//
//   dA/dt = Da * lap(A) - A*B*B + f * (1 - A)
//   dB/dt = Db * lap(B) + A*B*B - (k + f) * B
//
// Fields are Float32Arrays in row-major order; (0, 0) is the top-left cell.

export const DEFAULT_PARAMS = Object.freeze({
  feed: 0.037,
  kill: 0.06,
  diffA: 1.0,
  diffB: 0.5,
  dt: 1.0,
});

// 3x3 Laplacian stencil: -1 centre, 0.2 for the four edge neighbours, 0.05
// for the four corners. Weights sum to zero so a uniform field has no flux.
const EDGE = 0.2;
const CORNER = 0.05;

export class GrayScott {
  constructor(width, height, params = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) {
      throw new RangeError('grid must be at least 3x3');
    }
    this.width = width;
    this.height = height;
    this.params = { ...DEFAULT_PARAMS, ...params };
    const n = width * height;
    this.a = new Float32Array(n);
    this.b = new Float32Array(n);
    this.nextA = new Float32Array(n);
    this.nextB = new Float32Array(n);
    // Wrapped neighbour columns, computed once per row sweep instead of per cell.
    this.left = new Int32Array(width);
    this.right = new Int32Array(width);
    for (let x = 0; x < width; x++) {
      this.left[x] = (x + width - 1) % width;
      this.right[x] = (x + 1) % width;
    }
    this.steps = 0;
    this.clear();
  }

  index(x, y) {
    return y * this.width + x;
  }

  // Reset to the trivial steady state: all A, no B.
  clear() {
    this.a.fill(1);
    this.b.fill(0);
    this.steps = 0;
  }

  setParams(params) {
    Object.assign(this.params, params);
  }

  // Set A and B inside a disc. Either component may be omitted to leave it
  // untouched, which lets the same call seed B or wipe an area back to A.
  paint(cx, cy, radius, { a, b } = {}) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = this.index(x, y);
        if (a !== undefined) this.a[i] = a;
        if (b !== undefined) this.b[i] = b;
      }
    }
  }

  // Drop a blob of B: the usual way to start a pattern growing.
  seed(cx, cy, radius = 4) {
    this.paint(cx, cy, radius, { a: 0.5, b: 1 });
  }

  // Wipe a disc back to the empty state.
  erase(cx, cy, radius = 4) {
    this.paint(cx, cy, radius, { a: 1, b: 0 });
  }

  // Scatter `count` seeds using a supplied random source (defaults to Math.random)
  // so callers can make deterministic layouts.
  scatter(count, radius = 3, random = Math.random) {
    for (let i = 0; i < count; i++) {
      this.seed(random() * this.width, random() * this.height, radius);
    }
  }

  // Advance the system by `n` explicit Euler steps.
  step(n = 1) {
    const { width, height, a, b, nextA, nextB, left, right } = this;
    const { feed, kill, diffA, diffB, dt } = this.params;
    const decay = kill + feed;
    for (let s = 0; s < n; s++) {
      for (let y = 0; y < height; y++) {
        const row = y * width;
        const up = ((y + height - 1) % height) * width;
        const down = ((y + 1) % height) * width;
        for (let x = 0; x < width; x++) {
          const i = row + x;
          const xl = left[x];
          const xr = right[x];
          const av = a[i];
          const bv = b[i];
          const lapA =
            EDGE * (a[row + xl] + a[row + xr] + a[up + x] + a[down + x]) +
            CORNER * (a[up + xl] + a[up + xr] + a[down + xl] + a[down + xr]) -
            av;
          const lapB =
            EDGE * (b[row + xl] + b[row + xr] + b[up + x] + b[down + x]) +
            CORNER * (b[up + xl] + b[up + xr] + b[down + xl] + b[down + xr]) -
            bv;
          const reaction = av * bv * bv;
          let na = av + (diffA * lapA - reaction + feed * (1 - av)) * dt;
          let nb = bv + (diffB * lapB + reaction - decay * bv) * dt;
          // Explicit Euler can overshoot for large dt; clamping keeps the
          // fields physical instead of letting NaNs spread.
          if (na < 0) na = 0; else if (na > 1) na = 1;
          if (nb < 0) nb = 0; else if (nb > 1) nb = 1;
          nextA[i] = na;
          nextB[i] = nb;
        }
      }
      a.set(nextA);
      b.set(nextB);
      this.steps++;
    }
  }

  // Summary numbers for status displays and tests.
  stats() {
    const { b } = this;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let covered = 0;
    for (let i = 0; i < b.length; i++) {
      const v = b[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      if (v > 0.1) covered++;
    }
    return {
      minB: min,
      maxB: max,
      meanB: sum / b.length,
      // Fraction of cells where B is present in a visible amount.
      coverage: covered / b.length,
    };
  }
}
