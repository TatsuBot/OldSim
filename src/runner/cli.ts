/**
 * Minimal CLI for running a Monte Carlo matchup.
 *
 * Usage:
 *   npx tsx src/runner/cli.ts
 *   npx tsx src/runner/cli.ts --runs 100 --seed 42
 */

import { runMonteCarlo, formatMonteCarloResult } from "./monteCarlo.js";

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return fallback;
}

const runs = parseInt(arg("runs", "100"), 10);
const masterSeed = parseInt(arg("seed", "1"), 10);

const result = runMonteCarlo({
  masterSeed,
  runs,
  keepReplay: true,
  battle: {
    armyA: [{ npcId: "415", count: 1 }], // Abyssal demon
    armyB: [{ npcId: "3028", count: 5 }], // 5 goblins
    arenaWidth: 40,
    arenaHeight: 40,
    tickCap: 1200,
  },
});

console.log(formatMonteCarloResult(result));
