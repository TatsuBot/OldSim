import { describe, it, expect } from "vitest";
import { runBattle, createRng } from "../src/sim/index.js";
import type { BattleConfig } from "../src/sim/index.js";

describe("Phase 1 skeleton", () => {
  it("runs a zero-unit battle and ends immediately", () => {
    const config: BattleConfig = {
      armyA: [],
      armyB: [],
      arenaWidth: 40,
      arenaHeight: 40,
      seed: 42,
      tickCap: 1800,
    };

    const result = runBattle(config);

    expect(result.winner).toBe("draw");
    expect(result.ticksElapsed).toBe(0);
    expect(result.survivorsA).toBe(0);
    expect(result.survivorsB).toBe(0);
  });

  it("is deterministic for the same seed", () => {
    const config: BattleConfig = {
      armyA: [],
      armyB: [],
      arenaWidth: 40,
      arenaHeight: 40,
      seed: 12345,
      tickCap: 1800,
    };

    const a = runBattle(config);
    const b = runBattle(config);

    expect(a).toEqual(b);
  });

  it("seeded RNG produces a stable sequence", () => {
    const rng1 = createRng(1);
    const rng2 = createRng(1);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
    // Sanity: values are in [0, 1)
    for (const v of seq1) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds produce different sequences", () => {
    const a = createRng(1).next();
    const b = createRng(2).next();
    expect(a).not.toBe(b);
  });
});
