/**
 * NPC data types and loader.
 * Stats are loaded once from data/npcs.json and never fetched at runtime.
 */

export type CombatStyle = "melee" | "ranged" | "magic";
export type MeleeStyleDetail = "stab" | "slash" | "crush";

export type NpcLevels = {
  attack: number;
  strength: number;
  defence: number;
  magic: number;
  ranged: number;
};

export type NpcBonuses = {
  attack: number;
  strength: number;
  magic: number;
  ranged: number;
  defenceStab: number;
  defenceSlash: number;
  defenceCrush: number;
  defenceMagic: number;
  defenceRanged: number;
};

/** Normalized NPC definition used by the simulation. */
export type NpcDef = {
  id: string;
  name: string;
  combatLevel: number;
  hitpoints: number;
  /** Footprint size in tiles (1 = 1×1, 2 = 2×2, …). */
  size: number;
  /** Attack cooldown in game ticks. */
  attackSpeed: number;
  style: CombatStyle;
  /** For melee: stab / slash / crush. For others mirrors style. */
  styleDetail: string;
  /** Maximum attack range in tiles (1 for melee). */
  attackRange: number;
  levels: NpcLevels;
  bonuses: NpcBonuses;
  wikiName?: string;
  sourceId?: number;
};

export type NpcDatabase = {
  _meta?: Record<string, unknown>;
  npcs: Record<string, NpcDef>;
};

/** Validate a single NPC definition. Throws on failure. */
export function validateNpc(npc: NpcDef): void {
  if (!npc.id || typeof npc.id !== "string") {
    throw new Error(`NPC missing id: ${JSON.stringify(npc)}`);
  }
  if (!npc.name) throw new Error(`NPC ${npc.id}: missing name`);
  if (npc.hitpoints <= 0) throw new Error(`NPC ${npc.id}: hitpoints must be > 0`);
  if (npc.size < 1) throw new Error(`NPC ${npc.id}: size must be >= 1`);
  if (npc.attackSpeed < 1) throw new Error(`NPC ${npc.id}: attackSpeed must be >= 1`);
  if (!["melee", "ranged", "magic"].includes(npc.style)) {
    throw new Error(`NPC ${npc.id}: invalid style ${npc.style}`);
  }
  if (npc.attackRange < 1) throw new Error(`NPC ${npc.id}: attackRange must be >= 1`);

  for (const key of ["attack", "strength", "defence", "magic", "ranged"] as const) {
    const v = npc.levels[key];
    if (typeof v !== "number" || v < 0) {
      throw new Error(`NPC ${npc.id}: levels.${key} must be a non-negative number`);
    }
  }
}

/** Validate the whole database. */
export function validateNpcDatabase(db: NpcDatabase): void {
  if (!db.npcs || typeof db.npcs !== "object") {
    throw new Error("NPC database missing npcs map");
  }
  const ids = Object.keys(db.npcs);
  if (ids.length === 0) throw new Error("NPC database is empty");
  for (const id of ids) {
    const npc = db.npcs[id]!;
    if (npc.id !== id) {
      throw new Error(`NPC key ${id} does not match npc.id ${npc.id}`);
    }
    validateNpc(npc);
  }
}
