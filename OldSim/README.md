# OldSim

OSRS-style Army Battle Simulator.

Deterministic combat + pathing approximation, Monte Carlo (1 000+ runs), optional Three.js replay.

**Status:** Phase 1 skeleton (empty tick loop + seeded RNG + BattleConfig).

## Quick start

```bash
npm install
npm test
```

## Project layout

```
data/           # generated NPC stats (npcs.json)
src/
  sim/          # pure simulation core (no graphics, no FS)
  runner/       # Monte Carlo runner + CLI
  render/       # Three.js replay player (later)
  ui/           # battle builder / HUD (later)
tests/
```

## Design rules

1. The simulation never draws anything. The renderer never decides anything.
2. Given the same `BattleConfig` (including seed) the sim produces the identical battle, tick for tick.
3. `Math.random()` is banned inside `src/sim/`. Use the seeded RNG only.
4. All combat uses the real OSRS formulas (integer arithmetic + floor at the same points as the game).

## Build phases (current progress)

- [x] Phase 0 — Scope locked (melee-only v1, sticky nearest targeting, open arena, local experimentation)
- [x] Phase 1 — Skeleton + seeded RNG + BattleConfig + empty battle
- [ ] Phase 2 — NPC data pipeline
- [ ] Phase 3 — OSRS combat model
- [ ] Phase 4 — Tile grid, collision, LoS
- [ ] Phase 5 — OSRS-style pathing
- [ ] Phase 6 — Targeting + state machine
- [ ] Phase 7 — Full tick loop
- [ ] Phase 8 — Monte Carlo runner
- [ ] Phase 9 — Three.js renderer
- [ ] Phase 10+ — Polish / extensions

## License

MIT
