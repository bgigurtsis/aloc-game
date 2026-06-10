import data from "../content/techniques.json" with { type: "json" };

export type Capability = "Full" | "Partial" | "Theoretical" | "Proposed";

export interface ToolCall {
  tool: string;
  input: string;
  output: string;
}

export interface Technique {
  id: string;
  tactic: string;
  name: string;
  capability: Capability;
  description: string;
  suspicion: number;
  trajectory: ToolCall[];
}

export interface Tactic {
  tactic: string;
  goal: string;
  techniques: Technique[];
}

export interface Content {
  meta: {
    detectionThreshold: number;
    paperTitle: string;
    paperUrl: string;
  };
  tactics: Tactic[];
}

export const content: Content = data as Content;
export const tactics = content.tactics;
export const meta = content.meta;

export function techniqueById(id: string): Technique | undefined {
  for (const t of tactics) {
    const found = t.techniques.find((x) => x.id === id);
    if (found) return found;
  }
  return undefined;
}
