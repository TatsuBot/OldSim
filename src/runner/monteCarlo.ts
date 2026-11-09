/**
 * Monte Carlo runner: fight the same matchup N times with derived seeds,
 * aggregate win rates / survivors / duration, and optionally keep a near-average replay.
 */

import { runBattle } from "../sim/battle.js";
import type { BattleConfig, BattleResult, ReplayLog } from "../sim/types.js";

export type RunSummary = {
  runIndex: number;
  seed: number;
  winner: BattleResult["winner"];
  ticksElapsed: number;
  survivorsA: number;
  survivorsB: number;
};

export type MonteCarloConfig = {
  /** Base battle config (seed is overwritten per run). */
  battle: Omit<BattleConfig, "seed" | "recordReplay"> & { seed?: number };
  /** Master seed — each run uses masterSeed + runIndex. */
  masterSeed: number;
  /** Number of battles to simulate. Default 1000. */
  runs?: number;
  /**
   * After aggregation, re-run one near-average battle with replay recording.
   * Default true.
   */
  keepReplay?: boolean;
};

export type MonteCarloResult = {
  masterSeed: number;
  runs: number;
  winsA: number;
  winsB: number;
  draws: number;
  winRateA: number;
  winRateB: number;
  avgSurvivorsA: number;
  avgSurvivorsB: number;
  avgTicks: number;
  /** Rough standard error on win rate (percentage points, binomial). */
  winRateSE: number;
  summaries: RunSummary[];
  /** Near-average replay, if keepReplay was true. */
  replay?: ReplayLog;
  replayRunIndex?: number;
};

/**
 * Run N seeded battles and aggregate results.
 */
export function runMonteCarlo(cfg: MonteCarloConfig): MonteCarloResult {
  const runs = cfg.runs ?? 1000;
  const summaries: RunSummary[] = [];

  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let sumSurvA = 0;
  let sumSurvB = 0;
  let sumTicks = 0;

  for (let i = 0; i < runs; i++) {
    const seed = (cfg.masterSeed + i) >>> 0;
    const battleCfg: BattleConfig = {
      ...cfg.battle,
      seed,
      recordReplay: false,
    };
    const result = runBattle(battleCfg);

    summaries.push({
      runIndex: i,
      seed,
      winner: result.winner,
      ticksElapsed: result.ticksElapsed,
      survivorsA: result.survivorsA,
      survivorsB: result.survivorsB,
    });

    if (result.winner === "A") winsA++;
    else if (result.winner === "B") winsB++;
    else draws++;

    sumSurvA += result.survivorsA;
    sumSurvB += result.survivorsB;
    sumTicks += result.ticksElapsed;
  }

  const winRateA = winsA / runs;
  const winRateB = winsB / runs;
  // Binomial SE for side A win rate
  const winRateSE = Math.sqrt((winRateA * (1 - winRateA)) / runs);

  const avgSurvivorsA = sumSurvA / runs;
  const avgSurvivorsB = sumSurvB / runs;
  const avgTicks = sumTicks / runs;

  const out: MonteCarloResult = {
    masterSeed: cfg.masterSeed,
    runs,
    winsA,
    winsB,
    draws,
    winRateA,
    winRateB,
    avgSurvivorsA,
    avgSurvivorsB,
    avgTicks,
    winRateSE,
    summaries,
  };

  if (cfg.keepReplay !== false) {
    const pick = pickNearAverage(summaries, winsA, winsB, avgSurvivorsA, avgSurvivorsB);
    if (pick) {
      const seed = (cfg.masterSeed + pick.runIndex) >>> 0;
      const replayResult = runBattle({
        ...cfg.battle,
        seed,
        recordReplay: true,
      });
      out.replay = replayResult.replay;
      out.replayRunIndex = pick.runIndex;
    }
  }

  return out;
}

/**
 * Prefer a run whose winner matches the majority and whose survivor counts
 * are close to the averages. Avoids filming the most extreme outlier.
 */
function pickNearAverage(
  summaries: RunSummary[],
  winsA: number,
  winsB: number,
  avgSurvA: number,
  avgSurvB: number
): RunSummary | null {
  if (summaries.length === 0) return null;

  const majority: "A" | "B" | "draw" =
    winsA > winsB && winsA > 0 ? "A" : winsB > winsA ? "B" : "draw";

  let best: RunSummary | null = null;
  let bestScore = Infinity;

  for (const s of summaries) {
    // Prefer matching majority winner
    const winnerPenalty = s.winner === majority ? 0 : 1000;
    const survPenalty =
      Math.abs(s.survivorsA - avgSurvA) + Math.abs(s.survivorsB - avgSurvB);
    const score = winnerPenalty + survPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** Pretty-print a summary for the terminal. */
export function formatMonteCarloResult(r: MonteCarloResult): string {
  const pct = (x: number) => (x * 100).toFixed(1) + "%";
  const lines = [
    `Monte Carlo — ${r.runs} runs (master seed ${r.masterSeed})`,
    `  Side A wins: ${r.winsA} (${pct(r.winRateA)})`,
    `  Side B wins: ${r.winsB} (${pct(r.winRateB)})`,
    `  Draws:       ${r.draws}`,
    `  Avg survivors A/B: ${r.avgSurvivorsA.toFixed(2)} / ${r.avgSurvivorsB.toFixed(2)}`,
    `  Avg duration:      ${r.avgTicks.toFixed(1)} ticks`,
    `  Win-rate SE (A):   ±${(r.winRateSE * 100).toFixed(1)} pp`,
  ];
  if (r.replayRunIndex !== undefined) {
    lines.push(`  Replay from run #${r.replayRunIndex} (${r.replay?.frames.length ?? 0} frames)`);
  }
  return lines.join("\n");
}
