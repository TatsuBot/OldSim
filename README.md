# OldSim

OSRS-style Army Battle Simulator.

Deterministic combat + pathing approximation, Monte Carlo (1 000+ runs), optional Three.js replay.

**Status:** Phase 12 partial — expanded NPC data from osrsbox-db.

## Quick start

```bash
npm install
npm test
```

## Project layout

```
data/           # generated NPC stats (npcs.json)
src/
  sim/          # simulation core
  runner/       # Monte Carlo runner + CLI (later)
  render/       # Three.js replay player (later)
  ui/           # battle builder / HUD (later)
tests/
```

## Design rules

1. The simulation never draws anything. The renderer never decides anything.
2. Given the same `BattleConfig` (including seed) the sim produces the identical battle, tick for tick.
3. `Math.random()` is banned inside `src/sim/`. Use the seeded RNG only.
4. All combat uses the real OSRS formulas (integer arithmetic + floor at the same points as the game).

## Available NPCs (v1)

| ID   | Name           | HP  | Size | Speed | Style        |
|------|----------------|-----|------|-------|--------------|
| 3028 | Goblin         | 5   | 1    | 4     | melee/crush  |
| 26   | Zombie         | 22  | 1    | 5     | melee/slash  |
| 924  | Skeleton       | 18  | 1    | 4     | melee/crush  |
| 2491 | Wolf           | 10  | 2    | 4     | melee/stab   |
| 136  | Ogre           | 60  | 2    | 6     | melee/crush  |
| 3049 | Hobgoblin      | 29  | 1    | 4     | melee/crush  |
| 415  | Abyssal demon  | 150 | 1    | 4     | melee/stab   |

Source: osrsbox-db (normalized offline into `data/npcs.json`). Full list of 49 NPCs: `npx tsx src/runner/battleBuilder.ts --list`.

## Build phases (current progress)

- [x] Phase 0 — Scope locked (melee-only v1, sticky nearest targeting, open arena, local experimentation)
- [x] Phase 1 — Skeleton + seeded RNG + BattleConfig + empty battle
- [x] Phase 2 — NPC data pipeline
- [x] Phase 3 — OSRS combat model
- [x] Phase 4 — Tile grid, collision, LoS
- [x] Phase 5 — OSRS-style pathing
- [x] Phase 6 — Targeting + state machine
- [x] Phase 7 — Full tick loop
- [x] Phase 8 — Monte Carlo runner
- [x] Phase 9 — Three.js renderer
- [x] Phase 10 — Battle builder + results panel

## License

MIT

## Replay renderer (Phase 9)

```bash
# 1. Export a battle replay to public/replay.json
npm run export-replay
# or: npx tsx src/runner/exportReplay.ts --seed 42

# 2. Serve the player
npm run render
# open http://localhost:5173
```

Controls: Play/Pause, speed 0.5×–4×, scrub timeline, orbit camera (drag).

## Battle builder (Phase 10)

```bash
# List NPCs
npx tsx src/runner/battleBuilder.ts --list

# Run a matchup (writes public/results.json + public/replay.json)
npm run battle -- --a 415:1 --b 3028:10 --runs 200 --seed 7

# View
npm run render
# → http://localhost:5173/results.html   (stats)
# → http://localhost:5173/               (replay)
```

Army format: `id:count[,id:count...]`
