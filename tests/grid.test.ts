import { describe, it, expect } from "vitest";
import {
  createOpenGrid,
  addObstacle,
  occupiedTiles,
  canPlace,
  chebyshev,
  footprintDistance,
  inMeleeRange,
  canStep,
  hasLineOfSight,
  isTileBlocked,
  markOccupied,
  clearOccupied,
  footprintOverlapsOccupied,
} from "../src/sim/index.js";
import type { Footprint } from "../src/sim/index.js";

describe("Phase 4 — tile grid, footprints, range, collision", () => {
  it("createOpenGrid produces the requested size and is fully open", () => {
    const g = createOpenGrid(40, 30);
    expect(g.length).toBe(30);
    expect(g[0]!.length).toBe(40);
    expect(isTileBlocked(g, 0, 0)).toBe(false);
    expect(isTileBlocked(g, 39, 29)).toBe(false);
    expect(isTileBlocked(g, 40, 0)).toBe(true); // out of bounds = blocked
  });

  it("size-3 footprint reports nine occupied tiles", () => {
    const fp: Footprint = { x: 10, y: 10, size: 3 };
    const tiles = occupiedTiles(fp);
    expect(tiles).toHaveLength(9);
    expect(tiles).toContainEqual({ x: 10, y: 10 });
    expect(tiles).toContainEqual({ x: 12, y: 12 });
    expect(tiles).toContainEqual({ x: 11, y: 11 });
  });

  it("canPlace rejects footprints that overlap a blocked tile", () => {
    const g = createOpenGrid(20, 20);
    addObstacle(g, 5, 5, 8, 8); // 5..7 inclusive on each axis
    expect(canPlace(g, 0, 0, 1)).toBe(true);
    expect(canPlace(g, 5, 5, 1)).toBe(false);
    expect(canPlace(g, 4, 4, 2)).toBe(false); // size-2 would touch (5,5)
    expect(canPlace(g, 8, 8, 1)).toBe(true); // exclusive end
  });

  it("two footprints one tile apart are in melee range", () => {
    const a: Footprint = { x: 5, y: 5, size: 1 };
    const b: Footprint = { x: 6, y: 5, size: 1 }; // east adjacent
    expect(footprintDistance(a, b)).toBe(1);
    expect(inMeleeRange(a, b)).toBe(true);

    const diag: Footprint = { x: 6, y: 6, size: 1 };
    expect(inMeleeRange(a, diag)).toBe(true);

    const far: Footprint = { x: 8, y: 5, size: 1 };
    expect(inMeleeRange(a, far)).toBe(false);
  });

  it("size-2 vs size-1 adjacency works via footprint distance", () => {
    const big: Footprint = { x: 10, y: 10, size: 2 }; // occupies 10-11, 10-11
    const near: Footprint = { x: 12, y: 10, size: 1 }; // touches east edge
    expect(footprintDistance(big, near)).toBe(1);
    expect(inMeleeRange(big, near)).toBe(true);

    const far: Footprint = { x: 13, y: 10, size: 1 };
    expect(footprintDistance(big, far)).toBe(2);
    expect(inMeleeRange(big, far)).toBe(false);
  });

  it("chebyshev distance is max(|dx|,|dy|)", () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
    expect(chebyshev({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it("corner rule: cannot cut diagonally past a blocked tile", () => {
    const g = createOpenGrid(10, 10);
    addObstacle(g, 2, 2, 3, 3); // single blocked tile at (2,2)

    // From (1,1) trying to step NE to (2,2) — destination blocked
    expect(canStep(g, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);

    // From (1,2) to (2,3): diagonal that cuts the corner of (2,2)
    // Orthogonal intermediates: (2,2) blocked and (1,3) open → should fail
    expect(canStep(g, { x: 1, y: 2 }, { x: 2, y: 3 })).toBe(false);

    // Orthogonal step around is fine
    expect(canStep(g, { x: 1, y: 2 }, { x: 1, y: 3 })).toBe(true);
  });

  it("size-3 unit cannot enter a 2-tile-wide gap", () => {
    const g = createOpenGrid(20, 10);
    // Wall with a 2-tile gap: blocked columns 0-8 and 11-19, open 9-10
    for (let x = 0; x < 20; x++) {
      if (x < 9 || x > 10) {
        addObstacle(g, x, 4, x + 1, 6);
      }
    }
    // size-3 needs 3 clear tiles; gap is only 2 wide
    expect(canPlace(g, 8, 4, 3)).toBe(false);
    expect(canPlace(g, 9, 4, 3)).toBe(false);
    // size-1 can sit in the gap
    expect(canPlace(g, 9, 4, 1)).toBe(true);
    expect(canPlace(g, 10, 4, 1)).toBe(true);
  });

  it("line of sight is blocked by a solid wall and restored by a gap", () => {
    const g = createOpenGrid(20, 10);
    // Solid wall across the middle
    addObstacle(g, 0, 4, 20, 5);
    expect(hasLineOfSight(g, 5, 2, 5, 7)).toBe(false);

    // Punch a gap
    g[4]![5]!.blocked = false;
    expect(hasLineOfSight(g, 5, 2, 5, 7)).toBe(true);
  });

  it("occupancy tracking: mark / clear / overlap", () => {
    const occupied = new Set<string>();
    const a: Footprint = { x: 3, y: 3, size: 2 };
    markOccupied(a, occupied);
    expect(occupied.size).toBe(4);
    expect(footprintOverlapsOccupied({ x: 4, y: 4, size: 1 }, occupied)).toBe(true);
    expect(footprintOverlapsOccupied({ x: 0, y: 0, size: 1 }, occupied)).toBe(false);
    clearOccupied(a, occupied);
    expect(occupied.size).toBe(0);
  });
});
