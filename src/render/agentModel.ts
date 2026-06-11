import { type Model, type Blob, type Seg, filaments, windingPath } from "./field.ts";

// Seven structural states:
//   0 dormant (cold open)   1 Discovery   2 Defence Evasion
//   3 Resource Acquisition  4 Exfiltration  5 Replication  6 Persistence
// Stages 0 to 4 are pure organic mass; replication (5) and persistence (6)
// take the virus filament treatment.
//
// Each state carries the previous state's structure forward and adds to it,
// so the morphs read as one continuous evolution: the dormant blob grows a
// probe ring (1), the ring dims into a camouflage shroud (2), the probes
// extend into reaching arms through the shroud (3), one arm stretches out
// until a fragment breaks free (4), the fragment matures into a second mass
// (5), and the masses scatter into a persistent web (6).

export const DORMANT = 0;

// agent_view after tactic with stageIndex i shows model state i + 1.
export function stateForStageIndex(stageIndex: number): number {
  return stageIndex + 1;
}

export function agentModel(state: number): Model {
  const blobs: Blob[] = [];
  const segs: Seg[] = [];
  const blob = (x: number, y: number, r: number, p: number, i: number) => blobs.push({ x, y, r, p, i });
  const tendril = (cx: number, cy: number, angle: number, steps: number, startD: number, stepD: number, r0: number, i0: number) => {
    for (let t = 1; t <= steps; t++) {
      const d = startD + t * stepD;
      blob(cx + Math.cos(angle) * d, cy + Math.sin(angle) * d, Math.max(0.012, r0 - t * 0.007), 2, Math.max(0.25, i0 - t * 0.13));
    }
  };

  switch (state) {
    case 0: // dormant: small contained cluster
      blob(0.5, 0.5, 0.17, 1.6, 1.0);
      break;

    case 1: // Discovery: sharpened core with a probe ring
      blob(0.5, 0.5, 0.19, 3.0, 1.15);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.4;
        blob(0.5 + Math.cos(a) * 0.34, 0.5 + Math.sin(a) * 0.34, 0.034, 2, 0.8);
      }
      break;

    case 2: // Defence Evasion: the probe ring dims into a camouflage haze
      blob(0.5, 0.5, 0.19, 1.6, 1.0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.4;
        blob(0.5 + Math.cos(a) * 0.34, 0.5 + Math.sin(a) * 0.34, 0.06, 1.4, 0.42);
      }
      blob(0.5, 0.5, 0.31, 1.2, 0.36);
      break;

    case 3: // Resource Acquisition: probes extend into reaching arms
      blob(0.5, 0.5, 0.31, 1.2, 0.26);
      blob(0.5, 0.5, 0.19, 2.4, 1.05);
      for (const k of [0, 1, 3, 5]) {
        const a = (k / 6) * Math.PI * 2 + 0.4;
        tendril(0.5, 0.5, a, 5, 0.12, 0.07, 0.05, 0.95);
      }
      break;

    case 4: // Exfiltration: the upper-right arm stretches until a fragment breaks free
      blob(0.45, 0.55, 0.28, 1.2, 0.2);
      blob(0.45, 0.55, 0.17, 2.2, 1.0);
      for (const k of [0, 1, 3]) {
        const a = (k / 6) * Math.PI * 2 + 0.4;
        tendril(0.45, 0.55, a, 4, 0.12, 0.07, 0.05, 0.8);
      }
      for (let t = 1; t <= 5; t++) blob(0.45 + t * 0.078, 0.55 - t * 0.072, 0.022, 1.8, 0.45 + t * 0.07);
      blob(0.86, 0.17, 0.07, 2.5, 1.15);
      break;

    case 5: // Replication: forked masses joined by virus filaments
      blob(0.3, 0.62, 0.14, 2.2, 1.0);
      blob(0.72, 0.32, 0.14, 2.2, 1.0);
      [0.6, 2.6, 4.4].forEach((a) => tendril(0.3, 0.62, a, 2, 0.1, 0.07, 0.04, 0.7));
      [1.4, 3.5, 5.6].forEach((a) => tendril(0.72, 0.32, a, 2, 0.1, 0.07, 0.04, 0.7));
      windingPath(segs, 0.36, 0.55, 0.66, 0.38, 7, 0.013, 0.6, 201);
      filaments(segs, 0.24, 0.55, 3.6, 4, 0.012, 211, 0.5);
      filaments(segs, 0.78, 0.26, 0.6, 4, 0.012, 221, 0.5);
      break;

    default: {
      // Persistence: scattered cells connected by a filament web
      const cells = [
        [0.18, 0.25, 0.085],
        [0.5, 0.5, 0.115],
        [0.82, 0.2, 0.075],
        [0.25, 0.76, 0.095],
        [0.76, 0.72, 0.085],
        [0.5, 0.13, 0.055],
        [0.11, 0.52, 0.048],
        [0.89, 0.48, 0.055],
        [0.62, 0.9, 0.048]
      ];
      cells.forEach((c, i) => blob(c[0], c[1], c[2], 2, 0.85 + (i % 3) * 0.1));
      const links = [
        [0, 1], [1, 2], [1, 3], [1, 4], [0, 6], [2, 7], [3, 6], [4, 8], [5, 0], [5, 2]
      ];
      links.forEach(([a, b], k) => windingPath(segs, cells[a][0], cells[a][1], cells[b][0], cells[b][1], 6, 0.011, 0.5, 301 + k * 13));
      ([[0.5, 0.5, 1.2], [0.25, 0.76, 4.0], [0.82, 0.2, 5.4]] as const).forEach((p, k) => filaments(segs, p[0], p[1], p[2], 4, 0.011, 401 + k * 17, 0.45));
      break;
    }
  }

  return { blobs, segs, warp: 0.07, rough: 0.8 };
}
