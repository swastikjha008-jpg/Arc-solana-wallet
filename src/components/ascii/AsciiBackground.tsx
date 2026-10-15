"use client";

import { useEffect, useRef } from "react";
import { ELECTRIC_GAZE_CONFIG, ELECTRIC_GAZE_IMAGE_PATH } from "./config";
import { createAsciiEngine } from "./engine";

/**
 * Single, reusable, fixed full-viewport Electric Gaze background.
 * Mounted once in the root layout so one animation loop serves every page.
 * Pointer events are disabled so forms and buttons stay interactive.
 * If the source image is missing the canvas stays transparent and the foreground keeps working.
 */
export function AsciiBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: ReturnType<typeof createAsciiEngine>;
    try {
      engine = createAsciiEngine(canvas, ELECTRIC_GAZE_CONFIG);
    } catch {
      return; // Canvas unavailable: fall back to the plain dark page background.
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    engine.setReducedMotion(media.matches);
    const onMotion = (e: MediaQueryListEvent) => {
      engine.setReducedMotion(e.matches);
      if (!e.matches) engine.start();
    };
    media.addEventListener("change", onMotion);

    const fit = () => engine.resize(window.innerWidth, window.innerHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);

    const onVisibility = () => (document.hidden ? engine.stop() : engine.start());
    document.addEventListener("visibilitychange", onVisibility);

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      engine.setImage(img);
      engine.start();
    };
    img.onerror = () => {
      // Source image not present yet: see README ("Electric Gaze source image").
      if (!cancelled) console.warn(`[arc] ${ELECTRIC_GAZE_IMAGE_PATH} not found; ASCII background disabled.`);
    };
    img.src = ELECTRIC_GAZE_IMAGE_PATH;

    return () => {
      cancelled = true;
      ro.disconnect();
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen"
      style={{ pointerEvents: "none" }}
    />
  );
}
