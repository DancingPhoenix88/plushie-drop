# Plushie Drop — Changes Log

---

## v25 (current)
- **Reflection buffer at quarter-res** — `REFLECT_SCALE` reduced from 0.5 to 0.25 (4× smaller buffer) for better performance; visually imperceptible at 0.22 opacity

---

## v24
- **Rename to BB Tower** — updated title in `<title>`, `apple-mobile-web-app-title`, and `manifest.json`
- **Claw tracks mouse during cooldown** — claw now follows mouse/finger during the open animation instead of freezing at drop position, eliminating the hiccup when moving quickly
- **`#fz-next-label` CSS** — width 70%, margin-left 32%

---

## v23
- **Gyro / tilt controls** — GYRO checkbox enables device orientation; gravity direction follows phone tilt with full ±180° range via accelerometer gravity vector; unclamped (removed 15° cap)
- **Gyro arrow** — rotating ▼ indicator in floor zone shows true gravity direction when GYRO is on; hidden on desktop (pointer:fine) except in debug mode
- **Shake to push** — `DeviceMotionEvent` applies directional force to all plushies proportional to physical movement speed/direction
- **Gyro losing condition** — in GYRO mode, game over only triggers when 3+ plushies stay above danger line for 1 continuous second
- **Touch tween revamp** — tap distance <5% snaps instantly; 5–30% interpolates duration 0→300ms; ≥30% fixed 300ms
- **Debug gyro sim** — hold G + mouse to tilt, hold F + mouse to shake (IS_DEBUG only); arrow swaps in for joystick while held
- **Debug no-merge** — M key toggles merge on/off (IS_DEBUG only, release-safe)
- **iOS gyro permission fix** — saved gyro pref no longer auto-calls `requestPermission` on load

## v22
- **Cover patch alignment fix** — canvas `.cw` top offset changed from fixed `11px` to proportional `calc(11/1280*100%)` so it scales with game-frame height; fixes cover patches appearing vertically offset on larger devices (iPhone XS Max / 15 Pro Max)
- **Rename to BB Tower** — updated game title in `<title>`, `apple-mobile-web-app-title`, and `manifest.json`
- **Remove TTS on merge** — reverted name announcement (`speechSynthesis`) from `sfxMerge`; merges now play only the arpeggio SFX

---

## v21
- **Gamepad support** — Xbox/standard layout: left stick moves aim, A drops, LT/RT speed up, B toggles help popup, LB/RB switches help tab between keyboard and gamepad; gamepad tab hidden until controller connects
- **Game over accept** — Enter/Space on keyboard or A on gamepad restarts from game over screen
- **DEBUG/RELEASE switch** — `IS_DEBUG=true` on `main`, `false` on `release` branch; debug keyboard shortcuts and help section hidden in release
- **Level SFX** — ascending C major arpeggio + shimmer on LEVEL UP announcement

---

## v20
- **WIPE OUT trap door** — floor tile sprite drawn on canvas; opens when plushies start falling, closes after all plushies exit; 9-slice horizontal tile (capL/R=90px from meta); plushie-plushie SAT disabled while door is open so plushies spin and scatter freely
- **WIPE OUT physics** — merging disabled during wipeout; spin+scatter forces applied at door-open time; close timing calculated from physics (worst-case fall distance)
- **Cover patches moved to canvas** — reflection corner sprites drawn via `destination-over` compositing (behind plushies, above background)
- **Sidebar reordered** — Next above Level
- **Floor zone NEXT label** — shows `NEXT (LvX)` with current game level
- **Celebration sub-label** — shows `Lv X · Rank N · +pts`

---

## v19
- **Floor zone redesign** — 3 independently absolute-positioned panels (score+next left, joystick center, checkboxes right); all scale with floor-zone height via `aspect-ratio` + `%` sizing; no flex interference between panels
- **Portrait layout locked to viewport** — `height:100dvh; overflow:hidden` in portrait mode; `justify-content:flex-end` sticks game to bottom; no page scroll
- **Mid-range ar [0.6–0.667] offset** — top-bar and main-content shift down by evo zone height (11.25vw) to hide evo strip when screen is borderline portrait/wide
- **TAP TO DROP hint** — on load and restart (auto off): claw starts far-left; large slowly-pulsing text at tank center until first drop
- **Portrait/wide threshold raised to 2/3** — fixes iPhone 13 portrait with collapsed Safari chrome (ar ≈ 0.587) incorrectly entering wide layout
- **Arrow Down drops** — `↓` key now drops same as Space
- **Rank label** — sidebar Next label shows name only (no rank number)
- **Level in sidebar** — Level shown above Next in landscape sidebar
- **Fullscreen prompt** — iOS shows "Share → Add to Home Screen" guidance; Android shows Enter Full Screen button; skipped if already standalone
- **Auto-drop cooldown** — self-scheduling timeout ensures no drop is skipped; minimum 300ms gap always respected
- **Mouse/touch ignore cooldown** — clicks and taps queue and fire as soon as cooling clears; keyboard Space/↓ still blocks during cooldown
- **WIPE OUT timing** — sparkles start at 2nd glare (t=300ms), level announcement at t=620ms + 500ms delay; sparkles emitted at 10/s for 2s, white only, pulse in place
- **Bo** — renamed from Bơ

---

## v18
> ── session break ──
- **Rebalanced character sizes** — lv1 (Mây) radius reduced to 30; lv1–9 linearly interpolated to Bunny (r=116), step≈10.75; lv10–11 unchanged; physR overrides for Baby Bunny/Poko/Doraemi/Racoon keep original collision-to-visual ratios
- **Physics pre-calculation** — MASS (physR²), INV_MASS, MERGE_DIST, MERGE_DIST_SQ, and DAMP_DT all computed once at load; hot collision loop uses lookup tables instead of runtime r² and Math.pow
- **Merge distance formula** — gap constant updated to X=6 (lv1 r×20%); MERGE_DIST = 2×physR + 6; squared table used directly in distance check (no sqrt)
- **Speed cap optimised** — anti-tunneling check uses squared comparison (spd²>196) before sqrt; rolling movement average also uses squared distance (threshold 0.0625 = 0.25²)
- **Merge detection** — same-type check enforced before distance test; MERGE_DIST_SQ lookup replaces per-call squaring
- **Merge scores ÷10** — all base PTS values divided by 10 (Mây +1 … Mimi +55, Racoon triggers WIPE OUT)
- **Game-over conditions split** — two independent triggers: (1) any plushie center above danger line for 1 s; (2) 3+ plushie centers above danger line simultaneously; previously a single AND condition requiring both

---

## v17
- **WIPE OUT event** — merging two rank-11 Racoons triggers WIPE OUT: all remaining plushies pop simultaneously, bonus points awarded for each pop, a single large total-bonus popup replaces individual overlays, tank empties, evo zone resets to ranks 1–3 locked
- **Game levels** — each WIPE OUT increments the game level; merge scores multiply by 2^(level−1) (Level 2 = ×2, Level 3 = ×4 …); multiplier cached in `scoreMultiplier` and a pre-computed `PTS_M[rank]` table rebuilt once per level-up
- **LEVEL X celebration** — after WIPE OUT a "LEVEL X" card appears with the new multiplier shown in the sub-label; first-appearance tracking resets so celebration cards fire again for each rank
- **WIPE OUT VFX** — 160-particle confetti burst, 80 staggered 4-point sparkle stars across the full tank (white/gold/ice-blue with glow), triple glass-glare sweep (0 / 300 / 620 ms), dramatic rising-sweep + chord SFX
- **Rank system** — celebration sub-label now reads "Rank X · +Y pts" (was "Lv X · Y pts"); points shown post-multiplier
- **`W` debug shortcut** — force a WIPE OUT instantly; also unlocks all 11 ranks before triggering so the evo zone briefly shows the full strip

---

## v16
- **Fullscreen prompt on mobile** — on page load, mobile players see an overlay asking them to enter full screen; tapping "Enter Full Screen" calls `requestFullscreen` (webkit fallback included); "Skip" dismisses without entering
- **Floor-zone always visible** — removed `display:none` on `#floor-zone` from the wide+short media rule so the score is always accessible; also raised the hide-rule threshold from `9/16` → `4/5` to prevent iPhone 13 portrait (collapsed Safari chrome, ~0.587 ratio) from incorrectly triggering the landscape-only rule

---

## v15
- **AUTO fan-dial** — replaced ON/OFF checkbox with a 0→1→2→3 speed dial; shows one large number at a time (Righteous font, dark red glow for 1/2/3, invisible for 0); cycles on tap or `A` key; speeds: 1200ms / 820ms / 500ms
- **Touch tween** — on mobile, tapping tweens the claw to the touch point (0.3s easeInOutQuad) then drops; dragging cancels the tween and moves claw directly; touchend while tween is running queues drop for tween completion

---

## v14
- **Adaptive reflection on mobile** — reflection starts OFF; enables after 2s of stable ≥55 FPS; if FPS drops below 55 for 2s after enabling, disables permanently for the session (resets on reload)
- **Rolling FPS tracker** — 60-frame delta average drives the adaptive logic; desktop always enables reflection immediately

---

## v13
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
- **Evo zone locking** — icons silhouetted black until first merge; ranks 1–3 always unlocked; unlocks on merge, re-locks on restart or WIPE OUT
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
