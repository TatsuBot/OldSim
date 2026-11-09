/**
 * Living unit in a battle: stats snapshot, position, state machine, targeting.
 */

import type { NpcDef } from "./npc.js";
import type { UnitState } from "./types.js";
import type { Footprint, Point } from "./grid.js";
import { footprintDistance } from "./grid.js";

export type Side = "A" | "B";

export type SimUnit = {
  id: number;
  side: Side;
  npcId: string;
  /** Live reference to the static NPC definition. */
  def: NpcDef;
  /** South-west tile of the footprint. */
  x: number;
  y: number;
  hitpoints: number;
  maxHitpoints: number;
  /** Ticks remaining before the unit can attack again. 0 = ready. */
  cooldown: number;
  state: UnitState;
  /** Id of current target, or null. */
  targetId: number | null;
  /** Consecutive ticks the current target has been unreachable via BFS. */
  unreachableTicks: number;
  /** Spawn order index — used for deterministic tie-breaks. */
  spawnIndex: number;
  alive: boolean;
};

export function footprintOf(u: SimUnit): Footprint {
  return { x: u.x, y: u.y, size: u.def.size };
}

export function createUnit(
  id: number,
  side: Side,
  def: NpcDef,
  x: number,
  y: number,
  spawnIndex: number
): SimUnit {
  return {
    id,
    side,
    npcId: def.id,
    def,
    x,
    y,
    hitpoints: def.hitpoints,
    maxHitpoints: def.hitpoints,
    cooldown: 0,
    state: "Idle",
    targetId: null,
    unreachableTicks: 0,
    spawnIndex,
    alive: true,
  };
}

/**
 * Sticky nearest-enemy targeting (Phase 0 / 6 default).
 * - On acquire / retarget: pick nearest living enemy by footprint Chebyshev distance.
 * - Tie-break: lowest spawnIndex (deterministic).
 * - Keep target until it dies or is unreachable for `unreachableLimit` ticks.
 */
export function acquireTarget(
  unit: SimUnit,
  enemies: readonly SimUnit[],
  unreachableLimit: number = 20
): number | null {
  // Keep sticky target if still alive and not timed-out unreachable.
  if (unit.targetId !== null) {
    const current = enemies.find((e) => e.id === unit.targetId && e.alive);
    if (current) {
      if (unit.unreachableTicks < unreachableLimit) {
        return unit.targetId;
      }
      // Timed out — fall through to retarget.
    }
  }

  let best: SimUnit | null = null;
  let bestDist = Infinity;

  const selfFp = footprintOf(unit);
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = footprintDistance(selfFp, footprintOf(e));
    if (
      d < bestDist ||
      (d === bestDist && best !== null && e.spawnIndex < best.spawnIndex) ||
      (d === bestDist && best === null)
    ) {
      bestDist = d;
      best = e;
    }
  }

  return best ? best.id : null;
}

/**
 * Advance the unit's behavioural state for this tick (before movement/attack).
 * Returns the new state and whether a retarget just happened.
 */
export function updateState(
  unit: SimUnit,
  target: SimUnit | null,
  inRange: boolean
): UnitState {
  if (!unit.alive || unit.hitpoints <= 0) {
    unit.alive = false;
    unit.state = "Dead";
    unit.targetId = null;
    return "Dead";
  }

  if (!target || !target.alive) {
    unit.targetId = null;
    unit.unreachableTicks = 0;
    unit.state = "Idle";
    return "Idle";
  }

  // Have a living target.
  unit.targetId = target.id;

  if (inRange) {
    unit.unreachableTicks = 0;
    unit.state = "Attack";
    return "Attack";
  }

  unit.state = "Chase";
  return "Chase";
}

export function applyDamage(unit: SimUnit, damage: number): boolean {
  if (!unit.alive) return false;
  unit.hitpoints -= damage;
  if (unit.hitpoints <= 0) {
    unit.hitpoints = 0;
    unit.alive = false;
    unit.state = "Dead";
    unit.targetId = null;
    return true; // died
  }
  return false;
}

export function tickCooldown(unit: SimUnit): void {
  if (unit.cooldown > 0) unit.cooldown -= 1;
}
