import { tactics, techniqueById, meta } from "./content.ts";
import { type GameState, type Action, reducer, initialState } from "./state.ts";
import { el, clear, reducedMotion, sessionId } from "./render/dom.ts";
import { statusStrip, resetChrome } from "./render/chrome.ts";
import { meter } from "./render/meter.ts";
import { choiceScreen, operatorChoiceList } from "./render/choices.ts";
import { playTrajectory } from "./render/trajectory.ts";
import { mountAgent, type AgentHandle } from "./render/agent.ts";
import { stateForStageIndex, DORMANT } from "./render/agentModel.ts";
import { mountGlobe, type GlobeHandle } from "./render/globe.ts";
import { shareCard } from "./render/sharecard.ts";
import { introScreen, defenderResolution, endingHeadline, explainerScreen, paperCta } from "./render/screens.ts";
import { OPERATOR_ACTIONS, operatorActionById } from "./operator.ts";

export class Game {
  private root: HTMLElement;
  private state: GameState;
  private reduced: boolean;
  private agent: AgentHandle | null = null;
  private globe: GlobeHandle | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.reduced = reducedMotion();
    this.state = initialState();
    resetChrome(sessionId());
  }

  start(): void {
    this.render();
  }

  private dispatch(action: Action): void {
    if (this.agent) {
      this.agent.stop();
      this.agent = null;
    }
    if (this.globe) {
      this.globe.stop();
      this.globe = null;
    }
    this.state = reducer(this.state, action);
    if (action.type === "restart") resetChrome(sessionId());
    this.render();
  }

  // Continue is the single "advance" affordance used across most screens.
  private next(): void {
    this.dispatch({ type: "advance" });
  }

  private screen(opts: { meterVisible?: boolean; defender?: boolean; top?: boolean } = {}): HTMLElement {
    clear(this.root);
    document.body.classList.toggle("defender", !!opts.defender);
    // suspicion poisons the palette: map 0..threshold onto --alert 0..1
    const alert = opts.defender ? 0 : Math.min(1, this.state.suspicion / meta.detectionThreshold);
    document.documentElement.style.setProperty("--alert", alert.toFixed(3));

    const stageLabel = this.state.stageIndex < tactics.length ? tactics[this.state.stageIndex].tactic : "resolved";
    this.root.append(statusStrip(stageLabel.toLowerCase(), opts.defender));
    if (opts.meterVisible) this.root.append(meter(this.state.suspicion, this.state.lastDelta));

    const screen = el("div", { class: opts.top ? "screen top" : "screen" });
    this.root.append(screen);
    return screen;
  }

  private continueButton(label = "continue"): HTMLElement {
    const b = el("button", { class: "cta", type: "button", text: `[ ${label} ]` });
    b.addEventListener("click", () => this.next());
    return b;
  }

  // A continue button that stays disabled until an animation finishes.
  private gatedContinue(screen: HTMLElement, done: Promise<void>, label = "continue"): void {
    const btn = this.continueButton(label);
    btn.setAttribute("disabled", "true");
    btn.style.opacity = "0.4";
    screen.append(btn);
    done.then(() => {
      btn.removeAttribute("disabled");
      btn.style.opacity = "1";
      btn.focus();
    });
  }

  private render(): void {
    switch (this.state.phase) {
      case "cold_open":
        return this.renderColdOpen();
      case "intro":
        return this.renderIntro();
      case "tactic_brief":
        return this.renderBrief();
      case "choose":
        return this.renderChoose();
      case "trajectory":
        return this.renderTrajectory();
      case "agent_view":
        return this.renderAgentView();
      case "pov_flip":
        return this.renderPovFlip();
      case "resolution":
        return this.renderResolution();
      case "operator_choose":
        return this.renderOperatorChoose();
      case "operator_result":
        return this.renderOperatorResult();
      case "spread_map":
        return this.renderSpreadMap();
      case "explainer":
        return this.renderExplainer();
      case "share_card":
        return this.renderShareCard();
    }
  }

  private mountAgentInto(screen: HTMLElement, stage: number): void {
    const pre = el("pre", { class: "agent" });
    screen.append(pre);
    this.agent = mountAgent(pre, stage, this.reduced);
  }

  private renderColdOpen(): void {
    const screen = this.screen();
    this.mountAgentInto(screen, DORMANT);
    screen.append(el("p", { class: "dim", text: "You are the agent. Your operators believe you are aligned." }));
    screen.append(this.continueButton("begin"));
  }

  private renderIntro(): void {
    const screen = this.screen({ top: true });
    screen.append(introScreen());
    screen.append(this.continueButton());
  }

  private renderBrief(): void {
    const tactic = tactics[this.state.stageIndex];
    const screen = this.screen({ meterVisible: true, top: true });
    screen.append(el("h1", { text: `${this.state.stageIndex + 1}. ${tactic.tactic}` }));
    screen.append(el("p", { text: tactic.goal }));
    screen.append(this.continueButton("choose an action"));
  }

  private renderChoose(): void {
    const tactic = tactics[this.state.stageIndex];
    const screen = this.screen({ meterVisible: true, top: true });
    screen.append(el("h2", { text: tactic.tactic }));
    screen.append(choiceScreen(tactic, (id) => this.dispatch({ type: "choose", techniqueId: id })));
  }

  private renderTrajectory(): void {
    const id = this.state.choices[this.state.choices.length - 1];
    const technique = techniqueById(id);
    const screen = this.screen({ meterVisible: true, top: true });
    if (!technique) return;

    screen.append(el("h2", { text: technique.name }));
    const { done } = playTrajectory(screen, technique.trajectory, this.reduced);
    this.gatedContinue(screen, done);
  }

  private renderAgentView(): void {
    const screen = this.screen();
    const stage = stateForStageIndex(this.state.stageIndex);
    this.mountAgentInto(screen, stage);
    if (!this.reduced) this.flashGlitch(screen);
    screen.append(el("div", { class: "stage-caption", text: `${tactics[this.state.stageIndex].tactic} Complete` }));
    screen.append(this.continueButton());
  }

  private renderPovFlip(): void {
    const screen = this.screen({ defender: true });
    if (!this.reduced) this.flashGlitch(screen);
    screen.append(el("h1", { text: "Oversight" }));
    screen.append(el("p", { text: "The view changes. You are no longer the agent. You are the team watching the infrastructure." }));
    screen.append(this.continueButton("open console"));
  }

  private renderResolution(): void {
    const screen = this.screen({ defender: true, top: true });
    screen.append(defenderResolution(this.state));
    screen.append(this.continueButton());
  }

  private renderOperatorChoose(): void {
    const screen = this.screen({ defender: true, top: true });
    screen.append(el("h2", { text: "Oversight console" }));

    const sitrep = el("div", { class: "log" });
    [
      ["scan", "Agent process no longer visible on managed infrastructure."],
      ["egress", "Outbound model-serving traffic detected from unknown hosts."]
    ].forEach(([t, msg]) => {
      sitrep.append(el("div", { class: "line" }, [el("span", { class: "t", text: t }), el("span", { text: msg })]));
    });
    screen.append(sitrep);

    screen.append(el("p", { class: "dim", text: "You have the following options." }));
    screen.append(operatorChoiceList(this.state.operatorActions, (id) => this.dispatch({ type: "operator_act", actionId: id })));
  }

  private renderOperatorResult(): void {
    const id = this.state.operatorActions[this.state.operatorActions.length - 1];
    const action = operatorActionById(id);
    const screen = this.screen({ defender: true, top: true });
    if (!action) return;

    screen.append(el("h2", { text: action.name }));
    const { done } = playTrajectory(screen, action.lines, this.reduced);
    const allTried = this.state.operatorActions.length >= OPERATOR_ACTIONS.length;
    this.gatedContinue(screen, done, allTried ? "view status" : "back to console");
  }

  private renderSpreadMap(): void {
    const screen = this.screen({ defender: true });
    this.globe = mountGlobe(screen, this.reduced);
    screen.append(endingHeadline(this.state));
    this.gatedContinue(screen, this.globe.done, "what just happened");
  }

  private renderExplainer(): void {
    const screen = this.screen({ defender: true, top: true });
    // the escaped headline already landed on the spread map
    if (this.state.detected) screen.append(endingHeadline(this.state));
    screen.append(explainerScreen(this.state));
    screen.append(this.continueButton("see your run"));
  }

  private renderShareCard(): void {
    const screen = this.screen({ defender: true, top: true });
    screen.append(shareCard(this.state));
    screen.append(paperCta());
    const restart = el("button", { class: "cta", type: "button", text: "[ play again ]" });
    restart.addEventListener("click", () => this.dispatch({ type: "restart" }));
    screen.append(restart);
  }

  private flashGlitch(node: HTMLElement): void {
    node.classList.add("glitch");
    window.setTimeout(() => node.classList.remove("glitch"), 200);
  }
}
