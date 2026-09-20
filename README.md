# morphogen

An interactive reaction-diffusion pattern lab in the browser. Paint a few
seeds, tune the feed and kill rates of the Gray–Scott model, and watch spots,
stripes, corals, worms and cell-like blobs grow, split and die.

**Live demo:** https://fushanbobfan.github.io/morphogen/

Runs with no build step and no dependencies. The solver, presets, colour
mapping and parameter-map geometry are plain ES modules covered by a Node
test suite; only the page glue touches the DOM.

## Quick start

Open `index.html` in a browser, or serve the folder:

```bash
npm run serve
# then visit http://localhost:8080
```

The dev server is a ~40-line dependency-free static file server; any other
static server works too.

## What you can do

| Tool | Effect |
| --- | --- |
| Paint B | Click or drag to drop blobs of the activator chemical |
| Erase | Click or drag to wipe an area back to the empty state |

| Control | Effect |
| --- | --- |
| Regime | Load one of twelve named feed/kill pairs with a matching seed layout (see below) |
| Feed rate *f* | How fast A is replenished everywhere |
| Kill rate *k* | How fast B is removed |
| Feed/kill map | The whole parameter plane: click or drag to try any pair, arrow keys nudge it (Shift for bigger steps); dots mark the named regimes |
| Speed | Simulation steps per animation frame |
| Brush size | Radius of the paint and erase brushes, in cells |
| Palette | Colour ramp |
| Show | Which quantity is drawn: B, A, or A − B |
| Relief shading | Light the field as a height map so spots and ridges look embossed |
| Light direction | Compass bearing the light comes from, 0° at the top and clockwise |
| Relief height | How tall the pattern is treated as: higher exaggerates the edges |
| Pause / Step | Freeze the field, or advance it a single step |
| Reseed | Wipe the field and lay down the current regime's seeds again |
| Clear | Wipe the field to the empty state (then paint your own seeds) |
| Save image | Download the field as a PNG, upscaled 3× |

Changing the rates never resets the field, so a pattern mid-growth reacts to
the new rules: drag from **Coral** toward **Mitosis** and watch the ridges
break into cells.

Keyboard: <kbd>Space</kbd> pause, <kbd>.</kbd> step, <kbd>R</kbd> reseed,
<kbd>C</kbd> clear, <kbd>P</kbd> next palette, <kbd>H</kbd> relief shading, <kbd>S</kbd> save image,
<kbd>1</kbd>/<kbd>2</kbd> pick a tool, arrow keys on the map nudge the rates.

### Regimes

The named pairs follow the widely reproduced map of the Gray–Scott plane
(Pearson 1993, and later parameter surveys):

- **Mitosis** – spots that swell and pinch in two until the plane is tiled.
- **Coral** – branching, brain-like ridges that fill the space.
- **Fingerprint** – wandering stripes that flow around each other.
- **Solitons** – stable spots that settle into a lattice.
- **Pulsating solitons** – spots that breathe and occasionally split.
- **Worms** – short segments that crawl and grow from their tips.
- **Maze** – labyrinthine stripes that branch into one connected corridor.
- **Chaos and holes** – sheets of B punctured by wandering holes.
- **Chaos** – spots and stripes that never settle.
- **Moving spots** – restless blobs that glide and annihilate when they meet.
- **Spots and loops** – rings that expand and break into new spots.
- **U-skate world** – Tim Hutton's glider region: U-shaped bodies that skate
  slowly in a straight line.

Each regime also chooses how the grid is seeded: a few discs for patterns that
grow outward, many small discs for patterns that need neighbours to interact
with, and a handful of broad blobs for the low-feed regimes, where a small or
sparse seed starves before it can do anything.

## How it works

Two chemicals share every cell of a 320 × 240 periodic grid. A is fed in at
rate *f*, B converts A into more of itself (A + 2B → 3B) and is removed at
rate *k*, and both diffuse, A twice as fast as B:

```
dA/dt = Da ∇²A − A·B² + f (1 − A)
dB/dt = Db ∇²B + A·B² − (k + f) B
```

with `Da = 1`, `Db = 0.5` and a time step of 1. The Laplacian uses the
usual 3 × 3 stencil (−1 at the centre, 0.2 on the edges, 0.05 on the
corners), which is the convention the named feed/kill pairs assume. Both
fields are clamped to [0, 1] after each explicit Euler step so an aggressive
parameter change cannot blow the field up.

The mechanism behind the patterns: because A spreads faster than B, a blob of
B grows at its rim (where fresh A arrives) and starves in its middle (where
B has eaten the A). Whether that produces spots, stripes, mazes or dividing
cells depends on the balance of feed and kill, which is what the map lets you
explore.

Colours come from a palette of colour stops sampled into a 256-entry lookup
table; each channel has its own contrast window (B rarely climbs above 0.5,
so it is stretched to fill the palette).

Relief shading treats the drawn channel as a height map: each cell's slope
comes from central differences on the periodic grid, the surface normal is
lit with a single directional light (Lambert's cosine law), and the palette
colour is scaled by how the slope's brightness compares with flat ground.
Flat areas keep exactly their palette colour, so shading only changes the
edges of spots and stripes: the side facing the light brightens and the far
side falls into shadow.

## Project layout

```
index.html         page markup and controls
style.css          layout and theme
src/grayscott.js   GrayScott: grid, stepping, painting, stats
src/presets.js     named regimes and their seed layouts
src/render.js      palettes, lookup tables, channel selection, RGBA painting
src/parammap.js    feed/kill map geometry and nearest-regime lookup
src/main.js        DOM wiring, pointer tools, the map and the animation loop
test/              node --test suites for the solver, presets, renderer and map
scripts/serve.js   dependency-free static server for local development
```

## Development

```bash
npm test
```

## License

MIT
