/**
 * Strongly typed configuration model for the Electric Gaze ASCII renderer.
 * The renderer engine (engine.ts) is UI-agnostic and only depends on these types.
 */

export type RenderMode =
  | "characters" | "dither" | "mosaic" | "pixel" | "dots" | "cross" | "diamond" | "voxel"
  | "lego" | "mixed" | "lines" | "diagonal" | "braille" | "disco" | "hexdump" | "matrix"
  | "rings" | "hearts" | "stars" | "hexagons" | "triangles" | "bubbles" | "hatch"
  | "contour" | "halfblocks";

export const RENDER_MODES: readonly RenderMode[] = [
  "characters", "dither", "mosaic", "pixel", "dots", "cross", "diamond", "voxel", "lego",
  "mixed", "lines", "diagonal", "braille", "disco", "hexdump", "matrix", "rings", "hearts",
  "stars", "hexagons", "triangles", "bubbles", "hatch", "contour", "halfblocks",
] as const;

export type BackgroundMode = "none" | "blurred" | "solid" | "original";
export type CharSetName = "standard" | "blocks" | "binary" | "detailed" | "minimal" | "custom";
export type BlurType = "off" | "gaussian" | "directional" | "progressive" | "tilt" | "lens";
export type OverlayBlend = "multiply" | "screen" | "overlay" | "normal";
export type AnimStyle = "wave" | "pulse" | "shimmer" | "ripple" | "flicker";
export type StyleBlend = GlobalCompositeOperation;

export interface CurvePoint { x: number; y: number }
export interface Toggle { enabled: boolean; intensity: number }
export interface Enabled { enabled: boolean }

export interface PostEffects {
  vignette: Toggle;
  scanLines: Toggle;
  chromatic: Toggle;
  bloom: Toggle;
  filmGrain: Toggle;
  glitch: Toggle;
  pixelate: Toggle;
  halftone: Toggle;
  filmDust: Toggle;
}

export interface LightPoint { x: number; y: number; radius: number; intensity: number; color?: string }

export interface MaskConfig {
  enabled: boolean;
  tool: "freehand" | "rect" | "ellipse";
  brushSize: number;
  showOverlay: boolean;
  invert: boolean;
  dataUrl: string | null;
  shapes: unknown[];
}

export interface AsciiConfig {
  renderMode: RenderMode;
  bgMode: BackgroundMode;
  /** Blur radius (px) used when bgMode is "blurred". */
  bgBlur: number;
  /** 0-100 opacity of the background layer. */
  bgOpacity: number;
  /** Cell edge length in CSS pixels. */
  cellSize: number;
  /** 0-100 share of cells that are drawn. */
  coverage: number;
  invert: boolean;
  styleBlend: StyleBlend;
  charSet: CharSetName;
  customChars: string;
  /** -100..100 */
  brightness: number;
  /** 0..200+ (100 = neutral) */
  contrast: number;
  /** 0-100 edge (Sobel) boost added to luminance. */
  edgeEmphasis: number;
  /** 0-100 ordered-dither spread: how strongly the Bayer matrix perturbs glyph selection. */
  density: number;
  toneCurve: CurvePoint[];
  tint: string;
  tintOpacity: number;
  overlayBlend: OverlayBlend;
  /** 0-200 (100 = neutral) */
  saturation: number;
  /** 0-100 */
  grayscale: number;
  blurType: BlurType;
  blurAmount: number;
  blurAngle: number;
  directionalBothSides: boolean;
  tiltFocus: number;
  tiltPosition: number;
  tiltFeather: number;
  lensFocus: number;
  blurCenterX: number;
  blurCenterY: number;
  progressivePosition: number;
  progressiveReverse: boolean;
  pfx: PostEffects;
  animated: boolean;
  animStyle: AnimStyle;
  animSpeed: Toggle;
  animIntensity: Toggle;
  lights: { enabled: boolean; points: LightPoint[] };
  mask: MaskConfig;
}

/** The exact Electric Gaze configuration supplied in the build prompt. Do not edit values. */
export const ELECTRIC_GAZE_CONFIG: AsciiConfig = {
  renderMode: "dither",
  bgMode: "none",
  bgBlur: 12,
  bgOpacity: 90,
  cellSize: 9,
  coverage: 100,
  invert: false,
  styleBlend: "source-over",
  charSet: "standard",
  customChars: "",
  brightness: 0,
  contrast: 158,
  edgeEmphasis: 0,
  density: 20,
  toneCurve: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  tint: "#3ca6ff",
  tintOpacity: 0,
  overlayBlend: "multiply",
  saturation: 100,
  grayscale: 0,
  blurType: "off",
  blurAmount: 35,
  blurAngle: 0,
  directionalBothSides: false,
  tiltFocus: 35,
  tiltPosition: 50,
  tiltFeather: 15,
  lensFocus: 40,
  blurCenterX: 50,
  blurCenterY: 50,
  progressivePosition: 55,
  progressiveReverse: false,
  pfx: {
    vignette: { enabled: false, intensity: 38 },
    scanLines: { enabled: false, intensity: 40 },
    chromatic: { enabled: false, intensity: 15 },
    bloom: { enabled: false, intensity: 25 },
    filmGrain: { enabled: false, intensity: 30 },
    glitch: { enabled: false, intensity: 20 },
    pixelate: { enabled: false, intensity: 15 },
    halftone: { enabled: false, intensity: 20 },
    filmDust: { enabled: false, intensity: 20 },
  },
  animated: true,
  animStyle: "shimmer",
  animSpeed: { enabled: true, intensity: 100 },
  animIntensity: { enabled: true, intensity: 60 },
  lights: { enabled: false, points: [] },
  mask: {
    enabled: false,
    tool: "freehand",
    brushSize: 30,
    showOverlay: false,
    invert: false,
    dataUrl: null,
    shapes: [],
  },
};

/** Where the original source image must be placed (see README). */
export const ELECTRIC_GAZE_IMAGE_PATH = "/images/electric-gaze-source.webp";

export const CHAR_SETS: Record<Exclude<CharSetName, "custom">, string> = {
  standard: " .:-=+*#%@",
  blocks: " ░▒▓█",
  binary: " 01",
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  minimal: " .oO@",
};

export const HEX_CHARS = "0123456789abcdef";
export const BRAILLE_CHARS = "⠀⠁⠃⠇⡇⣇⣧⣷⣿";
export const HALFBLOCK_CHARS = " ▖▄▙█";
export const MATRIX_CHARS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789";
