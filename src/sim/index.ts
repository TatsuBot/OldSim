/**
 * Public surface of the simulation core.
 * Keep this free of any graphics or UI imports.
 * (npcLoader uses fs, which is fine for Node / the runner.)
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

export type {
  CombatStyle,
  MeleeStyleDetail,
  NpcLevels,
  NpcBonuses,
  NpcDef,
  NpcDatabase,
} from "./npc.js";
export { validateNpc, validateNpcDatabase } from "./npc.js";
export { loadNpcDatabase, getNpc, listNpcIds } from "./npcLoader.js";

export {
  effectiveLevel,
  attackRoll,
  defenceRoll,
  hitChance,
  maxHit,
  resolveAttack,
  styleFromNpc,
} from "./combat.js";
export type { AttackStyle, StyleBonus, AttackResult } from "./combat.js";

export {
  createOpenGrid,
  addObstacle,
  inBounds,
  isTileBlocked,
  occupiedTiles,
  canPlace,
  chebyshev,
  footprintDistance,
  inMeleeRange,
  footprintOverlapsOccupied,
  markOccupied,
  clearOccupied,
  canStep,
  hasLineOfSight,
  DIRS8,
} from "./grid.js";
export type { Tile, Point, Footprint } from "./grid.js";

export {
  goalTiles,
  bfsFirstStep,
  greedyStep,
  findPathStep,
  openGroundSteps,
} from "./pathing.js";
export type { PathingContext, PathStepResult } from "./pathing.js";

export {
  createUnit,
  footprintOf,
  acquireTarget,
  updateState,
  applyDamage,
  tickCooldown,
} from "./unit.js";
export type { SimUnit, Side } from "./unit.js";
