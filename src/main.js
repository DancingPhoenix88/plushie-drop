import { 
  W, H, DY, DROPY, PAD, PD, PTS, MERGE_DIST_SQ, CLAW_OPEN_FRAMES, 
  TRAP_ANIM_SPEED, CONFETTI_COLORS, FS 
} from './config.js';
import { Ball, stepPhysics, destroyBall } from './physics.js';
import { 
  initPixi, loadSprites, renderScene, cleanRender, triggerGlare, tickGlare, 
  drawAtFit, layerFx 
} from './renderer.js';
import { 
  mx, tiltAngle, initInputHandlers, processGamepad, processKeyboardMovement, 
  clampClaw, updateJoystick, flashDropBtn 
} from './input.js';
import { 
  sfxDrop, sfxMerge, sfxWipeOut, sfxLevelUp, sfxGameOver, playCharacterName, 
  startBGM, bgmOn, bgmRunning, muted 
} from './audio.js';
import { 
  fitToViewport, updateScoreUI, updateNextUI, buildEvoChart, updateEvoLabels, 
  bindDOMEvents, loadCbPrefs, toggleHelp, showGameOverModal, hideGameOverModal, 
  setPromptActionButton, dismissFsPrompt, enterFullscreen, initNextCanvas 
} from './ui.js';

let plushies = [], parts = [], mergeQ = [];
let popups = [], confetti = [], celebrations = [], sparkles = [];
let score = 0, best = 0, cur = 1, nxt = 1, gameLevel = 1, scoreMultiplier = 1;
let cooling = false, dead = false, tapHint = false, wipeOutActive = false;
let trapDoorScale = 0, trapDoorOpen = false;
let clawState = 'idle', clawOpenTimer = 0, clawLvl = 1, clawX = W / 2, clawDropX = W / 2;
let sidesOffset = 0, dbg = false, dbgPoly = false, solidMode = false, noMerge = false, showSpawnRate = false;
let apSpeed = 0, _apTimer = null;
const AP_DELAYS = [0, 1200, 820, 500];

let danger = {};
const firstMerged = new Set();
let _gameFrame = 0;
let _frameEvents = [];
const PTS_M = new Array(12);

function rebuildPtsTable() {
  for (let i = 1; i <= 11; i++) PTS_M[i] = PTS[i] * scoreMultiplier;
}

function scheduleAt(delay, fn) {
  _frameEvents.push({ at: _gameFrame + Math.max(1, Math.round(delay)), fn });
}

function tickScheduled() {
  _gameFrame++;
  _frameEvents = _frameEvents.filter(e => {
    if (_gameFrame >= e.at) { e.fn(); return false; }
    return true;
  });
}

function clearCelebrations() {
  for (const c of celebrations) {
    if (c.pixiGlow) { c.pixiGlow.destroy(); c.pixiGlow = null; }
    if (c.pixiText) { c.pixiText.destroy(); c.pixiText = null; }
    if (c.pixiSub) { c.pixiSub.destroy(); c.pixiSub = null; }
  }
  celebrations = [];
}

function clearPopups() {
  for (const p of popups) {
    if (p.pixiText) { p.pixiText.destroy(); p.pixiText = null; }
  }
  popups = [];
}

function rnd() {
  const top = plushies.reduce((m, p) => Math.max(m, p.level), 0);
  const maxL = Math.max(top - 1, 3);
  let total = 0;
  const weights = [];
  for (let L = 1; L <= maxL; L++) {
    const w = Math.pow(0.64, L - 1);
    weights.push(w); total += w;
  }
  let r = Math.random() * total;
  for (let L = 1; L <= maxL; L++) {
    r -= weights[L - 1];
    if (r <= 0) return L;
  }
  return 1;
}

function computeSpawnRates() {
  const top = plushies.reduce((m, p) => Math.max(m, p.level), 0);
  const maxL = Math.max(top - 1, 3);
  const rates = new Array(12).fill(0);
  let total = 0;
  for (let L = 1; L <= maxL; L++) total += Math.pow(0.64, L - 1);
  for (let L = 1; L <= maxL; L++) rates[L] = Math.pow(0.64, L - 1) / total;
  return rates;
}

function drop() {
  if (cooling || dead || wipeOutActive) return;
  tapHint = false;
  flashDropBtn();
  clawDropX = clampClaw(mx, cur);
  clawLvl = cur;
  clawState = 'opening';
  clawOpenTimer = CLAW_OPEN_FRAMES;
  cooling = true;
}

function setApSpeed(spd) {
  apSpeed = spd;
  ['ap', 'ap-ls'].forEach(id => {
    const dial = document.getElementById(id);
    if (!dial) return;
    dial.querySelectorAll('.ap-seg').forEach(seg => {
      seg.classList.toggle('active', +seg.dataset.spd === spd);
    });
  });
  if (_apTimer) { clearTimeout(_apTimer); _apTimer = null; }
  if (spd > 0) {
    const schedule = () => {
      _apTimer = setTimeout(() => {
        if (!apSpeed) { _apTimer = null; return; }
        (function waitCool() {
          if (wipeOutActive || dead) { schedule(); return; }
          if (cooling) { requestAnimationFrame(waitCool); }
          else { drop(); schedule(); }
        })();
      }, AP_DELAYS[apSpeed]);
    };
    schedule();
  }
}

function cycleAp() {
  setApSpeed((apSpeed + 1) % 4);
}

function burst(x, y, color) {
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 2 * i / 11 + Math.random() * .5, spd = 2 + Math.random() * 4;
    parts.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 3 + Math.random() * 4, color, life: 1 });
  }
}

function spawnCelebration(x, y, lvl, actualPts) {
  triggerGlare();
  playCharacterName(lvl);
  celebrations.push({
    x: W / 2, y: H / 2 - 30, name: PD[lvl].name, level: lvl,
    pts: actualPts ?? PTS[lvl], color: PD[lvl].body, stroke: PD[lvl].stroke,
    life: 1, scale: 0.1, phase: 'in'
  });
  setTimeout(() => {
    for (let i = 0; i < 60; i++) {
      const fromTop = i < 20;
      const cx = fromTop ? Math.random() * W : x, cy = fromTop ? -10 : y;
      const a = fromTop ? (Math.PI / 2 + Math.random() * .8 - .4) : (Math.random() * Math.PI * 2);
      const spd = fromTop ? (3 + Math.random() * 5) : (4 + Math.random() * 7);
      confetti.push({
        x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        r: 3 + Math.random() * 4, rot: Math.random() * Math.PI * 2,
        rv: (Math.random() - .5) * 0.25, w: 4 + Math.random() * 5, h: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        life: 1, shape: Math.random() < 0.6 ? 'rect' : 'circle'
      });
    }
  }, 80);
}

function detectMerges() {
  if (wipeOutActive || noMerge) return;
  const used = new Set();
  for (let i = 0; i < plushies.length; i++) {
    for (let j = i + 1; j < plushies.length; j++) {
      if (used.has(i) || used.has(j)) continue;
      const a = plushies[i], b = plushies[j];
      if (a.level !== b.level) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (dx * dx + dy * dy < MERGE_DIST_SQ[a.level]) {
        mergeQ.push([i, j]);
        used.add(i); used.add(j);
      }
    }
  }
}

function processMerges() {
  if (!mergeQ.length || noMerge) return;
  const pairs = mergeQ.splice(0).sort((a, b) => Math.max(b[0], b[1]) - Math.max(a[0], a[1]));
  const toRemove = new Set(), toAdd = [];
  let wipeOutPos = null;

  for (const [i, j] of pairs) {
    if (toRemove.has(i) || toRemove.has(j)) continue;
    const a = plushies[i], b = plushies[j];
    const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2, nl = a.level + 1;
    toRemove.add(i); toRemove.add(j);
    if (nl > 11) { wipeOutPos = { x: px, y: py }; continue; }
    toAdd.push({ x: px, y: py, lvl: nl });
    const pts = PTS_M[nl];
    score += pts;
    if (score > best) best = score;
    burst(px, py, PD[nl].body);
    updateScoreUI(score, gameLevel);
    sfxMerge(nl);
    popups.push({ x: px, y: py, text: '+' + pts.toLocaleString(), color: PD[nl].body, life: 1 });
    if (!firstMerged.has(nl)) {
      firstMerged.add(nl);
      spawnCelebration(px, py, nl, pts);
      buildEvoChart(firstMerged);
    }
  }

  plushies.filter((_, idx) => toRemove.has(idx)).forEach(p => destroyBall(p, danger));
  plushies = plushies.filter((_, idx) => !toRemove.has(idx));
  for (const { x, y, lvl } of toAdd) {
    const b = new Ball(x, y, lvl);
    b.vx = (Math.random() - .5) * 2; b.vy = -3;
    plushies.push(b);
  }
  if (wipeOutPos) triggerWipeOut(wipeOutPos.x, wipeOutPos.y);
}

function triggerWipeOut(x, y) {
  wipeOutActive = true; trapDoorOpen = false;
  clawState = 'idle'; cooling = false;
  cur = rnd(); nxt = rnd(); updateNextUI(nxt, gameLevel, drawAtFit);
  clawX = W / 2; clawLvl = cur;

  // Clear previous celebrations and popups before triggering WIPE OUT banner
  clearCelebrations();
  clearPopups();

  const OPEN_F = Math.round(1 / TRAP_ANIM_SPEED);
  const CLOSE_F = OPEN_F * 2 + 60;
  scheduleAt(OPEN_F, () => { trapDoorOpen = true; });
  scheduleAt(CLOSE_F, () => {
    plushies.forEach(p => destroyBall(p, danger));
    plushies = [];
    trapDoorOpen = false;
  });

  let totalPts = 0;
  for (const p of plushies) { totalPts += PTS_M[p.level]; p.vy = Math.max(p.vy, 1); }
  score += totalPts;
  updateScoreUI(score, gameLevel);

  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2, spd = 4 + Math.random() * 8;
    confetti.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2, rv: (Math.random() - .5) * 0.3,
      w: 6, h: 8, color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 1.2, shape: Math.random() < 0.6 ? 'rect' : 'circle'
    });
  }
  celebrations.push({ x: W / 2, y: H / 2 - 80, name: 'WIPE OUT!', level: 0, pts: totalPts, color: '#ff3030', stroke: '#800000', life: 1, scale: 0.1, phase: 'in', isWipeOut: true });
  if (totalPts > 0) popups.push({ x: W / 2, y: H / 2 + 60, text: '+' + totalPts.toLocaleString(), color: '#f0c500', life: 1.8, big: true });
  sfxWipeOut();
  triggerGlare();
}

function tickTrapDoor() {
  const target = trapDoorOpen ? 1 : 0;
  if (trapDoorScale === target) return;
  const prev = trapDoorScale;
  trapDoorScale = target > prev ? Math.min(1, prev + TRAP_ANIM_SPEED) : Math.max(0, prev - TRAP_ANIM_SPEED);
  if (prev > 0 && trapDoorScale <= 0 && wipeOutActive) {
    wipeOutActive = false;
    gameLevel++;
    scoreMultiplier = Math.pow(2, gameLevel - 1);
    rebuildPtsTable();
    const glEl = document.getElementById('gl-ls'); if (glEl) glEl.textContent = gameLevel;
    firstMerged.clear();
    buildEvoChart(firstMerged);

    // Clean up wipeout celebration before introducing the new level banner
    clearCelebrations();
    clearPopups();

    scheduleAt(30, () => {
      celebrations.push({ x: W / 2, y: H / 2 - 60, name: 'LEVEL ' + gameLevel, level: 0, pts: 0, color: '#f0c500', stroke: '#8a6000', life: 1, scale: 0.1, phase: 'in', isLevelUp: true });
      sfxLevelUp();
    });
  }
}

function tickPopups() {
  popups.forEach(p => {
    p.y -= (p.big ? 0.4 : 1.2);
    p.life -= 0.022;
    if (!p.pixiText && p.life > 0) {
      const sz = p.big ? Math.round(68 * FS) : Math.round(36 * FS);
      p.pixiText = new PIXI.Text({
        text: p.text,
        style: { fontFamily: "'Cherry Bomb One',sans-serif", fontSize: sz, fontWeight: '700', fill: p.color, stroke: { color: '#000000', width: 3 } }
      });
      p.pixiText.anchor.set(0.5, 0.5);
      layerFx.addChild(p.pixiText);
    }
    if (p.pixiText) {
      const sz = p.big ? Math.round((48 + p.life * 20) * FS) : Math.round((22 + p.life * 14) * FS);
      p.pixiText.style.fontSize = sz;
      p.pixiText.x = p.x; p.pixiText.y = p.y;
      p.pixiText.alpha = Math.min(p.life, 1) * 0.92;
    }
  });
  popups.filter(p => p.life <= 0).forEach(p => { if (p.pixiText) p.pixiText.destroy(); });
  popups = popups.filter(p => p.life > 0);
}

function tickSparkles() {
  sparkles = sparkles.filter(s => s.life > 0);
  sparkles.forEach(s => {
    if (s.delay > 0) { s.delay -= 16; return; }
    s.phase += 0.12;
    s.r = s.baseR * (0.7 + 0.3 * Math.sin(s.phase));
    s.life -= 0.018;
  });
}

function tickConfetti() {
  confetti = confetti.filter(p => p.life > 0);
  confetti.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.99;
    p.rot += p.rv; p.life -= 0.012;
  });
}

function tickCelebrations() {
  celebrations.forEach(c => {
    if (c.phase === 'in') {
      c.scale = Math.min(1, c.scale + 0.12);
      c.y -= 0.4;
      if (c.scale >= 1) { c.phase = 'hold'; c.holdTimer = 60; }
    } else if (c.phase === 'hold') {
      c.holdTimer--;
      c.y -= 0.4;
      if (c.holdTimer <= 0) c.phase = 'out';
    } else {
      c.life -= 0.022;
      c.y -= 0.8;
    }
    if (!c.pixiText && c.life > 0) {
      let sub = '';
      if (c.isWipeOut) sub = c.pts > 0 ? '+' + c.pts.toLocaleString() + ' bonus pts' : '';
      else if (c.isLevelUp) sub = '×' + Math.pow(2, gameLevel - 1) + ' points multiplier';
      else sub = `Rank ${c.level}  ·  +${c.pts.toLocaleString()} pts`;
      const gfx = new PIXI.Graphics();
      gfx.ellipse(0, 0, Math.round(120 * FS), Math.round(50 * FS));
      gfx.fill({ color: c.color, alpha: 0.65 });
      gfx.filters = [new PIXI.BlurFilter({ strength: 28, quality: 4 })];
      layerFx.addChild(gfx);
      c.pixiGlow = gfx;
      c.pixiText = new PIXI.Text({
        text: c.name,
        style: { fontFamily: "'Cherry Bomb One',sans-serif", fontSize: Math.round(52 * FS), fill: c.color, stroke: { color: c.stroke, width: 8 } }
      });
      c.pixiText.anchor.set(0.5, 0.5);
      layerFx.addChild(c.pixiText);
      if (sub) {
        c.pixiSub = new PIXI.Text({
          text: sub,
          style: { fontFamily: "'Cherry Bomb One',sans-serif", fontSize: Math.round(16 * FS), fill: '#ffffff', stroke: { color: '#000000', width: 3 } }
        });
        c.pixiSub.anchor.set(0.5, 0.5);
        layerFx.addChild(c.pixiSub);
      }
    }
    if (c.pixiText) {
      const alpha = c.phase === 'out' ? c.life * 0.95 : 0.97;
      if (c.pixiGlow) {
        c.pixiGlow.x = c.x; c.pixiGlow.y = c.y;
        c.pixiGlow.scale.set(c.scale);
        c.pixiGlow.alpha = alpha * 0.8;
      }
      c.pixiText.x = c.x; c.pixiText.y = c.y;
      c.pixiText.scale.set(c.scale);
      c.pixiText.alpha = alpha;
      if (c.pixiSub) {
        c.pixiSub.x = c.x; c.pixiSub.y = c.y + 34 * c.scale;
        c.pixiSub.scale.set(c.scale);
        c.pixiSub.alpha = alpha;
      }
    }
  });
  celebrations.forEach(c => {
    if (c.life <= 0) {
      if (c.pixiGlow) { c.pixiGlow.destroy(); c.pixiGlow = null; }
      if (c.pixiText) { c.pixiText.destroy(); c.pixiText = null; }
      if (c.pixiSub) { c.pixiSub.destroy(); c.pixiSub = null; }
    }
  });
  celebrations = celebrations.filter(c => c.life > 0);
}

function checkDanger() {
  const now = Date.now();
  for (const p of plushies) {
    if (!p.landed) { p._dangerLevel = 0; delete danger[p.born]; continue; }
    const vr = PD[p.level].r;
    const topAbove = p.y - vr < DY;
    const bottomNearLine = p.y + vr < DY + 10;
    if (bottomNearLine && now - p.born > 500) {
      p._dangerLevel = 3;
      danger[p.born] = danger[p.born] ?? now;
      if (now - danger[p.born] > 1000) { gameOver(); return; }
    } else if (topAbove) {
      p._dangerLevel = 2; delete danger[p.born];
    } else {
      p._dangerLevel = 0; delete danger[p.born];
    }
  }
}

function gameOver() {
  dead = true;
  sfxGameOver();
  const snap = cleanRender(plushies);
  showGameOverModal(score, snap);
}

function restart() {
  dead = false; cooling = false; wipeOutActive = false;
  trapDoorOpen = false; trapDoorScale = 0; gameLevel = 1; scoreMultiplier = 1;
  rebuildPtsTable();

  // Cancel any scheduled callbacks
  _frameEvents = [];

  // Clean all plushies
  plushies.forEach(p => destroyBall(p, danger));
  plushies = []; 
  parts = []; 
  mergeQ = []; 
  confetti = []; 
  sparkles = [];
  danger = {}; 
  firstMerged.clear(); 
  score = 0;

  // Fully destroy any remaining PIXI celebration and popup nodes
  clearCelebrations();
  clearPopups();

  updateScoreUI(score, gameLevel);
  hideGameOverModal();
  cur = rnd(); nxt = rnd(); updateNextUI(nxt, gameLevel, drawAtFit);
  clawState = 'idle'; clawX = W / 2; clawLvl = cur;

  if (bgmOn && !muted) {
    const el = document.getElementById('bgm-audio');
    if (el) el.currentTime = 0;
    startBGM();
  }

  requestAnimationFrame(loop);
}

function shareScore() {
  const url = window.location.href;
  const text = `I scored ${score.toLocaleString()} in BB Tower 🧸! Can you beat me?\n${url}`;
  if (navigator.share) {
    navigator.share({ title: 'BB Tower', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
  }
}

function loop() {
  tickScheduled();
  processGamepad({
    cur, dead, onDrop: drop, onRestart: restart, onShare: shareScore,
    onToggleHelp: () => toggleHelp(), onCycleAp: cycleAp
  });
  tickTrapDoor();
  processKeyboardMovement(cur, dead);

  if (!dead) {
    stepPhysics(plushies, { tiltAngle, wipeOutActive, trapDoorScale, sidesOffset });
    detectMerges();
    processMerges();
    checkDanger();
  }

  if (clawState === 'idle') {
    clawX = clampClaw(mx, cur);
  } else if (clawState === 'opening') {
    clawX = clampClaw(mx, cur);
    clawOpenTimer--;
    if (clawOpenTimer === CLAW_OPEN_FRAMES - 2) {
      sfxDrop();
      if (bgmOn && !bgmRunning) startBGM();
      const b = new Ball(clawDropX, DROPY, clawLvl);
      b.av = (Math.random() - .5) * 0.03;
      plushies.push(b);
      cur = nxt; nxt = rnd(); updateNextUI(nxt, gameLevel, drawAtFit);
    }
    if (clawOpenTimer <= 0) { clawState = 'idle'; cooling = false; }
  }

  updateJoystick();
  parts = parts.filter(p => p.life > 0);
  parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .18; p.life -= .044; p.r *= .93; });
  tickConfetti();
  tickSparkles();
  tickPopups();
  tickCelebrations();
  tickGlare();

  renderScene({
    plushies, parts, confetti, sparkles, celebrations,
    clawState, clawLvl, cur, clawX, clawOpenTimer,
    tapHint, dead, wipeOutActive, trapDoorScale,
    solidMode, dbg, dbgPoly, sidesOffset
  });

  if (!dead) requestAnimationFrame(loop);
}

async function boot() {
  rebuildPtsTable();
  const canvas = document.getElementById('gc');
  await initPixi(canvas);
  initNextCanvas();

  bindDOMEvents({
    onRestart: restart,
    onShare: shareScore,
    onCycleAp: cycleAp,
    onToggleNoMerge: checked => { noMerge = checked; }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'j' || e.key === 'J') {
      const joy = document.getElementById('joyctrl');
      if (joy) joy.style.display = joy.style.display === 'flex' ? 'none' : 'flex';
    }
    if (e.key === 'a' || e.key === 'A') cycleAp();
    if (e.key === '?' || e.key === '/') toggleHelp();
    if (e.key === 'Escape') toggleHelp(false);
    if (e.key === 's' || e.key === 'S') {
      showSpawnRate = !showSpawnRate;
      updateEvoLabels(showSpawnRate, computeSpawnRates);
    }
    if (e.key === 'd' || e.key === 'D') { dbg = !dbg; if (dbg) dbgPoly = false; }
    if (e.key === 'c' || e.key === 'C') { dbgPoly = !dbgPoly; if (dbgPoly) dbg = false; }
    if (e.key === 'h' || e.key === 'H') { solidMode = !solidMode; }
    if (e.key === 'w' || e.key === 'W') { if (!dead && !wipeOutActive) triggerWipeOut(W / 2, H / 2); }
  });

  initInputHandlers({ onDrop: drop });
  loadSprites(() => {
    loadCbPrefs();
    window.addEventListener('resize', fitToViewport);
    fitToViewport();
    buildEvoChart(firstMerged);
    updateNextUI(nxt, gameLevel, drawAtFit);

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isMobile = window.matchMedia('(pointer:coarse)').matches;
    if (isIOS) {
      const el = document.getElementById('fsp-ios'); if (el) el.style.display = '';
      setPromptActionButton('Got it!', dismissFsPrompt);
    } else if (isMobile) {
      const el = document.getElementById('fsp-android'); if (el) el.style.display = '';
      setPromptActionButton('Got it!', enterFullscreen);
    } else {
      const el = document.getElementById('fsp-pc'); if (el) el.style.display = '';
      setPromptActionButton('Got it!', dismissFsPrompt);
    }

    const unlockAudio = () => { if (bgmOn && !muted) startBGM(); };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    requestAnimationFrame(loop);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { type: 'module' });
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SW_UPDATED') {
        const toast = document.getElementById('update-toast');
        if (toast) toast.style.display = 'block';
      }
    });
  }
}

boot();