# Cozy Cavern v2 — Kindle the Cavern

This milestone turns the visual rebuild into a complete short progression arc. The Hearth Room and First Expedition remain intact, but the passage now continues through three ancient brazier chambers to the Cavern Heart.

## Run

Windows: double-click `start_server.bat` and open the address it launches.

Or from this folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

An internet connection is currently required for the pinned Three.js modules. All game art/model assets are local.

## Controls

- WASD / arrows — move
- Shift — run
- E / Space — interact / mine
- R — withdraw deposited crystal while near the hearth
- Camera — fixed-angle follow camera; no mouse rotation
- Mouse wheel — zoom
- 1–4 — animation clip inspection
- 0 — leave animation inspection

## Current progression

1. **Supply the hearth** — bank 4 stone and 6 crystal.
2. **Kindle the cavern** — withdraw/carry crystal and rekindle three ancient braziers.
   - Mosslight Brazier — 6 carried crystal
   - Amber Brazier — 8 carried crystal
   - Deepglass Brazier — 10 carried crystal
3. Each lit brazier becomes a warm refuge, slightly increases maximum warmth, and makes deeper mining routes practical.
4. **Awaken the Heart** — once all three braziers burn, carry 10 crystal into the deepest chamber and wake the great formation.
5. The Heart ending completes the milestone; the player may dismiss the ending panel and keep exploring.

Brazier costs are intentionally within the current 10-slot satchel. The original game paired larger crystal offerings with a larger upgrade tree. This build restores the complete exploration/warmth/brazier/Heart loop first; upgrades can be layered back in once the core progression has been playtested in the new world.

## New in this milestone

- The Crystal Grotto now opens into a much deeper authored route rather than ending at a wall.
- Three connected brazier chambers use the fixed camera as a composition constraint: tall walls and bright set dressing stay toward the edges while the central movement lane remains readable.
- Ancient braziers are low-poly procedural objects built to match the stone/bronze/fire language of the supplied kit. They begin cold and visibly ignite when restored.
- Lit braziers create real warmth zones, not just visual checkpoints.
- Cold drain increases gradually with depth. There are no invisible progression gates: reaching too far without restoring refuges is possible, but dangerous.
- Richer crystal seams appear farther from home so lighting a brazier expands both the safe frontier and the useful resource frontier.
- The Cavern Heart reuses and layers the supplied crystal models rather than introducing a mismatched temporary 3D asset.
- Awakening the Heart shifts its crystal glow from cold blue to warm amber, strengthens every restored brazier, removes the global warmth threat, and presents a proper end-state panel.
- Objective UI now advances through supply → 0/3 braziers → Heart → restored cavern, with a compact three-brazier status indicator.

## Existing visual/gameplay baseline retained

- Rigged adventurer with automatic grounding and in-place locomotion correction.
- Fixed-angle follow camera + wheel zoom.
- Screen-consistent WASD.
- Sprint acceleration/deceleration and reversal smoothing.
- Distance-matched locomotion cadence.
- Selective bloom with proper depth occlusion.
- Varied wall placement from the single supplied wall asset.
- Large decorative crystals block; small shards and mine nodes stay nonblocking.
- Hearth storage, crystal withdrawal, mining, pack capacity, respawning nodes, warmth, fainting, and loss of half the carried haul.
- Full supplied texture quality; no compression.

## Camera architecture / freeze note

The fixed camera is a deliberate Cozy Cavern design choice, not a claim that orbit/MMO controls are impossible. The original game used a static view, and this rebuild benefits from composing rooms around a known angle. Camera yaw, pitch, distance, and follow behavior remain isolated in `Game.js`; if a future game needs free orbit or MMO mouse-look, implement it as a separate camera-controller strategy (for example `FixedFollowCamera`, `OrbitCamera`, or `MMOCamera`) rather than coupling mouse steering into `Player`.

Treat the current camera and locomotion controller as feature-frozen unless later playtest feedback identifies a concrete issue.

## Deliberate non-goals for this pass

- Stairs remain decorative; the gameplay surface stays flat.
- No texture compression or asset-quality reduction.
- No save/load yet for the new progression state.
- No upgrade workbench yet. The larger original brazier costs and upgrade economy should return together, rather than partially reintroducing one without the other.
- No additional player animation work unless playtesters flag locomotion again.

## Validation

All local JavaScript files pass `node --check`, relative imports resolve, referenced HUD DOM IDs exist, and all 18 GLB files are packaged. A full automated WebGL browser smoke test is not available in the current build environment because Chromium cannot initialize a usable WebGL/EGL context there; desktop playtest remains the final renderer check.
