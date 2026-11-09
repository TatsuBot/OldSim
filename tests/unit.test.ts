import { describe, it, expect } from "vitest";
import {
  getNpc,
  createUnit,
  footprintOf,
  acquireTarget,
  updateState,
  applyDamage,
  tickCooldown,
  inMeleeRange,
} from "../src/sim/index.js";

describe("Phase 6 — targeting + state machine", () => {
  const goblin = () => getNpc("3028");
  const abby = () => getNpc("415");

  it("createUnit initialises Idle with full HP and no target", () => {
    const u = createUnit(1, "A", goblin(), 5, 5, 0);
    expect(u.state).toBe("Idle");
    expect(u.hitpoints).toBe(goblin().hitpoints);
    expect(u.targetId).toBeNull();
    expect(u.alive).toBe(true);
    expect(u.cooldown).toBe(0);
  });

  it("acquireTarget picks nearest enemy by footprint distance", () => {
    const self = createUnit(1, "A", goblin(), 5, 5, 0);
    const near = createUnit(2, "B", goblin(), 7, 5, 1); // dist 2
    const far = createUnit(3, "B", goblin(), 15, 5, 2); // dist 10

    const id = acquireTarget(self, [near, far]);
    expect(id).toBe(2);
  });

  it("acquireTarget tie-breaks by lowest spawnIndex", () => {
    const self = createUnit(1, "A", goblin(), 5, 5, 0);
    const a = createUnit(10, "B", goblin(), 7, 5, 5);
    const b = createUnit(11, "B", goblin(), 7, 5, 2); // same dist, lower spawnIndex

    // Place both at same distance
    a.x = 7;
    b.x = 7;
    const id = acquireTarget(self, [a, b]);
    expect(id).toBe(11); // spawnIndex 2 < 5
  });

  it("targeting is sticky — keeps current target while alive", () => {
    const self = createUnit(1, "A", goblin(), 5, 5, 0);
    const first = createUnit(2, "B", goblin(), 8, 5, 0);
    const closer = createUnit(3, "B", goblin(), 6, 5, 1);

    self.targetId = 2;
    self.unreachableTicks = 0;

    // Closer enemy exists, but sticky target is still alive
    const id = acquireTarget(self, [first, closer]);
    expect(id).toBe(2);
  });

  it("retargets when sticky target dies", () => {
    const self = createUnit(1, "A", goblin(), 5, 5, 0);
    const dead = createUnit(2, "B", goblin(), 8, 5, 0);
    dead.alive = false;
    dead.hitpoints = 0;
    const other = createUnit(3, "B", goblin(), 10, 5, 1);

    self.targetId = 2;
    const id = acquireTarget(self, [dead, other]);
    expect(id).toBe(3);
  });

  it("retargets after unreachable timeout", () => {
    const self = createUnit(1, "A", goblin(), 5, 5, 0);
    const stuck = createUnit(2, "B", goblin(), 20, 5, 0);
    const other = createUnit(3, "B", goblin(), 7, 5, 1);

    self.targetId = 2;
    self.unreachableTicks = 20; // at limit

    const id = acquireTarget(self, [stuck, other], 20);
    expect(id).toBe(3);
  });

  it("updateState: Idle when no target, Attack when in range, Chase when not", () => {
    const self = createUnit(1, "A", goblin(), 5, 5, 0);
    const enemy = createUnit(2, "B", goblin(), 6, 5, 0); // adjacent

    expect(updateState(self, null, false)).toBe("Idle");

    // in range
    expect(
      inMeleeRange(footprintOf(self), footprintOf(enemy))
    ).toBe(true);
    expect(updateState(self, enemy, true)).toBe("Attack");
    expect(self.state).toBe("Attack");

    // out of range
    enemy.x = 12;
    expect(updateState(self, enemy, false)).toBe("Chase");
  });

  it("applyDamage kills at 0 HP and sets Dead", () => {
    const u = createUnit(1, "A", goblin(), 0, 0, 0);
    const hp = u.hitpoints;
    expect(applyDamage(u, hp - 1)).toBe(false);
    expect(u.alive).toBe(true);

    expect(applyDamage(u, 1)).toBe(true);
    expect(u.alive).toBe(false);
    expect(u.state).toBe("Dead");
    expect(u.hitpoints).toBe(0);
  });

  it("tickCooldown decreases each call down to 0", () => {
    const u = createUnit(1, "A", goblin(), 0, 0, 0);
    u.cooldown = 3;
    tickCooldown(u);
    expect(u.cooldown).toBe(2);
    tickCooldown(u);
    tickCooldown(u);
    expect(u.cooldown).toBe(0);
    tickCooldown(u);
    expect(u.cooldown).toBe(0);
  });

  it("returns null when no living enemies", () => {
    const self = createUnit(1, "A", goblin(), 5, 5, 0);
    const dead = createUnit(2, "B", goblin(), 6, 5, 0);
    dead.alive = false;
    expect(acquireTarget(self, [dead])).toBeNull();
    expect(acquireTarget(self, [])).toBeNull();
  });
});
