// Colour mapping from a chemical field to RGBA pixels.
//
// A palette is a list of colour stops along [0, 1]; buildLut samples it into
// a 256-entry table so painting is a lookup per cell rather than an
// interpolation. Contrast windows let the same table stretch over whatever
// range of B a regime actually produces (spots peak near 0.4, worms near 0.5).

export const PALETTES = [
  {
    id: 'ink',
    name: 'Ink on paper',
    stops: [
      [0, [246, 242, 232]],
      [0.15, [214, 208, 194]],
      [0.5, [92, 84, 78]],
      [1, [24, 20, 22]],
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    stops: [
      [0, [7, 16, 38]],
      [0.3, [16, 72, 128]],
      [0.6, [32, 170, 190]],
      [0.85, [190, 240, 220]],
      [1, [255, 255, 255]],
    ],
  },
  {
    id: 'ember',
    name: 'Ember',
    stops: [
      [0, [12, 8, 16]],
      [0.3, [110, 20, 40]],
      [0.6, [230, 90, 30]],
      [0.85, [255, 210, 90]],
      [1, [255, 250, 220]],
    ],
  },
  {
    id: 'moss',
    name: 'Moss',
    stops: [
      [0, [16, 24, 16]],
      [0.35, [40, 90, 50]],
      [0.7, [140, 190, 90]],
      [1, [240, 250, 200]],
    ],
  },
  {
    id: 'grey',
    name: 'Greyscale',
    stops: [
      [0, [0, 0, 0]],
      [1, [255, 255, 255]],
    ],
  },
];

export const DEFAULT_PALETTE_ID = 'ocean';

export function paletteById(id) {
  return PALETTES.find((p) => p.id === id) || null;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Sample a stop list into a flat RGB table with `size` entries.
export function buildLut(stops, size = 256) {
  if (!Array.isArray(stops) || stops.length === 0) throw new RangeError('palette needs at least one stop');
  const lut = new Uint8ClampedArray(size * 3);
  for (let i = 0; i < size; i++) {
    const t = size === 1 ? 0 : i / (size - 1);
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        lo = stops[s];
        hi = stops[s + 1];
        break;
      }
    }
    const span = hi[0] - lo[0];
    const u = span > 0 ? (t - lo[0]) / span : 0;
    lut[i * 3] = Math.round(lerp(lo[1][0], hi[1][0], u));
    lut[i * 3 + 1] = Math.round(lerp(lo[1][1], hi[1][1], u));
    lut[i * 3 + 2] = Math.round(lerp(lo[1][2], hi[1][2], u));
  }
  return lut;
}

// Which number each cell shows. `difference` (A minus B) is the classic
// reaction-diffusion look: B-rich cells read as dark ridges on a light ground.
export const CHANNELS = [
  { id: 'b', name: 'B (activator)' },
  { id: 'a', name: 'A (substrate)' },
  { id: 'difference', name: 'A − B' },
];

export function channelValue(grid, i, channel) {
  switch (channel) {
    case 'a':
      return grid.a[i];
    case 'difference':
      return grid.a[i] - grid.b[i];
    default:
      return grid.b[i];
  }
}

// Write RGBA pixels for the grid into `out` (a Uint8ClampedArray of length
// width*height*4). Values from `lo` to `hi` span the whole palette; anything
// outside is clamped to the ends.
export function paintField(grid, out, lut, { channel = 'b', lo = 0, hi = 1 } = {}) {
  const n = grid.width * grid.height;
  if (out.length < n * 4) throw new RangeError('output buffer too small');
  const size = lut.length / 3;
  const scale = hi > lo ? (size - 1) / (hi - lo) : 0;
  for (let i = 0; i < n; i++) {
    let idx = Math.round((channelValue(grid, i, channel) - lo) * scale);
    if (idx < 0) idx = 0;
    else if (idx > size - 1) idx = size - 1;
    const o = i * 4;
    const l = idx * 3;
    out[o] = lut[l];
    out[o + 1] = lut[l + 1];
    out[o + 2] = lut[l + 2];
    out[o + 3] = 255;
  }
  return out;
}

// Sensible contrast windows per channel: B rarely climbs above ~0.5, so
// stretching it to the palette's end keeps the picture from looking washed out.
export function defaultWindow(channel) {
  switch (channel) {
    case 'a':
      return { lo: 0.2, hi: 1 };
    case 'difference':
      return { lo: -0.2, hi: 1 };
    default:
      return { lo: 0, hi: 0.5 };
  }
}
