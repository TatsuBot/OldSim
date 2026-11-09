/**
 * Pull monsters from osrsbox-db and write data/npcs.json
 *
 *   node scripts/refreshNpcs.mjs
 *
 * Source: https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/monsters-complete.json
 */

import { writeFileSync } from "node:fs";

const URL =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/monsters-complete.json";

const WANTED_NAMES = [
  "Goblin", "Imp", "Giant rat", "Chicken", "Cow",
  "Zombie", "Skeleton", "Ghost", "Wolf", "Giant spider",
  "Hobgoblin", "Ogre", "Hill Giant", "Moss giant", "Ice warrior",
  "Black Knight", "Guard", "White Knight",
  "Fire giant", "Ice giant", "Lesser demon", "Greater demon",
  "Black demon", "Hellhound", "Ankou", "Bloodveld",
  "Nechryael", "Abyssal demon", "Kurask", "Turoth",
  "Crawling Hand", "Mountain troll", "Troll general",
  "Cyclops", "Chaos dwarf", "Green dragon", "Blue dragon",
  "Pyrefiend", "Dust devil", "Jelly", "Gargoyle",
  "Dagannoth", "Al-Kharid warrior", "Thug", "Mugger",
  "Barbarian", "Dwarf", "Dark warrior", "Earth warrior",
];

function isPureMelee(m) {
  const atypes = Array.isArray(m.attack_type) ? m.attack_type : m.attack_type ? [m.attack_type] : [];
  if (!atypes.length) return false;
  return !atypes.some((t) => t === "magic" || t === "ranged");
}

function hasStats(m) {
  return (m.hitpoints || 0) > 0 && m.attack_level != null;
}

function normalize(m) {
  if (!m || !hasStats(m)) return null;
  let atypes = Array.isArray(m.attack_type) ? m.attack_type : m.attack_type ? [m.attack_type] : ["crush"];
  let style = "melee";
  let detail = "crush";
  if (atypes.includes("ranged")) {
    style = "ranged";
    detail = null;
  } else if (atypes.includes("magic")) {
    style = "magic";
    detail = null;
  } else {
    for (const cand of ["stab", "slash", "crush"]) {
      if (atypes.includes(cand)) {
        detail = cand;
        break;
      }
    }
  }
  return {
    id: String(m.id),
    name: m.name,
    combatLevel: m.combat_level || 0,
    size: m.size || 1,
    hitpoints: m.hitpoints,
    attackSpeed: m.attack_speed || 4,
    attackRange: style === "melee" ? 1 : 4,
    style,
    styleDetail: detail,
    levels: {
      attack: m.attack_level || 1,
      strength: m.strength_level || 1,
      defence: m.defence_level || 1,
      magic: m.magic_level || 1,
      ranged: m.ranged_level || 1,
    },
    bonuses: {
      attack: m.attack_bonus || 0,
      strength: m.strength_bonus || 0,
      magic: m.magic_bonus || 0,
      ranged: m.ranged_bonus || 0,
      defenceStab: m.defence_stab || 0,
      defenceSlash: m.defence_slash || 0,
      defenceCrush: m.defence_crush || 0,
      defenceMagic: m.defence_magic || 0,
      defenceRanged: m.defence_ranged || 0,
    },
  };
}

console.log("Fetching", URL);
const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const src = await res.json();
console.log("Loaded", Object.keys(src).length, "entries");

const byName = new Map();
for (const m of Object.values(src)) {
  if (m.duplicate) continue;
  const list = byName.get(m.name) || [];
  list.push(m);
  byName.set(m.name, list);
}

const out = [];
const seen = new Set();
for (const want of WANTED_NAMES) {
  const candidates = (byName.get(want) || []).filter(hasStats);
  const melee = candidates.filter(isPureMelee);
  const pool = melee.length ? melee : candidates;
  if (!pool.length) {
    console.warn("  missing:", want);
    continue;
  }
  pool.sort((a, b) => (a.combat_level || 999) - (b.combat_level || 999) || a.id - b.id);
  const n = normalize(pool[0]);
  if (!n || seen.has(n.id)) continue;
  seen.add(n.id);
  out.push(n);
}

out.sort((a, b) => a.combatLevel - b.combatLevel || a.name.localeCompare(b.name));
for (const n of out) {
  if (n.styleDetail == null) n.styleDetail = n.style;
}
const byId = Object.fromEntries(out.map((n) => [n.id, n]));
writeFileSync(
  "data/npcs.json",
  JSON.stringify(
    {
      _meta: {
        source: "osrsbox-db monsters-complete.json",
        count: out.length,
      },
      npcs: byId,
    },
    null,
    2
  ) + "\n"
);
console.log("Wrote data/npcs.json with", out.length, "NPCs");
for (const n of out) {
  console.log(
    `  ${n.id.padStart(5)} ${n.name.padEnd(22)} CB${String(n.combatLevel).padStart(3)} HP${String(n.hitpoints).padStart(4)} sz${n.size} ${n.style}`
  );
}
