import { el } from "./dom.ts";
const SLOTS = 20;

// ASCII suspicion meter with a flashed delta on change. Visual only; the
// value is owned by state.
export function meter(suspicion: number, delta: number): HTMLElement {
  const filled = Math.round((suspicion / 100) * SLOTS);

  let bar = "";
  for (let i = 0; i < SLOTS; i++) {
    bar += i < filled ? "#" : ".";
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
