import assert from 'node:assert/strict';
import { AsciiField, DEFAULTS } from '../renderer.js';

// This synthetic patch supplies the original source aspect ratio and bounds.
// The compressed real logo, source colors and shape remain tested in renderer.test.mjs.
const logoPixels = { width: 449, height: 445, data: new Uint8ClampedArray(449 * 445 * 4) };
const textPixels = { width: 1290, height: 250, data: new Uint8ClampedArray(1290 * 250 * 4) };
for(let y=35;y<215;y++)for(let x=40;x<1250;x++)if(x%258<50)textPixels.data.set([0,133,204,255],(y*1290+x)*4);
for (let y = 180; y < 265; y++) for (let x = 180; x < 269; x++) {
  logoPixels.data.set([0, 133, 204, 255], (y * logoPixels.width + x) * 4);
}
let nextId = 1, callbacks = new Map(), dimensions = { width: 1440, height: 900 };
const listeners = {};
let samples = new Map(), backgroundCells = new Map(), backgroundGlyphs = new Map(), fontStage = 0;
let backgroundId = -1, previousAnchor = null;
globalThis.requestAnimationFrame = fn => { const id = nextId++; callbacks.set(id, fn); return id; };
globalThis.cancelAnimationFrame = id => callbacks.delete(id);
globalThis.window = { devicePixelRatio: 3, addEventListener() {}, removeEventListener() {} };
globalThis.document = {
  hidden: false,
  addEventListener(name, fn) { listeners[name] = fn; }, removeEventListener() {},
  createElement() { return { width: 0, height: 0, getContext() { return { drawImage() {} }; } }; }
};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.IntersectionObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
const context = {
  setTransform() {}, fillRect() { fontStage = 0; }, drawImage() {},
  set font(value) { this.fontValue = value; fontStage++; }, get font() { return this.fontValue; },
  fillText(char, x, y) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    assert.equal(char.length, 1);
    const key = [char, x, y].join('|'), alpha = this.globalAlpha ?? 1;
    samples.set(key, (samples.get(key) || 0) + alpha);
    // Classify by the actual paint layer, not font size or numeric weight.
    // Foreground glyphs may be bold and larger without becoming background.
    if (fontStage === 1) {
      if(!previousAnchor||previousAnchor.x!==x||previousAnchor.y!==y)backgroundId++;
      previousAnchor={x,y};
      const cell = String(backgroundId), identity = [backgroundId,char].join('|');
      backgroundCells.set(cell, (backgroundCells.get(cell) || 0) + alpha);
      backgroundGlyphs.set(identity, (backgroundGlyphs.get(identity) || 0) + alpha);
    }
  }
};
const canvas = {
  getContext(type) { assert.equal(type, '2d'); return context; },
  getBoundingClientRect() { return { ...dimensions, left: 0, top: 0 }; },
  parentElement: { addEventListener() {}, removeEventListener() {} }
};
const field = new AsciiField(canvas, { logoPixels, textPixels });
function frame(seconds) {
  samples = new Map(); backgroundCells = new Map(); backgroundGlyphs = new Map();
  backgroundId=-1;previousAnchor=null;
  field.time = seconds; field.render();
  return { all: samples, cells: backgroundCells, glyphs: backgroundGlyphs };
}
function difference(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let massA = 0, massB = 0, absolute = 0, maximum = 0, visible = 0;
  for (const key of keys) {
    const x = a.get(key) || 0, y = b.get(key) || 0, delta = Math.abs(x - y);
    massA += x; massB += y; absolute += delta; maximum = Math.max(maximum, delta);
    if (delta >= .008) visible++;
  }
  return { relativeL1: absolute / ((massA + massB) / 2), visibleFraction: visible / keys.size, maximum };
}
for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
  dimensions = { width, height }; field.resize();
  const base = frame(60), two = difference(base.cells, frame(62).cells), five = difference(base.cells, frame(65).cells);
  const label = `${width}x${height}`;
  assert.equal(base.cells.size, Math.ceil(width / field.cell) * Math.ceil(height / field.row), 'flow captures every background cell and excludes logo');
  // Sum crossfade glyph weights per cell to measure broad flow, not glyph swaps.
  // Stable row-major identities isolate true opacity changes from physical motion.
  assert.ok(two.relativeL1 >= .35, `${label}: sufficient background flow over 2s (${two.relativeL1})`);
  assert.ok(two.visibleFraction >= .20, `${label}: at least 20% of cells change alpha by .008 over 2s (${two.visibleFraction})`);
  assert.ok(five.relativeL1 >= .55, `${label}: sustained background flow over 5s (${five.relativeL1})`);
  assert.ok(five.visibleFraction >= .30, `${label}: at least 30% of cells change alpha by .008 over 5s (${five.visibleFraction})`);
  const checkpoints = [0, 8, 19.8, 20, 42, 100, 115.8, 132, 560];
  for (let seconds = 0; seconds <= 5; seconds += .1) checkpoints.push(seconds);
  for (let seconds = 132; seconds <= 137; seconds += .5) checkpoints.push(seconds);
  let maximum = 0;
  for (const seconds of checkpoints) {
    // The accepted Vector controls normalize 45 wall seconds to 115.8 shader
    // seconds. Preserve its .01 canonical-phase bound; report wall-rate maxima
    // separately rather than disguising a speed multiplier as a discontinuity.
    const wall=seconds*45/115.8, previous = frame(wall), current = frame(wall + 45 / 115.8 / 30);
    const delta = difference(previous.glyphs, current.glyphs).maximum;
    maximum = Math.max(maximum, delta);
    assert.ok(delta < .01, `${label}: no canonical background opacity jumps at ${seconds}s (${delta})`);
  }
  console.log(`Flow ${label}: 2s L1=${two.relativeL1.toFixed(3)}, changed=${two.visibleFraction.toFixed(3)}; 5s L1=${five.relativeL1.toFixed(3)}, changed=${five.visibleFraction.toFixed(3)}; max background frame alpha=${maximum.toFixed(5)}`);
}

let clock = 1000;
function advanceFrame(now) {
  assert.equal(callbacks.size, 1);
  const [id, callback] = callbacks.entries().next().value;
  callbacks.delete(id); callback(now);
  assert.equal(callbacks.size, 1, 'only one RAF is pending');
}
function expectFrozen(stop, resume, label) {
  const time = field.time, fade = field.replayElapsed, frames = field.frameCount;
  stop(); assert.equal(callbacks.size, 0, `${label} cancels RAF`);
  field.tick(clock + 5000);
  assert.equal(field.time, time, `${label} freezes the animation clock`);
  assert.equal(field.replayElapsed, fade, `${label} freezes replay dissolve`);
  assert.equal(field.frameCount, frames, `${label} does not draw`);
  resume(); clock += 6000; advanceFrame(clock);
  assert.equal(field.time, time, `${label} resumes without elapsed-time catch-up`);
  assert.equal(field.replayElapsed, fade, `${label} fade resumes without a jump`);
  clock += 1000 / 30; advanceFrame(clock);
  assert.ok(Math.abs(field.time - time - 1 / 30) < 1e-12, `${label} continues normal frame time`);
}
field.time = 100; field.replay();
assert.ok(field.replaySnapshot); assert.equal(field.replayElapsed, 0); assert.equal(field.time, 0);
advanceFrame(clock); clock += 1000 / 30; advanceFrame(clock);
expectFrozen(() => field.setPaused(true), () => field.setPaused(false), 'pause');
expectFrozen(() => { document.hidden = true; listeners.visibilitychange(); }, () => { document.hidden = false; listeners.visibilitychange(); }, 'hidden tab');
expectFrozen(() => field.intersection.fn([{ isIntersecting: false }]), () => field.intersection.fn([{ isIntersecting: true }]), 'offscreen');
field.setReduced(true);
assert.equal(field.replaySnapshot, null); assert.equal(callbacks.size, 0);
const still = frame(0); field.pointer = { x: 8, y: -6 };
const laterStill = frame(900);
assert.deepEqual(laterStill.all, still.all, 'reduced motion draws a stable fully revealed composition');
assert.deepEqual(laterStill.cells, still.cells, 'reduced motion stops the background');
const reducedTime = field.time, reducedFrames = field.frameCount;
field.tick(clock + 10000); field.replay();
assert.equal(field.time, reducedTime, 'reduced motion ignores tick and replay');
assert.equal(field.frameCount, reducedFrames); assert.equal(callbacks.size, 0);
field.setReduced(false); const beforeResume = field.time;
clock += 10000; advanceFrame(clock);
assert.equal(field.time, beforeResume, 'deliberately enabling motion does not catch up frozen time');
field.replay(); clock += 1000 / 30; advanceFrame(clock);
for (let i = 0; i < 200; i++) { clock += 1000 / 30; advanceFrame(clock); }
assert.equal(field.replaySnapshot, null, 'replay releases its snapshot after the dissolve');
assert.ok(field.time > DEFAULTS.replayFadeSeconds);
field.destroy(); assert.equal(callbacks.size, 0);

document.hidden = true;
const hiddenStart = new AsciiField(canvas, { logoPixels, textPixels });
assert.equal(hiddenStart.visible, false, 'initial hidden document starts suspended');
assert.equal(callbacks.size, 0, 'hidden startup does not schedule RAF');
hiddenStart.tick(clock + 10000); assert.equal(hiddenStart.time, 0);
document.hidden = false; listeners.visibilitychange(); assert.equal(callbacks.size, 1);
clock += 20000;
const [id, callback] = callbacks.entries().next().value;
callbacks.delete(id); callback(clock);
assert.equal(hiddenStart.time, 0, 'first visible startup frame does not catch up');
hiddenStart.destroy(); assert.equal(callbacks.size, 0);
console.log('PASS: perceptible background flow after reveal; .01 background frame-opacity bound; pause/offscreen/visibility clocks; hidden startup; dissolve replay; reduced-motion stillness.');
