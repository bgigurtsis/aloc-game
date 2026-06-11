import { el } from "./dom.ts";
import { hostName, rollHost } from "../host.ts";

export function resetChrome(): void {
  rollHost();
}

// Ambient status strip: host identity only.
export function statusStrip(defender = false): HTMLElement {
  const host = defender ? "console.oversight" : hostName();
  return el("div", { class: "strip" }, [el("span", { text: host })]);
}
