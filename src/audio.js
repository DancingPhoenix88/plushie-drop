const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
let ac = null;
export let muted = false;
export let bgmRunning = false;
export let bgmOn = true;
let _userInteracted = false;
let _bgmVolume = 0.4;
let _bgmGain = null;
let _bgmSrcNode = null;
let _bgmFadeTimer = null;

// macOS/Chromium coreaudiod watchdog window clears at ~10.1s.
// Audio is prevented from touching the system before this point to avoid blocking the main thread.
const STARTUP_GRACE_PERIOD_MS = 10500;

const NAME_SEGS_BAP = [null,
  [0.000, 3.389], [3.389, 2.407], [5.796, 3.038], [8.834, 3.248],
  [12.082, 2.477], [14.559, 2.244], [16.803, 2.407], [19.210, 2.384],
  [21.594, 1.752], [23.346, 1.473], [24.819, 2.000],
];
const NAME_SEGS_BONG = [null,
  [0.000, 2.389], [2.389, 2.257], [4.646, 3.002], [7.648, 3.190],
  [10.838, 3.118], [13.956, 2.752], [16.708, 3.264], [19.972, 3.312],
  [23.284, 2.753], [26.037, 2.728], [28.765, 2.000],
];
let _namesBufBap = null, _namesBufBong = null;
let _namesRawBap = null, _namesRawBong = null;
let _preloadedAudio = false;

export function markUserInteracted() {
  // Purely sets a flag — 0ms execution time, never touches the OS audio daemon
  _userInteracted = true;
}

export function preloadAudioRaw() {
  if (_preloadedAudio) return;
  _preloadedAudio = true;
  fetch('Audio/Names_Bap.mp3')
    .then(r => r.ok ? r.arrayBuffer() : null)
    .then(b => { if (b) _namesRawBap = b; })
    .catch(() => {});
  fetch('Audio/Names_Bong.mp3')
    .then(r => r.ok ? r.arrayBuffer() : null)
    .then(b => { if (b) _namesRawBong = b; })
    .catch(() => {});
}

// Background idle download for voice clips
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => preloadAudioRaw(), { timeout: 4000 });
  } else {
    setTimeout(preloadAudioRaw, 3000);
  }
}

export function getAC() {
  if (ac && ac.state !== 'closed') return ac;

  // Never block the user's first drops during the initial OS watchdog window
  if (typeof performance !== 'undefined' && performance.now() < STARTUP_GRACE_PERIOD_MS) {
    return null;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    ac = new AudioContextClass({ latencyHint: 'playback' });
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 3;
    comp.ratio.value = 20;
    comp.attack.value = 0.001;
    comp.release.value = 0.1;
    comp.connect(ac.destination);
    ac._sfxBus = comp;
  } catch (e) {
    return null;
  }
  return ac;
}

// At 10.5 seconds, the OS lock has passed, so the AudioContext initializes in ~1.8ms in the background
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const a = getAC();
    if (a && _userInteracted && a.state === 'suspended') {
      a.resume().catch(() => {});
    }
    if (_userInteracted && bgmOn && !muted) {
      startBGM();
    }
  }, STARTUP_GRACE_PERIOD_MS);
}

export function playCharacterName(lvl) {
  if (muted) return;
  const a = getAC();
  if (!a) return;

  if (_namesRawBap && !_namesBufBap) {
    const raw = _namesRawBap.slice(0);
    _namesRawBap = null;
    a.decodeAudioData(raw).then(b => { _namesBufBap = b; }).catch(() => {});
  }
  if (_namesRawBong && !_namesBufBong) {
    const raw = _namesRawBong.slice(0);
    _namesRawBong = null;
    a.decodeAudioData(raw).then(b => { _namesBufBong = b; }).catch(() => {});
  }

  const voices = [];
  if (_namesBufBap) voices.push([_namesBufBap, NAME_SEGS_BAP]);
  if (_namesBufBong) voices.push([_namesBufBong, NAME_SEGS_BONG]);
  if (!voices.length) return;

  const [buf, segs] = voices[Math.floor(Math.random() * voices.length)];
  const seg = segs[lvl];
  if (!seg) return;

  try {
    const src = a.createBufferSource();
    src.buffer = buf;
    const g = a.createGain(); 
    g.gain.value = 1.0;
    src.connect(g); 
    g.connect(a._sfxBus || a.destination);
    src.start(a.currentTime + 0.02, seg[0], seg[1]);
  } catch (err) {}
}

export function tone(freq, start, type, vol, dur) {
  const a = getAC();
  if (!a) return;
  const t = a.currentTime + start + 0.02;
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); 
  g.connect(a._sfxBus || a.destination);
  o.type = type; 
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.start(t); 
  o.stop(t + dur + 0.05);
}

export function sfxDrop(silent = false) {
  if (muted || silent) return;
  const a = getAC();
  if (!a) return;
  const t = a.currentTime + 0.02;
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); 
  g.connect(a._sfxBus || a.destination);
  o.type = 'sine';
  o.frequency.setValueAtTime(480, t);
  o.frequency.linearRampToValueAtTime(280, t + 0.06);
  g.gain.setValueAtTime(0.12, t);
  g.gain.linearRampToValueAtTime(0.0001, t + 0.08);
  o.start(t); 
  o.stop(t + 0.10);
}

const MSFX = [null,
  [[330, .00, 'sine', .22, .2], [494, .10, 'sine', .18, .2]],
  [[392, .00, 'triangle', .2, .22], [523, .09, 'triangle', .18, .22]],
  [[440, .00, 'sine', .2, .18], [554, .08, 'sine', .2, .18], [659, .16, 'sine', .22, .22]],
  [[392, .00, 'triangle', .2, .15], [494, .08, 'triangle', .2, .15], [587, .16, 'triangle', .2, .15], [784, .24, 'triangle', .22, .22]],
  [[880, .00, 'square', .12, .22], [659, .13, 'square', .12, .28]],
  [[330, .00, 'sawtooth', .12, .12], [440, .07, 'sawtooth', .12, .12], [550, .14, 'sawtooth', .12, .14], [659, .22, 'sawtooth', .1, .22]],
  [[523, .00, 'triangle', .2, .13], [587, .07, 'triangle', .2, .13], [659, .14, 'triangle', .2, .13], [784, .21, 'triangle', .2, .15], [1047, .30, 'triangle', .22, .25]],
  [[784, .00, 'square', .13, .2], [784, .13, 'square', .1, .15], [1047, .25, 'square', .16, .3]],
  [[523, .00, 'triangle', .22, .15], [659, .08, 'triangle', .22, .15], [784, .17, 'triangle', .22, .15], [1047, .26, 'triangle', .25, .22], [1319, .36, 'triangle', .22, .3]],
  [[1047, .00, 'sine', .22, .15], [1319, .07, 'sine', .22, .15], [1568, .14, 'sine', .24, .15], [2093, .21, 'sine', .26, .25]],
  [[523, .00, 'triangle', .26, .5], [659, .07, 'triangle', .26, .45], [784, .14, 'triangle', .26, .4], [1047, .21, 'triangle', .3, .5], [1319, .32, 'triangle', .28, .55]],
];

export function sfxMerge(lvl) {
  if (muted) return;
  (MSFX[lvl] || []).forEach(([f, d, t, v, u]) => tone(f, d, t, v, u));
}

export function sfxWipeOut() {
  if (muted) return;
  const a = getAC();
  if (!a) return;
  const t = a.currentTime + 0.02;

  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); 
  g.connect(a._sfxBus || a.destination);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110, t);
  o.frequency.linearRampToValueAtTime(880, t + 0.8);
  g.gain.setValueAtTime(0.3, t);
  g.gain.linearRampToValueAtTime(0.0001, t + 1.0);
  o.start(t); 
  o.stop(t + 1.05);

  [523, 659, 784, 1047].forEach((f, k) => {
    tone(f, 0.3 + k * 0.06, 'triangle', 0.2, 0.8);
  });
}

export function sfxLevelUp() {
  if (muted) return;
  [523, 659, 784, 1047, 1319].forEach((f, k) => {
    tone(f, k * 0.08, 'triangle', 0.22, 0.45);
  });
  tone(2093, 0.35, 'sine', 0.1, 0.8);
}

export function sfxGameOver() {
  if (muted) return;
  const a = getAC();
  if (!a) return;
  const t = a.currentTime + 0.02;
  [[392, .00, 'sine', .25, .4], [330, .18, 'sine', .22, .45], [261.63, .38, 'sine', .2, .5], [196, .6, 'sine', .18, .7]]
    .forEach(([f, d, tp, v, u]) => tone(f, d, tp, v, u));
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); 
  g.connect(a._sfxBus || a.destination);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.linearRampToValueAtTime(60, t + 1.2);
  g.gain.setValueAtTime(0.08, t);
  g.gain.linearRampToValueAtTime(0.0001, t + 1.2);
  o.start(t); 
  o.stop(t + 1.25);
}

const _bgmEl = () => document.getElementById('bgm-audio');

function _initBgmRouting() {
  if (!isIOS) return null;
  if (_bgmGain) return _bgmGain;
  const el = _bgmEl(); if (!el) return null;
  try {
    const a = getAC();
    if (!a) return null;
    if (!_bgmSrcNode) {
      _bgmSrcNode = a.createMediaElementSource(el);
    }
    _bgmGain = a.createGain();
    _bgmGain.gain.value = _bgmVolume;
    _bgmSrcNode.connect(_bgmGain);
    _bgmGain.connect(a.destination);
  } catch (e) {}
  return _bgmGain;
}

export function startBGM() {
  if (muted || !bgmOn || !_userInteracted) return;
  if (typeof performance !== 'undefined' && performance.now() < STARTUP_GRACE_PERIOD_MS) {
    return;
  }
  const el = _bgmEl(); 
  if (!el) return;
  if (!el.src || !el.src.includes('Audio/Upbeat.mp3')) {
    el.src = 'Audio/Upbeat.mp3';
  }
  _initBgmRouting();
  el.volume = _bgmVolume;
  if (_bgmGain) _bgmGain.gain.value = _bgmVolume;
  const p = el.play();
  if (p && p.catch) p.catch(() => {});
  bgmRunning = true;
}

export function stopBGM() {
  clearInterval(_bgmFadeTimer);
  const el = _bgmEl(); if (!el) return;
  el.pause();
  bgmRunning = false;
}

export function toggleBGM(on) {
  bgmOn = on;
  if (bgmOn && !muted) {
    if (_userInteracted) startBGM();
  } else {
    stopBGM();
  }
}

export function toggleMute() {
  muted = !muted;
  if (muted) stopBGM(); 
  else if (bgmOn && _userInteracted) startBGM();
  return muted;
}

export function setBGMVolume(v) {
  _bgmVolume = parseFloat(v);
  if (_bgmGain) _bgmGain.gain.value = _bgmVolume;
  const el = _bgmEl();
  if (el) el.volume = _bgmVolume;
  const lbl = document.getElementById('bgm-vol-label');
  if (lbl) lbl.textContent = Math.round(_bgmVolume * 100) + '%';
  try { localStorage.setItem('plushie_bgm_vol', _bgmVolume); } catch (e) {}
}