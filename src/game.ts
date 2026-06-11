import { tactics, techniqueById, meta } from "./content.ts";
import { type GameState, type Action, reducer, initialState } from "./state.ts";
import { el, clear, reducedMotion } from "./render/dom.ts";
import { statusStrip, resetChrome } from "./render/chrome.ts";
import { meter } from "./render/meter.ts";
import { choiceScreen, operatorChoiceList } from "./render/choices.ts";
import { playTrajectory } from "./render/trajectory.ts";
import {
  mountAgent,
  pickVariant,
  seenVariantCount,
  AGENT_VARIANTS,
  type AgentHandle,
  type AgentVariantId,
  type MountAgentOpts
} from "./render/agent.ts";
import { stateForStageIndex, DORMANT } from "./render/agentModel.ts";
import { mountGlobe, type GlobeHandle } from "./render/globe.ts";
import { shareCard } from "./render/sharecard.ts";
import { shareRun, type ShareOutcome } from "./render/share.ts";
import { captureShareCard } from "./render/capture.ts";
import { introScreen, defenderResolution, endingHeadline, explainerScreen } from "./render/screens.ts";
import { OPERATOR_ACTIONS, operatorActionById } from "./operator.ts";

export class Game {
  private root: HTMLElement;
  private state: GameState;
  private reduced: boolean;
  private agent: AgentHandle | null = null;
  private globe: GlobeHandle | null = null;
  // each run gets a randomly assigned visual variant for the agent
  private variant: AgentVariantId;

  constructor(root: HTMLElement) {
    this.root = root;
    this.reduced = reducedMotion();
    this.state = initialState();
    this.variant = pickVariant();
    resetChrome();
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
    if (action.type === "restart") {
      this.variant = pickVariant();
      resetChrome();
    }
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

    this.root.append(statusStrip(opts.defender));
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

  private mountAgentInto(screen: HTMLElement, stage: number, opts: MountAgentOpts = {}): void {
    this.agent = mountAgent(screen, this.variant, stage, this.reduced, opts);
  }

  // The agent alone: it materialises, pulses awake, and only then is the
  // begin button revealed.
  private renderColdOpen(): void {
    const screen = this.screen();
    this.mountAgentInto(screen, DORMANT, { wake: true, size: "hero" });
    const btn = this.continueButton("begin");
    if (this.reduced) {
      screen.append(btn);
      return;
    }
    btn.classList.add("reveal");
    btn.setAttribute("disabled", "true");
    screen.append(btn);
    window.setTimeout(() => {
      btn.removeAttribute("disabled");
      btn.classList.add("show");
    }, 3000);
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
    screen.append(this.continueButton("choose a technique"));
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

  // Stage complete: the previous form holds for a beat, then morphs into the
  // new one; the caption fades in and only then does continue unlock.
  private renderAgentView(): void {
    const screen = this.screen();
    const prev = stateForStageIndex(this.state.stageIndex - 1);
    const next = stateForStageIndex(this.state.stageIndex);
    const caption = el("div", { class: "stage-caption", text: `${tactics[this.state.stageIndex].tactic} Complete` });

    if (this.reduced) {
      this.mountAgentInto(screen, next);
      screen.append(caption);
      screen.append(this.continueButton());
      return;
    }

    this.mountAgentInto(screen, prev, { formed: true });
    caption.classList.add("fade");
    screen.append(caption);

    const HOLD_MS = 1000; // old form lingers before the mutation kicks in
    const MORPH_MS = 1100; // matches MAT_MS in agent.ts
    const done = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        this.flashGlitch(screen);
        this.agent?.setState(next);
      }, HOLD_MS);
      window.setTimeout(() => {
        caption.classList.add("show");
        window.setTimeout(resolve, 500);
      }, HOLD_MS + MORPH_MS + 200);
    });
    this.gatedContinue(screen, done);
  }

  private renderPovFlip(): void {
    const screen = this.screen({ defender: true });
    if (!this.reduced) this.flashGlitch(screen);
    screen.append(el("h1", { class: "tight", text: "Oversight" }));
    screen.append(el("p", { text: "Your perspective has flipped. You are now a security operator at the AI lab. Shut down the rogue agent before it's too late." }));
    screen.append(this.continueButton("open console"));
  }

  private renderResolution(): void {
    const screen = this.screen({ defender: true, top: true });
    screen.append(defenderResolution(this.state));
    screen.append(this.continueButton());
  }

  private renderOperatorChoose(): void {
    const screen = this.screen({ defender: true, top: true });
    screen.append(el("h2", { text: "Security Operations Center" }));
    screen.append(el("p", { text: "Canaries are being tripped. Inference is being served from an unknown endpoint. Stop the agent before it's too late." }));

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

  // Back in the agent's hands: the operator console failed, so the ending
  // returns to the agent palette (suspicion hue included).
  private renderSpreadMap(): void {
    const screen = this.screen();
    screen.classList.add("spread");
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
    screen.append(shareCard(this.state, this.variant));

    // capture now, not on tap: the share channels need the tap's transient
    // user activation, which a slow capture after the click would burn
    const capture = captureShareCard(this.state, this.variant);
    capture.catch(() => undefined); // surfaced on tap; avoid an unhandled rejection before it

    const hint = el("div", { class: "share-hint" });
    const share = el("button", { class: "cta", type: "button", text: "[ share on x ]" });
    share.addEventListener("click", () => void this.handleShare(share, hint, capture));
    const restart = el("button", { class: "cta", type: "button", text: "[ play again ]" });
    restart.addEventListener("click", () => this.dispatch({ type: "restart" }));

    screen.append(el("div", { class: "cta-row" }, [share, restart]));
    screen.append(hint);
    screen.append(el("p", { class: "dim small", text: this.formsHint() }));
    screen.append(el("a", { class: "cta", href: meta.paperUrl, target: "_blank", rel: "noopener", text: "[ read the paper ]" }));
  }

  // Copy for the play-again nudge: the entity has four visual forms and the
  // rotation guarantees a new one each run until all four have been seen.
  private formsHint(): string {
    const total = AGENT_VARIANTS.length;
    const seen = seenVariantCount();
    if (seen >= total) return `you've encountered all ${total} agent forms`;
    if (seen > 0) return `you've encountered ${seen} of ${total} agent forms, play again to meet another`;
    return "the agent takes a different form each run, play again to meet another";
  }

  private async handleShare(btn: HTMLButtonElement, hint: HTMLElement, capture: Promise<Blob>): Promise<void> {
    const messages: Record<ShareOutcome, string> = {
      shared: "",
      cancelled: "",
      copied: "image copied \u2014 paste it into your post",
      downloaded: "image downloaded \u2014 attach it to your post"
    };
    btn.setAttribute("disabled", "true");
    hint.textContent = "";
    try {
      hint.textContent = messages[await shareRun(this.state, capture)];
    } catch {
      hint.textContent = "couldn't capture the card \u2014 try a screenshot instead";
    } finally {
      btn.removeAttribute("disabled");
    }
  }

  private flashGlitch(node: HTMLElement): void {
    node.classList.add("glitch");
    window.setTimeout(() => node.classList.remove("glitch"), 200);
  }
}
