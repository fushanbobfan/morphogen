// Named regions of the Gray–Scott feed/kill plane. The pairs come from the
// widely reproduced Pearson parameter map (with Da = 1, Db = 0.5, dt = 1);
// each one is a place where the model does something visibly different.
//
// `layout` says how to seed the grid so the pattern gets going: a few discs
// for patterns that grow outward, many small ones for patterns that need to
// interact, and a handful of broad blobs for the low-feed regimes, where a
// small or sparse seed starves before it can do anything.

export const PRESETS = [
  {
    id: 'mitosis',
    name: 'Mitosis',
    feed: 0.0367,
    kill: 0.0649,
    layout: 'many',
    description: 'Spots that swell and pinch in two, over and over, until the plane is tiled with cells.',
  },
  {
    id: 'coral',
    name: 'Coral',
    feed: 0.0545,
    kill: 0.062,
    layout: 'few',
    description: 'Branching, brain-like ridges that grow outward from each seed and fill the space.',
  },
  {
    id: 'fingerprint',
    name: 'Fingerprint',
    feed: 0.037,
    kill: 0.06,
    layout: 'few',
    description: 'Wandering stripes that flow around each other like the ridges of a fingerprint.',
  },
  {
    id: 'solitons',
    name: 'Solitons',
    feed: 0.03,
    kill: 0.062,
    layout: 'many',
    description: 'Stable spots that hold their shape and drift apart, then settle into a lattice.',
  },
  {
    id: 'pulsing',
    name: 'Pulsating solitons',
    feed: 0.025,
    kill: 0.06,
    layout: 'many',
    description: 'Spots that breathe: they swell, shrink and occasionally split.',
  },
  {
    id: 'worms',
    name: 'Worms',
    feed: 0.078,
    kill: 0.061,
    layout: 'many',
    description: 'Short segments that crawl, bend and grow from their tips.',
  },
  {
    id: 'maze',
    name: 'Maze',
    feed: 0.029,
    kill: 0.057,
    layout: 'few',
    description: 'Labyrinthine stripes that branch until the plane is one connected corridor.',
  },
  {
    id: 'holes',
    name: 'Chaos and holes',
    feed: 0.026,
    kill: 0.051,
    layout: 'blobs',
    description: 'Sheets of B punctured by holes that open, close and wander.',
  },
  {
    id: 'chaos',
    name: 'Chaos',
    feed: 0.026,
    kill: 0.055,
    layout: 'blobs',
    description: 'Spots and stripes that never settle: shapes form, collide and dissolve.',
  },
  {
    id: 'moving',
    name: 'Moving spots',
    feed: 0.014,
    kill: 0.054,
    layout: 'blobs',
    description: 'Restless blobs that glide across the plane and annihilate when they meet.',
  },
  {
    id: 'loops',
    name: 'Spots and loops',
    feed: 0.018,
    kill: 0.051,
    layout: 'blobs',
    description: 'Rings that expand from spots and break into new spots where they touch.',
  },
  {
    id: 'uskate',
    name: 'U-skate world',
    feed: 0.062,
    kill: 0.06093,
    layout: 'few',
    description: 'Tim Hutton\'s glider region: U-shaped bodies that skate slowly in a straight line.',
  },
];

export const DEFAULT_PRESET_ID = 'fingerprint';

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

// Seed a fresh grid the way a preset wants. `random` lets callers make the
// result reproducible.
export function applyLayout(grid, layout, random = Math.random) {
  grid.clear();
  const { width, height } = grid;
  const r = Math.max(2, Math.round(Math.min(width, height) / 40));
  switch (layout) {
    case 'few': {
      grid.seed(width / 2, height / 2, r * 2);
      grid.seed(width * 0.25, height * 0.3, r);
      grid.seed(width * 0.75, height * 0.7, r);
      break;
    }
    case 'many': {
      grid.scatter(Math.round((width * height) / 900), r, random);
      break;
    }
    case 'blobs': {
      // Radius 8 is about the largest disc that survives at feed rates near
      // 0.014; bigger ones hollow out and collapse, smaller ones fade.
      grid.scatter(Math.max(6, Math.round((width * height) / 6000)), 8, random);
      break;
    }
    default:
      throw new Error(`unknown layout: ${layout}`);
  }
}

export function applyPreset(grid, preset, random = Math.random) {
  grid.setParams({ feed: preset.feed, kill: preset.kill });
  applyLayout(grid, preset.layout, random);
}
