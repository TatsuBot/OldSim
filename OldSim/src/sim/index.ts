/**
 * Public surface of the simulation core.
 * Keep this free of any graphics, filesystem, or UI imports.
 */

export { createRng } from "./rng.js";
export type { RNG } from "./rng.js";
export { runBattle } from "./battle.js";
export type {
  ArmyEntry,
  BattleConfig,
  BattleResult,
  ReplayLog,
  ReplayFrame,
  ReplayUnit,
  ReplayEvent,
  UnitState,
} from "./types.js";
