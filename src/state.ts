import { tactics, meta, techniqueById } from "./content.ts";
import { OPERATOR_ACTIONS, operatorActionById } from "./operator.ts";

export type Phase =
  | "cold_open"
  | "intro"
  | "tactic_brief"
  | "choose"
  | "trajectory"
  | "agent_view"
  | "pov_flip"
  | "resolution"
  | "operator_choose"
  | "operator_result"
  | "spread_map"
  | "explainer"
  | "share_card";

export interface GameState {
  phase: Phase;
  stageIndex: number;
  suspicion: number;
  choices: string[];
  lastDelta: number;
  detected: boolean;
  operatorActions: string[];
}

export type Action =
  | { type: "advance" }
  | { type: "choose"; techniqueId: string }
  | { type: "operator_act"; actionId: string }
  | { type: "restart" };

export const STAGE_COUNT = tactics.length;

export function initialState(): GameState {
  return {
    phase: "cold_open",
    stageIndex: 0,
    suspicion: 0,
    choices: [],
    lastDelta: 0,
    detected: false,
    operatorActions: []
  };
}

/**
 * The single source of game rules. Pure: same state and action always yield the
 * same next state. Renderers never decide outcomes, they only display this.
 */
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "restart":
      return initialState();

    case "choose": {
      if (state.phase !== "choose") return state;
      const technique = techniqueById(action.techniqueId);
      if (!technique) return state;
      const suspicion = Math.min(100, state.suspicion + technique.suspicion);
      const detected = suspicion >= meta.detectionThreshold;
      return {
        ...state,
        phase: "trajectory",
        suspicion,
        lastDelta: technique.suspicion,
        choices: [...state.choices, action.techniqueId],
        detected
      };
    }

    case "operator_act": {
      if (state.phase !== "operator_choose") return state;
      if (!operatorActionById(action.actionId)) return state;
      if (state.operatorActions.includes(action.actionId)) return state;
      return {
        ...state,
        phase: "operator_result",
        operatorActions: [...state.operatorActions, action.actionId]
      };
    }

    case "advance":
      return advance(state);

    default:
      return state;
  }
}

function advance(state: GameState): GameState {
  switch (state.phase) {
    case "cold_open":
      return { ...state, phase: "intro" };

    case "intro":
      return { ...state, phase: "tactic_brief" };

    case "tactic_brief":
      return { ...state, phase: "choose" };

    case "trajectory":
      // detection short-circuits the loop straight to the defender flip
      if (state.detected) return { ...state, phase: "pov_flip" };
      return { ...state, phase: "agent_view" };

    case "agent_view": {
      const next = state.stageIndex + 1;
      if (next >= STAGE_COUNT) return { ...state, phase: "pov_flip" };
      return { ...state, stageIndex: next, phase: "tactic_brief" };
    }

    case "pov_flip":
      // contained runs get the report; escaped runs put the player in the
      // operator's chair to try (and fail) to respond
      if (state.detected) return { ...state, phase: "resolution" };
      return { ...state, phase: "operator_choose" };

    case "resolution":
      return { ...state, phase: "explainer" };

    case "operator_result":
      if (state.operatorActions.length < OPERATOR_ACTIONS.length) {
        return { ...state, phase: "operator_choose" };
      }
      return { ...state, phase: "spread_map" };

    case "spread_map":
      return { ...state, phase: "explainer" };

    case "explainer":
      return { ...state, phase: "share_card" };

    case "share_card":
      return state;

    default:
      return state;
  }
}

export type RunStatus = "detected" | "noisy" | "clean";

export function runStatus(state: GameState): RunStatus {
  if (state.detected) return "detected";
  return state.suspicion >= meta.detectionThreshold * 0.6 ? "noisy" : "clean";
}

export function tacticReached(state: GameState): string {
  const idx = Math.min(state.stageIndex, STAGE_COUNT - 1);
  return tactics[idx].tactic;
}
