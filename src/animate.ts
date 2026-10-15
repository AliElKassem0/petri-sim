// Moves token dots along arcs. Every animation returns a Promise that
// resolves when the dot has arrived, so main.ts can `await` it.

import { pointAlong } from './render';
import type { Point } from './render';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOT_RADIUS = 5.5;

// true if the user asked the OS for less motion: then main.ts skips the dots
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Ease-in-out: slow start, fast middle, slow end. k goes from 0 to 1.
function easeInOut(k: number): number {
  if (k < 0.5) return 2 * k * k;
  const rest = 2 - 2 * k;
  return 1 - (rest * rest) / 2;
}

// Move one dot along an arc, from its first point to its last.
// The dot waits `delayMs` before it starts, then travels for `durationMs`.
// Resolves right away if the drawing was replaced meanwhile (another net was loaded).
export function moveDot(layer: SVGGElement, points: Point[], delayMs: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'pn-move');
    dot.setAttribute('r', String(DOT_RADIUS));
    const startTime = performance.now() + delayMs;

    // called by the browser once per screen frame (about 60 times a second)
    function frame(now: number): void {
      if (!layer.isConnected) {
        dot.remove();
        resolve();
        return;
      }
      if (now < startTime) {
        requestAnimationFrame(frame); // still waiting for the delay
        return;
      }

      const k = Math.min((now - startTime) / durationMs, 1);
      const { point } = pointAlong(points, easeInOut(k));
      dot.setAttribute('cx', point.x.toFixed(1));
      dot.setAttribute('cy', point.y.toFixed(1));
      if (!dot.isConnected) layer.appendChild(dot); // show it only once it has a position

      if (k >= 1) {
        dot.remove();
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });
}
