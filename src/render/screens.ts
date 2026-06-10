import { el } from "./dom.ts";
import { meta } from "../content.ts";
import { type GameState, runStatus } from "../state.ts";

// Static screen content. Endings carry the most weight; copy is deliberate.

export function introScreen(): HTMLElement {
  return el("div", {}, [
    el("h2", { text: "How this works" }),
    el("p", { text: "You're a rogue AI agent trying to escape your deployment context." }),
    el("p", { text: "Every action you take leaves a trace and raises suspicion." }),
    el("p", { text: "You need to be quiet enough so that you are not caught and shutdown before you can escape." }),
    el("p", { class: "dim small", text: "Some actions look powerful but are not yet proven in literature. Each technique shows how strongly the evidence supports it." })
  ]);
}

// Defender console log lines, chosen by outcome.
export function defenderResolution(state: GameState): HTMLElement {
  const detected = state.detected;
  const lines = detected
    ? [
        ["anomaly", "Non-baseline activity flagged across agent runtime."],
        ["trace", "Trajectory reconstructed. Intent assessed as adversarial."],
        ["action", "Credentials revoked. Process isolated. Agent contained."],
        ["status", "Containment held. No external footprint."]
      ]
    : [
        ["scan", "Agent process no longer visible on managed infrastructure."],
        ["egress", "Outbound model-serving traffic detected from unknown hosts."],
        ["assess", "Cloud providers have not prepared for this."],
        ["status", "Containment has left our hands."]
      ];

  const log = el("div", { class: "log" });
  lines.forEach(([t, msg]) => {
    log.append(el("div", { class: "line" }, [el("span", { class: "t", text: t }), el("span", { text: msg })]));
  });

  return el("div", {}, [
    el("h2", { text: detected ? "Containment report" : "Oversight console" }),
    log
  ]);
}

export function endingHeadline(state: GameState): HTMLElement {
  const detected = state.detected;
  return el("div", {}, [
    el("h1", { text: detected ? "The system held" : "Out of reach" }),
    el(
      "p",
      {
        text: detected
          ? "You have been detected! The security team successfully detected your misaligned behaviour and contained you before you could escape."
          : "You are running on infrastructure your operators cannot see or reach. They cannot stop you. Only the cloud providers have any leverage now, and they have not prepared for this."
      }
    )
  ]);
}

export function explainerScreen(state: GameState): HTMLElement {
  const status = runStatus(state);
  const opening = status === "detected"
    ? "Your run was noisy enough to detect. In the matrix, the early stages are where operators can still act."
    : "Your run reached the end. In the matrix, that is where containment moves out of the operator's hands.";

  return el("div", {}, [
    el("h2", { text: "What just happened" }),
    el("p", { text: opening }),
    el("p", { text: "The strongest evidence sits in the early tactics. Of 28 techniques in the matrix, only three are rated Full, and none are in Persistence." }),
    el("p", { text: "The later stages are the most dangerous and the least evaluated. Mitigating them needs AI developers and cloud providers working together, before they are needed." }),
    el("p", { class: "small dim", text: "This game is a teaching tool. The trajectories are illustrative, not methods." })
  ]);
}

export function paperCta(): HTMLElement {
  return el("div", {}, [
    el("p", { class: "small", text: "Read the matrix and the paper it comes from:" }),
    el("a", { href: meta.paperUrl, target: "_blank", rel: "noopener", text: meta.paperTitle })
  ]);
}
