# Plushie Drop 🧸

A Suika-style drop-and-merge game with cute plushie characters.

## Play

👉 [DancingPhoenix88.github.io/plushie-drop](https://DancingPhoenix88.github.io/plushie-drop/)

Open on mobile and tap **Add to Home Screen** to install as an app.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Move drop point left |
| `→` | Move drop point right |
| `Shift` + `←` / `→` | Move drop point fast |
| `Space` | Drop plushie |
| `D` | Toggle debug overlay (collider circles, angular velocity) |

### Debug spawn (dev)

| Key | Spawns |
|-----|--------|
| `2` | Mây (lv 2) |
| `3` | Bơ (lv 3) |
| `4` | Baby Bunny (lv 4) |
| `5` | Mini Dora (lv 5) |
| `6` | Poko (lv 6) |
| `7` | Doraemi (lv 7) |
| `8` | Doraemon (lv 8) |
| `9` | Bunny (lv 9) |
| `0` | Mimi (lv 10) |
| `1` | Racoon (lv 11) |

---

## Characters & Merge Points

| Level | Character | Merge → |
|-------|-----------|---------|
| 1 | Vincam | +3 pts |
| 2 | Mây | +6 pts |
| 3 | Bơ | +10 pts |
| 4 | Baby Bunny | +15 pts |
| 5 | Mini Dora | +21 pts |
| 6 | Poko | +28 pts |
| 7 | Doraemi | +36 pts |
| 8 | Doraemon | +45 pts |
| 9 | Bunny | +55 pts |
| 10 | Mimi | +100 pts |
| 11 | Racoon | ★ Final |

---

## Tech

- Vanilla HTML / CSS / JavaScript — single file, no framework
- Custom circle physics engine (sub-step integration, SAT polygon colliders)
- Web Audio API for BGM and per-character merge SFX
- Web Speech API for character name pronunciation on merge
- PWA with offline caching via Service Worker
