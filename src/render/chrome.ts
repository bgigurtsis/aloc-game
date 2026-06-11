import { el } from "./dom.ts";
import { hostName, rollHost } from "../host.ts";

export function resetChrome(): void {
  rollHost();
}

// Ambient status strip. Defenders see a different host label; the wrap-up
// screens drop the label entirely but keep the strip for its spacing.
export function statusStrip(defender = false, showHost = true): HTMLElement {
  const host = defender ? "S.O.C." : hostName();
  return el("div", { class: "strip" }, [
    el("span"),
    el("span", { text: showHost ? host : "" })
  ]);
}
