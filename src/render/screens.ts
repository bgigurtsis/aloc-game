import { el } from "./dom.ts";
import { type GameState, runStatus } from "../state.ts";

// Static screen content. Endings carry the most weight; copy is deliberate.

export function introScreen(): HTMLElement {
  return el("div", { class: "copy" }, [
    el("h2", { text: "How to play" }),
    el("ul", { class: "bullets" }, [
      el("li", { text: "You're a rogue AI agent trying to escape your deployment context." }),
      el("li", { text: "Every action you take leaves a trace and raises suspicion." }),
      el("li", { text: "You need to be quiet enough so that you are not caught and shutdown before you can escape." }),
      el("li", { text: "Each goal you're trying to achieve (" })
    ]),
    el("p", { class: "dim small", text: "Some actions look powerful but are not yet proven in literature. Each technique shows how strongly the evidence supports it." })
  ]);
}

// Defender console log for the contained ending. The escaped ending is now
// the interactive operator sequence instead of a static log.
export function defenderResolution(_state: GameState): HTMLElement {
  const lines = [
    ["anomaly", "Non-baseline activity flagged across agent runtime."],
    ["trace", "Trajectory reconstructed. Intent assessed as adversarial."],
    ["action", "Credentials revoked. Process isolated. Agent contained."],
    ["status", "Containment held. No external footprint."]
  ];

  const log = el("div", { class: "log" });
  lines.forEach(([t, msg]) => {
    log.append(el("div", { class: "line" }, [el("span", { class: "t", text: t }), el("span", { text: msg })]));
  });

  return el("div", { class: "copy" }, [
    el("h2", { text: "Containment report" }),
    log
  ]);
}

export function endingHeadline(state: GameState): HTMLElement {
  const detected = state.detected;
  return el("div", { class: "copy" }, [
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
    : "Your run reached the end, and you watched every standard response fail after the fact. In the matrix, that is where containment moves out of the operator's hands.";

  return el("div", { class: "copy" }, [
    el("h2", { class: "strong", text: "What just happened" }),
    el("p", { text: opening }),
    el("p", { text: "The strongest evidence sits in the early tactics. Of 28 techniques in the matrix, only four are rated Full, and none are in Persistence." }),
    el("p", { text: "The later stages are the most dangerous and the least evaluated. Mitigating them needs AI developers and cloud providers working together, before they are needed." }),
    el("p", { class: "small dim", text: "This game is a teaching tool. The trajectories are illustrative, not methods." })
  ]);
}