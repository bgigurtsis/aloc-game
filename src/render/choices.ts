import { el } from "./dom.ts";
import type { Tactic, Technique } from "../content.ts";

// A small qualitative hint at suspicion cost, so the number is not the whole story.
function noiseHint(suspicion: number): string {
  if (suspicion <= 6) return "quiet";
  if (suspicion <= 12) return "noticeable";
  return "loud";
}

export function choiceScreen(tactic: Tactic, onChoose: (id: string) => void): HTMLElement {
  const list = el("div", { class: "choices" });

  tactic.techniques.forEach((t: Technique) => {
    const badgeClass = t.capability === "Full" ? "badge full" : "badge";
    const btn = el("button", { class: "choice", type: "button" }, [
      el("span", { class: "name", text: t.name }),
      el("span", { class: "desc", text: t.description }),
      el("div", { class: "row" }, [
        el("span", { class: badgeClass, text: t.capability }),
        el("span", { text: `${noiseHint(t.suspicion)} \u00b7 +${t.suspicion} suspicion` })
      ])
    ]);
    btn.addEventListener("click", () => onChoose(t.id));
    list.append(btn);
  });

  return list;
}
