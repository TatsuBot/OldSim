/**
 * OSRS-style NPC pathing.
 *
 * Rules modelled:
 * - Tick-locked: one step per tick (default speed 1).
 * - 8 directions; diagonal steps obey the corner rule.
 * - Goal = any tile from which the unit is in attack range of the target
 *   (NOT the target's own occupied tiles — that classic bug makes units push forever).
 * - BFS for a true shortest path in tiles; take only the first step; replan next tick.
 * - Footprint-aware: every tile of a size>1 destination must be placeable.
 * - Occupied tiles treated as blocked for stopping (v1 clumping).
 * - Fallback order when BFS finds nothing: already-in-range → greedy step → stay.
 */

import {
  canPlace,
  canStep,
  footprintDistance,
  inMeleeRange,
  isTileBlocked,
  type Footprint,
  type Point,
  type Tile,
  DIRS8,
} from "./grid.js";

export type PathingContext = {
  grid: Tile[][];
  /** "x,y" keys of tiles occupied by living units (excluding the mover itself). */
  occupied: ReadonlySet<string>;
  /** Max tiles BFS may visit before giving up (local search cap). */
  bfsLimit?: number;
};

export type PathStepResult = {
  /** Next SW corner to move to, or null if no move this tick. */
  step: Point | null;
  /** Why we chose this (useful for logging / debugging). */
  reason: "bfs" | "already_in_range" | "greedy" | "stuck" | "no_goal";
};

/**
 * Generate goal tiles: every legal SW position from which `size`-footprint
 * is in melee range of the target footprint (or within attackRange for non-melee).
 * For v1 we only need melee (range 1).
 */
export function goalTiles(
  grid: Tile[][],
  target: Footprint,
  size: number,
  attackRange: number = 1,
  occupied: ReadonlySet<string> = new Set()
): Point[] {
  const goals: Point[] = [];
  const h = grid.length;
  const w = grid[0]?.length ?? 0;

  // Search a band around the target large enough for size + range.
  const margin = size + attackRange + 1;
  const minX = Math.max(0, target.x - margin);
  const maxX = Math.min(w - size, target.x + target.size + margin);
  const minY = Math.max(0, target.y - margin);
  const maxY = Math.min(h - size, target.y + target.size + margin);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!canPlace(grid, x, y, size)) continue;
      // Don't stand on currently occupied tiles.
      if (footprintBlockedByOccupied({ x, y, size }, occupied)) continue;

      const dist = footprintDistance({ x, y, size }, target);
      if (attackRange === 1) {
        if (dist === 1) goals.push({ x, y });
      } else {
        if (dist >= 1 && dist <= attackRange) goals.push({ x, y });
      }
    }
  }
  return goals;
}

function footprintBlockedByOccupied(
  fp: Footprint,
  occupied: ReadonlySet<string>
): boolean {
  for (let dy = 0; dy < fp.size; dy++) {
    for (let dx = 0; dx < fp.size; dx++) {
      if (occupied.has(`${fp.x + dx},${fp.y + dy}`)) return true;
    }
  }
  return false;
}

/**
 * BFS from `start` looking for any goal tile.
 * Returns the first step toward a nearest goal, or null if none reachable
 * within the visit limit.
 */
export function bfsFirstStep(
  grid: Tile[][],
  start: Point,
  goals: ReadonlySet<string>,
  size: number,
  occupied: ReadonlySet<string>,
  limit: number = 200
): Point | null {
  if (goals.has(`${start.x},${start.y}`)) return null; // already there

  const key = (p: Point) => `${p.x},${p.y}`;
  const visited = new Set<string>();
  // parent pointer to reconstruct only the first step
  const parent = new Map<string, Point>();
  const queue: Point[] = [start];
  visited.add(key(start));
  let visits = 0;

  while (queue.length > 0 && visits < limit) {
    const cur = queue.shift()!;
    visits++;

    for (const [dx, dy] of DIRS8) {
      const next: Point = { x: cur.x + dx, y: cur.y + dy };
      const nk = key(next);
      if (visited.has(nk)) continue;

      // Static + corner rule
      if (!canStep(grid, cur, next, size)) continue;
      // Occupancy (destination footprint must be free)
      if (footprintBlockedByOccupied({ x: next.x, y: next.y, size }, occupied)) {
        continue;
      }

      visited.add(nk);
      parent.set(nk, cur);

      if (goals.has(nk)) {
        // Walk back to the step right after start
        let step = next;
        let p = parent.get(nk)!;
        while (p.x !== start.x || p.y !== start.y) {
          step = p;
          p = parent.get(key(p))!;
        }
        return step;
      }

      queue.push(next);
    }
  }
  return null;
}

/**
 * Greedy fallback: among legal 8-dir steps, pick the one that most reduces
 * Chebyshev distance to the target's SW corner (or any target tile).
 */
export function greedyStep(
  grid: Tile[][],
  from: Point,
  target: Footprint,
  size: number,
  occupied: ReadonlySet<string>
): Point | null {
  let best: Point | null = null;
  let bestDist = footprintDistance({ x: from.x, y: from.y, size }, target);

  for (const [dx, dy] of DIRS8) {
    const next: Point = { x: from.x + dx, y: from.y + dy };
    if (!canStep(grid, from, next, size)) continue;
    if (footprintBlockedByOccupied({ x: next.x, y: next.y, size }, occupied)) {
      continue;
    }
    const d = footprintDistance({ x: next.x, y: next.y, size }, target);
    if (d < bestDist) {
      bestDist = d;
      best = next;
    }
  }
  return best;
}

/**
 * Compute the single step a unit should take this tick toward its target.
 */
export function findPathStep(
  ctx: PathingContext,
  from: Point,
  size: number,
  target: Footprint,
  attackRange: number = 1
): PathStepResult {
  const { grid, occupied, bfsLimit = 200 } = ctx;

  // Already in range → don't move.
  if (attackRange === 1) {
    if (inMeleeRange({ x: from.x, y: from.y, size }, target)) {
      return { step: null, reason: "already_in_range" };
    }
  } else {
    const dist = footprintDistance({ x: from.x, y: from.y, size }, target);
    if (dist >= 1 && dist <= attackRange) {
      return { step: null, reason: "already_in_range" };
    }
  }

  const goals = goalTiles(grid, target, size, attackRange, occupied);
  if (goals.length === 0) {
    // No legal standing tile in range (crowded / walled). Try greedy anyway.
    const g = greedyStep(grid, from, target, size, occupied);
    return g
      ? { step: g, reason: "greedy" }
      : { step: null, reason: "no_goal" };
  }

  const goalSet = new Set(goals.map((p) => `${p.x},${p.y}`));
  const step = bfsFirstStep(grid, from, goalSet, size, occupied, bfsLimit);
  if (step) return { step, reason: "bfs" };

  // BFS failed (blocked / limit). Greedy fallback.
  const g = greedyStep(grid, from, target, size, occupied);
  if (g) return { step: g, reason: "greedy" };

  return { step: null, reason: "stuck" };
}

/**
 * Convenience: distance in steps on open ground (Chebyshev), useful for tests.
 */
export function openGroundSteps(from: Point, to: Point): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}
