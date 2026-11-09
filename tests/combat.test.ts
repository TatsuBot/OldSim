import { describe, it, expect } from "vitest";
import {
  getNpc,
  createRng,
  effectiveLevel,
  attackRoll,
  defenceRoll,
  hitChance,
  maxHit,
  resolveAttack,
  styleFromNpc,
} from "../src/sim/index.js";

describe("Phase 3 — OSRS combat formulas", () => {
  // ---------- pure formula checks ----------

  it("effectiveLevel: floor((level + styleBonus) * prayer) + 8", () => {
    expect(effectiveLevel(1, 0, 1)).toBe(9); // 1 + 8
    expect(effectiveLevel(97, 0, 1)).toBe(105); // Abyssal demon attack
    expect(effectiveLevel(50, 3, 1)).toBe(61); // aggressive style bonus
    expect(effectiveLevel(50, 0, 1.15)).toBe(65); // prayer (not used by NPCs, but formula correct)
  });

  it("Goblin (3028) attack roll and max hit match hand calculation", () => {
    const goblin = getNpc("3028");
    // attack level 1, attack bonus -21
    // effective attack = floor(1 + 0) + 8 = 9
    // attack roll = 9 * (-21 + 64) = 9 * 43 = 387
    expect(attackRoll(goblin, "crush")).toBe(387);

    // strength level 1, strength bonus -15
    // effective strength = 9
    // max hit = floor(0.5 + 9 * (-15 + 64) / 640) = floor(0.5 + 9 * 49 / 640)
    //         = floor(0.5 + 441/640) = floor(0.5 + 0.6890625) = floor(1.189) = 1
    expect(maxHit(goblin, "crush")).toBe(1);
  });

  it("Abyssal demon (415) attack roll and max hit match hand calculation", () => {
    const abby = getNpc("415");
    // attack 97, attack bonus 0 → effective 105 → roll 105 * 64 = 6720
    expect(attackRoll(abby, "stab")).toBe(6720);

    // strength 67, strength bonus 0 → effective 75
    // max hit = floor(0.5 + 75 * 64 / 640) = floor(0.5 + 4800/640) = floor(0.5 + 7.5) = floor(8) = 8
    expect(maxHit(abby, "stab")).toBe(8);
  });

  it("defence roll uses the matching bonus for the incoming style", () => {
    const goblin = getNpc("3028");
    // defence level 1, all defence bonuses -15
    // effective defence = 9
    // defence roll = 9 * (-15 + 64) = 9 * 49 = 441
    expect(defenceRoll(goblin, "crush")).toBe(441);
    expect(defenceRoll(goblin, "stab")).toBe(441);
    expect(defenceRoll(goblin, "slash")).toBe(441);
  });

  it("hitChance formula is correct at the boundary and extremes", () => {
    // attack == defence → 1 - 0.5 = 0.5
    expect(hitChance(100, 100)).toBeCloseTo(0.5, 10);

    // attack < defence → attack / (2 * defence)
    expect(hitChance(50, 100)).toBeCloseTo(0.25, 10);

    // attack > defence → 1 - defence / (2 * attack)
    expect(hitChance(100, 50)).toBeCloseTo(0.75, 10);

    expect(hitChance(0, 100)).toBe(0);
    expect(hitChance(100, 0)).toBe(1);
  });

  it("styleFromNpc maps NPC style correctly", () => {
    expect(styleFromNpc(getNpc("3028"))).toBe("crush"); // Goblin
    expect(styleFromNpc(getNpc("26"))).toBe("slash"); // Zombie
    expect(styleFromNpc(getNpc("415"))).toBe("stab"); // Abyssal demon
  });

  // ---------- resolveAttack integration ----------

  it("resolveAttack is deterministic given the same RNG sequence", () => {
    const attacker = getNpc("415");
    const defender = getNpc("3028");

    const r1 = resolveAttack(attacker, defender, createRng(42));
    const r2 = resolveAttack(attacker, defender, createRng(42));
    expect(r1).toEqual(r2);
  });

  it("resolveAttack never deals damage on a miss, and damage is in [0, maxHit] on a hit", () => {
    const attacker = getNpc("415");
    const defender = getNpc("3028");
    const rng = createRng(123);

    for (let i = 0; i < 200; i++) {
      const result = resolveAttack(attacker, defender, rng);
      if (result.hit) {
        expect(result.damage).toBeGreaterThanOrEqual(0);
        expect(result.damage).toBeLessThanOrEqual(result.maxHit);
      } else {
        expect(result.damage).toBe(0);
      }
    }
  });

  it("observed hit rate converges on formula hit chance (Abby vs Goblin)", () => {
    const attacker = getNpc("415");
    const defender = getNpc("3028");
    const style = styleFromNpc(attacker);

    const aRoll = attackRoll(attacker, style);
    const dRoll = defenceRoll(defender, style);
    const expected = hitChance(aRoll, dRoll);

    const trials = 50_000;
    const rng = createRng(7);
    let hits = 0;
    for (let i = 0; i < trials; i++) {
      if (resolveAttack(attacker, defender, rng, style).hit) hits++;
    }
    const observed = hits / trials;

    // within ~1 percentage point for 50k trials
    expect(Math.abs(observed - expected)).toBeLessThan(0.01);
  });

  it("Goblin vs Abyssal demon has very low hit chance (sanity)", () => {
    const goblin = getNpc("3028");
    const abby = getNpc("415");
    const style = styleFromNpc(goblin);
    const chance = hitChance(
      attackRoll(goblin, style),
      defenceRoll(abby, style)
    );
    // Goblin should almost never hit an Abyssal demon
    expect(chance).toBeLessThan(0.05);
  });
});
