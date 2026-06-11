import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { el, reducedMotion } from "./render/dom.ts";
import { mountAgent, AGENT_VARIANTS } from "./render/agent.ts";
import { meter } from "./render/meter.ts";
import { choiceScreen, operatorChoiceList } from "./render/choices.ts";
import { playTrajectory } from "./render/trajectory.ts";
import { mountGlobe } from "./render/globe.ts";
import { shareCard } from "./render/sharecard.ts";
import { defenderResolution } from "./render/screens.ts";
import { tactics } from "./content.ts";
import { OPERATOR_ACTIONS } from "./operator.ts";
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

// ---- agent filmstrips: every variant, all seven states ----
const STATE_NAMES = ["dormant", "discovery", "defence evasion", "resource acquisition", "exfiltration", "replication", "persistence"];
for (const variant of AGENT_VARIANTS) {
  const strip = section(`Agent: ${variant}, all states (live)`);
  const film = el("div", { class: "filmstrip" });
  strip.append(film);
  STATE_NAMES.forEach((name, i) => {
    const box = el("div", {});
    film.append(frame(`${i} ${name}`, box));
    mountAgent(box, variant, i, reduced);
  });
}

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

// ---- defender ending: contained ----
const endSec = section("Defender console: containment report");
const contained: GameState = { ...initialState(), detected: true, stageIndex: 5, suspicion: 92 };
const containedBox = el("div", { class: "lab-col" });
containedBox.append(defenderResolution(contained));
endSec.append(frame("contained", containedBox));

// ---- operator response (escaped ending) ----
const opSec = section("Operator response: choices");
const opRow = el("div", { class: "filmstrip" });
opSec.append(opRow);
[["fresh", []], ["two failed", [OPERATOR_ACTIONS[0].id, OPERATOR_ACTIONS[1].id]]].forEach(([label, tried]) => {
  const box = el("div", { class: "lab-col" });
  box.append(operatorChoiceList(tried as string[], () => {}));
  opRow.append(frame(label as string, box));
});

const opResSec = section("Operator response: result (printed)");
const opResCol = el("div", { class: "lab-col" });
opResSec.append(opResCol);
playTrajectory(opResCol, OPERATOR_ACTIONS[0].lines, true);

// ---- spread map globe ----
const globeSec = section("Spread map: rotating globe (live)");
const globeCol = el("div", { class: "lab-col", style: "display:flex;flex-direction:column;gap:12px" });
globeSec.append(frame("spread_map", globeCol));
mountGlobe(globeCol, reduced);

// ---- share cards ----
const cardSec = section("Share cards");
const cardRow = el("div", { class: "filmstrip" });
cardSec.append(cardRow);
const clean: GameState = { ...initialState(), detected: false, stageIndex: 5, suspicion: 31 };
const noisy: GameState = { ...initialState(), detected: false, stageIndex: 5, suspicion: 71 };
const caught: GameState = { ...initialState(), detected: true, stageIndex: 4, suspicion: 93 };
// one card per variant, so every static render stays reviewable
([
  ["clean / ramp", clean, "ramp"],
  ["noisy / braille", noisy, "braille"],
  ["detected / blocks", caught, "blocks"],
  ["clean / canvas", clean, "canvas"]
] as const).forEach(([label, st, variant]) => {
  cardRow.append(frame(label, shareCard(st, variant)));
});
