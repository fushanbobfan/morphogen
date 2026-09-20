import { GrayScott } from './grayscott.js';
import { PRESETS, DEFAULT_PRESET_ID, presetById, applyPreset, applyLayout } from './presets.js';
import {
  PALETTES,
  DEFAULT_PALETTE_ID,
  paletteById,
  buildLut,
  CHANNELS,
  paintField,
  defaultWindow,
} from './render.js';
import { rateToPixel, pixelToRate, nearestPreset, snapRate } from './parammap.js';

const canvas = document.getElementById('dish');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const grid = new GrayScott(WIDTH, HEIGHT);
const image = ctx.createImageData(WIDTH, HEIGHT);

const ui = {
  preset: document.getElementById('preset'),
  presetDescription: document.getElementById('preset-description'),
  feed: document.getElementById('feed'),
  feedValue: document.getElementById('feed-value'),
  kill: document.getElementById('kill'),
  killValue: document.getElementById('kill-value'),
  steps: document.getElementById('steps'),
  stepsValue: document.getElementById('steps-value'),
  brush: document.getElementById('brush'),
  brushValue: document.getElementById('brush-value'),
  map: document.getElementById('map'),
  mapHint: document.getElementById('map-hint'),
  palette: document.getElementById('palette'),
  channel: document.getElementById('channel'),
  pause: document.getElementById('pause'),
  step: document.getElementById('step'),
  reseed: document.getElementById('reseed'),
  clear: document.getElementById('clear'),
  status: document.getElementById('status'),
  tools: Array.from(document.querySelectorAll('input[name="tool"]')),
};

const state = {
  presetId: DEFAULT_PRESET_ID,
  paletteId: DEFAULT_PALETTE_ID,
  channel: 'b',
  lut: null,
  stepsPerFrame: Number(ui.steps.value),
  brush: Number(ui.brush.value),
  paused: false,
  tool: 'seed',
  pointerDown: false,
};

// --- controls ---------------------------------------------------------------

function fillSelect(select, items, selectedId) {
  select.innerHTML = '';
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    if (item.id === selectedId) option.selected = true;
    select.append(option);
  }
}

function formatRate(v) {
  return Number(v).toFixed(4);
}

function syncRateInputs() {
  ui.feed.value = grid.params.feed;
  ui.kill.value = grid.params.kill;
  ui.feedValue.textContent = formatRate(grid.params.feed);
  ui.killValue.textContent = formatRate(grid.params.kill);
  drawMap();
}

function loadPreset(id) {
  const preset = presetById(id) || presetById(DEFAULT_PRESET_ID);
  state.presetId = preset.id;
  ui.preset.value = preset.id;
  ui.presetDescription.textContent = preset.description;
  applyPreset(grid, preset);
  syncRateInputs();
  ui.mapHint.textContent = 'Click anywhere to try that pair of rates. Dots are the named regimes.';
  draw();
}

function reseed() {
  const preset = presetById(state.presetId);
  applyLayout(grid, preset ? preset.layout : 'few');
  draw();
}

function setPalette(id) {
  const palette = paletteById(id) || paletteById(DEFAULT_PALETTE_ID);
  state.paletteId = palette.id;
  state.lut = buildLut(palette.stops);
  ui.palette.value = palette.id;
  draw();
}

function setPaused(paused) {
  state.paused = paused;
  ui.pause.textContent = paused ? 'Resume' : 'Pause';
  ui.pause.setAttribute('aria-pressed', String(paused));
}

fillSelect(ui.preset, PRESETS, state.presetId);
fillSelect(ui.palette, PALETTES, state.paletteId);
fillSelect(ui.channel, CHANNELS, state.channel);

ui.preset.addEventListener('change', () => loadPreset(ui.preset.value));
ui.palette.addEventListener('change', () => setPalette(ui.palette.value));
ui.channel.addEventListener('change', () => {
  state.channel = ui.channel.value;
  draw();
});

// Dragging a rate slider keeps the current field and just changes the rules,
// which is the fun part: a pattern mid-growth reacts to the new regime.
ui.feed.addEventListener('input', () => {
  setRates({ feed: Number(ui.feed.value) });
});
ui.kill.addEventListener('input', () => {
  setRates({ kill: Number(ui.kill.value) });
});

// Change the rates in place (the field keeps evolving under the new rules)
// and keep the sliders, map and regime label in step.
function setRates(rates) {
  grid.setParams(rates);
  syncRateInputs();
  const near = nearestPreset(grid.params, PRESETS);
  ui.mapHint.textContent = near
    ? `Near ${near.name}. Click anywhere to try that pair of rates.`
    : 'Uncharted territory: not near any named regime. Click anywhere to try that pair of rates.';
}
ui.steps.addEventListener('input', () => {
  state.stepsPerFrame = Number(ui.steps.value);
  ui.stepsValue.textContent = ui.steps.value;
});
ui.brush.addEventListener('input', () => {
  state.brush = Number(ui.brush.value);
  ui.brushValue.textContent = ui.brush.value;
});

ui.pause.addEventListener('click', () => setPaused(!state.paused));
ui.step.addEventListener('click', () => {
  setPaused(true);
  grid.step(1);
  draw();
});
ui.reseed.addEventListener('click', reseed);
ui.clear.addEventListener('click', () => {
  grid.clear();
  draw();
});

for (const input of ui.tools) {
  input.addEventListener('change', () => {
    if (input.checked) state.tool = input.value;
  });
}

function selectTool(value) {
  const input = ui.tools.find((t) => t.value === value);
  if (!input) return;
  input.checked = true;
  state.tool = value;
}

// --- painting ---------------------------------------------------------------

function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

function paintAt(event) {
  const { x, y } = cellFromEvent(event);
  if (state.tool === 'erase') grid.erase(x, y, state.brush);
  else grid.seed(x, y, state.brush);
  if (state.paused) draw();
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  state.pointerDown = true;
  canvas.setPointerCapture(event.pointerId);
  paintAt(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (state.pointerDown) paintAt(event);
});
function releasePointer() {
  state.pointerDown = false;
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);

// --- feed/kill map ------------------------------------------------------------

const mapCtx = ui.map.getContext('2d');

function drawMap() {
  const w = ui.map.width;
  const h = ui.map.height;
  mapCtx.clearRect(0, 0, w, h);

  // Faint grid every 0.005 in kill and 0.01 in feed.
  mapCtx.strokeStyle = 'rgba(155, 176, 181, 0.15)';
  mapCtx.lineWidth = 1;
  for (let k = 0.04; k <= 0.0751; k += 0.005) {
    const { x } = rateToPixel({ feed: 0.005, kill: k }, w, h);
    mapCtx.beginPath();
    mapCtx.moveTo(x + 0.5, 0);
    mapCtx.lineTo(x + 0.5, h);
    mapCtx.stroke();
  }
  for (let f = 0.01; f <= 0.111; f += 0.01) {
    const { y } = rateToPixel({ feed: f, kill: 0.04 }, w, h);
    mapCtx.beginPath();
    mapCtx.moveTo(0, y + 0.5);
    mapCtx.lineTo(w, y + 0.5);
    mapCtx.stroke();
  }

  mapCtx.fillStyle = 'rgba(155, 176, 181, 0.8)';
  mapCtx.font = '11px system-ui, sans-serif';
  mapCtx.textBaseline = 'bottom';
  mapCtx.fillText('kill →', w - 36, h - 3);
  mapCtx.textBaseline = 'top';
  mapCtx.fillText('feed ↑', 4, 3);

  // Named regimes.
  for (const p of PRESETS) {
    const { x, y } = rateToPixel(p, w, h);
    mapCtx.beginPath();
    mapCtx.arc(x, y, 3, 0, Math.PI * 2);
    mapCtx.fillStyle = p.id === state.presetId ? '#9af0e3' : 'rgba(95, 211, 196, 0.6)';
    mapCtx.fill();
  }

  // Current rates.
  const { x, y } = rateToPixel(grid.params, w, h);
  mapCtx.beginPath();
  mapCtx.arc(x, y, 6, 0, Math.PI * 2);
  mapCtx.strokeStyle = '#ffd166';
  mapCtx.lineWidth = 2;
  mapCtx.stroke();
}

function mapRatesFromEvent(event) {
  const rect = ui.map.getBoundingClientRect();
  const px = {
    x: ((event.clientX - rect.left) / rect.width) * ui.map.width,
    y: ((event.clientY - rect.top) / rect.height) * ui.map.height,
  };
  const r = pixelToRate(px, ui.map.width, ui.map.height);
  return { feed: snapRate(r.feed), kill: snapRate(r.kill) };
}

let mapDragging = false;
ui.map.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  mapDragging = true;
  ui.map.setPointerCapture(event.pointerId);
  setRates(mapRatesFromEvent(event));
});
ui.map.addEventListener('pointermove', (event) => {
  if (mapDragging) setRates(mapRatesFromEvent(event));
});
ui.map.addEventListener('pointerup', () => {
  mapDragging = false;
});
ui.map.addEventListener('lostpointercapture', () => {
  mapDragging = false;
});
ui.map.addEventListener('keydown', (event) => {
  const step = Number(ui.feed.step);
  const nudge = { ArrowUp: { feed: step }, ArrowDown: { feed: -step }, ArrowRight: { kill: step }, ArrowLeft: { kill: -step } }[event.key];
  if (!nudge) return;
  event.preventDefault();
  const scale = event.shiftKey ? 10 : 1;
  setRates({
    feed: snapRate(Math.min(Number(ui.feed.max), Math.max(Number(ui.feed.min), grid.params.feed + (nudge.feed || 0) * scale))),
    kill: snapRate(Math.min(Number(ui.kill.max), Math.max(Number(ui.kill.min), grid.params.kill + (nudge.kill || 0) * scale))),
  });
});

// --- keyboard ---------------------------------------------------------------

window.addEventListener('keydown', (event) => {
  const tag = event.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  switch (event.key) {
    case ' ':
      event.preventDefault();
      setPaused(!state.paused);
      break;
    case '.':
      setPaused(true);
      grid.step(1);
      draw();
      break;
    case 'r':
    case 'R':
      reseed();
      break;
    case 'c':
    case 'C':
      grid.clear();
      draw();
      break;
    case 'p':
    case 'P': {
      const i = PALETTES.findIndex((p) => p.id === state.paletteId);
      setPalette(PALETTES[(i + 1) % PALETTES.length].id);
      break;
    }
    case '1':
      selectTool('seed');
      break;
    case '2':
      selectTool('erase');
      break;
    default:
      return;
  }
});

// --- drawing and the loop ----------------------------------------------------

function draw() {
  paintField(grid, image.data, state.lut, { channel: state.channel, ...defaultWindow(state.channel) });
  ctx.putImageData(image, 0, 0);
}

let lastStatus = 0;
function updateStatus(now) {
  if (now - lastStatus < 250) return;
  lastStatus = now;
  const s = grid.stats();
  ui.status.textContent =
    `step ${grid.steps.toLocaleString()} · B covers ${(s.coverage * 100).toFixed(1)}%` +
    (state.paused ? ' · paused' : '');
}

function frame(now) {
  if (!state.paused) {
    grid.step(state.stepsPerFrame);
    draw();
  }
  updateStatus(now);
  requestAnimationFrame(frame);
}

setPalette(state.paletteId);
loadPreset(state.presetId);
requestAnimationFrame(frame);
