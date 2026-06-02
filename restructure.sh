#!/usr/bin/env bash
# Run once from the project root to complete the folder restructure.
# After running: git add -A && git commit -m "restructure: organise Sprites into subdirs, move dev tools to dev/"
set -e

# ── Sprites/characters ────────────────────────────────────────────
mkdir -p Sprites/characters
for f in Sprites/level_*.png; do
  [ -f "$f" ] && git mv "$f" Sprites/characters/
done

# ── Sprites/claw ──────────────────────────────────────────────────
mkdir -p Sprites/claw
for f in Sprites/claw_back.png Sprites/claw_front.png Sprites/claw_open.png; do
  [ -f "$f" ] && git mv "$f" Sprites/claw/
done

# ── Sprites/machine ───────────────────────────────────────────────
mkdir -p Sprites/machine
for f in Sprites/claw_machine_*.png; do
  [ -f "$f" ] && git mv "$f" Sprites/machine/
done

# ── Sprites/ui ────────────────────────────────────────────────────
mkdir -p Sprites/ui
for f in \
  Sprites/checkbox_bg.png Sprites/checkbox_tick.png \
  Sprites/joystick_released.png Sprites/joystick_tilted.png \
  Sprites/button_released.png Sprites/button_pressed.png; do
  [ -f "$f" ] && git mv "$f" Sprites/ui/
done

# ── Sprites/icons ─────────────────────────────────────────────────
mkdir -p Sprites/icons
[ -f Sprites/app_icon.png ] && git mv Sprites/app_icon.png Sprites/icons/

# ── dev/ (experimental / tooling — not deployed) ──────────────────
mkdir -p dev
[ -f tool_9slice.html ]   && git mv tool_9slice.html   dev/
[ -f index-pixijs.html ]  && git mv index-pixijs.html  dev/

echo "Done. Now run: git add -A && git commit -m 'restructure: organise Sprites into subdirs, move dev tools to dev/'"
