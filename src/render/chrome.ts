import { el } from "./dom.ts";
import { hostName, rollHost } from "../host.ts";

export function resetChrome(): void {
  rollHost();
}

// Ambient status strip. Defenders see a different host label.
export function statusStrip(label: string, defender = false): HTMLElement {
  const host = defender ? "console.oversight" : hostName();
  return el("div", { class: "strip" }, [
    el("span", { text: defender ? "defender" : "" }),
    el("span", { text: label }),
    el("span", { text: host })
  ]);
}
