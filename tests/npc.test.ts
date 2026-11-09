import { describe, it, expect } from "vitest";
import {
  loadNpcDatabase,
  getNpc,
  listNpcIds,
  validateNpc,
} from "../src/sim/index.js";
import type { NpcDef } from "../src/sim/index.js";

describe("Phase 2 — NPC data pipeline", () => {
  it("loads and validates the NPC database", () => {
    const db = loadNpcDatabase();
    expect(Object.keys(db.npcs).length).toBeGreaterThanOrEqual(5);
  });

  it("every NPC has required positive fields", () => {
    const db = loadNpcDatabase();
    for (const npc of Object.values(db.npcs)) {
      expect(npc.hitpoints).toBeGreaterThan(0);
      expect(npc.size).toBeGreaterThanOrEqual(1);
      expect(npc.attackSpeed).toBeGreaterThanOrEqual(1);
      expect(npc.attackRange).toBeGreaterThanOrEqual(1);
      expect(["melee", "ranged", "magic"]).toContain(npc.style);
      expect(npc.levels.attack).toBeGreaterThanOrEqual(0);
      expect(npc.levels.strength).toBeGreaterThanOrEqual(0);
      expect(npc.levels.defence).toBeGreaterThanOrEqual(0);
    }
  });

  it("can look up known NPCs by id", () => {
    const goblin = getNpc("3028");
    expect(goblin.name).toBe("Goblin");
    expect(goblin.hitpoints).toBe(5);
    expect(goblin.size).toBe(1);
    expect(goblin.style).toBe("melee");
    expect(goblin.attackSpeed).toBe(4);
  });

  it("throws on unknown NPC id", () => {
    expect(() => getNpc("does-not-exist")).toThrow(/Unknown NPC id/);
  });

  it("listNpcIds returns all ids", () => {
    const ids = listNpcIds();
    expect(ids).toContain("3028");
    expect(ids).toContain("415");
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  it("validateNpc rejects bad data", () => {
    const bad: NpcDef = {
      id: "bad",
      name: "Bad",
      combatLevel: 1,
      hitpoints: 0, // invalid
      size: 1,
      attackSpeed: 4,
      style: "melee",
      styleDetail: "crush",
      attackRange: 1,
      levels: { attack: 1, strength: 1, defence: 1, magic: 1, ranged: 1 },
      bonuses: {
        attack: 0, strength: 0, magic: 0, ranged: 0,
        defenceStab: 0, defenceSlash: 0, defenceCrush: 0,
        defenceMagic: 0, defenceRanged: 0,
      },
    };
    expect(() => validateNpc(bad)).toThrow(/hitpoints/);
  });

  it("includes a size-2 NPC (Wolf)", () => {
    const wolf = getNpc("2491");
    expect(wolf.size).toBe(2);
    expect(wolf.name).toBe("Wolf");
  });

  it("includes a high-level NPC (Abyssal demon)", () => {
    const abby = getNpc("415");
    expect(abby.hitpoints).toBe(150);
    expect(abby.levels.attack).toBeGreaterThan(50);
  });
});
