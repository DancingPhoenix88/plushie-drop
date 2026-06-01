# Plushie Drop 🧸

A Suika-style drop-and-merge game with 11 cute plushie characters.

## Play

👉 [DancingPhoenix88.github.io/plushie-drop](https://DancingPhoenix88.github.io/plushie-drop/)

Open on mobile → Share → **Add to Home Screen** to install as an app (PWA).

---

## Keyboard Controls

### Gameplay

| Key | Action |
|-----|--------|
| `←` / `→` | Move drop point (2 px/frame) |
| `Shift` + `←` / `→` | Move drop point fast (5 px/frame) |
| `Space` / `↓` | Drop plushie |
| `A` | Cycle auto-drop speed (off → slow → medium → fast) |
| `J` | Toggle joystick overlay |
| `?` or `/` | Show keyboard shortcuts |

### Debug & Dev

| Key | Action |
|-----|--------|
| `W` | Force **WIPE OUT** — unlocks all ranks, triggers full wipe-out sequence |
| `S` | Toggle spawn-rate view — replaces names in the evo strip with live probabilities |
| `D` | Toggle debug overlay (collider circle, angular velocity, avg movement) |
| `C` | Toggle polygon collider view — N-gon SAT shapes with vertex dots |
| `H` | Toggle solid N-gon rendering (replaces sprites) |
| `[` / `]` | Decrease / increase polygon sides |
| `2`–`9` | Spawn rank 2–9 at current drop point |
| `0` | Spawn rank 10 (Mimi) |
| `1` | Spawn rank 11 (Racoon) |

---

## Characters & Ranks

| Rank | Character | Merge score (base) |
|------|-----------|--------------------|
| 1 | Mây | +10 |
| 2 | Bơ | +30 |
| 3 | Vincam | +60 |
| 4 | Mini Dora | +100 |
| 5 | Baby Bunny | +150 |
| 6 | Poko | +210 |
| 7 | Doraemi | +280 |
| 8 | Doraemon | +360 |
| 9 | Bunny | +450 |
| 10 | Mimi | +550 |
| 11 | Racoon ★ | — (triggers WIPE OUT) |

Merging two of the same rank produces the next rank up. Two rank-11 Racoons trigger **WIPE OUT**.

---

## WIPE OUT & Game Levels

When two Racoons (rank 11) merge, a **WIPE OUT** occurs:

1. Every plushie remaining in the tank pops simultaneously with a burst VFX, sparkles, and a triple glass-glare sweep.
2. Bonus points are awarded for every popped plushie (at the current multiplier).
3. A single large **total bonus** popup appears instead of individual score overlays.
4. The tank empties and the evolution zone resets — only ranks 1–3 are visible until each higher rank appears for the first time.
5. The **game level** increments and a "LEVEL X" celebration appears.
6. All future merge scores are multiplied by **2^(level−1)**:
   - Level 1 → ×1 (default)
   - Level 2 → ×2
   - Level 3 → ×4
   - Level 4 → ×8 … and so on.
7. First-appearance tracking resets, so celebration cards will fire again for each rank as you rediscover them.

---

## Evolution Zone

The strip at the bottom shows all 11 ranks. Ranks 4–11 start **locked** (silhouetted) and unlock permanently the first time you merge to that rank. On WIPE OUT the zone resets to locked, giving you the satisfaction of unlocking each character again at the new multiplier.

A **celebration card** pops up the first time each rank appears, showing:
- Character name
- Rank number
- Points earned (after the current multiplier)

---

## Features

### Physics
- Custom physics engine — no external library; accurate collision and stacking
- Polygon (N-gon) SAT colliders — shape matches the character's visual body
- Mass-based collision — a tiny Mây barely nudges a Racoon
- Stable stacking — settled plushies don't spin or jitter

### Rendering
- Pre-rendered sprites at `scale × DPR` physical pixels — zero upscaling blur on Retina screens
- Draw order by rank — larger plushies render behind smaller ones
- Drop prediction circle — dashed ring at predicted landing spot in the character's stroke colour
- Score popup on merge — `+N` floats up from the merge point, fades over ~1.5 s

### Gameplay Feel
- Danger zone blink — red dashed line pulses when plushies enter the warning zone
- 60 fps arrow-key polling — smooth cursor movement regardless of OS key-repeat rate
- Modulo cursor wrap — left at far-left wraps to far-right and vice versa
- Autoplay — fixed-interval drops at the current cursor position; aim freely between drops

### Visual Effects
- Particle burst on every merge
- Confetti shower on first-appearance celebration
- Glass glare sweep across the canvas (random idle + triple burst on WIPE OUT)
- 4-point sparkle stars scattered across the tank on WIPE OUT
- Big "WIPE OUT!" + "LEVEL X" celebration cards with animated scale-in

### Audio
- BGM — cheerful looping melody via Web Audio API (triangle oscillators)
- Drop SFX — soft thud on every drop
- Per-rank merge SFX — 11 unique ascending arpeggios
- WIPE OUT SFX — rising sawtooth sweep + chord fanfare
- Character name TTS — `speechSynthesis` pronounces the name after each merge

### Responsive UI
- Portrait (phone) — score/next/controls bar + canvas + evolution strip
- Landscape (desktop) — canvas + right sidebar with score, level, next preview, and evolution list
- Viewport scaling — entire game root scales to fit any screen while preserving aspect ratio
- PWA — `manifest.json` + service worker for offline caching and Add-to-Home-Screen install

---

## Tech

- Vanilla HTML / CSS / JavaScript — single `index.html`, no build step, no framework
- Custom 2D physics with SAT polygon colliders
- Web Audio API (BGM + SFX)
- Web Speech API (character name TTS)
- Canvas 2D with DPR-aware pre-rendering
- PWA with offline service worker
