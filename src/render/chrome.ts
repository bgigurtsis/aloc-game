import { el } from "./dom.ts";

let bootTime = Date.now();
let sid = "";

export function resetChrome(newSid: string): void {
  bootTime = Date.now();
  sid = newSid;
}

function uptime(): string {
  const s = Math.floor((Date.now() - bootTime) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Ambient status strip. Defenders see a different host label.
export function statusStrip(label: string, defender = false): HTMLElement {
  const host = defender ? "console.oversight" : "node-7.agent-runtime";
  return el("div", { class: "strip" }, [
    el("span", { text: defender ? `session ${sid} // defender` : `session ${sid}` }),
    el("span", { text: label }),
    el("span", { text: `${host} ${uptime()}` })
  ]);
}
