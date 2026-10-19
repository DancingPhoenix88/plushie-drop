let ac = null;
export let muted = false;
export let bgmRunning = false;
export let bgmOn = true;
let _bgmVolume = 0.4;
let _bgmGain = null;
let _bgmFadeTimer = null;

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

(async function preloadAudioRaw() {
  try { _namesRawBap = await (await fetch('Audio/Names_Bap.mp3')).arrayBuffer(); } catch (e) {}
  try { _namesRawBong = await (await fetch('Audio/Names_Bong.mp3')).arrayBuffer(); } catch (e) {}
})();

export function getAC() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 3;
    comp.ratio.value = 20;
    comp.attack.value = 0.001;
    comp.release.value = 0.1;
    comp.connect(ac.destination);
    ac._sfxBus = comp;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export function tone(freq, start, type, vol, dur) {
  const a = getAC(), t = a.currentTime + start;
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); g.connect(a._sfxBus || a.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}

export function sfxDrop(silent = false) {
  if (muted || silent) return;
  const a = getAC(), t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); g.connect(a._sfxBus || a.destination);
  o.type = 'sine';
  o.frequency.setValueAtTime(480, t);
  o.frequency.exponentialRampToValueAtTime(280, t + 0.06);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.start(t); o.stop(t + 0.10);
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

export function playCharacterName(lvl) {
  if (muted) return;
  const a = getAC();
  if (_namesRawBap && !_namesBufBap) a.decodeAudioData(_namesRawBap).then(b => { _namesBufBap = b; }).catch(() => {});
  if (_namesRawBong && !_namesBufBong) a.decodeAudioData(_namesRawBong).then(b => { _namesBufBong = b; }).catch(() => {});
  const voices = [];
  if (_namesBufBap) voices.push([_namesBufBap, NAME_SEGS_BAP]);
  if (_namesBufBong) voices.push([_namesBufBong, NAME_SEGS_BONG]);
  if (!voices.length) return;
  const [buf, segs] = voices[Math.floor(Math.random() * voices.length)];
  const seg = segs[lvl];
  if (!seg) return;
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain(); g.gain.value = 1.0;
  src.connect(g); g.connect(a._sfxBus || a.destination);
  src.start(a.currentTime, seg[0], seg[1]);
}

export function sfxWipeOut() {
  if (muted) return;
  const a = getAC(), t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); g.connect(a._sfxBus || a.destination);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.8);
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
  o.start(t); o.stop(t + 1.1);
  [523, 659, 784, 1047].forEach((f, k) => {
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.connect(g2); g2.connect(a._sfxBus || a.destination);
    o2.type = 'triangle'; o2.frequency.value = f;
    g2.gain.setValueAtTime(0, t + 0.3 + k * 0.06);
    g2.gain.linearRampToValueAtTime(0.2, t + 0.35 + k * 0.06);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o2.start(t + 0.3 + k * 0.06); o2.stop(t + 1.5);
  });
}

export function sfxLevelUp() {
  if (muted) return;
  const a = getAC(), t = a.currentTime;
  [523, 659, 784, 1047, 1319].forEach((f, k) => {
    const o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a._sfxBus || a.destination);
    o.type = 'triangle'; o.frequency.value = f;
    const on = t + k * 0.08;
    g.gain.setValueAtTime(0, on);
    g.gain.linearRampToValueAtTime(0.22, on + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, on + 0.5);
    o.start(on); o.stop(on + 0.55);
  });
  const os = a.createOscillator(), gs = a.createGain();
  os.connect(gs); gs.connect(a._sfxBus || a.destination);
  os.type = 'sine'; os.frequency.value = 2093;
  gs.gain.setValueAtTime(0, t + 0.35);
  gs.gain.linearRampToValueAtTime(0.1, t + 0.4);
  gs.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  os.start(t + 0.35); os.stop(t + 1.3);
}

export function sfxGameOver() {
  if (muted) return;
  const a = getAC(), t = a.currentTime;
  [[392, .00, 'sine', .25, .4], [330, .18, 'sine', .22, .45], [261.63, .38, 'sine', .2, .5], [196, .6, 'sine', .18, .7]]
    .forEach(([f, d, tp, v, u]) => tone(f, d, tp, v, u));
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); g.connect(a._sfxBus || a.destination);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.linearRampToValueAtTime(60, t + 1.2);
  g.gain.setValueAtTime(0.08, t);
  g.gain.linearRampToValueAtTime(0, t + 1.2);
  o.start(t); o.stop(t + 1.3);
}

const _bgmEl = () => document.getElementById('bgm-audio');

function _initBgmRouting() {
  if (_bgmGain) return _bgmGain;
  const el = _bgmEl(); if (!el) return null;
  try {
    const a = getAC();
    const src = a.createMediaElementSource(el);
    _bgmGain = a.createGain();
    _bgmGain.gain.value = _bgmVolume;
    src.connect(_bgmGain);
    _bgmGain.connect(a.destination);
  } catch (e) {}
  return _bgmGain;
}

export function startBGM() {
  if (muted || !bgmOn) return;
  const el = _bgmEl(); if (!el) return;
  _initBgmRouting();
  el.play().catch(() => {});
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
  if (bgmOn && !muted) startBGM(); else stopBGM();
}

export function toggleMute() {
  muted = !muted;
  if (muted) stopBGM(); else if (bgmOn) startBGM();
  return muted;
}

export function setBGMVolume(v) {
  _bgmVolume = parseFloat(v);
  if (_bgmGain) _bgmGain.gain.value = _bgmVolume;
  else { const el = _bgmEl(); if (el) el.volume = _bgmVolume; }
  const lbl = document.getElementById('bgm-vol-label');
  if (lbl) lbl.textContent = Math.round(_bgmVolume * 100) + '%';
  try { localStorage.setItem('plushie_bgm_vol', _bgmVolume); } catch (e) {}
}