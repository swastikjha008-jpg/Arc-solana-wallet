/**
 * Electric Gaze rendering engine (Canvas 2D). Framework-agnostic: no React, no server code.
 * Pipeline: background → cell sampling → glyph/geometry → colour → post-fx → lights → mask → animation.
 */
import {
  HEX_CHARS, MATRIX_CHARS, type AsciiConfig, type RenderMode,
} from "./config";
import {
  adjustColor, animationOffset, animationParams, applyToneCurve, clamp, coverRect, glyphIndex, glyphsFor,
  hash2, luminance, pickPixelRatio,
} from "./helpers";

type Img = CanvasImageSource & { width: number; height: number };

export interface EngineDeps {
  raf: (cb: FrameRequestCallback) => number;
  caf: (id: number) => void;
  now: () => number;
  createCanvas: () => HTMLCanvasElement;
  devicePixelRatio: () => number;
}

export interface AsciiEngine {
  setImage(img: Img | null): void;
  setReducedMotion(reduced: boolean): void;
  resize(cssWidth: number, cssHeight: number): void;
  renderFrame(timeSeconds: number): void;
  start(): void;
  stop(): void;
  destroy(): void;
  readonly running: boolean;
  readonly hasImage: boolean;
}

const FONT_STACK = "'Geist Mono','JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
const FRAME_INTERVAL_MS = 1000 / 30;
const SOLID_BG = "#05060a";
const GLYPH_MODES: ReadonlySet<RenderMode> = new Set(["characters", "dither", "hexdump", "braille", "halfblocks"]);

const defaultDeps = (): EngineDeps => ({
  raf: (cb) => window.requestAnimationFrame(cb),
  caf: (id) => window.cancelAnimationFrame(id),
  now: () => performance.now(),
  createCanvas: () => document.createElement("canvas"),
  devicePixelRatio: () => window.devicePixelRatio || 1,
});

export function createAsciiEngine(canvas: HTMLCanvasElement, config: AsciiConfig, partialDeps: Partial<EngineDeps> = {}): AsciiEngine {
  const deps: EngineDeps = { ...defaultDeps(), ...partialDeps };
  const ctx = canvas.getContext("2d");
  const layer = deps.createCanvas();
  const layerCtx = layer.getContext("2d");
  const sample = deps.createCanvas();
  const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
  const colorCanvas = deps.createCanvas();
  const colorCtx = colorCanvas.getContext("2d");
  const scratch = deps.createCanvas();
  const scratchCtx = scratch.getContext("2d");

  let image: Img | null = null;
  let maskImage: HTMLImageElement | null = null;
  let cssW = 0, cssH = 0, dpr = 1, cols = 0, rows = 0, cell = config.cellSize;
  let lum = new Float32Array(0);
  let colors = new Uint8ClampedArray(0);
  let edge = new Float32Array(0);
  let atlas: HTMLCanvasElement | null = null;
  let atlasKey = "";
  let matrixAtlas: HTMLCanvasElement | null = null;
  let rafId = 0;
  let running = false;
  let reduced = false;
  let destroyed = false;
  let lastFrame = 0;
  let startTime = 0;

  if (config.mask.enabled && config.mask.dataUrl && typeof Image !== "undefined") {
    const m = new Image();
    m.onload = () => { maskImage = m; };
    m.src = config.mask.dataUrl;
  }

  function buildAtlas(chars: string, tint: string | null): HTMLCanvasElement {
    const tile = Math.max(4, Math.ceil(cell * dpr));
    const a = deps.createCanvas();
    a.width = tile * chars.length;
    a.height = tile;
    const c = a.getContext("2d");
    if (!c) return a;
    c.fillStyle = tint ?? "#ffffff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `${Math.round(tile * 0.95)}px ${FONT_STACK}`;
    Array.from(chars).forEach((ch, i) => c.fillText(ch, i * tile + tile / 2, tile / 2 + tile * 0.04));
    return a;
  }

  function ensureAtlases(chars: string): void {
    const key = `${chars}|${cell}|${dpr}`;
    if (key !== atlasKey) {
      atlas = buildAtlas(chars, null);
      matrixAtlas = buildAtlas(MATRIX_CHARS, "#22ff77");
      atlasKey = key;
    }
  }

  function blurSample(): void {
    if (!sampleCtx || config.blurType === "off") return;
    const radius = Math.max(0, config.blurAmount / 10);
    if (radius <= 0) return;
    const snap = scratch;
    snap.width = cols; snap.height = rows;
    scratchCtx?.drawImage(sample, 0, 0);
    const draw = (filter: string, alpha = 1, dx = 0, dy = 0) => {
      sampleCtx.save();
      sampleCtx.globalAlpha = alpha;
      sampleCtx.filter = filter;
      sampleCtx.drawImage(snap, dx, dy);
      sampleCtx.restore();
    };
    if (config.blurType === "gaussian") {
      sampleCtx.clearRect(0, 0, cols, rows);
      draw(`blur(${radius}px)`);
      return;
    }
    if (config.blurType === "directional") {
      const steps = Math.max(2, Math.round(radius * 2));
      const ang = (config.blurAngle * Math.PI) / 180;
      sampleCtx.clearRect(0, 0, cols, rows);
      for (let i = 0; i < steps; i++) {
        const f = steps === 1 ? 0 : (i / (steps - 1) - (config.directionalBothSides ? 0.5 : 0)) * (config.directionalBothSides ? 2 : 1);
        draw("none", 1 / (i + 1), Math.cos(ang) * f * radius, Math.sin(ang) * f * radius);
      }
      return;
    }
    // progressive / tilt / lens: blend a blurred copy over the sharp one through a gradient mask.
    const blurred = deps.createCanvas();
    blurred.width = cols; blurred.height = rows;
    const bc = blurred.getContext("2d");
    if (!bc) return;
    bc.filter = `blur(${radius}px)`;
    bc.drawImage(snap, 0, 0);
    bc.filter = "none";
    bc.globalCompositeOperation = "destination-in";
    let g: CanvasGradient;
    if (config.blurType === "lens") {
      const cx = (config.blurCenterX / 100) * cols, cy = (config.blurCenterY / 100) * rows;
      const r = (config.lensFocus / 100) * Math.max(cols, rows) * 0.5;
      g = bc.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.4 + 1);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
    } else if (config.blurType === "tilt") {
      const p = config.tiltPosition / 100, f = config.tiltFocus / 200, fe = config.tiltFeather / 100;
      g = bc.createLinearGradient(0, 0, 0, rows);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(clamp(p - f - fe), "rgba(0,0,0,1)");
      g.addColorStop(clamp(p - f), "rgba(0,0,0,0)");
      g.addColorStop(clamp(p + f), "rgba(0,0,0,0)");
      g.addColorStop(clamp(p + f + fe), "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,1)");
    } else {
      const p = config.progressivePosition / 100;
      g = bc.createLinearGradient(0, 0, 0, rows);
      const a = config.progressiveReverse ? 1 : 0;
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(clamp(p), `rgba(0,0,0,${a})`);
      g.addColorStop(1, `rgba(0,0,0,${1 - a})`);
    }
    bc.fillStyle = g;
    bc.fillRect(0, 0, cols, rows);
    sampleCtx.drawImage(blurred, 0, 0);
  }

  function sampleImage(): void {
    if (!image || !sampleCtx || cols === 0 || rows === 0) return;
    sample.width = cols; sample.height = rows;
    sampleCtx.imageSmoothingEnabled = true;
    sampleCtx.imageSmoothingQuality = "high";
    const r = coverRect(image.width, image.height, cols, rows);
    sampleCtx.drawImage(image, r.x, r.y, r.w, r.h);
    blurSample();
    const data = sampleCtx.getImageData(0, 0, cols, rows).data;
    lum = new Float32Array(cols * rows);
    colors = new Uint8ClampedArray(cols * rows * 4);
    for (let i = 0; i < cols * rows; i++) {
      const [r2, g2, b2] = adjustColor([data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!], config);
      colors[i * 4] = r2; colors[i * 4 + 1] = g2; colors[i * 4 + 2] = b2; colors[i * 4 + 3] = 255;
      lum[i] = clamp(applyToneCurve(luminance(r2, g2, b2), config.toneCurve));
    }
    if (config.edgeEmphasis > 0) {
      edge = new Float32Array(cols * rows);
      const L = (x: number, y: number) => lum[clamp(y, 0, rows - 1) * cols + clamp(x, 0, cols - 1)]!;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const gx = -L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1) + L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1);
        const gy = -L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1) + L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1);
        edge[y * cols + x] = clamp(Math.hypot(gx, gy) / 4);
      }
    }
    colorCanvas.width = cols; colorCanvas.height = rows;
    colorCtx?.putImageData(new ImageData(colors, cols, rows), 0, 0);
  }

  function drawBackground(c: CanvasRenderingContext2D): void {
    if (config.bgMode === "none") return;
    c.save();
    c.globalAlpha = config.bgOpacity / 100;
    if (config.bgMode === "solid" || !image) {
      c.fillStyle = SOLID_BG;
      c.fillRect(0, 0, cssW, cssH);
    } else {
      const r = coverRect(image.width, image.height, cssW, cssH);
      if (config.bgMode === "blurred") c.filter = `blur(${config.bgBlur}px)`;
      c.drawImage(image, r.x, r.y, r.w, r.h);
    }
    c.restore();
  }

  function cellLum(cx: number, cy: number, t: number): number {
    const i = cy * cols + cx;
    let v = lum[i]!;
    if (config.edgeEmphasis > 0) v += edge[i]! * (config.edgeEmphasis / 100);
    return clamp(v + animationOffset(config, t, cx, cy, cols, rows));
  }

  function renderGlyphs(t: number): void {
    if (!layerCtx) return;
    const chars = glyphsFor(config);
    ensureAtlases(chars);
    if (!atlas) return;
    const tile = Math.max(4, Math.ceil(cell * dpr));
    const list = Array.from(chars);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      if (config.coverage < 100 && hash2(cx * 7 + 1, cy * 13 + 5) * 100 >= config.coverage) continue;
      const idx = glyphIndex(cellLum(cx, cy, t), list.length, config, cx, cy);
      if (list[idx] === " " || list[idx] === "⠀") continue;
      layerCtx.drawImage(atlas, idx * tile, 0, tile, tile, cx * cell, cy * cell, cell, cell);
    }
    // Colour the glyph alpha with the sampled (adjusted) colours.
    layerCtx.save();
    layerCtx.globalCompositeOperation = "source-in";
    layerCtx.imageSmoothingEnabled = false;
    layerCtx.drawImage(colorCanvas, 0, 0, cols, rows, 0, 0, cols * cell, rows * cell);
    layerCtx.restore();
  }

  function renderMatrix(t: number): void {
    if (!layerCtx) return;
    ensureAtlases(HEX_CHARS);
    if (!matrixAtlas) return;
    const tile = Math.max(4, Math.ceil(cell * dpr));
    const n = Array.from(MATRIX_CHARS).length;
    const { speed } = animationParams(config);
    const trail = Math.max(6, Math.round(rows * 0.45));
    for (let cx = 0; cx < cols; cx++) {
      const colSpeed = 0.6 + hash2(cx, 91) * 0.9;
      const head = ((t * speed * 9 * colSpeed + hash2(cx, 17) * (rows + trail)) % (rows + trail));
      for (let cy = 0; cy < rows; cy++) {
        const d = head - cy;
        if (d < 0 || d > trail) continue;
        const base = 1 - d / trail;
        const l = cellLum(cx, cy, 0);
        const alpha = clamp(base * (0.25 + 0.75 * (config.invert ? 1 - l : l)));
        if (alpha < 0.04) continue;
        const gi = Math.floor(hash2(cx, cy + Math.floor(t * 6)) * n);
        layerCtx.globalAlpha = alpha;
        layerCtx.drawImage(matrixAtlas, gi * tile, 0, tile, tile, cx * cell, cy * cell, cell, cell);
      }
    }
    layerCtx.globalAlpha = 1;
  }

  function shape(c: CanvasRenderingContext2D, mode: RenderMode, x: number, y: number, s: number, rgb: string, cx: number, cy: number, t: number, level: number): void {
    const m = cell / 2, mx = x + m, my = y + m, r = s * m;
    c.fillStyle = rgb; c.strokeStyle = rgb; c.lineWidth = Math.max(1, s * cell * 0.22);
    switch (mode) {
      case "mosaic": c.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1); break;
      case "pixel": c.fillRect(x, y, cell, cell); break;
      case "dots": c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill(); break;
      case "cross": c.beginPath(); c.moveTo(mx - r, my); c.lineTo(mx + r, my); c.moveTo(mx, my - r); c.lineTo(mx, my + r); c.stroke(); break;
      case "diamond": c.beginPath(); c.moveTo(mx, my - r); c.lineTo(mx + r, my); c.lineTo(mx, my + r); c.lineTo(mx - r, my); c.closePath(); c.fill(); break;
      case "voxel": {
        const h = r * 0.5;
        c.beginPath(); c.moveTo(mx, my - r); c.lineTo(mx + r, my - h); c.lineTo(mx, my); c.lineTo(mx - r, my - h); c.closePath(); c.globalAlpha = 1; c.fill();
        c.globalAlpha = 0.65; c.beginPath(); c.moveTo(mx - r, my - h); c.lineTo(mx, my); c.lineTo(mx, my + r); c.lineTo(mx - r, my + h); c.closePath(); c.fill();
        c.globalAlpha = 0.4; c.beginPath(); c.moveTo(mx + r, my - h); c.lineTo(mx, my); c.lineTo(mx, my + r); c.lineTo(mx + r, my + h); c.closePath(); c.fill();
        c.globalAlpha = 1; break;
      }
      case "lego": c.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1); c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.arc(mx, my, Math.max(1, r * 0.55), 0, Math.PI * 2); c.fill(); break;
      case "lines": c.beginPath(); c.moveTo(x, my); c.lineTo(x + cell, my); c.stroke(); break;
      case "diagonal": c.beginPath(); c.moveTo(x, y + cell); c.lineTo(x + cell, y); c.stroke(); break;
      case "disco": c.fillStyle = `hsl(${(cx * 7 + cy * 5 + t * 60) % 360} 90% 60%)`; c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill(); break;
      case "rings": c.lineWidth = Math.max(1, cell * 0.12); c.beginPath(); c.arc(mx, my, Math.max(0.5, r), 0, Math.PI * 2); c.stroke(); break;
      case "hearts": {
        const k = r; c.beginPath(); c.moveTo(mx, my + k * 0.9);
        c.bezierCurveTo(mx - k * 1.4, my - k * 0.1, mx - k * 0.6, my - k * 1.1, mx, my - k * 0.35);
        c.bezierCurveTo(mx + k * 0.6, my - k * 1.1, mx + k * 1.4, my - k * 0.1, mx, my + k * 0.9); c.fill(); break;
      }
      case "stars": {
        c.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; c.lineTo(mx + Math.cos(a) * rr, my + Math.sin(a) * rr); }
        c.closePath(); c.fill(); break;
      }
      case "hexagons": {
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; c.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); }
        c.closePath(); c.fill(); break;
      }
      case "triangles": c.beginPath(); c.moveTo(mx, my - r); c.lineTo(mx + r, my + r * 0.8); c.lineTo(mx - r, my + r * 0.8); c.closePath(); c.fill(); break;
      case "bubbles":
        c.globalAlpha = 0.8; c.lineWidth = Math.max(1, cell * 0.1); c.beginPath(); c.arc(mx, my, Math.max(0.5, r), 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 0.9; c.fillStyle = "#fff"; c.beginPath(); c.arc(mx - r * 0.35, my - r * 0.35, Math.max(0.5, r * 0.18), 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; break;
      case "hatch":
        c.lineWidth = 1; c.beginPath();
        if (s > 0.25) { c.moveTo(x, y + cell); c.lineTo(x + cell, y); }
        if (s > 0.5) { c.moveTo(x, y); c.lineTo(x + cell, y + cell); }
        if (s > 0.75) { c.moveTo(x, my); c.lineTo(x + cell, my); }
        c.stroke(); break;
      case "contour": {
        const right = cx + 1 < cols ? Math.floor(cellLum(cx + 1, cy, t) * 8) : level;
        const below = cy + 1 < rows ? Math.floor(cellLum(cx, cy + 1, t) * 8) : level;
        c.lineWidth = 1; c.beginPath();
        if (right !== level) { c.moveTo(x + cell, y); c.lineTo(x + cell, y + cell); }
        if (below !== level) { c.moveTo(x, y + cell); c.lineTo(x + cell, y + cell); }
        c.stroke(); break;
      }
      default: break;
    }
  }

  function renderShapes(t: number): void {
    if (!layerCtx) return;
    const mixedPool: RenderMode[] = ["dots", "cross", "diamond", "mosaic"];
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      if (config.coverage < 100 && hash2(cx * 7 + 1, cy * 13 + 5) * 100 >= config.coverage) continue;
      const l = cellLum(cx, cy, t);
      const s = config.invert ? 1 - l : l;
      if (s < 0.04) continue;
      const i = (cy * cols + cx) * 4;
      const rgb = `rgb(${colors[i]},${colors[i + 1]},${colors[i + 2]})`;
      const mode = config.renderMode === "mixed" ? mixedPool[Math.floor(hash2(cx, cy) * mixedPool.length)]! : config.renderMode;
      shape(layerCtx, mode, cx * cell, cy * cell, s, rgb, cx, cy, t, Math.floor(l * 8));
    }
  }

  function post(c: CanvasRenderingContext2D, t: number): void {
    const p = config.pfx;
    const frame = Math.floor(t * 24);
    if (p.pixelate.enabled) {
      const f = Math.max(2, Math.round(p.pixelate.intensity / 4));
      scratch.width = Math.max(1, Math.floor(cssW / f)); scratch.height = Math.max(1, Math.floor(cssH / f));
      scratchCtx?.drawImage(canvas, 0, 0, scratch.width, scratch.height);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvas.width, canvas.height);
      c.drawImage(scratch, 0, 0, canvas.width, canvas.height); c.restore();
    }
    if (p.bloom.enabled) {
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = p.bloom.intensity / 100; c.filter = `blur(${4 + p.bloom.intensity / 8}px)`;
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(canvas, 0, 0); c.restore();
    }
    if (p.chromatic.enabled) {
      const off = Math.max(1, Math.round(p.chromatic.intensity / 8));
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5;
      c.drawImage(canvas, -off * dpr, 0); c.drawImage(canvas, off * dpr, 0); c.restore();
    }
    if (p.glitch.enabled && hash2(frame, 3) < p.glitch.intensity / 100) {
      for (let k = 0; k < 3; k++) {
        const sy = Math.floor(hash2(frame, k + 10) * cssH), sh = 4 + Math.floor(hash2(frame, k + 20) * 20), dx = (hash2(frame, k + 30) - 0.5) * 40;
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(canvas, 0, sy * dpr, canvas.width, sh * dpr, dx * dpr, sy * dpr, canvas.width, sh * dpr); c.restore();
      }
    }
    if (p.halftone.enabled) {
      const step = 6; c.save(); c.globalCompositeOperation = "destination-out"; c.fillStyle = `rgba(0,0,0,${p.halftone.intensity / 100})`;
      for (let y = 0; y < cssH; y += step) for (let x = 0; x < cssW; x += step) { c.beginPath(); c.arc(x + (((y / step) & 1) ? step / 2 : 0), y, 1.2, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    if (p.scanLines.enabled) { c.save(); c.fillStyle = `rgba(0,0,0,${p.scanLines.intensity / 200})`; for (let y = 0; y < cssH; y += 3) c.fillRect(0, y, cssW, 1); c.restore(); }
    if (p.vignette.enabled) {
      c.save(); const g = c.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.3, cssW / 2, cssH / 2, Math.hypot(cssW, cssH) / 2);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${p.vignette.intensity / 100})`); c.fillStyle = g; c.fillRect(0, 0, cssW, cssH); c.restore();
    }
    if (p.filmGrain.enabled) {
      c.save(); c.globalAlpha = p.filmGrain.intensity / 400; c.fillStyle = "#fff";
      for (let i = 0; i < 600; i++) c.fillRect(hash2(frame, i) * cssW, hash2(i, frame + 7) * cssH, 1, 1); c.restore();
    }
    if (p.filmDust.enabled) {
      c.save(); c.globalAlpha = p.filmDust.intensity / 150; c.fillStyle = "#fff";
      for (let i = 0; i < 20; i++) { const x = hash2(Math.floor(t * 3), i) * cssW, y = hash2(i, Math.floor(t * 3) + 50) * cssH; c.fillRect(x, y, 1 + hash2(i, 9) * 2, 1 + hash2(9, i) * 2); }
      c.restore();
    }
  }

  function lighting(c: CanvasRenderingContext2D): void {
    if (!config.lights.enabled) return;
    c.save(); c.globalCompositeOperation = "lighter";
    for (const pt of config.lights.points) {
      const x = pt.x * cssW, y = pt.y * cssH, r = pt.radius * Math.max(cssW, cssH);
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
      g.addColorStop(0, `rgba(255,255,255,${clamp(pt.intensity)})`); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, cssW, cssH);
    }
    c.restore();
  }

  function revealMask(c: CanvasRenderingContext2D): void {
    if (!config.mask.enabled || !maskImage || !image) return;
    const t = deps.createCanvas(); t.width = canvas.width; t.height = canvas.height;
    const tc = t.getContext("2d"); if (!tc) return;
    tc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = coverRect(image.width, image.height, cssW, cssH);
    tc.drawImage(image, r.x, r.y, r.w, r.h);
    tc.globalCompositeOperation = config.mask.invert ? "destination-out" : "destination-in";
    tc.drawImage(maskImage, 0, 0, cssW, cssH);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(t, 0, 0); c.restore();
  }

  function renderFrame(t: number): void {
    if (destroyed || !ctx || !layerCtx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layerCtx.clearRect(0, 0, cssW, cssH);
    if (!image || lum.length === 0) return; // graceful fallback: transparent canvas, foreground stays usable
    drawBackground(ctx);
    if (config.renderMode === "matrix") renderMatrix(t);
    else if (GLYPH_MODES.has(config.renderMode)) renderGlyphs(t);
    else renderShapes(t);
    ctx.save();
    ctx.globalCompositeOperation = config.styleBlend;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    post(ctx, t);
    lighting(ctx);
    revealMask(ctx);
  }

  function loop(ts: number): void {
    if (!running || destroyed) return;
    rafId = deps.raf(loop);
    if (ts - lastFrame < FRAME_INTERVAL_MS) return;
    lastFrame = ts;
    renderFrame((ts - startTime) / 1000);
  }

  return {
    setImage(img) {
      image = img;
      sampleImage();
      renderFrame(0);
    },
    setReducedMotion(r) {
      reduced = r;
      if (running && r) { deps.caf(rafId); running = false; }
      renderFrame(0);
    },
    resize(w, h) {
      if (destroyed || w <= 0 || h <= 0) return;
      cssW = w; cssH = h;
      dpr = pickPixelRatio(w, h, deps.devicePixelRatio());
      cell = config.cellSize;
      cols = Math.ceil(w / cell); rows = Math.ceil(h / cell);
      for (const c of [canvas, layer]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      sampleImage();
      renderFrame(0);
    },
    renderFrame,
    start() {
      // No source image (yet): nothing to animate, so never spin an empty frame loop.
      if (running || destroyed || !image) return;
      if (reduced || !config.animated) { renderFrame(0); return; }
      running = true; startTime = deps.now(); lastFrame = 0;
      rafId = deps.raf(loop);
    },
    stop() {
      if (running) deps.caf(rafId);
      running = false;
    },
    destroy() {
      if (running) deps.caf(rafId);
      running = false; destroyed = true;
      for (const c of [layer, sample, colorCanvas, scratch]) { c.width = 0; c.height = 0; }
      atlas = null; matrixAtlas = null; image = null; maskImage = null;
    },
    get running() { return running; },
    get hasImage() { return image !== null; },
  };
}
