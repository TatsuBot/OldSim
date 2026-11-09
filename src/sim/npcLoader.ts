/**
 * Offline NPC data loader.
 * Reads the static data/npcs.json once. Never makes network calls.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { NpcDatabase, NpcDef } from "./npc.js";
import { validateNpcDatabase } from "./npc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Default path relative to this file (src/sim → ../../data/npcs.json). */
const DEFAULT_PATH = join(__dirname, "../../data/npcs.json");

let cached: NpcDatabase | null = null;

/**
 * Load and validate the NPC database.
 * Result is cached for the process lifetime.
 */
export function loadNpcDatabase(path: string = DEFAULT_PATH): NpcDatabase {
  if (cached && path === DEFAULT_PATH) return cached;

  const raw = readFileSync(path, "utf-8");
  const db = JSON.parse(raw) as NpcDatabase;
  validateNpcDatabase(db);

  if (path === DEFAULT_PATH) cached = db;
  return db;
}

/** Look up a single NPC by id. Throws if missing. */
export function getNpc(id: string, db?: NpcDatabase): NpcDef {
  const database = db ?? loadNpcDatabase();
  const npc = database.npcs[id];
  if (!npc) {
    throw new Error(`Unknown NPC id: ${id}. Available: ${Object.keys(database.npcs).join(", ")}`);
  }
  return npc;
}

/** List all known NPC ids. */
export function listNpcIds(db?: NpcDatabase): string[] {
  const database = db ?? loadNpcDatabase();
  return Object.keys(database.npcs);
}
