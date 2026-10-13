"use client";

import { useEffect, useRef } from "react";
import { LEFT_SCENES, RIGHT_SCENES } from "./margin-scenes";

// Fixed schematics in the side margins that change as the page scrolls: each scene fades in as the reader reaches
// its share of the page. Scroll progress is written to CSS variables (no React re-render per frame); globals.css
// turns them into opacity, draw-in, drift and the planing-hull trim. Hidden where there is no margin to fill.

const COUNT = LEFT_SCENES.length;
const SPAN = 1 / (COUNT - 1);
const clamp = (n: number) => Math.min(1, Math.max(0, n));

export function MarginArt() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      const p = range > 0 ? clamp(window.scrollY / range) : 0;
      el.style.setProperty("--p", p.toFixed(4));
      for (let i = 0; i < COUNT; i++) {
        const c = i * SPAN;
        // Full strength within 0.42 spans of the scene's centre, gone by 0.58: a brief cross-fade, not a double exposure.
        el.style.setProperty(`--o${i}`, clamp((0.58 * SPAN - Math.abs(p - c)) / (0.16 * SPAN)).toFixed(3));
        el.style.setProperty(`--k${i}`, clamp((p - (c - SPAN / 2)) / SPAN).toFixed(3));
      }
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    const resize = new ResizeObserver(queue);
    resize.observe(document.body);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      resize.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const side = (scenes: typeof LEFT_SCENES, align: string, edge: string) => (
    <div className={`absolute inset-y-0 w-[calc((100%-42rem)/2)] ${edge}`}>
      {scenes.map((Scene, i) => (
        <svg key={i} className={`ma-s ma-s${i}`} viewBox="0 0 300 900" preserveAspectRatio={align}>
          <Scene />
        </svg>
      ))}
    </div>
  );

  return (
    <div ref={root} aria-hidden="true" className="ma pointer-events-none fixed inset-0 -z-10 hidden xl:block">
      {side(LEFT_SCENES, "xMidYMid meet", "left-0")}
      {side(RIGHT_SCENES, "xMidYMid meet", "right-0")}
    </div>
  );
}
