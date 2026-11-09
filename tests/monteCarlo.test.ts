import { describe, it, expect } from "vitest";
import { runMonteCarlo } from "../src/runner/monteCarlo.js";

describe("Phase 8 — Monte Carlo runner", () => {
  it("same master seed produces identical aggregates", () => {
    const cfg = {
      masterSeed: 99,
      runs: 20,
      keepReplay: false,
      battle: {
        armyA: [{ npcId: "415", count: 1 }],
        armyB: [{ npcId: "3028", count: 1 }],
        arenaWidth: 30,
        arenaHeight: 30,
        tickCap: 600,
      },
    };
    const a = runMonteCarlo(cfg);
    const b = runMonteCarlo(cfg);
    expect(a.winsA).toBe(b.winsA);
    expect(a.winsB).toBe(b.winsB);
    expect(a.draws).toBe(b.draws);
    expect(a.avgTicks).toBe(b.avgTicks);
    expect(a.summaries).toEqual(b.summaries);
  });

  it("different master seeds can differ", () => {
    const base = {
      runs: 15,
      keepReplay: false,
      battle: {
        armyA: [{ npcId: "3028", count: 3 }],
        armyB: [{ npcId: "3028", count: 3 }],
        arenaWidth: 30,
        arenaHeight: 30,
        tickCap: 800,
      },
    };
    const a = runMonteCarlo({ ...base, masterSeed: 1 });
    const b = runMonteCarlo({ ...base, masterSeed: 99999 });
    // Not guaranteed to differ with only 15 runs, but summaries seeds must differ
    expect(a.summaries[0]!.seed).not.toBe(b.summaries[0]!.seed);
  });

  it("win rates are in [0,1] and sum with draws to 1", () => {
    const r = runMonteCarlo({
      masterSeed: 7,
      runs: 25,
      keepReplay: false,
      battle: {
        armyA: [{ npcId: "415", count: 1 }],
        armyB: [{ npcId: "3028", count: 2 }],
        arenaWidth: 30,
        arenaHeight: 30,
        tickCap: 600,
      },
    });
    expect(r.winRateA).toBeGreaterThanOrEqual(0);
    expect(r.winRateA).toBeLessThanOrEqual(1);
    expect(r.winsA + r.winsB + r.draws).toBe(r.runs);
  });

  it("keepReplay selects a near-average run with frames", () => {
    const r = runMonteCarlo({
      masterSeed: 3,
      runs: 10,
      keepReplay: true,
      battle: {
        armyA: [{ npcId: "415", count: 1 }],
        armyB: [{ npcId: "3028", count: 1 }],
        arenaWidth: 30,
        arenaHeight: 30,
        tickCap: 600,
      },
    });
    expect(r.replay).toBeDefined();
    expect(r.replay!.frames.length).toBeGreaterThan(0);
    expect(r.replayRunIndex).toBeGreaterThanOrEqual(0);
  });

  it("Abyssal demon heavily favored vs single goblin over 30 runs", () => {
    const r = runMonteCarlo({
      masterSeed: 11,
      runs: 30,
      keepReplay: false,
      battle: {
        armyA: [{ npcId: "415", count: 1 }],
        armyB: [{ npcId: "3028", count: 1 }],
        arenaWidth: 30,
        arenaHeight: 30,
        tickCap: 600,
      },
    });
    expect(r.winsA).toBeGreaterThanOrEqual(28);
  });
});
