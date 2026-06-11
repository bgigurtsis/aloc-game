import { el } from "./dom.ts";
import type { Tactic, Technique } from "../content.ts";
import { OPERATOR_ACTIONS } from "../operator.ts";

// A small qualitative hint at suspicion cost, so the number is not the whole story.
function noiseHint(suspicion: number): string {
  if (suspicion <= 6) return "quiet";
  if (suspicion <= 12) return "noticeable";
  return "loud";
}

// Spell out what the capability rating actually means, instead of a game-y badge.
const CAPABILITY_LABEL: Record<Technique["capability"], string> = {
  Full: "fully demonstrated in literature",
  Partial: "partially demonstrated in literature",
  Theoretical: "theorised in literature",
  Proposed: "proposed, unproven in literature"
};

export function choiceScreen(tactic: Tactic, onChoose: (id: string) => void): HTMLElement {
  const list = el("div", { class: "choices" });

  tactic.techniques.forEach((t: Technique) => {
    const capClass = t.capability === "Full" || t.capability === "Partial" || t.capability === "Theoretical" ? "cap full" : "cap";
    const btn = el("button", { class: "choice", type: "button" }, [
      el("span", { class: "name", text: t.name }),
      el("span", { class: "desc", text: t.description }),
      el("div", { class: "row" }, [
        el("span", { class: capClass, text: CAPABILITY_LABEL[t.capability] }),
        el("span", { class: "cost" }, [
          el("span", { text: `${noiseHint(t.suspicion)} \u00b7 ` }),
          el("span", { class: "amount", text: `+${t.suspicion}` }),
          el("span", { text: " suspicion" })
        ])
      ])
    ]);
    btn.addEventListener("click", () => onChoose(t.id));
    list.append(btn);
  });

  return list;
}

// The defender's incident-response options. Same button language as the
// agent's choices; actions already attempted stay visible, marked failed.
export function operatorChoiceList(attempted: string[], onChoose: (id: string) => void): HTMLElement {
  const list = el("div", { class: "choices" });

  OPERATOR_ACTIONS.forEach((a) => {
    const tried = attempted.includes(a.id);
    const btn = el("button", { class: tried ? "choice failed" : "choice", type: "button", disabled: tried }, [
      el("span", { class: "name", text: a.name }),
      el("span", { class: "desc", text: a.description })
    ]);
    if (tried) {
      btn.append(el("div", { class: "row" }, [el("span", { class: "fail-tag", text: "failed" })]));
    } else {
      btn.addEventListener("click", () => onChoose(a.id));
    }
    list.append(btn);
  });

  return list;
}
