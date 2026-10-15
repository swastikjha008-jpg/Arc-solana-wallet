/** Pure helpers for the ASCII renderer (no DOM access, unit-testable). */
import { CHAR_SETS, BRAILLE_CHARS, HALFBLOCK_CHARS, HEX_CHARS, type AsciiConfig, type CurvePoint, type OverlayBlend } from "./config";

export const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);

export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Deterministic hash in [0,1) from integer coordinates. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] as number) / 16;
}

export function applyToneCurve(v: number, curve: CurvePoint[]): number {
  if (curve.length < 2) return v;
  const pts = [...curve].sort((a, b) => a.x - b.x);
  const first = pts[0] as CurvePoint;
  const last = pts[pts.length - 1] as CurvePoint;
  if (v <= first.x) return first.y;
  if (v >= last.x) return last.y;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as CurvePoint;
    const b = pts[i] as CurvePoint;
    if (v <= b.x) {
      const t = (v - a.x) / Math.max(1e-6, b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return last.y;
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blendChannel(base: number, top: number, mode: OverlayBlend): number {
  const b = base / 255;
  const t = top / 255;
  switch (mode) {
    case "multiply": return b * t * 255;
    case "screen": return (1 - (1 - b) * (1 - t)) * 255;
    case "overlay": return (b < 0.5 ? 2 * b * t : 1 - 2 * (1 - b) * (1 - t)) * 255;
    default: return top;
  }
}

/** Stage 4 colour adjustments in the order required by the spec (blur is applied on the sample canvas). */
export function adjustColor(rgb: [number, number, number], cfg: AsciiConfig): [number, number, number] {
  let [r, g, b] = rgb;
  const br = (cfg.brightness / 100) * 255;
  r += br; g += br; b += br;
  const c = cfg.contrast / 100;
  r = (r - 128) * c + 128; g = (g - 128) * c + 128; b = (b - 128) * c + 128;
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = cfg.saturation / 100;
  r = gray + (r - gray) * sat; g = gray + (g - gray) * sat; b = gray + (b - gray) * sat;
  const gs = cfg.grayscale / 100;
  if (gs > 0) {
    const g2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r += (g2 - r) * gs; g += (g2 - g) * gs; b += (g2 - b) * gs;
  }
  const to = cfg.tintOpacity / 100;
  if (to > 0) {
    const [tr, tg, tb] = parseHex(cfg.tint);
    r += (blendChannel(r, tr, cfg.overlayBlend) - r) * to;
    g += (blendChannel(g, tg, cfg.overlayBlend) - g) * to;
    b += (blendChannel(b, tb, cfg.overlayBlend) - b) * to;
  }
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}

export function glyphsFor(cfg: AsciiConfig): string {
  switch (cfg.renderMode) {
    case "hexdump": return HEX_CHARS;
    case "braille": return BRAILLE_CHARS;
    case "halfblocks": return HALFBLOCK_CHARS;
    default: {
      if (cfg.charSet === "custom") return cfg.customChars.length >= 2 ? cfg.customChars : CHAR_SETS.standard;
      return CHAR_SETS[cfg.charSet];
    }
  }
}

/** Select a glyph index for a luminance value, with ordered dither for "dither" mode. */
export function glyphIndex(lum: number, count: number, cfg: AsciiConfig, cx: number, cy: number): number {
  const l = cfg.invert ? 1 - lum : lum;
  let v = l * (count - 1);
  if (cfg.renderMode === "dither") v += (bayer(cx, cy) - 0.5) * (cfg.density / 100) * 2;
  return Math.max(0, Math.min(count - 1, Math.round(v)));
}

export interface AnimParams { speed: number; amplitude: number }

export function animationParams(cfg: AsciiConfig): AnimParams {
  return {
    speed: cfg.animSpeed.enabled ? cfg.animSpeed.intensity / 100 : 1,
    amplitude: cfg.animIntensity.enabled ? cfg.animIntensity.intensity / 100 : 1,
  };
}

/** Luminance offset in about [-0.3, 0.3] for the active animation style. */
export function animationOffset(cfg: AsciiConfig, t: number, cx: number, cy: number, cols: number, rows: number): number {
  if (!cfg.animated) return 0;
  const { speed, amplitude } = animationParams(cfg);
  const time = t * speed;
  const amp = amplitude * 0.3;
  switch (cfg.animStyle) {
    case "wave": return Math.sin((cx / cols) * Math.PI * 4 + time * 2) * amp;
    case "pulse": return Math.sin(time * 2) * amp;
    case "shimmer": return Math.sin(time * 3 + hash2(cx, cy) * Math.PI * 2) * amp;
    case "ripple": {
      const dx = cx - cols / 2;
      const dy = cy - rows / 2;
      return Math.sin(Math.hypot(dx, dy) * 0.35 - time * 3) * amp;
    }
    case "flicker": return (hash2(cx + Math.floor(time * 12), cy) - 0.5) * 2 * amp;
  }
}

/** Fits a source of (sw, sh) into (dw, dh) preserving aspect ratio ("cover"). */
export function coverRect(sw: number, sh: number, dw: number, dh: number): { x: number; y: number; w: number; h: number } {
  const s = Math.max(dw / sw, dh / sh);
  const w = sw * s;
  const h = sh * s;
  return { x: (dw - w) / 2, y: (dh - h) / 2, w, h };
}

/** Caps the backing-store scale so very large screens do not cost excessive fill-rate. */
export function pickPixelRatio(cssW: number, cssH: number, devicePixelRatio: number, maxPixels = 2_600_000, maxDpr = 2): number {
  let dpr = Math.min(Math.max(devicePixelRatio || 1, 1), maxDpr);
  while (dpr > 1 && cssW * dpr * cssH * dpr > maxPixels) dpr -= 0.25;
  return Math.max(1, dpr);
}
