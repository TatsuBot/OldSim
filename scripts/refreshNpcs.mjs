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
  // God Wars Dungeon — generals, bodyguards, and minions
  "General Graardor", "K'ril Tsutsaroth", "Commander Zilyana", "Kree'arra",
  "Sergeant Strongstack", "Sergeant Steelwill", "Sergeant Grimspike",
  "Starlight", "Growler", "Bree", "Balfrug Kreeyath", "Wingman Skree",
  "Spiritual warrior", "Spiritual ranger", "Spiritual mage",
  "Knight of Saradomin", "Saradomin priest", "Saradomin wizard",
  "Bandosian guard", "Armadylean guard",
  "Zamorak warrior", "Zamorak ranger", "Zamorak mage", "Zamorak crafter",
  "Monk of Zamorak", "Guardian of Armadyl",
  // Bosses (approximated: single attack style, no specials — see README)
  "King Black Dragon", "Kalphite Queen",
  "Dagannoth Rex", "Dagannoth Prime", "Dagannoth Supreme",
  "TzTok-Jad", "Zulrah", "Vorkath", "Cerberus", "Abyssal Sire",
  "Kraken", "Thermonuclear smoke devil", "Chaos Elemental",
  "Callisto", "Venenatis", "Vet'ion", "Scorpia", "Giant Mole",
  "Ahrim the Blighted", "Dharok the Wretched", "Guthan the Infested",
  "Karil the Tainted", "Torag the Corrupted", "Verac the Defiled",
  "Demonic gorilla", "Lizardman shaman",
  // Slayer / mid-high tier
  "Cave horror", "Aberrant spectre", "Dark beast",
  "Steel dragon", "Iron dragon", "Mithril dragon", "Adamant dragon",
  "Rune dragon", "Bronze dragon", "Red dragon", "Black dragon",
  "Skeletal Wyvern", "Ancient Wyvern",
  "Brutal black dragon", "Brutal green dragon",
  "Kalphite Soldier", "Kalphite Worker", "Kalphite Guardian",
  "Scarab mage", "Locust rider", "Sand Crab", "Rock Crab",
  "Cave kraken", "Smoke devil", "Mutated Bloodveld", "Infernal Mage",
  "Banshee", "Cockatrice", "Basilisk",
  // Army / humanoids
  "Soldier", "Warrior", "Monk", "Wizard", "Archer",
  "Elf Warrior", "Elf Archer", "Gnome guard",
  "Troll", "Ice troll", "Sea troll",
  "Rat", "Spider", "Scorpion", "Snake",
  "Shade", "Ghoul", "Werewolf", "Demon",
  "Baby blue dragon", "Baby red dragon", "Baby black dragon",
];

// Specific variants by ID, in addition to the one-per-name pick above.
// Needed where one name covers very different stat tiers — e.g. Goblins
// range from CB 2 (3028, HP 5) to CB 25 (2488, HP 26), and the name pick
// always takes the weakest. Same for White Knight (1829 is the CB 42 tier).
const WANTED_IDS = [
  655, 3045, 2485, 2488, // Goblin variants: CB 5, CB 5 (strong), CB 13, CB 25
  1829, // White Knight, CB 42
  516, // Black Knight with real attack levels (4959 has attack_level 0)
];

function isPureMelee(m) {
  const atypes = Array.isArray(m.attack_type) ? m.attack_type : m.attack_type ? [m.attack_type] : [];
  if (!atypes.length) return false;
  return !atypes.some((t) => t === "magic" || t === "ranged");
}

function hasStats(m) {
  // Usable combatant: HP > 0 and at least one offensive level > 0.
  // osrsbox lists some NPCs with all levels 0 (e.g. Black Knight 4959),
  // which would normalize to a 1/1/1 dud that can barely hit anything.
  // (Attack alone is not enough: pure rangers/mages can have attack 0.)
  return (
    (m.hitpoints || 0) > 0 &&
    ((m.attack_level || 0) > 0 || (m.magic_level || 0) > 0 || (m.ranged_level || 0) > 0)
  );
}

function normalize(m) {
  if (!m || !hasStats(m)) return null;
  let atypes = Array.isArray(m.attack_type) ? m.attack_type : m.attack_type ? [m.attack_type] : ["crush"];
  // The sim supports one attack style per NPC. Pick the style with the
  // highest corresponding level — the NPC's strongest attack — instead of
  // trusting the attack_type label order. Labels mislead for multi-style
  // bosses: Kalphite Queen lists ranged first but has ranged level 1 and
  // melee 300; Zulrah's melee form has melee 1 and magic/ranged 300.
  // Ties prefer melee, then ranged, then magic (so 1/1/1 NPCs stay melee).
  const levels = {
    melee: m.attack_level || 1,
    ranged: m.ranged_level || 1,
    magic: m.magic_level || 1,
  };
  let style = "melee";
  if (levels.ranged > levels.melee && levels.ranged >= levels.magic) style = "ranged";
  else if (levels.magic > levels.melee && levels.magic > levels.ranged) style = "magic";
  let detail = "crush";
  if (style === "ranged" || style === "magic") {
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

// Specific variants by ID (see WANTED_IDS above).
const byIdSrc = new Map(Object.values(src).filter((m) => !m.duplicate).map((m) => [m.id, m]));
for (const id of WANTED_IDS) {
  const m = byIdSrc.get(id);
  if (!m || !hasStats(m)) {
    console.warn("  missing id:", id);
    continue;
  }
  const n = normalize(m);
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
        note: "One representative variant per name, plus explicit WANTED_IDS variants. Bosses approximated: single attack style, no specials.",
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
