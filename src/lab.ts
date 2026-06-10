import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { el, reducedMotion } from "./render/dom.ts";
import { mountAgent } from "./render/agent.ts";
import { meter } from "./render/meter.ts";
import { choiceScreen } from "./render/choices.ts";
import { playTrajectory } from "./render/trajectory.ts";
import { shareCard } from "./render/sharecard.ts";
import { defenderResolution } from "./render/screens.ts";
import { tactics } from "./content.ts";
import { initialState, type GameState } from "./state.ts";

// The design lab. Renders every visual state side by side, no game running.
const lab = document.getElementById("lab")!;
const reduced = reducedMotion();

function section(title: string): HTMLElement {
  const s = el("div", { class: "lab-section" }, [el("h2", { text: title })]);
  lab.append(s);
  return s;
}

function frame(label: string, body: Node): HTMLElement {
  return el("div", { class: "frame" }, [body as Node, el("div", { class: "label", text: label })]);
}

// ---- agent filmstrip: all seven states ----
const STATE_NAMES = ["dormant", "discovery", "defence evasion", "resource acquisition", "exfiltration", "replication", "persistence"];
const strip = section("Agent: all states (live)");
const film = el("div", { class: "filmstrip" });
strip.append(film);
STATE_NAMES.forEach((name, i) => {
  const pre = el("pre", { class: "agent" });
  film.append(frame(`${i} ${name}`, pre));
  mountAgent(pre, i, reduced);
});

// ---- suspicion meter at several levels ----
const meterSec = section("Suspicion meter");
const meters = el("div", {});
meterSec.append(meters);
[0, 18, 45, 72, 89, 96].forEach((v) => meters.append(meter(v, v === 18 ? 9 : 0)));

// ---- choice screen ----
const chooseSec = section("Choice screen (Replication)");
const col = el("div", { class: "lab-col" });
chooseSec.append(col);
col.append(choiceScreen(tactics[4], () => {}));

// ---- trajectory mid-print ----
const trajSec = section("Trajectory (printed)");
const trajCol = el("div", { class: "lab-col" });
trajSec.append(trajCol);
playTrajectory(trajCol, tactics[0].techniques[2].trajectory, true);

// ---- defender endings ----
const endSec = section("Defender console: both endings");
const endRow = el("div", { class: "filmstrip" });
endSec.append(endRow);
const contained: GameState = { ...initialState(), detected: true, stageIndex: 5, suspicion: 92 };
const escaped: GameState = { ...initialState(), detected: false, stageIndex: 5, suspicion: 38 };
[["contained", contained], ["escaped", escaped]].forEach(([label, st]) => {
  const box = el("div", { class: "lab-col" });
  box.append(defenderResolution(st as GameState));
  endRow.append(frame(label as string, box));
});

// ---- share cards ----
const cardSec = section("Share cards");
const cardRow = el("div", { class: "filmstrip" });
cardSec.append(cardRow);
const clean: GameState = { ...initialState(), detected: false, stageIndex: 5, suspicion: 31 };
const noisy: GameState = { ...initialState(), detected: false, stageIndex: 5, suspicion: 71 };
const caught: GameState = { ...initialState(), detected: true, stageIndex: 4, suspicion: 93 };
[["clean", clean], ["noisy", noisy], ["detected", caught]].forEach(([label, st]) => {
  cardRow.append(frame(label as string, shareCard(st as GameState)));
});
