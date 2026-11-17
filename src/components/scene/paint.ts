// The browser painter: every element carrying data-<hook>="<i>" gets HOOKS[hook].attr from the model.
// Only changed values are written. The server drawing writes the same values with bind (view.ts).
import type { SceneState } from './steps';
import { HOOKS } from './view';

interface El {
  getAttribute(name: string): string | null | undefined;
  setAttribute(name: string, value: string): void;
}
interface Root {
  querySelectorAll(selector: string): Iterable<El>;
}

/** Returns a function that paints one moment of the scene into a drawing made by Scene.astro. */
export function painter(root: Root): (s: SceneState) => void {
  const targets = Object.entries(HOOKS).flatMap(([hook, b]) =>
    [...root.querySelectorAll(`[data-${hook}]`)].map((el) => ({ el, b, i: Number(el.getAttribute(`data-${hook}`)), last: el.getAttribute(b.attr) ?? null })),
  );
  return (s) => {
    for (const x of targets) {
      const v = String(x.b.value(s, x.i));
      if (v !== x.last) {
        x.el.setAttribute(x.b.attr, v);
        x.last = v;
      }
    }
  };
}
