import { W, PAD, PD, WALL, AV_MAX } from './config.js';

export let mx = W / 2;
export let tiltAngle = 0;
export let gyroOn = false;
export const keysDown = new Set();

let _touchTween = null;
let _gpBtnPrev = {};
const GP_DEADZONE = 0.2;
let _joyLastMx = null, _joyNoMovFrames = 0;
let _motionAvailable = false;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

export function clampClaw(x, lvl) {
  const r = PD[lvl].r;
  return Math.max(PAD + r + 1, Math.min(W - PAD - r - 1, x));
}

export function setMx(val) {
  mx = val;
}

export function initInputHandlers({ onDrop }) {
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'Shift'].includes(e.key)) keysDown.add(e.key);
    if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); onDrop(); }
  });
  window.addEventListener('keyup', e => keysDown.delete(e.key));
  window.addEventListener('blur', () => keysDown.clear());

  const cv = document.getElementById('gc');
  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    mx = Math.max(PAD, Math.min(W - PAD, (e.clientX - r.left) * (W / r.width)));
  });

  cv.addEventListener('click', () => onDrop());

  cv.addEventListener('touchstart', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const tx = Math.max(PAD, Math.min(W - PAD, (e.touches[0].clientX - r.left) * (W / r.width)));
    const pct = Math.abs(tx - mx) / W;
    if (pct < 0.05) { cancelTween(); mx = tx; }
    else { tweenClawTo(tx, Math.min(300, (pct / 0.3) * 300), onDrop); }
  }, { passive: false });

  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    cancelTween();
    mx = Math.max(PAD, Math.min(W - PAD, (e.touches[0].clientX - r.left) * (W / r.width)));
  }, { passive: false });

  cv.addEventListener('touchend', e => {
    e.preventDefault();
    if (_touchTween) _touchTween.dropOnDone = true; else onDrop();
  });
}

function cancelTween() {
  if (!_touchTween) return;
  cancelAnimationFrame(_touchTween.raf);
  _touchTween = null;
}

function tweenClawTo(targetX, duration, onDrop) {
  cancelTween();
  const startX = mx, startTime = performance.now();
  _touchTween = { raf: null, dropOnDone: false };
  const tween = _touchTween;
  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    mx = startX + (targetX - startX) * ease;
    if (t < 1) {
      tween.raf = requestAnimationFrame(tick);
    } else {
      _touchTween = null;
      if (tween.dropOnDone) onDrop();
    }
  }
  tween.raf = requestAnimationFrame(tick);
}

export function processKeyboardMovement(cur, dead) {
  if (dead) return;
  const hasL = keysDown.has('ArrowLeft'), hasR = keysDown.has('ArrowRight');
  if (!hasL && !hasR) return;
  const speed = keysDown.has('Shift') ? 6.5 : 2.6;
  const mn = WALL + PD[cur].r + 1, mx2 = W - WALL - PD[cur].r - 1, range = mx2 - mn;
  if (range <= 0) return;
  const delta = hasL ? -speed : speed;
  mx = ((mx + delta - mn) % range + range) % range + mn;
}

export function processGamepad({ cur, dead, onDrop, onRestart, onShare, onToggleHelp, onCycleAp }) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of pads) if (p) { gp = p; break; }
  if (!gp) return;

  const pressed = i => gp.buttons[i]?.pressed && !_gpBtnPrev[i];
  if (dead) {
    if (pressed(0)) onRestart();
    if (pressed(3)) onShare();
    for (let i = 0; i < gp.buttons.length; i++) _gpBtnPrev[i] = gp.buttons[i]?.pressed;
    return;
  }

  const lt = gp.buttons[6]?.value ?? 0, rt = gp.buttons[7]?.value ?? 0;
  const triggerVal = Math.max(lt, rt);
  const speed = 2 + triggerVal * 8;

  const ax = gp.axes[0] ?? 0;
  if (Math.abs(ax) > GP_DEADZONE) {
    const mn = WALL + PD[cur].r + 1, mx2 = W - WALL - PD[cur].r - 1;
    mx = Math.max(mn, Math.min(mx2, mx + ax * speed));
  }
  if (pressed(0)) onDrop();
  if (pressed(1)) onToggleHelp();
  if (pressed(3)) onCycleAp();

  for (let i = 0; i < gp.buttons.length; i++) _gpBtnPrev[i] = gp.buttons[i]?.pressed;
}

export function updateJoystick() {
  const img = document.getElementById('joy-img');
  if (!img) return;
  const hasL = keysDown.has('ArrowLeft'), hasR = keysDown.has('ArrowRight');
  if (hasL) { img.src = 'Sprites/ui/joystick_tilted.png'; img.classList.remove('flip'); _joyNoMovFrames = 0; }
  else if (hasR) { img.src = 'Sprites/ui/joystick_tilted.png'; img.classList.add('flip'); _joyNoMovFrames = 0; }
  else {
    const dMx = (_joyLastMx !== null) ? mx - _joyLastMx : 0;
    if (Math.abs(dMx) > 0.5) {
      _joyNoMovFrames = 0;
      img.src = 'Sprites/ui/joystick_tilted.png';
      img.classList.toggle('flip', dMx > 0);
    } else {
      _joyNoMovFrames++;
      if (_joyNoMovFrames >= 3) {
        img.src = 'Sprites/ui/joystick_released.png';
        img.classList.remove('flip');
      }
    }
  }
  _joyLastMx = mx;
}

export function flashDropBtn() {
  const btn = document.getElementById('drop-btn');
  if (!btn) return;
  btn.src = 'Sprites/ui/button_pressed.png';
  setTimeout(() => { btn.src = 'Sprites/ui/button_released.png'; }, 300);
}

function onDeviceOrientation(e) {
  if (e.gamma === null) return;
  if (!_motionAvailable && !isIOS) tiltAngle = -e.gamma * Math.PI / 180;
}

function onDeviceMotion(e) {
  _motionAvailable = true;
  const g = e.accelerationIncludingGravity;
  if (g && g.x != null && g.y != null) {
    const rawAngle = Math.atan2(g.x, -g.y);
    tiltAngle = tiltAngle * 0.7 + rawAngle * 0.3;
  }
}

export function toggleGyro() {
  if (gyroOn) {
    window.removeEventListener('deviceorientation', onDeviceOrientation);
    window.removeEventListener('devicemotion', onDeviceMotion);
    gyroOn = false; tiltAngle = 0;
    return;
  }
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(state => {
      if (state === 'granted') {
        window.addEventListener('deviceorientation', onDeviceOrientation);
        gyroOn = true;
      }
    }).catch(() => {});
  } else {
    window.addEventListener('deviceorientation', onDeviceOrientation);
    window.addEventListener('devicemotion', onDeviceMotion);
    gyroOn = true;
  }
}