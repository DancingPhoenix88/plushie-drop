import { W, PAD, PD, WALL, AV_MAX, IS_DEBUG, IS_GP_DEBUG } from './config.js';

export let mx = W / 2;
export let tiltAngle = 0;
export let gyroOn = false;
export const keysDown = new Set();

let _touchTween = null;
let _gpBtnPrev = {};
const GP_DEADZONE = 0.2;
let _joyLastMx = null, _joyNoMovFrames = 0;
let _motionAvailable = false;
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export let inputSource = 'keyboard';
export function setInputSource(src) {
  if (inputSource !== src) inputSource = src;
}

let _gpConnected = false;
export function gpConnected() {
  return _gpConnected || IS_GP_DEBUG;
}
export function setGpConnected(v) {
  _gpConnected = v;
}

export let _gKeyDown = false;
export let _fKeyDown = false;
let _tiltPrevX = null;
let _shakeTrackX = 0, _shakeTrackY = 0, _shakeTrackT = 0;
const GYRO_DRAG_SCALE = 0.4;
let _onGyroHud = null;

export function clampClaw(x, lvl) {
  const r = PD[lvl].r;
  return Math.max(PAD + r + 1, Math.min(W - PAD - r - 1, x));
}

export function setMx(val) {
  mx = val;
}

function updateGyroHudState() {
  if (!_onGyroHud) return;
  if (!_gKeyDown && !_fKeyDown) {
    _onGyroHud(null);
    return;
  }
  const parts = [];
  if (_gKeyDown) parts.push(`G ←→ tilt: ${(tiltAngle * 180 / Math.PI).toFixed(1)}°`);
  if (_fKeyDown) parts.push(`F fast-move: shake`);
  _onGyroHud('🎮 ' + parts.join('   '));
}

export function initInputHandlers({ onDrop, onShakeForce, onGyroHud }) {
  _onGyroHud = onGyroHud;

  window.addEventListener('keydown', e => {
    setInputSource('keyboard');
    if (['ArrowLeft', 'ArrowRight', 'Shift'].includes(e.key)) keysDown.add(e.key);
    if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); onDrop(); }

    if (IS_DEBUG) {
      if (e.repeat) return;
      if (e.key === 'g' || e.key === 'G') {
        _gKeyDown = true;
        _tiltPrevX = null;
        updateGyroHudState();
      }
      if (e.key === 'f' || e.key === 'F') {
        _fKeyDown = true;
        _shakeTrackT = 0;
        updateGyroHudState();
      }
    }
  }, { capture: true });

  window.addEventListener('keyup', e => {
    keysDown.delete(e.key);
    if (IS_DEBUG) {
      if (e.key === 'g' || e.key === 'G') {
        _gKeyDown = false;
        _tiltPrevX = null;
        tiltAngle = 0;
        updateGyroHudState();
      }
      if (e.key === 'f' || e.key === 'F') {
        _fKeyDown = false;
        updateGyroHudState();
      }
    }
  });

  window.addEventListener('blur', () => {
    keysDown.clear();
    _gKeyDown = false;
    _fKeyDown = false;
    _tiltPrevX = null;
    tiltAngle = 0;
    updateGyroHudState();
  });

  const cv = document.getElementById('gc');
  cv.addEventListener('mousemove', e => {
    setInputSource('keyboard');
    if (_gKeyDown || _fKeyDown) return;
    const r = cv.getBoundingClientRect();
    mx = Math.max(PAD, Math.min(W - PAD, (e.clientX - r.left) * (W / r.width)));
  });

  if (IS_DEBUG) {
    window.addEventListener('mousemove', e => {
      if (!_gKeyDown && !_fKeyDown) return;

      if (_gKeyDown) {
        if (_tiltPrevX !== null) {
          const ddeg = (e.clientX - _tiltPrevX) * GYRO_DRAG_SCALE;
          const newGamma = Math.max(-90, Math.min(90, -tiltAngle * 180 / Math.PI + ddeg));
          tiltAngle = -newGamma * Math.PI / 180;
        }
        _tiltPrevX = e.clientX;
      }

      if (_fKeyDown) {
        const now = performance.now();
        const dt = now - _shakeTrackT;
        if (_shakeTrackT > 0 && dt > 0 && dt < 80) {
          const ddx = e.clientX - _shakeTrackX;
          const ddy = e.clientY - _shakeTrackY;
          const fx = -(ddx / dt) * 1.2;
          const fy = -(ddy / dt) * 1.2;
          if ((Math.abs(fx) > 0.05 || Math.abs(fy) > 0.05) && onShakeForce) {
            onShakeForce(fx, fy);
          }
        }
        _shakeTrackX = e.clientX;
        _shakeTrackY = e.clientY;
        _shakeTrackT = now;
      }

      updateGyroHudState();
    });
  }

  cv.addEventListener('click', () => onDrop());

  cv.addEventListener('touchstart', e => {
    e.preventDefault();
    setInputSource('touch');
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

export function processGamepad({ cur, dead, onDrop, onRestart, onShare, onToggleHelp, onCycleAp, onSetBgmVolume, bgmVolume }) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of pads) if (p) { gp = p; break; }
  if (!gp) return;

  const pressed = i => gp.buttons[i]?.pressed && !_gpBtnPrev[i];
  if (dead) {
    if (pressed(0)) { setInputSource('gamepad'); onRestart(); }
    if (pressed(3)) { setInputSource('gamepad'); onShare(); }
    for (let i = 0; i < gp.buttons.length; i++) _gpBtnPrev[i] = gp.buttons[i]?.pressed;
    return;
  }

  const lt = gp.buttons[6]?.value ?? 0, rt = gp.buttons[7]?.value ?? 0;
  const triggerVal = Math.max(lt, rt);
  const speed = 2 + triggerVal * 8;

  if ((lt > 0.02 || rt > 0.02) && onSetBgmVolume) {
    const delta = (rt - lt) * 0.006;
    const nv = Math.max(0, Math.min(1, bgmVolume + delta));
    if (Math.abs(delta) > 0.0001) onSetBgmVolume(nv);
  }

  const ax = gp.axes[0] ?? 0;
  if (Math.abs(ax) > GP_DEADZONE) {
    setInputSource('gamepad');
    const mn = WALL + PD[cur].r + 1, mx2 = W - WALL - PD[cur].r - 1;
    mx = Math.max(mn, Math.min(mx2, mx + ax * speed));
  }
  if (pressed(0)) { setInputSource('gamepad'); onDrop(); }
  if (pressed(1)) { setInputSource('gamepad'); onToggleHelp(); }
  if (pressed(3)) { setInputSource('gamepad'); onCycleAp(); }

  const mn = WALL + PD[cur].r + 1, mx2 = W - WALL - PD[cur].r - 1;
  if (gp.buttons[14]?.pressed) { setInputSource('gamepad'); mx = Math.max(mn, Math.min(mx2, mx - speed)); }
  if (gp.buttons[15]?.pressed) { setInputSource('gamepad'); mx = Math.max(mn, Math.min(mx2, mx + speed)); }

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