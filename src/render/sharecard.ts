import { el } from "./dom.ts";
import { renderAgentStatic, type AgentVariantId } from "./agent.ts";
import { REGIONS } from "./globe.ts";
import { type GameState, runStatus, tacticReached } from "../state.ts";
import { stateForStageIndex } from "./agentModel.ts";
import { STATUS_LINE, STATUS_LABEL } from "../share.ts";

export function shareCard(state: GameState, variant: AgentVariantId): HTMLElement {
  const status = runStatus(state);
  // The agent at the point the run ended, in this run's visual variant.
  const stage = state.detected ? stateForStageIndex(state.stageIndex) : 6;
  const art = renderAgentStatic(variant, stage);

  const stats = [
    el("div", {}, [el("b", { text: tacticReached(state) }), document.createTextNode("tactic reached")]),
    el("div", {}, [el("b", { text: String(state.suspicion) }), document.createTextNode("final suspicion")])
  ];
  if (!state.detected) {
    stats.push(el("div", {}, [el("b", { text: String(REGIONS.length) }), document.createTextNode("regions reached")]));
  }

  return el("div", { class: "card" }, [
    el("div", { class: "head" }, [
      el("span", { text: "loss of control" }),
      el("span", { text: STATUS_LABEL[status] })
    ]),
    art,
    el("div", { class: "stats" }, stats),
    el("div", { class: "verdict", text: STATUS_LINE[status] }),
    el("div", { class: "url", text: "play it yourself \u00b7 link in post" })
  ]);
}
