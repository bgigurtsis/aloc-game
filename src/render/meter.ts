import { el } from "./dom.ts";
import { meta } from "../content.ts";

const SLOTS = 20;

// ASCII suspicion meter. Shows a tick at the detection threshold and a flashed
// delta on change. Visual only; the value is owned by state.
export function meter(suspicion: number, delta: number): HTMLElement {
  const filled = Math.round((suspicion / 100) * SLOTS);
  const threshSlot = Math.round((meta.detectionThreshold / 100) * SLOTS);

  let bar = "";
  for (let i = 0; i < SLOTS; i++) {
    if (i === threshSlot) bar += "|";
    else bar += i < filled ? "#" : ".";
  }

  const wrap = el("div", { class: "meter" }, [
    el("span", { text: "suspicion score " }),
    el("span", { class: "bar", text: `[${bar}]` }),
    el("span", { text: ` ${String(suspicion).padStart(2, " ")}` })
  ]);

  if (delta > 0) {
    const d = el("span", { class: "delta show", text: `+${delta}` });
    wrap.append(d);
  }
  return wrap;
}
