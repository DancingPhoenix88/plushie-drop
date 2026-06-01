# Plushie Drop — Changes Log

---

## v13 (current)
- **Reflection optimization** — reflections now read from a separate offscreen buffer (`reflectBuf`) instead of the live canvas, eliminating the GPU read-back stall
- **Half-resolution capture** — source strips stored at 50% resolution, scaled back up on draw (cuts pixel data by 4×)
- **~20fps throttle** — buffer updated every 3rd frame; one frame behind at 60fps, imperceptible
- **Fixed double-draw** — reflections were being drawn twice per frame; removed the redundant second call
- **AUTO dial** — `#ap` checkbox replaced with a cycling dial (0→1→2→3→0); `apSpeed` controls drop interval (off / 1200ms / 820ms / 500ms); styled with `Righteous` font, dark red glow, 6° skew

---

## v12
- **Claw frozen during cooldown** — mouse, touch, and arrow keys ignored while `cooling=true`; claw stays at drop position until ready
- **5% left/right play-area padding** — claw and plushies can no longer touch the side walls (`PAD = 5% W` constant, separate from `WALL`)
- **Reflection fixes** — right wall transform corrected (`translate(2*(W-rv))`), source coordinates now multiplied by `dpr` (fixes size mismatch and wrong zone sampling), reflections now drawn *before* popups/confetti so text/effects are not included in reflection
- **Right wall reflection** geometry aligned: rightmost orange pixel appears at cyan left edge, overflow cut off at canvas right

---

## v11
- **Reflection dpr fix** — source `drawImage` coordinates multiplied by `dpr`; previously sampled wrong physical pixels causing 2× size inflation and wrong zone
- **3-plushie lose condition** — game over only triggers when ≥ 3 plushies are simultaneously above the danger line (was 1)
- **Checkbox persistence** — BGM and Gyro states saved to `localStorage` per device, auto-restored on load

---

## v10
- **Reflections disabled on mobile** — `isMobile = pointer:coarse` check gates `drawReflections` + `drawCoverPatches`
- **Platform differences documented** — memory note added for breakpoints, mobile flags, known device quirks

---

## v9
- **iPhone portrait fix** — `max-height: 878px` rule now requires `min-aspect-ratio: 9/16` so it only fires in wide/landscape mode; portrait phones (e.g. iPhone 13 Pro 390×844) no longer have floor/evo zones hidden

---

## v8
- **Wall reflections** — Option-D canvas sampling: left/right strips sampled, compressed, flipped into reflection zones
- **Cover patches** — `claw_machine_top_left/bottom_left_reflection_cover.png` drawn at 4 corners (right variants = horizontal flip)
- **Render order** — reflections → cover patches → main objects (via `destination-over` composite)
- **Reflection disabled on mobile** (`pointer:coarse`)

---

## v7
- **Sprite checkboxes** — BGM, AUTO, GYRO use `checkbox_bg.png` / `checkbox_tick.png`; labels below; overlap trick for tighter spacing
- **Gyro as checkbox** — replaces old button; iOS permission still requested on first ON toggle; syncs with sidebar
- **Sidebar sync** — `#ls-cbs` mirrors floor-zone checkboxes; hidden unless floor-zone is hidden (`max-height: 878px`)
- **Evo zone locking** — icons silhouetted black until first merge; levels 1–3 always unlocked; unlocks on merge, re-locks on restart
- **Glass glare animation** — slanted double-line sweeping left→right, random 5–10 s interval; triggered on first-merge celebration
- **Righteous font** — loaded via Google Fonts for score (`#sc-p`) and celebration canvas text; `document.fonts.load()` ensures canvas uses it before first draw
- **Blob shadow** in evo zone — oval shadow under each character sprite
- **SFX compressor** — master `DynamicsCompressorNode` limits peak volume when many sounds overlap

---

## v6
- **Landscape centering** — `justify-content: center` on `#game-root` in wide mode
- **Height < 879 crop** — `(min-aspect-ratio: 9/16) and (max-height: 878px)` hides floor/evo zones and expands canvas to fill
- **Portrait scroll** — body gets `min-height: calc(100vw * 16/9 + 48px)` with `overflow-y: auto`; removes forced `100dvh` constraint
- **Background color** changed to `#A47966`

---

## v5
- **Claw machine UI layout** — 9:16 main content with `#game-frame` (claw machine middle tile), floor zone (score/next/controls), evo zone; blue/cyan tiles fill viewport height in portrait
- **Canvas** W=632, H=1049 with `aspect-ratio: 632/1049`; `.cw` inset from meta-derived percentages
- **Joystick + button** — PC-only (`pointer:fine`), toggled by `J` key; tilts on mouse/arrow movement (3-frame inactivity reset); button flashes on drop
- **Score/Next** — `claw_machine_score_next_bg.png` panel; Share Tech Mono / Righteous font for score; `#nc` changed from `<canvas>` to `<img>`
- **Drop SFX muted on autoplay**
- **Loop paused on game over** to save battery; `resumeLoop()` called on restart
- **Danger zone** — "DANGER" text, 5% W padding, same font as UI
- **Game Over** moved to fullscreen `position: fixed` overlay

---

## v4
- **Gyroscope tilt** — `DeviceOrientation` API maps `gamma` to gravity direction; canvas rotates visually; iOS 13+ permission flow; 🌀 toggle button

---

## v3
- **Keyboard shortcuts popup** (`?` / `/`) — Gameplay and Debug sections, sorted alphabetically
- **H / C mutual exclusive** — solid n-gon mode (H) and collider display (C) can't both be active
- **`physR` override** — Baby Bunny, Poko, Doraemi, Racoon have smaller collision radius than display radius
- **Network-first service worker** — always fetches fresh, falls back to cache offline

---

## v2
- **Service worker** introduced (`sw.js`) with `plushie-v1` cache
- **Auto-drop** checkbox (`A` shortcut)
- **BGM** — 8-bar C-major loop at 128 BPM via Web Audio API

---

## v1
- Initial release: Plushie Drop game with 11 characters, polygon SAT physics, merge mechanics, claw mode, score system, evolution chart
