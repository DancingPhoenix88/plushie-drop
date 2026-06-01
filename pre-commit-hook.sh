#!/bin/sh
# Warn if any .meta file is staged — CSS border-image-width values may need updating.
# Install: cp pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

staged_meta=$(git diff --cached --name-only | grep '\.meta$')
if [ -n "$staged_meta" ]; then
  echo ""
  echo "⚠️  .meta file(s) changed:"
  echo "$staged_meta" | sed 's/^/   /'
  echo ""
  echo "   Check and update hard-coded border-image-width percentages in index.html:"
  echo "   • claw_machine_middle_tile  →  #game-frame border-image"
  echo "     (ref 720×1280: top=slice/1280%, sides=slice/720%)"
  echo "   • claw_machine_top_tile     →  #top-tile border-image (pixel values ok)"
  echo "   • claw_machine_bottom_tile  →  #bottom-tile::before border-image (pixel values ok)"
  echo ""
fi
exit 0
