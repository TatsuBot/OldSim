/**
 * OSRS combat formulas.
 * All calculations use integer arithmetic with Math.floor at the same points the game does.
 * Pure functions — no RNG, no game state — so they are trivially testable.
 *
 * Sources: OSRS Wiki damage / accuracy calculators and documented formulas.
 */

import type { NpcDef } from "./npc.js";
import type { RNG } from "./rng.js";

/** Attack style for the purpose of accuracy/defence matching. */
export type AttackStyle = "stab" | "slash" | "crush" | "ranged" | "magic";

/** Optional style bonus (accurate / aggressive / controlled / defensive). NPCs normally use 0. */
export type StyleBonus = 0 | 1 | 3; // accurate=0, controlled=1, aggressive=3 (melee)

/**
 * Effective level used in attack/defence/strength rolls.
 * effective = floor((level + styleBonus) * prayerMultiplier) + 8
 * NPCs use no prayers → prayerMultiplier = 1.
 */
export function effectiveLevel(
  level: number,
  styleBonus: StyleBonus = 0,
  prayerMultiplier: number = 1
): number {
  return Math.floor((level + styleBonus) * prayerMultiplier) + 8;
}

/**
 * Attack roll = effectiveAttack * (attackBonus + 64)
 */
export function attackRoll(
  attacker: NpcDef,
  style: AttackStyle = "crush",
  styleBonus: StyleBonus = 0
): number {
  const level =
    style === "ranged"
      ? attacker.levels.ranged
      : style === "magic"
        ? attacker.levels.magic
        : attacker.levels.attack;

  const bonus =
    style === "ranged"
      ? attacker.bonuses.ranged
      : style === "magic"
        ? attacker.bonuses.magic
        : attacker.bonuses.attack;

  const effective = effectiveLevel(level, styleBonus);
  return effective * (bonus + 64);
}

/**
 * Defence roll against a given incoming style.
 * Uses the matching defence bonus (stab/slash/crush/ranged/magic).
 */
export function defenceRoll(
  defender: NpcDef,
  incomingStyle: AttackStyle,
  styleBonus: StyleBonus = 0
): number {
  const level = defender.levels.defence;
  const bonus = defenceBonusForStyle(defender, incomingStyle);
  const effective = effectiveLevel(level, styleBonus);
  return effective * (bonus + 64);
}

function defenceBonusForStyle(npc: NpcDef, style: AttackStyle): number {
  switch (style) {
    case "stab":
      return npc.bonuses.defenceStab;
    case "slash":
      return npc.bonuses.defenceSlash;
    case "crush":
      return npc.bonuses.defenceCrush;
    case "ranged":
      return npc.bonuses.defenceRanged;
    case "magic":
      return npc.bonuses.defenceMagic;
    default:
      return npc.bonuses.defenceCrush;
  }
}

/**
 * Hit chance from the standard OSRS formula:
 * if attack < defence:  attack / (2 * defence)
 * else:                 1 - defence / (2 * attack)
 */
export function hitChance(attack: number, defence: number): number {
  if (attack <= 0) return 0;
  if (defence <= 0) return 1;
  if (attack < defence) {
    return attack / (2 * defence);
  }
  return 1 - defence / (2 * attack);
}

/**
 * Max hit (melee / ranged strength formula).
 * maxHit = floor(0.5 + effectiveStrength * (strengthBonus + 64) / 640)
 *
 * Magic uses a different base-max-hit + % damage system; stubbed for v1.
 */
export function maxHit(
  attacker: NpcDef,
  style: AttackStyle = "crush",
  styleBonus: StyleBonus = 0
): number {
  if (style === "magic") {
    // v1 stub: use strength-style formula with magic level as a rough stand-in.
    // Real magic max hit needs spell base + magic damage %. Revisit in Phase 12.
    const effective = effectiveLevel(attacker.levels.magic, styleBonus);
    return Math.floor(0.5 + (effective * (attacker.bonuses.magic + 64)) / 640);
  }

  const level =
    style === "ranged" ? attacker.levels.ranged : attacker.levels.strength;
  const bonus =
    style === "ranged" ? attacker.bonuses.ranged : attacker.bonuses.strength;

  const effective = effectiveLevel(level, styleBonus);
  return Math.floor(0.5 + (effective * (bonus + 64)) / 640);
}

export type AttackResult = {
  hit: boolean;
  damage: number;
  maxHit: number;
  hitChance: number;
  attackRoll: number;
  defenceRoll: number;
};

/**
 * Resolve a single attack.
 * - Computes hit chance from rolls
 * - Draws one random number to decide hit/miss
 * - On a hit, rolls damage uniformly in [0, maxHit] inclusive
 * - A roll of 0 damage on a successful hit is legal in OSRS
 */
export function resolveAttack(
  attacker: NpcDef,
  defender: NpcDef,
  rng: RNG,
  style: AttackStyle = styleFromNpc(attacker),
  styleBonus: StyleBonus = 0
): AttackResult {
  const aRoll = attackRoll(attacker, style, styleBonus);
  const dRoll = defenceRoll(defender, style, 0);
  const chance = hitChance(aRoll, dRoll);
  const mHit = maxHit(attacker, style, styleBonus);

  const roll = rng.next(); // [0, 1)
  const hit = roll < chance;
  const damage = hit ? rng.nextInt(mHit + 1) : 0; // 0..maxHit inclusive

  return {
    hit,
    damage,
    maxHit: mHit,
    hitChance: chance,
    attackRoll: aRoll,
    defenceRoll: dRoll,
  };
}

/** Infer the primary attack style of an NPC for v1. */
export function styleFromNpc(npc: NpcDef): AttackStyle {
  if (npc.style === "ranged") return "ranged";
  if (npc.style === "magic") return "magic";
  // melee — use the detailed style if present
  const d = npc.styleDetail;
  if (d === "stab" || d === "slash" || d === "crush") return d;
  return "crush";
}
