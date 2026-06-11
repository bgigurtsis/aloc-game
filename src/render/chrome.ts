import { el } from "./dom.ts";
import { hostName, rollHost } from "../host.ts";

export function resetChrome(): void {
  rollHost();
}

// Ambient status strip. Defenders see a different host label.
export function statusStrip(defender = false): HTMLElement {
  const host = defender ? "S.O.C." : hostName();
  return el("div", { class: "strip" }, [
    el("span"),
    el("span", { text: host })
  ]);
}
