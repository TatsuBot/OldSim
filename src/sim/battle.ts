/**
 * Core battle simulation — tick loop wiring combat, pathing, and targeting.
 *
 * Ordering (documented for reproducibility):
 * 1. Acquire / validate target
 * 2. Tick cooldown down
 * 3. If in range and cooldown ready → attack
 * 4. Else → path one step toward target
 * 5. Remove dead, record frame, check end conditions
 */

import { createRng } from "./rng.js";
import type {
  BattleConfig,
  BattleResult,
  ReplayFrame,
  ReplayLog,
  ReplayEvent,
  ReplayUnit,
} from "./types.js";
import { getNpc, loadNpcDatabase } from "./npcLoader.js";
import {
  createOpenGrid,
  inMeleeRange,
  markOccupied,
  clearOccupied,
  canPlace,
  type Tile,
} from "./grid.js";
import { findPathStep, type PathingContext } from "./pathing.js";
import {
  createUnit,
  footprintOf,
  acquireTarget,
  updateState,
  applyDamage,
  tickCooldown,
  type SimUnit,
  type Side,
} from "./unit.js";
import { resolveAttack, styleFromNpc } from "./combat.js";

const UNREACHABLE_LIMIT = 20;

/**
 * Run a single deterministic battle.
 * Same config + seed → identical result, tick for tick.
 */
export function runBattle(config: BattleConfig): BattleResult {
  loadNpcDatabase();
  const rng = createRng(config.seed);
  const grid = createOpenGrid(config.arenaWidth, config.arenaHeight);
  const occupied = new Set<string>();

  const units = spawnArmies(config, grid, occupied);
  if (units.length === 0) {
    return {
      winner: "draw",
      ticksElapsed: 0,
      survivorsA: 0,
      survivorsB: 0,
      replay: config.recordReplay ? { config, frames: [] } : undefined,
    };
  }

  const frames: ReplayFrame[] = [];
  let tick = 0;

  for (tick = 0; tick < config.tickCap; tick++) {
    const events: ReplayEvent[] = [];
    const living = units.filter((u) => u.alive).sort((a, b) => a.id - b.id);

    for (const unit of living) {
      if (!unit.alive) continue;

      const enemies = units.filter((u) => u.alive && u.side !== unit.side);

      const targetId = acquireTarget(unit, enemies, UNREACHABLE_LIMIT);
      const target =
        targetId !== null ? units.find((u) => u.id === targetId) ?? null : null;

      const inRange =
        target !== null &&
        target.alive &&
        inMeleeRange(footprintOf(unit), footprintOf(target));

      updateState(unit, target, inRange);
      tickCooldown(unit);

      if (target && target.alive && inRange) {
        if (unit.cooldown === 0) {
          const style = styleFromNpc(unit.def);
          const result = resolveAttack(unit.def, target.def, rng, style);
          events.push({
            type: "attack",
            attackerId: unit.id,
            defenderId: target.id,
            damage: result.damage,
            hit: result.hit,
          });
          if (result.hit && result.damage > 0) {
            const died = applyDamage(target, result.damage);
            if (died) {
              events.push({ type: "death", unitId: target.id });
              clearOccupied(footprintOf(target), occupied);
            }
          }
          unit.cooldown = unit.def.attackSpeed;
        }
        unit.unreachableTicks = 0;
      } else if (target && target.alive) {
        clearOccupied(footprintOf(unit), occupied);
        const ctx: PathingContext = { grid, occupied, bfsLimit: 200 };
        const pathResult = findPathStep(
          ctx,
          { x: unit.x, y: unit.y },
          unit.def.size,
          footprintOf(target),
          unit.def.attackRange
        );

        if (pathResult.step) {
          const fromX = unit.x;
          const fromY = unit.y;
          unit.x = pathResult.step.x;
          unit.y = pathResult.step.y;
          events.push({
            type: "move",
            unitId: unit.id,
            fromX,
            fromY,
            toX: unit.x,
            toY: unit.y,
          });
          unit.unreachableTicks = 0;
        } else if (
          pathResult.reason === "stuck" ||
          pathResult.reason === "no_goal"
        ) {
          unit.unreachableTicks += 1;
        } else {
          unit.unreachableTicks = 0;
        }
        markOccupied(footprintOf(unit), occupied);
      } else {
        unit.unreachableTicks = 0;
      }
    }

    if (config.recordReplay) {
      frames.push({
        tick,
        units: units.map(toReplayUnit),
        events,
      });
    }

    const aliveA = units.filter((u) => u.alive && u.side === "A").length;
    const aliveB = units.filter((u) => u.alive && u.side === "B").length;
    if (aliveA === 0 || aliveB === 0) {
      return finish(config, units, tick + 1, frames, aliveA, aliveB);
    }
  }

  const aliveA = units.filter((u) => u.alive && u.side === "A").length;
  const aliveB = units.filter((u) => u.alive && u.side === "B").length;
  return finish(config, units, config.tickCap, frames, aliveA, aliveB);
}

function finish(
  config: BattleConfig,
  units: SimUnit[],
  ticksElapsed: number,
  frames: ReplayFrame[],
  aliveA: number,
  aliveB: number
): BattleResult {
  let winner: "A" | "B" | "draw" = "draw";
  if (aliveA > 0 && aliveB === 0) winner = "A";
  else if (aliveB > 0 && aliveA === 0) winner = "B";

  const result: BattleResult = {
    winner,
    ticksElapsed,
    survivorsA: aliveA,
    survivorsB: aliveB,
    remainingHpA: units
      .filter((u) => u.alive && u.side === "A")
      .map((u) => u.hitpoints),
    remainingHpB: units
      .filter((u) => u.alive && u.side === "B")
      .map((u) => u.hitpoints),
  };

  if (config.recordReplay) {
    result.replay = { config, frames } satisfies ReplayLog;
  }
  return result;
}

function toReplayUnit(u: SimUnit): ReplayUnit {
  return {
    id: u.id,
    side: u.side,
    npcId: u.npcId,
    x: u.x,
    y: u.y,
    hitpoints: u.hitpoints,
    maxHitpoints: u.maxHitpoints,
    state: u.state,
    targetId: u.targetId,
  };
}

function spawnArmies(
  config: BattleConfig,
  grid: Tile[][],
  occupied: Set<string>
): SimUnit[] {
  const units: SimUnit[] = [];
  let nextId = 1;
  let spawnIndex = 0;

  const placeSide = (
    entries: BattleConfig["armyA"],
    side: Side,
    west: boolean
  ) => {
    const margin = 2;
    const startX = west ? margin : Math.max(margin, config.arenaWidth - margin - 10);
    let cursorX = startX;
    let cursorY = margin;
    const maxY = config.arenaHeight - margin;

    for (const entry of entries) {
      const def = getNpc(entry.npcId);
      for (let n = 0; n < entry.count; n++) {
        let placed = false;
        for (let attempt = 0; attempt < 800; attempt++) {
          if (cursorY + def.size > maxY) {
            cursorY = margin;
            cursorX += def.size + 1;
          }
          if (canPlace(grid, cursorX, cursorY, def.size)) {
            let free = true;
            for (let dy = 0; dy < def.size && free; dy++) {
              for (let dx = 0; dx < def.size && free; dx++) {
                if (occupied.has(`${cursorX + dx},${cursorY + dy}`)) free = false;
              }
            }
            if (free) {
              const unit = createUnit(
                nextId++,
                side,
                def,
                cursorX,
                cursorY,
                spawnIndex++
              );
              markOccupied(
                { x: cursorX, y: cursorY, size: def.size },
                occupied
              );
              units.push(unit);
              cursorY += def.size + 1;
              placed = true;
              break;
            }
          }
          cursorY += 1;
        }
        if (!placed) {
          throw new Error(
            `Could not place ${entry.npcId} for side ${side} — arena full`
          );
        }
      }
    }
  };

  placeSide(config.armyA, "A", true);
  placeSide(config.armyB, "B", false);
  return units;
}
