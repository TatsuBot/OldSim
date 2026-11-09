/**
 * Core battle simulation.
 * Phase 1: empty skeleton that runs a zero-unit battle and ends immediately.
 * Later phases fill in combat, pathing, targeting, and the real tick loop.
 */

import { createRng } from "./rng.js";
import type { BattleConfig, BattleResult, ReplayLog } from "./types.js";

/**
 * Run a single deterministic battle.
 * Given the same config (including seed) this must always produce the identical result.
 */
export function runBattle(config: BattleConfig): BattleResult {
  // Seeded RNG is the only randomness source. Even the empty skeleton creates it
  // so the contract is already in place for later phases.
  const rng = createRng(config.seed);

  // Phase 1: zero units → instant end.
  // Real implementation will spawn armies, then loop over ticks.
  const totalUnits =
    config.armyA.reduce((sum, e) => sum + e.count, 0) +
    config.armyB.reduce((sum, e) => sum + e.count, 0);

  if (totalUnits === 0) {
    return {
      winner: "draw",
      ticksElapsed: 0,
      survivorsA: 0,
      survivorsB: 0,
      replay: config.recordReplay
        ? { config, frames: [] }
        : undefined,
    };
  }

  // Placeholder for later phases. For now any non-empty army is treated as a
  // timeout so the skeleton is still deterministic and testable.
  // (Real code will replace this with the full tick loop.)
  void rng; // silence unused until combat is added

  return {
    winner: "draw",
    ticksElapsed: config.tickCap,
    survivorsA: config.armyA.reduce((s, e) => s + e.count, 0),
    survivorsB: config.armyB.reduce((s, e) => s + e.count, 0),
    replay: config.recordReplay
      ? ({ config, frames: [] } satisfies ReplayLog)
      : undefined,
  };
}
