import { describe, expect, it, vi } from "vitest";
import { ELECTRIC_GAZE_CONFIG, RENDER_MODES } from "@/components/ascii/config";
import { adjustColor, animationOffset, applyToneCurve, coverRect, glyphIndex, glyphsFor, pickPixelRatio } from "@/components/ascii/helpers";
import { createAsciiEngine, type EngineDeps } from "@/components/ascii/engine";

describe("Electric Gaze configuration (exact values from the build prompt)", () => {
  it("matches the supplied configuration", () => {
    const c = ELECTRIC_GAZE_CONFIG;
    expect(c).toMatchObject({
      renderMode: "dither", bgMode: "none", bgBlur: 12, bgOpacity: 90, cellSize: 9, coverage: 100, invert: false,
      styleBlend: "source-over", charSet: "standard", customChars: "", brightness: 0, contrast: 158, edgeEmphasis: 0, density: 20,
      tint: "#3ca6ff", tintOpacity: 0, overlayBlend: "multiply", saturation: 100, grayscale: 0, blurType: "off", blurAmount: 35,
      blurAngle: 0, directionalBothSides: false, tiltFocus: 35, tiltPosition: 50, tiltFeather: 15, lensFocus: 40, blurCenterX: 50,
      blurCenterY: 50, progressivePosition: 55, progressiveReverse: false, animated: true, animStyle: "shimmer",
    });
    expect(c.toneCurve).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(c.animSpeed).toEqual({ enabled: true, intensity: 100 });
    expect(c.animIntensity).toEqual({ enabled: true, intensity: 60 });
    expect(c.lights).toEqual({ enabled: false, points: [] });
    expect(c.mask).toEqual({ enabled: false, tool: "freehand", brushSize: 30, showOverlay: false, invert: false, dataUrl: null, shapes: [] });
  });
  it("has every post effect present and disabled with the specified intensity", () => {
    const expected = { vignette: 38, scanLines: 40, chromatic: 15, bloom: 25, filmGrain: 30, glitch: 20, pixelate: 15, halftone: 20, filmDust: 20 };
    for (const [k, v] of Object.entries(expected)) expect(ELECTRIC_GAZE_CONFIG.pfx[k as keyof typeof ELECTRIC_GAZE_CONFIG.pfx]).toEqual({ enabled: false, intensity: v });
  });
  it("supports all 25 render modes", () => expect(new Set(RENDER_MODES).size).toBe(25));
});

describe("renderer helpers", () => {
  it("applies tone curve, colour adjustments and glyph selection", () => {
    expect(applyToneCurve(0.4, ELECTRIC_GAZE_CONFIG.toneCurve)).toBeCloseTo(0.4);
    expect(applyToneCurve(0.5, [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 1 }])).toBe(1);
    const [r] = adjustColor([128, 128, 128], ELECTRIC_GAZE_CONFIG);
    expect(r).toBeCloseTo(128, 0); // contrast pivots around mid-grey
    const [hi] = adjustColor([200, 200, 200], ELECTRIC_GAZE_CONFIG);
    expect(hi).toBeGreaterThan(200); // contrast 158 pushes highlights up
    const chars = glyphsFor(ELECTRIC_GAZE_CONFIG);
    expect(chars).toBe(" .:-=+*#%@");
    expect(glyphIndex(0, chars.length, { ...ELECTRIC_GAZE_CONFIG, density: 0 }, 0, 0)).toBe(0);
    expect(glyphIndex(1, chars.length, ELECTRIC_GAZE_CONFIG, 3, 3)).toBe(chars.length - 1);
  });
  it("shimmer is bounded and deterministic", () => {
    const a = animationOffset(ELECTRIC_GAZE_CONFIG, 1.23, 4, 5, 100, 60);
    expect(a).toBe(animationOffset(ELECTRIC_GAZE_CONFIG, 1.23, 4, 5, 100, 60));
    expect(Math.abs(a)).toBeLessThanOrEqual(0.3);
    expect(animationOffset({ ...ELECTRIC_GAZE_CONFIG, animated: false }, 1, 1, 1, 10, 10)).toBe(0);
  });
  it("preserves aspect ratio (cover) and caps pixel ratio", () => {
    const r = coverRect(1000, 500, 400, 400);
    expect(r.h).toBe(400); expect(r.w).toBe(800); expect(r.x).toBe(-200);
    expect(pickPixelRatio(800, 600, 3)).toBe(2);
    expect(pickPixelRatio(3840, 2160, 2)).toBeLessThan(2);
    expect(pickPixelRatio(800, 600, 0)).toBe(1);
  });
});

function fakeCanvas(): HTMLCanvasElement {
  const ctx = new Proxy({}, { get: (t: Record<string, unknown>, k: string) => (k in t ? t[k] : k === "getImageData" ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(180) }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => undefined), set: (t: Record<string, unknown>, k: string, v: unknown) => { t[k] = v; return true; } });
  return { width: 0, height: 0, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
}
globalThis.ImageData ??= class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} } as never;

describe("engine lifecycle (animation cleanup, resize, reduced motion)", () => {
  function setup() {
    let nextId = 1; const pending = new Map<number, FrameRequestCallback>();
    const deps: EngineDeps = {
      raf: vi.fn((cb) => { const id = nextId++; pending.set(id, cb); return id; }),
      caf: vi.fn((id) => { pending.delete(id); }),
      now: () => 0, createCanvas: fakeCanvas, devicePixelRatio: () => 2,
    };
    const canvas = fakeCanvas();
    const engine = createAsciiEngine(canvas, ELECTRIC_GAZE_CONFIG, deps);
    engine.setImage({ width: 100, height: 50 } as never);
    return { engine, deps, canvas, pending };
  }
  it("starts one loop, cancels it on stop and destroy", () => {
    const { engine, deps, pending } = setup();
    engine.resize(300, 200);
    engine.start(); engine.start(); // idempotent
    expect(deps.raf).toHaveBeenCalledTimes(1);
    expect(engine.running).toBe(true);
    engine.stop();
    expect(deps.caf).toHaveBeenCalled(); expect(pending.size).toBe(0); expect(engine.running).toBe(false);
    engine.start(); engine.destroy();
    expect(engine.running).toBe(false); expect(pending.size).toBe(0);
    engine.start(); expect(deps.raf).toHaveBeenCalledTimes(2); // destroyed engine never restarts
  });
  it("keeps scheduling frames while running", () => {
    const { engine, pending } = setup();
    engine.resize(300, 200); engine.start();
    const [first] = [...pending.values()]; pending.clear();
    first!(100);
    expect(pending.size).toBe(1);
    engine.destroy();
  });
  it("resizes the backing store using a capped device pixel ratio and ignores empty sizes", () => {
    const { engine, canvas } = setup();
    engine.resize(300, 200);
    expect(canvas.width).toBe(600); expect(canvas.height).toBe(400);
    expect(canvas.style.width).toBe("300px");
    engine.resize(0, 0);
    expect(canvas.width).toBe(600);
  });
  it("does not animate under prefers-reduced-motion", () => {
    const { engine, deps } = setup();
    engine.resize(300, 200); engine.setReducedMotion(true); engine.start();
    expect(deps.raf).not.toHaveBeenCalled(); expect(engine.running).toBe(false);
  });
  it("falls back gracefully (no throw) when no image is available", () => {
    const canvas = fakeCanvas();
    const engine = createAsciiEngine(canvas, ELECTRIC_GAZE_CONFIG, { createCanvas: fakeCanvas, devicePixelRatio: () => 1 });
    expect(() => { engine.resize(200, 100); engine.renderFrame(0); engine.start(); engine.destroy(); }).not.toThrow();
    expect(engine.hasImage).toBe(false);
    expect(engine.running).toBe(false); // no empty animation loop without an image
  });
});
