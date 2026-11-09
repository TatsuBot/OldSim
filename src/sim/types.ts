/**
 * Core types for the simulation. These are the contract between
 * the sim core, the Monte Carlo runner, and the renderer.
 */

/** One entry in an army: which NPC and how many of them. */
export type ArmyEntry = {
  /** NPC id from data/npcs.json (or a temporary test id). */
  npcId: string;
  count: number;
};

/** Configuration for a single battle (or a Monte Carlo series). */
export type BattleConfig = {
  /** Units on side A (left / "blue"). */
  armyA: ArmyEntry[];
  /** Units on side B (right / "red"). */
  armyB: ArmyEntry[];
  /** Arena width in tiles (X). */
  arenaWidth: number;
  /** Arena height in tiles (Y). */
  arenaHeight: number;
  /** Master seed for this battle (or the series). */
  seed: number;
  /** Hard stop after this many ticks (0.6 s each). Default 1800 = 18 min. */
  tickCap: number;
  /**
   * When true the sim records a full per-tick replay log.
   * Keep false for bulk Monte Carlo runs.
   */
  recordReplay?: boolean;
};

/** Outcome of one completed battle. */
export type BattleResult = {
  /** "A" | "B" | "draw" (timeout). */
  winner: "A" | "B" | "draw";
  ticksElapsed: number;
  /** Living units remaining on each side at end. */
  survivorsA: number;
  survivorsB: number;
  /** Optional: remaining hitpoints of survivors (for richer stats). */
  remainingHpA?: number[];
  remainingHpB?: number[];
  /** Present only when recordReplay was true. */
  replay?: ReplayLog;
};

/** Compact per-tick snapshot for the renderer. */
export type ReplayFrame = {
  tick: number;
  units: ReplayUnit[];
  events: ReplayEvent[];
};

export type ReplayUnit = {
  id: number;
  side: "A" | "B";
  npcId: string;
  /** South-west tile of the footprint. */
  x: number;
  y: number;
  hitpoints: number;
  maxHitpoints: number;
  state: UnitState;
  targetId: number | null;
};

export type ReplayEvent =
  | { type: "attack"; attackerId: number; defenderId: number; damage: number; hit: boolean }
  | { type: "death"; unitId: number }
  | { type: "move"; unitId: number; fromX: number; fromY: number; toX: number; toY: number };

export type ReplayLog = {
  config: BattleConfig;
  frames: ReplayFrame[];
};

/** High-level behavioural state of a unit. */
export type UnitState = "Idle" | "Chase" | "Attack" | "Retarget" | "Dead";
