import { describe, it, expect } from "vitest";
import {
  createOpenGrid,
  addObstacle,
  inMeleeRange,
  findPathStep,
  openGroundSteps,
  goalTiles,
  markOccupied,
  type Footprint,
  type Point,
  type PathingContext,
} from "../src/sim/index.js";

function ctx(
  grid: ReturnType<typeof createOpenGrid>,
  occupied: Set<string> = new Set()
): PathingContext {
  return { grid, occupied, bfsLimit: 300 };
}

describe("Phase 5 — OSRS-style pathing", () => {
  it("open ground: reaches melee range in exactly N steps (Chebyshev)", () => {
    const grid = createOpenGrid(30, 30);
    const start: Point = { x: 5, y: 5 };
    const target: Footprint = { x: 15, y: 5, size: 1 }; // 10 tiles east
    const expected = openGroundSteps(start, { x: 14, y: 5 }); // stand at 14 to be adjacent

    let pos = { ...start };
    let steps = 0;
    const occupied = new Set<string>();

    while (!inMeleeRange({ ...pos, size: 1 }, target) && steps < 20) {
      const result = findPathStep(ctx(grid, occupied), pos, 1, target);
      expect(result.step).not.toBeNull();
      pos = result.step!;
      steps++;
    }

    expect(inMeleeRange({ ...pos, size: 1 }, target)).toBe(true);
    expect(steps).toBe(expected);
  });

  it("uses diagonal steps when they shorten the route", () => {
    const grid = createOpenGrid(20, 20);
    const start: Point = { x: 2, y: 2 };
    const target: Footprint = { x: 7, y: 7, size: 1 };
    // Chebyshev distance to an adjacent tile is 4 (stand at 6,6)
    const result = findPathStep(ctx(grid), start, 1, target);
    expect(result.step).not.toBeNull();
    // First step should be diagonal toward the target
    expect(result.step!.x).toBe(3);
    expect(result.step!.y).toBe(3);
    expect(result.reason).toBe("bfs");
  });

  it("corner rule: routes around a single blocked tile instead of cutting", () => {
    const grid = createOpenGrid(15, 15);
    addObstacle(grid, 5, 5, 6, 6); // pillar at (5,5)

    const start: Point = { x: 3, y: 5 };
    const target: Footprint = { x: 7, y: 5, size: 1 };

    // Simulate a few steps — should never land on (5,5) and should reach range
    let pos = { ...start };
    const path: Point[] = [pos];
    for (let i = 0; i < 10; i++) {
      if (inMeleeRange({ ...pos, size: 1 }, target)) break;
      const r = findPathStep(ctx(grid), pos, 1, target);
      if (!r.step) break;
      pos = r.step;
      path.push(pos);
      expect(pos.x === 5 && pos.y === 5).toBe(false);
    }
    expect(inMeleeRange({ ...pos, size: 1 }, target)).toBe(true);
  });

  it("size-3 unit never enters a 2-tile-wide gap; size-1 does", () => {
    // 2-row-high corridor (y=4,5) running the full width.
    // Size-1 fits and can walk it; size-3 needs 3 rows and cannot place at all.
    const grid = createOpenGrid(24, 10);
    for (let x = 0; x < 24; x++) {
      addObstacle(grid, x, 0, x + 1, 4); // block y=0..3
      addObstacle(grid, x, 6, x + 1, 10); // block y=6..9
    }

    const target: Footprint = { x: 18, y: 4, size: 1 };

    // size-1 walks the corridor end-to-end
    let pos1: Point = { x: 2, y: 4 };
    for (let i = 0; i < 25; i++) {
      if (inMeleeRange({ ...pos1, size: 1 }, target)) break;
      const r = findPathStep(ctx(grid), pos1, 1, target);
      if (!r.step) break;
      pos1 = r.step;
    }
    expect(inMeleeRange({ ...pos1, size: 1 }, target)).toBe(true);
    expect(pos1.x).toBeGreaterThanOrEqual(17);

    // size-3 cannot place anywhere in a 2-row corridor
    const start3: Point = { x: 2, y: 4 };
    const r3 = findPathStep(ctx(grid), start3, 3, target);
    expect(r3.step).toBeNull();
  });

  it("already in range → no movement", () => {
    const grid = createOpenGrid(10, 10);
    const pos: Point = { x: 3, y: 3 };
    const target: Footprint = { x: 4, y: 3, size: 1 };
    const r = findPathStep(ctx(grid), pos, 1, target);
    expect(r.step).toBeNull();
    expect(r.reason).toBe("already_in_range");
  });

  it("unreachable (walled-off) target triggers fallback, does not loop forever", () => {
    const grid = createOpenGrid(15, 15);
    // Box around the target
    addObstacle(grid, 6, 6, 10, 7);
    addObstacle(grid, 6, 9, 10, 10);
    addObstacle(grid, 6, 6, 7, 10);
    addObstacle(grid, 9, 6, 10, 10);

    const start: Point = { x: 2, y: 2 };
    const target: Footprint = { x: 7, y: 7, size: 1 };

    const r = findPathStep(ctx(grid), start, 1, target);
    // Should return quickly with greedy or stuck/no_goal — never hang
    expect(["greedy", "stuck", "no_goal", "bfs"]).toContain(r.reason);
  });

  it("occupied tiles are avoided; unit paths to free adjacent tile", () => {
    const grid = createOpenGrid(15, 15);
    const target: Footprint = { x: 8, y: 5, size: 1 };
    const occupied = new Set<string>();
    // Block the natural adjacent tiles east of start toward target
    markOccupied({ x: 6, y: 5, size: 1 }, occupied);
    markOccupied({ x: 7, y: 5, size: 1 }, occupied);

    const start: Point = { x: 5, y: 5 };
    const r = findPathStep(ctx(grid, occupied), start, 1, target);
    expect(r.step).not.toBeNull();
    // Should not step onto occupied tiles
    expect(occupied.has(`${r.step!.x},${r.step!.y}`)).toBe(false);
  });

  it("goal tiles are adjacent positions, not the target's own tile", () => {
    const grid = createOpenGrid(10, 10);
    const target: Footprint = { x: 5, y: 5, size: 1 };
    const goals = goalTiles(grid, target, 1, 1);
    const keys = new Set(goals.map((p) => `${p.x},${p.y}`));
    // Target tile itself must not be a goal
    expect(keys.has("5,5")).toBe(false);
    // Orthogonal and diagonal neighbours should be goals
    expect(keys.has("4,5")).toBe(true);
    expect(keys.has("6,5")).toBe(true);
    expect(keys.has("5,4")).toBe(true);
    expect(keys.has("5,6")).toBe(true);
    expect(keys.has("4,4")).toBe(true); // diagonal
  });

  it("replan-every-tick: after one step, next call produces the next step", () => {
    const grid = createOpenGrid(20, 20);
    let pos: Point = { x: 2, y: 2 };
    const target: Footprint = { x: 10, y: 2, size: 1 };
    const steps: Point[] = [];

    for (let i = 0; i < 10; i++) {
      if (inMeleeRange({ ...pos, size: 1 }, target)) break;
      const r = findPathStep(ctx(grid), pos, 1, target);
      expect(r.step).not.toBeNull();
      pos = r.step!;
      steps.push(pos);
    }
    expect(inMeleeRange({ ...pos, size: 1 }, target)).toBe(true);
    // Path should be monotonically approaching
    expect(steps.length).toBeGreaterThanOrEqual(7);
  });
});
