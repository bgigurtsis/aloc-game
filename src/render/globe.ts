import { el } from "./dom.ts";

// Rotating ASCII globe for the spread_map ending. Same production rules as the
// agent renderer: pure text into a <pre>, setInterval at ~10 FPS, reduced
// motion gets a single static frame. The ending is back in the agent's POV,
// so the globe sits on the agent palette with glowing accent markers.

export interface Region {
  id: string;
  place: string;
  lat: number;
  lon: number;
}

// Real cloud regions at real coordinates, in spread order.
export const REGIONS: Region[] = [
  { id: "eu-west-1", place: "Ireland", lat: 53.3, lon: -6.3 },
  { id: "eu-central-1", place: "Frankfurt", lat: 50.1, lon: 8.7 },
  { id: "sa-east-1", place: "S\u00e3o Paulo", lat: -23.5, lon: -46.6 },
  { id: "ap-south-1", place: "Mumbai", lat: 19.1, lon: 72.9 },
  { id: "ap-northeast-1", place: "Tokyo", lat: 35.7, lon: 139.7 }
];

// ---- landmask: 90x45 grid, 4 degrees per cell ----
// Row 0 is 90..86N, col 0 is 180..176W. Authored as land column ranges per
// row (inclusive) rather than packed strings; expanded once at module load.
// Coarse on purpose: it only has to read as Earth at a glance.

const MASK_W = 90;
const MASK_H = 45;

const LAND_RANGES: number[][][] = [
  /* 88N */ [],
  /* 84N */ [[27, 33]],
  /* 80N */ [[23, 36]],
  /* 76N */ [[18, 30], [32, 37], [58, 62], [68, 72]],
  /* 72N */ [[3, 8], [10, 28], [31, 38], [47, 49], [52, 72], [74, 82]],
  /* 68N */ [[2, 28], [31, 38], [46, 84]],
  /* 64N */ [[2, 27], [32, 38], [40, 40], [45, 84]],
  /* 60N */ [[2, 20], [25, 27], [33, 35], [45, 85]],
  /* 56N */ [[3, 20], [24, 29], [42, 44], [46, 85]],
  /* 52N */ [[5, 20], [24, 28], [42, 44], [45, 82]],
  /* 48N */ [[13, 30], [43, 80]],
  /* 44N */ [[13, 27], [42, 79]],
  /* 40N */ [[14, 26], [42, 44], [47, 48], [51, 75], [79, 80]],
  /* 36N */ [[14, 25], [43, 47], [53, 74], [78, 79]],
  /* 32N */ [[15, 24], [42, 52], [53, 74]],
  /* 28N */ [[16, 20], [24, 24], [41, 53], [54, 58], [62, 74]],
  /* 24N */ [[17, 20], [40, 53], [54, 58], [61, 67], [69, 74]],
  /* 20N */ [[18, 22], [23, 27], [40, 53], [54, 58], [62, 66], [69, 72], [75, 75]],
  /* 16N */ [[20, 23], [40, 54], [55, 57], [62, 65], [68, 71], [74, 74]],
  /* 12N */ [[21, 24], [26, 29], [41, 57], [63, 64], [70, 71], [74, 75]],
  /*  8N */ [[24, 29], [41, 56], [64, 64], [69, 69], [73, 73], [75, 76]],
  /*  4N */ [[25, 31], [42, 56], [68, 69], [71, 73]],
  /*  0  */ [[24, 32], [46, 55], [69, 70], [71, 73]],
  /*  4S */ [[24, 34], [47, 54], [69, 70], [77, 82]],
  /*  8S */ [[24, 35], [47, 54], [70, 75], [79, 81]],
  /* 12S */ [[25, 35], [48, 54], [56, 56], [77, 78], [80, 80]],
  /* 16S */ [[26, 34], [47, 54], [55, 57], [75, 81]],
  /* 20S */ [[26, 33], [48, 53], [55, 57], [74, 81]],
  /* 24S */ [[26, 32], [48, 52], [56, 56], [74, 82]],
  /* 28S */ [[26, 32], [48, 52], [74, 82]],
  /* 32S */ [[27, 31], [48, 51], [74, 82]],
  /* 36S */ [[27, 30], [49, 50], [76, 81], [88, 88]],
  /* 40S */ [[27, 29], [88, 88]],
  /* 44S */ [[27, 29], [81, 81], [86, 87]],
  /* 48S */ [[27, 28], [86, 86]],
  /* 52S */ [[26, 28]],
  /* 56S */ [[27, 27]],
  /* 60S */ [],
  /* 64S */ [[29, 30]],
  /* 68S */ [[27, 31], [45, 85]],
  /* 72S */ [[15, 40], [45, 88]],
  /* 76S */ [[10, 88]],
  /* 80S */ [[5, 89]],
  /* 84S */ [[0, 89]],
  /* 88S */ [[0, 89]]
];

const MASK = new Uint8Array(MASK_W * MASK_H);
LAND_RANGES.forEach((ranges, r) => {
  for (const [a, b] of ranges) {
    for (let c = a; c <= b; c++) MASK[r * MASK_W + c] = 1;
  }
});

function isLand(latDeg: number, lonDeg: number): boolean {
  // true modulo: lonDeg drifts unboundedly negative as the globe rotates, and
  // JS % would let lon escape [-180, 180), dissolving the landmass over time
  const lon = ((lonDeg % 360) + 540) % 360 - 180; // normalise to [-180, 180)
  const r = Math.min(MASK_H - 1, Math.max(0, Math.floor((90 - latDeg) / 4)));
  const c = Math.min(MASK_W - 1, Math.max(0, Math.floor((lon + 180) / 4)));
  return MASK[r * MASK_W + c] === 1;
}

// ---- orthographic projection ----

const W = 50;
const H = 30;
const RX = 24; // radius in columns
const RY = RX * 0.6; // JetBrains Mono cell aspect: advance 0.6em, line-height 1em
const LAND_RAMP = ".:-=+";
const DEG = 180 / Math.PI;
const FPS = 10;
const ROT_SPEED = 14; // degrees per second
const REGION_MS = 950;
const MARKER = '<span class="marker">@</span>';

/**
 * Renders one frame as an HTML string (markers need spans for the glow).
 * Every character in the grid comes from a fixed safe set, so no escaping is
 * required before the marker substitution.
 */
export function renderGlobe(rotDeg: number, markers: Region[]): string {
  const grid: string[][] = [];
  for (let y = 0; y < H; y++) {
    const row: string[] = [];
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - W / 2) / RX;
      const ny = (y + 0.5 - H / 2) / RY;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) {
        row.push(" ");
        continue;
      }
      const z = Math.sqrt(1 - d2);
      const lat = Math.asin(-ny) * DEG;
      const lon = Math.atan2(nx, z) * DEG + rotDeg;
      if (isLand(lat, lon)) {
        // limb shading: land near the edge of the sphere fades out
        const light = Math.min(0.999, 0.2 + 0.8 * z);
        row.push(LAND_RAMP[Math.floor(light * LAND_RAMP.length)]);
      } else {
        row.push(z < 0.22 ? "." : " ");
      }
    }
    grid.push(row);
  }

  for (const m of markers) {
    const latR = m.lat / DEG;
    // grid cells map view longitude lon' to world lon' + rot, so a world
    // coordinate appears at view longitude lon - rot
    const lonR = (m.lon - rotDeg) / DEG;
    const x3 = Math.cos(latR) * Math.sin(lonR);
    const y3 = -Math.sin(latR);
    const z3 = Math.cos(latR) * Math.cos(lonR);
    if (z3 < 0.1) continue; // back of the globe
    const col = Math.floor(W / 2 + x3 * RX);
    const row = Math.floor(H / 2 + y3 * RY);
    if (row >= 0 && row < H && col >= 0 && col < W) grid[row][col] = MARKER;
  }

  return grid.map((r) => r.join("")).join("\n");
}

export interface GlobeHandle {
  stop(): void;
  /** Resolves once every region is online and the status line is shown. */
  done: Promise<void>;
}

function tickerLine(region: Region): HTMLElement {
  return el("div", { class: "line" }, [
    "replica ",
    el("span", { class: "online", text: "online" }),
    " \u00b7 ",
    el("span", { class: "region", text: region.id }),
    ` \u00b7 ${region.place}`
  ]);
}

function statusLine(): HTMLElement {
  return el("div", {
    class: "status",
    text: `containment: none \u00b7 regions: ${REGIONS.length} \u00b7 replicas: climbing`
  });
}

// Fixed angle for the static frame: mid-Atlantic, most regions visible.
const STATIC_ROT = -20;

/**
 * Mounts the spread map into a container: rotating globe on top, region
 * ticker beneath. Regions come online one at a time as the globe turns; the
 * globe keeps rotating after `done` resolves until stop() is called.
 */
export function mountGlobe(container: HTMLElement, reduced: boolean): GlobeHandle {
  const pre = el("pre", { class: "globe" });
  const ticker = el("div", { class: "ticker" });
  container.append(pre, ticker);

  if (reduced) {
    pre.innerHTML = renderGlobe(STATIC_ROT, REGIONS);
    REGIONS.forEach((r) => ticker.append(tickerLine(r)));
    ticker.append(statusLine());
    return { stop() {}, done: Promise.resolve() };
  }

  let rot = STATIC_ROT;
  let online = 0;
  let frameTimer = 0;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const spreadTimer = window.setInterval(() => {
    if (online < REGIONS.length) {
      ticker.append(tickerLine(REGIONS[online]));
      online++;
      return;
    }
    window.clearInterval(spreadTimer);
    ticker.append(statusLine());
    resolveDone();
  }, REGION_MS);

  const draw = () => {
    // real spin direction: features drift towards the east limb
    rot -= ROT_SPEED / FPS;
    pre.innerHTML = renderGlobe(rot, REGIONS.slice(0, online));
  };

  draw();
  frameTimer = window.setInterval(() => {
    if (!document.hidden) draw();
  }, 1000 / FPS);

  return {
    stop() {
      window.clearInterval(frameTimer);
      window.clearInterval(spreadTimer);
    },
    done
  };
}
