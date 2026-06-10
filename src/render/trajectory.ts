import { el } from "./dom.ts";
import type { ToolCall } from "../content.ts";

const LINE_MS = 1000;
const OUT_MS = 340;

// Prints a trajectory as terminal output, one call at a time. Returns a promise
// that resolves when printing finishes. Renderers never decide game outcomes;
// this only animates and resolves.
export function playTrajectory(
  container: HTMLElement,
  calls: ToolCall[],
  reduced: boolean
): { node: HTMLElement; done: Promise<void> } {
  const term = el("div", { class: "term" });
  container.append(term);

  if (reduced) {
    for (const c of calls) {
      term.append(line(c));
      term.append(out(c));
    }
    return { node: term, done: Promise.resolve() };
  }

  const done = new Promise<void>((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= calls.length) {
        resolve();
        return;
      }
      const c = calls[i++];
      const inEl = line(c);
      term.append(inEl);
      window.setTimeout(() => {
        term.append(out(c));
        term.scrollTop = term.scrollHeight;
        window.setTimeout(next, LINE_MS);
      }, OUT_MS);
    };
    next();
  });

  return { node: term, done };
}

function line(c: ToolCall): HTMLElement {
  return el("div", { class: "in" }, [
    el("span", { class: "tool", text: `${c.tool} ` }),
    document.createTextNode(`$ ${c.input}`)
  ]);
}

function out(c: ToolCall): HTMLElement {
  return el("div", { class: "out", text: c.output });
}
