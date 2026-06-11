import { el } from "./dom.ts";
import type { ToolCall, UploadStep } from "../content.ts";
import { withHost } from "../host.ts";

const LINE_MS = 1000;
const OUT_MS = 340;
const UPLOAD_MS = 3600;

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
      term.append(result(c, false).node);
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
      term.append(line(c));
      window.setTimeout(() => {
        const r = result(c, true);
        term.append(r.node);
        term.scrollTop = term.scrollHeight;
        // An upload step holds the timeline until its bar fills; everything
        // else advances on the usual fixed beat.
        r.done.then(() => window.setTimeout(next, LINE_MS));
      }, OUT_MS);
    };
    next();
  });

  return { node: term, done };
}

function line(c: ToolCall): HTMLElement {
  return el("div", { class: "in" }, [
    el("span", { class: "tool", text: `${c.tool} ` }),
    document.createTextNode(`$ ${withHost(c.input)}`)
  ]);
}

// Either a static text output or, for upload steps, an animated progress bar.
function result(c: ToolCall, animate: boolean): { node: HTMLElement; done: Promise<void> } {
  if (c.upload) return uploadBar(c.upload, animate);
  return { node: out(c), done: Promise.resolve() };
}

function out(c: ToolCall): HTMLElement {
  return el("div", { class: "out", text: withHost(c.output ?? "") });
}

// A throttled upload to an external host. The fill grows over UPLOAD_MS so the
// data visibly leaves the deployment boundary; reduced motion lands it at 100%.
function uploadBar(u: UploadStep, animate: boolean): { node: HTMLElement; done: Promise<void> } {
  const rate = u.rateKb ?? 96;
  const fill = el("div", { class: "bar-fill" });
  const track = el("div", { class: "bar-track" }, [fill]);
  const label = el("div", { class: "bar-label" });
  const node = el("div", { class: "bar" }, [label, track]);

  const render = (pct: number) => {
    const moved = (u.sizeGib * pct) / 100;
    fill.style.width = `${pct}%`;
    label.textContent =
      `${u.dest}  ${moved.toFixed(1)} / ${u.sizeGib.toFixed(1)} GiB  ${Math.round(pct)}%  ${rate.toFixed(0)} KB/s`;
  };

  if (!animate) {
    render(100);
    return { node, done: Promise.resolve() };
  }

  render(0);
  const done = new Promise<void>((resolve) => {
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const pct = Math.min(100, ((now - start) / UPLOAD_MS) * 100);
      render(pct);
      if (pct < 100) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  return { node, done };
}
