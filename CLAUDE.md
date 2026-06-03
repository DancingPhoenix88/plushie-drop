# CLAUDE.md — Plushie Drop (BB Tower)

Developer context for AI sessions. Read this before touching anything.

---

## Self-verification rule (REQUIRED before claiming work is done)

**After every significant code edit, test in the browser before saying it's ready.**

1. Reload the page at `http://localhost:800X`
2. Check console for errors using the Claude in Chrome extension (`read_console_messages`, `onlyErrors:true`)
3. Run a quick health check:
```js
({gameRunning: typeof dead!=='undefined'&&!dead, textures: typeof plushieTextures!=='undefined'?plushieTextures.filter(Boolean).length:'undef'})
```
4. Only report "done" after confirming no errors and healthy game state

This rule exists because errors like `Uncaught SyntaxError`, `ReferenceError: cannot access before initialization`, and silently broken game loops have been claimed "working" multiple times without browser verification.

---

## What this is

Single-file HTML game (`index.html`) — Suika-style drop-and-merge. No build step, no framework. All game logic, physics, rendering, audio, and UI live in one file. `sw.js` is the service worker for PWA/offline. `manifest.json` is the PWA manifest.

Live at: https://DancingPhoenix88.github.io/plushie-drop/

---

## File structure

```
index.html          — everything: CSS + HTML + JS
sw.js               — service worker (cache name = plushie-vN, must bump on every release)
manifest.json       — PWA icons and display config
CHANGES.md          — version changelog
README.md           — player-facing docs
Sprites/
  characters/       — level_0.png … level_11.png (plushie sprites)
  claw/             — claw_back.png, claw_front.png, claw_open.png
  machine/          — claw_machine_*.png (UI chrome: top/middle/bottom tiles, floor, covers, score bg)
  ui/               — checkbox_bg.png, checkbox_tick.png, joystick_*.png, button_*.png
  icons/            — app_icon.png (PWA/homescreen icon; must exist — currently referenced but not yet created)
dev/                — dev/experimental tools, not deployed
  tool_9slice.html  — 9-slice border-image preview tool
  index-pixijs.html — PixiJS experiment (not production)
```

---

## Version bumping (REQUIRED on every commit with user-visible changes)

Four places must change together — never skip any:
1. `sw.js` line 1: `const CACHE = 'plushie-vN'`
2. `index.html`: `ctx.fillText('vN', ...)` (near the DANGER line draw)
3. `index.html`: `meta.textContent = \`vN · ...\`` (in `updateHelpMeta()`)
4. `CHANGES.md`: new section at top, rename old `(current)` → plain heading

---

## `bumpsup` workflow

When Hoang says **`bumsup`** (his shorthand), do all of the following:

**Step 1 — Claude does (files):**
- Bump version in all 4 places above
- Write new `## vN (current)` section in `CHANGES.md` summarising changes since last version

**Step 2 — git commands for Hoang to run:**
```bash
git add index.html sw.js CHANGES.md
git commit -m "vN: <one-line summary>"
git push origin main
git checkout release
git merge main --no-ff -m "release vN"
sed -i '' 's/const IS_DEBUG = true/const IS_DEBUG = false/' index.html
git add index.html
git commit --amend --no-edit
git push origin release
git checkout main
```

**Why the sed:** `main` always has `IS_DEBUG = true`; `release` always has `IS_DEBUG = false`. The sed ensures that after merging, release stays in release mode without ever manually editing that line.

---

## DEBUG / RELEASE branches

- `main` → development, `IS_DEBUG = true` — debug keyboard shortcuts active, debug section in help popup visible
- `release` → production (GitHub Pages deploys this), `IS_DEBUG = false` — debug features hidden
- Never manually edit `IS_DEBUG` on `release` — the `bumpsup` sed handles it every time

---

## Canvas coordinate system

- **Game units**: W=632, H=1049
- **WALL**=11 (side/bottom border thickness in game units)
- **DY**=178 (danger zone Y — plushies above this trigger warning)
- **DROPY**=94 (claw drop Y — where held plushie sits)
- **PAD**=W×5% ≈ 32 (left/right play area padding; claw and plushies can't touch walls)
- **FS**=W/460 ≈ 1.37 (font scale factor — multiply all canvas px sizes by this)

Reference design group: 720×1280, zones: game=720×771, floor=720×315, evo=720×194.

---

## Characters & physics

```
Rank | Name       | r    | physR | body
-----|------------|------|-------|------
1    | Mây        | 30   | 30    | #8ee8ff
2    | Bo         | 41   | 41    | #4a8c40
3    | Vincam     | 52   | 52    | #f5f5f5
4    | Mini Dora  | 62   | 62    | #e83030
5    | Baby Bunny | 73   | 66    | #fff0f8
6    | Poko       | 84   | 80    | #c87830
7    | Doraemi    | 95   | 91    | #f0c820
8    | Doraemon   | 105  | 105   | #1090e8
9    | Bunny      | 116  | 116   | #f060a0
10   | Mimi       | 125  | 125   | #9848d4
11   | Racoon     | 136  | 129   | #282838  ← triggers WIPE OUT on merge
```

`r` = visual/collision radius. `physR` = override for collision only (where visual and collision radius differ). `physR` defaults to `r` if omitted.

Base merge scores (PTS): `[0,1,3,6,10,15,21,28,36,45,55,100]` — multiplied by `scoreMultiplier` (2^(gameLevel-1)) at runtime via `PTS_M[]`.

Physics constants: `GRAV=0.38, DAMP=0.994, REST=0.35, FRIC=0.84, SUBSTEPS=6, ITERS=4`

---

## Layout breakpoints

All use CSS `aspect-ratio` media queries (CSS pixels, DPR-normalised — retina doesn't affect these).

| Condition | Value | Effect |
|-----------|-------|--------|
| `max-aspect-ratio: 2/3` | ar < 0.667 | Portrait layout: floor zone + evo strip + top/bottom tiles |
| `min-aspect-ratio: 2/3` | ar ≥ 0.667 | Wide layout: row, sidebar, no tiles |
| `min-aspect-ratio: 12/16` | ar ≥ 0.75 | Sidebar (evo-panel) visible |
| `min-aspect-ratio: 4/5` + `max-height: 878px` | ar ≥ 0.8 AND short | Landscape/laptop: hide ev-s, expand canvas |
| `min-aspect-ratio: 6/10` + `max-aspect-ratio: 2/3` | 0.6 ≤ ar ≤ 0.667 | Shift top-bar + main-content down by 11.25vw (hides evo strip) |

**Key decision**: portrait/wide boundary was raised from `9/16` (0.5625) to `2/3` (0.667) because iPhone 13 with collapsed Safari chrome has ar ≈ 0.587 — the old threshold incorrectly triggered wide layout on a portrait phone.

iPhone 13 reference: CSS pixels 390×844 (no chrome) → 390×664 (with Safari chrome) → ar ≈ 0.587.

---

## Floor zone (portrait)

Three independently absolute-positioned panels inside `#fz-inner` (itself `position:absolute;inset:0` inside `#floor-zone`):

- **LEFT** `#fz-scorenext` — score + next preview. `aspect-ratio:174/60`, `height:70%`, `top:10%`. BG sprite scales to 100%×100% of element.
- **CENTER** `#joyctrl` — joystick + drop button. `left:50%; transform:translateX(-50%)`. Sizes: joy=46% height, btn=22% height of floor zone.
- **RIGHT** `#fz-ctrl` — checkboxes (GYRO, BGM, AUTO dial). `align-items:stretch` so cb-items fill height; input.sprite-cb `height:72%; aspect-ratio:1`.

Floor zone position: `left:calc(20/720*100%); right:calc(20/720*100%); bottom:calc(82/1280*100%); height:calc(112/1280*100%)` of `#game-frame`.

Evo strip (`#ev-s`): `bottom:0; height:calc(81/1280*100%)` of `#game-frame`. Evo height as vw: `81/1280 × 16/9 × 100vw = 11.25vw`.

---

## Score font sizing

`fitScoreFont()` runs only when digit count changes (tracked by `_lastScoreLen`). Also re-runs on resize (resets `_lastScoreLen=0`). Formula: `fontSize = min(maxPx, floor(containerWidth / (charCount × SCORE_CHAR_RATIO)))`. `SCORE_CHAR_RATIO=0.8`. Applied to both `#sc-p` (floor zone, max 30px) and `#sc` (sidebar, max 21px).

---

## Drop / cooldown system

- **Cooldown** = 18 frames at 60fps ≈ 300ms (`CLAW_OPEN_FRAMES=18`). `cooling=true` while claw animation plays.
- **Mouse click / touch**: queue via `tryDrop` loop — retries each frame until `cooling` clears. Aborts immediately if `wipeOutActive || dead`.
- **Keyboard Space / ↓**: calls `drop()` directly — blocked during `cooling`.
- **Auto-drop**: self-scheduling `setTimeout` → `waitCool` RAF loop → `drop()`. Skips if `wipeOutActive || dead`, reschedules cleanly.
- `drop()` itself guards: `if(cooling||dead||wipeOutActive) return`.
- On load / restart (auto off): claw goes to far left (`mx = PAD + PD[cur].r + 1`), "TAP TO DROP" hint shown until first drop.

---

## WIPE OUT sequence

Triggered when two rank-11 Racoons merge. Timeline:

| Time | Event |
|------|-------|
| t=0 | `wipeOutActive=true`, score tallied, plushies get downward nudge, funnel collision activates, WIPE OUT text + 1st glare |
| t=300ms | 2nd glare + sparkle emitter starts (10/s for 2s, white 4-point stars, pulse in place) |
| t=620ms | 3rd glare + `gameLevel++`, multiplier + evo reset, `wipeOutActive=false`, funnel clears |
| t=1120ms | "LEVEL X" celebration text appears |

**Funnel physics**: during `wipeOutActive`, flat floor collision replaced by two angled ramps — `circleSegCollide()` against left ramp `(PAD, H-WALL)→(W/2-70, H-WALL+80)` and right ramp `(W-PAD, H-WALL)→(W/2+70, H-WALL+80)`. Plushies slide to center hole (radius 70) and fall through. Constants: `FUNNEL_HOLE_R=70, FUNNEL_DEPTH=80`. Plushies removed from array once `y-r > H+80`.

At `wipeOutActive=false`: remaining plushies cleared, floor restored. Interactions (click/touch/auto) blocked during entire wipeout — not queued, discarded at entry point.

---

## Joystick

- Hidden by default on mobile (`showJoy = !matchMedia('pointer:coarse').matches`).
- Shown/hidden via JS only — no CSS breakpoint controls it.
- Now lives inside `#fz-inner` as the center panel (moved from standalone absolute position).
- Sizes by % of floor-zone height: joy=46%, drop-btn=22%.

---

## Reflections

- Disabled on mobile by default; adaptive enable after 2s of stable ≥55 FPS.
- Off permanently if FPS drops below 55 after enabling.
- Desktop always enables immediately.
- Uses offscreen buffer `reflectBuf` at 50% resolution, updated every 3rd frame.

---

## Audio

- BGM: triangle oscillator melody, 128 BPM, loops.
- SFX: per-rank merge arpeggios (11 unique), drop thud, WIPE OUT sweep+fanfare.
- TTS: `speechSynthesis` speaks character name after each merge.
- All silent when `muted=true`. BGM toggled separately via `bgmOn`.

---

## PWA / service worker

- `manifest.json` references `Sprites/app_icon.png` for all icon sizes. **This file must be created** — it's referenced but doesn't exist yet.
- `apple-touch-icon` in `<head>` also points to `Sprites/app_icon.png`.
- iOS doesn't support `requestFullscreen` — fullscreen prompt shows "Share → Add to Home Screen" on iOS, standard fullscreen button on Android.
- `navigator.standalone === true` = already launched from home screen, skip prompt.

---

## Git workflow

- Always bare commands, no path prefix — user runs from project folder.
- Version bump = sw.js + index.html version label + CHANGES.md + help popup meta string — all four, every time.
- Branch `feature/claw_machine` has `#ap checked` autoplay ON for testing — remove before merging to main.
