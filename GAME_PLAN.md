# Plushie Drop — Suika Clone Game Plan

## Concept
A physics-based drop-and-merge game. Drop stuffed animal plushies into a bin. Two matching plushies touching = they merge into the next level. Keep the pile below the danger line. Reach Dragon (lv 11) for max points.

---

## Tech Stack
- **HTML5 Canvas** — rendering
- **Matter.js** — 2D physics (circles with restitution + friction)
- **Vanilla JS** — game logic, no framework needed
- Single `index.html` file, fully offline-playable

---

## Plushie Levels (evolution chain)

| Lv | Name    | Radius | Color    | Points |
|----|---------|--------|----------|--------|
| 1  | Mouse   | 18px   | #d4c5b8  | 1      |
| 2  | Bunny   | 26px   | #f0ece8  | 3      |
| 3  | Fox     | 34px   | #e8864a  | 6      |
| 4  | Dog     | 42px   | #c8a878  | 10     |
| 5  | Cat     | 50px   | #a8a0c8  | 15     |
| 6  | Panda   | 60px   | #f4f2f0  | 21     |
| 7  | Raccoon | 70px   | #888880  | 28     |
| 8  | Bear    | 82px   | #a07848  | 36     |
| 9  | Lion    | 94px   | #e8b840  | 45     |
| 10 | Unicorn | 108px  | #e8d0f0  | 55     |
| 11 | Dragon  | 124px  | #50b868  | 66     |

---

## File Structure

```
plushie-drop/
├── index.html          # game shell, score UI, canvas
├── game.js             # main game loop
├── physics.js          # Matter.js setup, collision handling
├── plushies.js         # plushie definitions + canvas draw functions
├── ui.js               # score, next preview, game-over screen
└── sprites/            # optional: pre-drawn PNG sprites per level
```

---

## Core Systems

### 1. Physics Setup (Matter.js)
All plushies are **perfect circles** — ears, horns, spines are drawn on canvas but the physics body is always `Matter.Bodies.circle()`. This means they roll naturally with zero extra tuning.

```js
const engine = Matter.Engine.create();
engine.gravity.y = 1.2;

// Container walls: left, right, floor (static rectangles)

// Each plushie = Matter.Bodies.circle(x, y, RADIUS[level], {
//   restitution: 0.25,  // soft plushie — slight squish bounce
//   friction: 0.6,      // enough grip to roll, not slide
//   frictionAir: 0.01,
//   label: `plushie_${level}`
// })
//
// RADIUS = [0,18,26,33,40,47,55,63,72,82,93,48] (lv1–lv11)
// Ears/horns are canvas-only — never affect collision shape
```

### 2. Drop Mechanic
- Track mouse/touch X position → show ghost plushie on the guide line
- On click/tap: spawn plushie body at that X, y=top
- Queue the *next* plushie (shown in sidebar) — random lv1–lv3 only
- Brief cooldown (~600ms) before next drop allowed

### 3. Merge Logic
```js
Matter.Events.on(engine, 'collisionStart', (event) => {
  event.pairs.forEach(pair => {
    const { bodyA, bodyB } = pair;
    if (bodyA.label === bodyB.label) {
      // same level → schedule merge
      pendingMerges.push([bodyA, bodyB]);
    }
  });
});

// In update loop:
pendingMerges.forEach(([a, b]) => {
  const midX = (a.position.x + b.position.x) / 2;
  const midY = (a.position.y + b.position.y) / 2;
  const nextLevel = getLevel(a) + 1;
  Matter.World.remove(world, a);
  Matter.World.remove(world, b);
  if (nextLevel <= 11) spawnPlushie(midX, midY, nextLevel);
  addScore(POINTS[nextLevel]);
  playMergeEffect(midX, midY, nextLevel);
});
```

### 4. Danger Line / Game Over
- Danger line drawn at ~15% from top of container
- Each frame: check if any plushie's top edge is above the line AND it has been settled (velocity < threshold) for > 2 seconds
- If yes → game over animation → score screen

### 5. Drawing Plushies (Canvas)
Each level has a `draw(ctx, x, y, r)` function that paints the face/body using canvas 2D API (arcs, bezier paths for ears/horns). All art is procedural — no external image files needed. The spritesheet SVG above is the reference for each design.

---

## UI Layout

```
+----------+------------------+----------+
| SCORE    |                  | EVOL.    |
| 1 840    |    [ghost drop]  | CHART    |
|----------|                  |          |
| BEST     |   GAME AREA      | mouse →  |
| 4 220    |   (canvas)       | bunny →  |
|----------|                  | ...      |
| NEXT     |  - - danger line |          |
| [fox]    |  [plushies pile] | dragon ★ |
|          |                  |          |
| TIPS     |__________________|          |
+----------+------------------+----------+
```

---

## Game States

| State      | Description                              |
|------------|------------------------------------------|
| `idle`     | Waiting for first drop                   |
| `dropping` | Player aiming, ghost shown               |
| `settling` | Plushie falling, merges checked          |
| `cooldown` | Brief pause before next drop allowed     |
| `gameover` | Pile too high — show score + replay btn  |

---

## Scoring
- Merge gives points for the *resulting* level (see table)
- Bonus: +50 for merging into Dragon (lv 11)
- Dragon that fills the container → special ending screen

---

## Phase Plan

| Phase | What to build                          | Est. time |
|-------|----------------------------------------|-----------|
| 1     | Matter.js container + drop mechanic    | 2–3 hrs   |
| 2     | All 11 plushie draw functions          | 3–4 hrs   |
| 3     | Merge logic + score system             | 2 hrs     |
| 4     | Danger line + game-over state          | 1 hr      |
| 5     | Next-preview UI + evolution sidebar    | 1 hr      |
| 6     | Merge particle effect + sounds         | 2 hrs     |
| 7     | Polish: animations, mobile touch       | 2 hrs     |

**Total estimated: ~14 hrs for a fully playable build**

---

## Stretch Goals
- High score saved to `localStorage`
- Confetti explosion when Dragon appears
- Background music (loopable chiptune)
- Share score as image (Canvas → PNG)
- PWA manifest for mobile install
