/**
 * Run one battle (or a short Monte Carlo pick) and write replay.json for the renderer.
 *
 *   npx tsx src/runner/exportReplay.ts
 *   npx tsx src/runner/exportReplay.ts --seed 42
 */

import { writeFileSync } from "node:fs";
import { runBattle } from "../sim/battle.js";
import type { BattleConfig } from "../sim/types.js";

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return fallback;
}

const seed = parseInt(arg("seed", "1"), 10);

const config: BattleConfig = {
  armyA: [{ npcId: "415", count: 1 }],
  armyB: [{ npcId: "3028", count: 8 }],
  arenaWidth: 40,
  arenaHeight: 40,
  seed,
  tickCap: 1200,
  recordReplay: true,
};

console.log(`Running battle (seed ${seed})…`);
const result = runBattle(config);
console.log(
  `Winner: ${result.winner}  ticks: ${result.ticksElapsed}  survivors A/B: ${result.survivorsA}/${result.survivorsB}`
);

if (!result.replay) {
  console.error("No replay recorded");
  process.exit(1);
}

const outPath = arg("out", "public/replay.json");
writeFileSync(outPath, JSON.stringify(result.replay));
console.log(`Wrote ${result.replay.frames.length} frames → ${outPath}`);
