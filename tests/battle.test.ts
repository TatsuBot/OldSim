import { describe, it, expect } from "vitest";
import { runBattle, type BattleConfig } from "../src/sim/index.js";

function baseConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    armyA: [],
    armyB: [],
    arenaWidth: 40,
    arenaHeight: 40,
    seed: 42,
    tickCap: 1800,
    ...overrides,
  };
}

describe("Phase 7 — tick loop", () => {
  it("zero units ends immediately as draw", () => {
    const result = runBattle(baseConfig());
    expect(result.winner).toBe("draw");
    expect(result.ticksElapsed).toBe(0);
  });

  it("is deterministic: same seed → identical result", () => {
    const cfg = baseConfig({
      armyA: [{ npcId: "415", count: 1 }], // Abyssal demon
      armyB: [{ npcId: "3028", count: 1 }], // Goblin
      seed: 12345,
    });
    const a = runBattle(cfg);
    const b = runBattle(cfg);
    expect(a.winner).toBe(b.winner);
    expect(a.ticksElapsed).toBe(b.ticksElapsed);
    expect(a.survivorsA).toBe(b.survivorsA);
    expect(a.survivorsB).toBe(b.survivorsB);
  });

  it("Abyssal demon vs Goblin: demon wins the vast majority", () => {
    let demonWins = 0;
    const runs = 50;
    for (let i = 0; i < runs; i++) {
      const result = runBattle(
        baseConfig({
          armyA: [{ npcId: "415", count: 1 }],
          armyB: [{ npcId: "3028", count: 1 }],
          seed: 1000 + i,
          tickCap: 600,
        })
      );
      if (result.winner === "A") demonWins++;
    }
    // Demon should win almost every time
    expect(demonWins).toBeGreaterThanOrEqual(runs - 2);
  });

  it("duel finishes before tick cap (no timeout)", () => {
    const result = runBattle(
      baseConfig({
        armyA: [{ npcId: "415", count: 1 }],
        armyB: [{ npcId: "3028", count: 1 }],
        seed: 7,
        tickCap: 1800,
      })
    );
    expect(result.winner).not.toBe("draw");
    expect(result.ticksElapsed).toBeLessThan(1800);
    expect(result.ticksElapsed).toBeGreaterThan(0);
  });

  it("mirror match 5v5 goblins is roughly even over many seeds", () => {
    let winsA = 0;
    let winsB = 0;
    let draws = 0;
    const runs = 40;
    for (let i = 0; i < runs; i++) {
      const result = runBattle(
        baseConfig({
          armyA: [{ npcId: "3028", count: 5 }],
          armyB: [{ npcId: "3028", count: 5 }],
          seed: 2000 + i,
          tickCap: 1200,
        })
      );
      if (result.winner === "A") winsA++;
      else if (result.winner === "B") winsB++;
      else draws++;
    }
    // Should not be wildly skewed (allow noise with only 40 runs)
    expect(winsA + winsB).toBeGreaterThan(runs / 2); // most finish
    // Neither side should win > 85% of decisive games
    const decisive = winsA + winsB;
    if (decisive > 0) {
      expect(winsA / decisive).toBeLessThan(0.85);
      expect(winsB / decisive).toBeLessThan(0.85);
    }
  });

  it("records a replay when requested", () => {
    const result = runBattle(
      baseConfig({
        armyA: [{ npcId: "415", count: 1 }],
        armyB: [{ npcId: "3028", count: 1 }],
        seed: 1,
        recordReplay: true,
        tickCap: 600,
      })
    );
    expect(result.replay).toBeDefined();
    expect(result.replay!.frames.length).toBeGreaterThan(0);
    expect(result.replay!.frames[0]!.units.length).toBe(2);
  });

  it("lopsided army: 1 demon vs 3 goblins still favors the demon", () => {
    let demonWins = 0;
    const runs = 30;
    for (let i = 0; i < runs; i++) {
      const result = runBattle(
        baseConfig({
          armyA: [{ npcId: "415", count: 1 }],
          armyB: [{ npcId: "3028", count: 3 }],
          seed: 3000 + i,
          tickCap: 900,
        })
      );
      if (result.winner === "A") demonWins++;
    }
    expect(demonWins).toBeGreaterThan(runs * 0.7);
  });
});
