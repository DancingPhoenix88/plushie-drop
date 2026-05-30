# Plushie Drop 🧸

A Suika-style drop-and-merge game with 11 cute plushie characters.

## Play

👉 [DancingPhoenix88.github.io/plushie-drop](https://DancingPhoenix88.github.io/plushie-drop/)

Open on mobile → Share → **Add to Home Screen** to install as an app (PWA).

---

## Keyboard Controls

| Key | Action |
|-----|--------|
| `←` / `→` | Move drop point (2 px/frame) |
| `Shift` + `←` / `→` | Move drop point fast (5 px/frame) |
| `Space` | Drop |
| `←` at far left | Wraps to far right (and vice versa) |

### Debug & Dev

| Key | Action |
|-----|--------|
| `D` | Toggle debug overlay — collider circle, angular velocity, 30-frame avg movement |
| `C` | Toggle polygon collider view — actual N-gon SAT shape with vertex dots |
| `2`–`9` | Spawn lv2–lv9 at current drop point |
| `0` | Spawn lv10 (Mimi) |
| `1` | Spawn lv11 (Racoon) |

---

## Characters & Merge Points

| Level | Character | Collider radius | Merge score |
|-------|-----------|-----------------|-------------|
| 1 | Vincam | 18 px | +3 |
| 2 | Mây | 23 px | +6 |
| 3 | Bơ | 29 px | +10 |
| 4 | Baby Bunny | 34 px | +15 |
| 5 | Mini Dora | 40 px | +21 |
| 6 | Poko | 45 px | +28 |
| 7 | Doraemi | 50 px | +36 |
| 8 | Doraemon | 56 px | +45 |
| 9 | Bunny | 85 px | +55 |
| 10 | Mimi | 92 px | +100 |
| 11 | Racoon | 100 px | ★ Final |

lv11 Racoon diameter = ~56% of the tank width. Two of any same level touching → merge → next level up.

---

## Nice-to-have Features

### Physics
- **Custom physics engine** — no external library; sub-step Euler integration with iterative position correction
- **Polygon SAT colliders** — each plushie uses an N-gon (hexagon for small, 12-gon for large), matching image-space collider radius (65 px for lv1–8, 90 px for lv9–11)
- **Mass-based collision** — impulse proportional to r²; a tiny Vincam barely nudges a Racoon
- **Anti-tunneling** — per-substep speed cap prevents fast plushies from passing through each other
- **Rotation killer** — 30-frame rolling average of position delta; phantom spin from settled contacts is zeroed out

### Rendering
- **Pre-rendered sprites** — each sprite is drawn once to an offscreen canvas at `scale × DPR` physical pixels, then blitted 1:1 in the game loop — zero upscaling blur even on Retina screens
- **Draw order by level** — higher-level (larger) plushies render first; smaller ones paint on top
- **Drop prediction circle** — dashed ring at the predicted landing position, in the character's stroke colour; hidden during drop cooldown
- **Score popup on merge** — `+N` floats up from the merge point in the character's body colour, fades over ~1.5 s
- **Particle burst** — colour-matched burst spawns at every merge

### Gameplay feel
- **Guide line always visible** — vertical drop guide and ghost sprite stay on screen during the post-drop cooldown so you can aim ahead
- **Danger zone blink** — the red danger line pulses when any plushie's top enters the 60 px warning zone above it; the earlier the warning the brighter the pulse
- **60 fps input polling** — arrow key movement is processed every frame (not OS key-repeat rate), giving smooth, lag-free cursor movement
- **Modulo cursor wrap** — pressing left at the leftmost position wraps to the rightmost, and vice versa, for quick traversal

### Audio
- **BGM** — cheerful looping melody via Web Audio API (triangle oscillators); off by default, toggled with the BGM checkbox
- **Drop SFX** — soft thud on every drop
- **Per-level merge SFX** — 11 unique ascending arpeggios; higher levels get grander fanfares
- **Character name TTS** — `speechSynthesis` pronounces the character's name 200 ms after each merge

### Responsive UI
- **Portrait layout** (phone) — compact top bar (score + next preview + controls) + full-width canvas + 1-row evolution strip pinned to the bottom
- **Landscape layout** (desktop) — canvas left, side panel right; switches automatically via `@media (orientation)`
- **Viewport scaling** — `fitToViewport()` scales the entire game root to fit any screen size while maintaining aspect ratio; re-runs on orientation change
- **Safe-area padding** — header and footer backgrounds extend into the notch / home-indicator zone on iPhone
- **PWA** — `manifest.json` + service worker for offline caching and Add-to-Home-Screen install

### Visual polish
- **Device pixel ratio** — canvas rendered at `W × DPR` physical pixels; context pre-scaled so all drawing coordinates stay in logical units
- **Tiled bunny background** — SVG silhouette of a bunny (no detail) tiled across the page at 20° rotation, 13% opacity
- **Beige canvas background** — warm `#f5e6c8` inside the tank
- **Darker same-hue stroke** — every character's body circle has a border in the same hue at ~30–40% darker

---

## Tech

- Vanilla HTML / CSS / JavaScript — single `index.html`, no build step, no framework
- Custom 2D physics with SAT polygon colliders
- Web Audio API (BGM + SFX)
- Web Speech API (character name TTS)
- Canvas 2D with DPR-aware pre-rendering
- PWA with offline service worker
