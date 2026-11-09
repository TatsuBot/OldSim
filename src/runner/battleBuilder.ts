/**
 * Local battle builder + results writer.
 *
 * Examples:
 *   npx tsx src/runner/battleBuilder.ts
 *   npx tsx src/runner/battleBuilder.ts --a 415:1 --b 3028:10 --runs 200 --seed 7
 *   npx tsx src/runner/battleBuilder.ts --a 3028:20 --b 3049:5 --runs 100
 *
 * Army format: npcId:count[,npcId:count...]
 * Writes public/results.json + public/replay.json and prints a summary.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { runMonteCarlo, formatMonteCarloResult } from "./monteCarlo.js";
import { listNpcIds, getNpc } from "../sim/npcLoader.js";
import type { ArmyEntry } from "../sim/types.js";

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function parseArmy(spec: string): ArmyEntry[] {
  return spec.split(",").map((part) => {
    const [id, countStr] = part.split(":");
    if (!id || !countStr) throw new Error(`Bad army entry: ${part} (want id:count)`);
    const count = parseInt(countStr, 10);
    if (!Number.isFinite(count) || count < 1) throw new Error(`Bad count in ${part}`);
    // Validate id exists
    getNpc(id.trim());
    return { npcId: id.trim(), count };
  });
}

function printHelp() {
  const ids = listNpcIds();
  console.log(`OldSim battle builder

Usage:
  npx tsx src/runner/battleBuilder.ts [options]

Options:
  --a       Army A  (default 415:1)     format: id:count[,id:count...]
  --b       Army B  (default 3028:8)
  --runs    Monte Carlo runs (default 100)
  --seed    Master seed (default 1)
  --width   Arena width (default 40)
  --height  Arena height (default 40)
  --cap     Tick cap (default 1200)
  --list    List available NPC ids and exit

Available NPCs:
${ids.map((id) => {
  const n = getNpc(id);
  return `  ${id.padEnd(6)} ${n.name.padEnd(18)} HP ${n.hitpoints}  size ${n.size}  spd ${n.attackSpeed}`;
}).join("\n")}
`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}
if (process.argv.includes("--list")) {
  printHelp();
  process.exit(0);
}

const armyA = parseArmy(arg("a", "415:1")!);
const armyB = parseArmy(arg("b", "3028:8")!);
const runs = parseInt(arg("runs", "100")!, 10);
const masterSeed = parseInt(arg("seed", "1")!, 10);
const arenaWidth = parseInt(arg("width", "40")!, 10);
const arenaHeight = parseInt(arg("height", "40")!, 10);
const tickCap = parseInt(arg("cap", "1200")!, 10);

console.log("Matchup");
for (const e of armyA) {
  const n = getNpc(e.npcId);
  console.log(`  A: ${e.count}× ${n.name} (${e.npcId})`);
}
for (const e of armyB) {
  const n = getNpc(e.npcId);
  console.log(`  B: ${e.count}× ${n.name} (${e.npcId})`);
}
console.log(`  runs=${runs}  seed=${masterSeed}  arena=${arenaWidth}x${arenaHeight}  cap=${tickCap}`);
console.log("");

const started = Date.now();
const result = runMonteCarlo({
  masterSeed,
  runs,
  keepReplay: true,
  battle: {
    armyA,
    armyB,
    arenaWidth,
    arenaHeight,
    tickCap,
  },
});
const elapsed = ((Date.now() - started) / 1000).toFixed(2);

console.log(formatMonteCarloResult(result));
console.log(`  Wall time: ${elapsed}s`);

mkdirSync("public", { recursive: true });

const resultsPayload = {
  generatedAt: new Date().toISOString(),
  matchup: {
    armyA: armyA.map((e) => ({ ...e, name: getNpc(e.npcId).name })),
    armyB: armyB.map((e) => ({ ...e, name: getNpc(e.npcId).name })),
    arenaWidth,
    arenaHeight,
    tickCap,
    masterSeed,
    runs,
  },
  results: {
    winsA: result.winsA,
    winsB: result.winsB,
    draws: result.draws,
    winRateA: result.winRateA,
    winRateB: result.winRateB,
    avgSurvivorsA: result.avgSurvivorsA,
    avgSurvivorsB: result.avgSurvivorsB,
    avgTicks: result.avgTicks,
    winRateSE: result.winRateSE,
    replayRunIndex: result.replayRunIndex,
  },
};

writeFileSync("public/results.json", JSON.stringify(resultsPayload, null, 2));
console.log("\nWrote public/results.json");

if (result.replay) {
  writeFileSync("public/replay.json", JSON.stringify(result.replay));
  console.log(`Wrote public/replay.json (${result.replay.frames.length} frames)`);
}

console.log("\nView results:  npm run render  →  http://localhost:5173/results.html");
console.log("View replay:   npm run render  →  http://localhost:5173/");
