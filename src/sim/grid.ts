/**
 * Tile grid, footprints, collision, and range checks.
 * OSRS is a tile game: positions, movement, and melee range are decided on a grid.
 *
 * Position convention (matches OSRS): the south-west tile of a unit's footprint.
 * A size-3 NPC at (10, 10) occupies tiles (10..12, 10..12).
 */

/** Direction deltas for the 8 neighbouring tiles (and self at index 0 unused). */
export const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [0, 1],   // N
  [1, 1],   // NE
  [1, 0],   // E
  [1, -1],  // SE
  [0, -1],  // S
  [-1, -1], // SW
  [-1, 0],  // W
  [-1, 1],  // NW
];

export type Tile = {
  /** Fully blocked (wall interior / solid object). */
  blocked: boolean;
  /** Edge blocks for movement / projectiles (true = blocked). */
  blockN: boolean;
  blockE: boolean;
  blockS: boolean;
  blockW: boolean;
};

export type Point = { x: number; y: number };

/**
 * Axis-aligned footprint: south-west corner + size.
 * Occupies [x, x+size) × [y, y+size).
 */
export type Footprint = {
  x: number;
  y: number;
  size: number;
};

/** Create an all-open rectangular arena. */
export function createOpenGrid(width: number, height: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        blocked: false,
        blockN: false,
        blockE: false,
        blockS: false,
        blockW: false,
      });
    }
    grid.push(row);
  }
  return grid;
}

/** Mark a solid rectangular obstacle (inclusive min, exclusive max). */
export function addObstacle(
  grid: Tile[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    const row = grid[y]!;
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      row[x]!.blocked = true;
    }
  }
}

export function inBounds(grid: Tile[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < (grid[0]?.length ?? 0);
}

export function isTileBlocked(grid: Tile[][], x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return true;
  return grid[y]![x]!.blocked;
}

/**
 * All tiles occupied by a footprint.
 */
export function occupiedTiles(fp: Footprint): Point[] {
  const tiles: Point[] = [];
  for (let dy = 0; dy < fp.size; dy++) {
    for (let dx = 0; dx < fp.size; dx++) {
      tiles.push({ x: fp.x + dx, y: fp.y + dy });
    }
  }
  return tiles;
}

/**
 * Can a footprint of the given size sit with its SW corner at (x, y)?
 * Checks static collision only (not unit occupancy).
 */
export function canPlace(
  grid: Tile[][],
  x: number,
  y: number,
  size: number
): boolean {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (isTileBlocked(grid, x + dx, y + dy)) return false;
    }
  }
  return true;
}

/**
 * Chebyshev distance between two points (max of |dx|, |dy|).
 * Used for OSRS-style range and "nearest" targeting.
 */
export function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Minimum Chebyshev distance between any tile of fpA and any tile of fpB.
 */
export function footprintDistance(a: Footprint, b: Footprint): number {
  // Distance between two axis-aligned squares.
  // On each axis, the gap (or 0 if overlapping).
  const gapX = axisGap(a.x, a.x + a.size - 1, b.x, b.x + b.size - 1);
  const gapY = axisGap(a.y, a.y + a.size - 1, b.y, b.y + b.size - 1);
  return Math.max(gapX, gapY);
}

function axisGap(a0: number, a1: number, b0: number, b1: number): number {
  if (a1 < b0) return b0 - a1;
  if (b1 < a0) return a0 - b1;
  return 0; // overlap or touch
}

/**
 * Two footprints are in melee range when the min Chebyshev distance is exactly 1
 * (adjacent, including diagonally). Distance 0 means overlapping (not used for living units).
 */
export function inMeleeRange(a: Footprint, b: Footprint): boolean {
  return footprintDistance(a, b) === 1;
}

/**
 * True if any tile of the footprint is currently marked occupied.
 * `occupied` is a set of "x,y" keys for tiles held by living units.
 */
export function footprintOverlapsOccupied(
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

/** Add every tile of a footprint to the occupied set. */
export function markOccupied(fp: Footprint, occupied: Set<string>): void {
  for (let dy = 0; dy < fp.size; dy++) {
    for (let dx = 0; dx < fp.size; dx++) {
      occupied.add(`${fp.x + dx},${fp.y + dy}`);
    }
  }
}

/** Remove every tile of a footprint from the occupied set. */
export function clearOccupied(fp: Footprint, occupied: Set<string>): void {
  for (let dy = 0; dy < fp.size; dy++) {
    for (let dx = 0; dx < fp.size; dx++) {
      occupied.delete(`${fp.x + dx},${fp.y + dy}`);
    }
  }
}

/**
 * Can a unit step from `from` to `to` (one tile step, possibly diagonal)?
 * Applies the OSRS corner-cutting rule: a diagonal step is illegal if either
 * of the two orthogonal tiles it cuts between is blocked on the shared edge
 * (or is fully blocked).
 *
 * For version 1 we treat fully-blocked tiles as impassable and ignore edge flags
 * except as a future extension point. Corner rule is enforced via the two
 * orthogonal neighbours being non-blocked.
 */
export function canStep(
  grid: Tile[][],
  from: Point,
  to: Point,
  size: number = 1
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
  if (dx === 0 && dy === 0) return false;

  // Destination footprint must fit and be free of static blocks.
  if (!canPlace(grid, to.x, to.y, size)) return false;

  // Diagonal: both orthogonal intermediate tiles must be placeable for size-1
  // (or at least not fully blocked) — the classic corner rule.
  if (dx !== 0 && dy !== 0) {
    if (isTileBlocked(grid, from.x + dx, from.y)) return false;
    if (isTileBlocked(grid, from.x, from.y + dy)) return false;
  }

  return true;
}

/**
 * Simple Bresenham-style line-of-sight between two tile centres / closest tiles.
 * Returns false if any crossed tile is fully blocked.
 * (Edge-flag projectile checks can be layered later; v1 uses full-tile blocks.)
 */
export function hasLineOfSight(
  grid: Tile[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    // Skip the start tile; block if we hit a blocked tile before the end.
    if ((x !== x0 || y !== y0) && (x !== x1 || y !== y1)) {
      if (isTileBlocked(grid, x, y)) return false;
    }
    if (x === x1 && y === y1) return true;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}
