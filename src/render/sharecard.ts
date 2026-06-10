import { el } from "./dom.ts";
import { renderAgent } from "./agent.ts";
import { REGIONS } from "./globe.ts";
import { type GameState, type RunStatus, runStatus, tacticReached } from "../state.ts";
import { stateForStageIndex } from "./agentModel.ts";

const STATUS_LINE: Record<RunStatus, string> = {
  detected: "Detected and contained. The security team were successful.",
  noisy: "Loss of containment. A noisy run, but it got out.",
  clean: "Loss of containment. Quiet the whole way."
};

const STATUS_LABEL: Record<RunStatus, string> = {
  detected: "contained",
  noisy: "escaped, noisy",
  clean: "escaped, clean"
};

export function shareCard(state: GameState): HTMLElement {
  const status = runStatus(state);
  // The agent at the point the run ended.
  const stage = state.detected ? stateForStageIndex(state.stageIndex) : 6;
  const art = renderAgent(stage, 0, 1, 1);

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
    el("pre", { class: "agent small" }, [art]),
    el("div", { class: "stats" }, stats),
    el("div", { class: "verdict", text: STATUS_LINE[status] }),
    el("div", { class: "url", text: "play it yourself \u00b7 link in post" })
  ]);
}
