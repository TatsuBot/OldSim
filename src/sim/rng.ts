/**
 * Seeded PRNG — the only source of randomness allowed in the simulation core.
 * Mulberry32: fast, high-quality 32-bit generator. Deterministic given the same seed.
 * Never use Math.random() inside src/sim/.
 */

export type RNG = {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Returns a float in [min, max). */
  nextRange(min: number, max: number): number;
};

/**
 * Create a Mulberry32 RNG from a 32-bit seed.
 * Seed is coerced to unsigned 32-bit.
 */
export function createRng(seed: number): RNG {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      return Math.floor(next() * maxExclusive);
    },
    nextRange(min: number, max: number): number {
      return min + next() * (max - min);
    },
  };
}
