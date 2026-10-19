import { PD, VERSION } from './config.js';
import { toggleBGM, setBGMVolume } from './audio.js';
import { toggleGyro } from './input.js';

const SCORE_CHAR_RATIO = 0.8;
const CB_KEY = 'plushie_cb_prefs';
const HS_KEY = 'plushie_highscore';

let ncls = null, nctxls = null;
export function initNextCanvas() {
  ncls = document.getElementById('nc-ls');
  if (ncls) {
    const dpr = window.devicePixelRatio || 1;
    nctxls = ncls.getContext('2d');
    ncls.width = 98 * dpr; ncls.height = 80 * dpr;
    ncls.style.width = '98px'; ncls.style.height = '80px';
    nctxls.scale(dpr, dpr);
    nctxls.imageSmoothingEnabled = true;
    nctxls.imageSmoothingQuality = 'high';
  }
}

export function fitScoreFont() {
  ['sc-p', 'sc'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || !el.textContent) return;
    const len = el.textContent.length;
    if (!len) return;
    const cw = el.getBoundingClientRect().width;
    if (!cw) return;
    el.style.fontSize = Math.min(id === 'sc-p' ? 30 : 21, Math.floor(cw / (len * SCORE_CHAR_RATIO))) + 'px';
  });
}

export function updateScoreUI(score, level) {
  const s = score.toLocaleString();
  const el = document.getElementById('sc'); if (el) el.textContent = s;
  const elp = document.getElementById('sc-p'); if (elp) elp.textContent = s;
  const ll = document.getElementById('level-label'); if (ll) ll.textContent = `· LV ${level}`;
  fitScoreFont();
}

export function updateNextUI(nxt, gameLevel, drawAtFitFn) {
  const nc = document.getElementById('nc'); if (nc) nc.src = `Sprites/characters/level_${nxt}.png`;
  const nl = document.getElementById('nl-ls'); if (nl) nl.textContent = PD[nxt].name;
  const lbl = document.getElementById('fz-next-label'); if (lbl) lbl.textContent = `NEXT (Lv${gameLevel})`;
  if (nctxls && drawAtFitFn) {
    nctxls.clearRect(0, 0, 98, 80);
    drawAtFitFn(nctxls, 98, 80, nxt);
  }
}

export function buildEvoChart(firstMerged) {
  const el = document.getElementById('ev');
  const es = document.getElementById('ev-s');
  if (el) el.innerHTML = '';
  if (es) es.innerHTML = '';

  for (let i = 1; i <= 11; i++) {
    const locked = i > 3 && !firstMerged.has(i);
    const scaleCls = i <= 8 ? 'evo-scale' : '';

    if (el) {
      const row = document.createElement('div');
      row.className = 'evo-row';
      row.innerHTML = `<img src="Sprites/characters/level_${i}.png" class="${scaleCls} ${locked ? 'evo-locked' : ''}">
                       <span data-lvl="${i}">${PD[i].name}</span>`;
      el.appendChild(row);
    }

    if (es) {
      const cell = document.createElement('div');
      cell.className = 'ec';
      cell.innerHTML = `<img src="Sprites/characters/level_${i}.png" class="${scaleCls} ${locked ? 'evo-locked' : ''}">
                        <div class="ec-shadow"></div>
                        <span class="en">${PD[i].name}</span>`;
      es.appendChild(cell);
    }
  }
}

export function updateEvoLabels(showSpawnRate, computeRatesFn) {
  const rates = computeRatesFn();
  document.querySelectorAll('[data-lvl]').forEach(el => {
    const lvl = +el.dataset.lvl;
    if (showSpawnRate) {
      const pct = rates[lvl] * 100;
      el.textContent = pct >= 0.1 ? pct.toFixed(1) + '%' : '—';
    } else {
      el.textContent = PD[lvl].name;
    }
  });
}

export function fitToViewport() {
  const root = document.getElementById('game-root');
  if (!root) return;
  root.style.transform = 'translate(-50%,-50%)';
  const scale = Math.min(window.innerHeight / root.offsetHeight, window.innerWidth / root.offsetWidth);
  root.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(4)})`;
}

export function saveCbPrefs() {
  try {
    localStorage.setItem(CB_KEY, JSON.stringify({
      bgm: document.getElementById('bgm-cb')?.checked ?? false,
      gyro: document.getElementById('gyro-cb')?.checked ?? false,
    }));
  } catch (e) {}
}

export function loadCbPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(CB_KEY) || '{}');
    if (p.bgm != null) {
      toggleBGM(p.bgm);
      ['bgm-cb', 'bgm-ls'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = p.bgm; });
    }
    if (p.gyro === true) {
      ['gyro-cb', 'gyro-ls'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = true; });
    }
  } catch (e) {}
}

export function toggleHelp(force) {
  const el = document.getElementById('help-popup');
  if (!el) return;
  const show = force !== undefined ? force : !el.classList.contains('show');
  el.classList.toggle('show', show);
  if (show) {
    const meta = document.getElementById('help-meta');
    if (meta) meta.textContent = `${VERSION} · ${window.innerWidth}×${window.innerHeight}`;
  }
}

export function showHelpTab(tab) {
  const kb = document.getElementById('help-content-kb');
  const gp = document.getElementById('help-content-gp');
  if (kb) kb.style.display = tab === 'kb' ? '' : 'none';
  if (gp) gp.style.display = tab === 'gp' ? '' : 'none';
}

export function dismissFsPrompt() {
  document.getElementById('fs-prompt')?.classList.remove('show');
}

export function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (req) req.call(el).catch(() => {});
  dismissFsPrompt();
}

export function setPromptActionButton(label, handler) {
  const container = document.getElementById('fs-prompt-action');
  if (!container) return;
  container.innerHTML = '';
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', handler);
  container.appendChild(btn);
}

export function showGameOverModal(score, polaroidUrl) {
  let hs = 0;
  try { hs = parseInt(localStorage.getItem(HS_KEY) || '0') || 0; } catch (e) {}
  const isNew = score > hs;
  if (isNew) { try { localStorage.setItem(HS_KEY, score); } catch (e) {} }

  const fsEl = document.getElementById('fs'); if (fsEl) fsEl.textContent = score.toLocaleString();
  const sub = document.getElementById('ov-sub'); if (sub) sub.textContent = isNew ? '🎉 New High Score!' : 'Final Score';
  const img = document.getElementById('ov-polaroid-img');
  const wrap = document.getElementById('ov-polaroid');
  if (img && wrap && polaroidUrl) { img.src = polaroidUrl; wrap.style.display = 'block'; }
  document.getElementById('ov')?.classList.add('show');
}

export function hideGameOverModal() {
  document.getElementById('ov')?.classList.remove('show');
  const polaroid = document.getElementById('ov-polaroid');
  if (polaroid) polaroid.style.display = 'none';
}

export function bindDOMEvents({ onRestart, onShare, onCycleAp, onToggleNoMerge }) {
  document.getElementById('help-btn')?.addEventListener('click', () => toggleHelp());
  document.getElementById('help-close-btn')?.addEventListener('click', () => toggleHelp(false));
  document.getElementById('help-tab-kb')?.addEventListener('click', () => showHelpTab('kb'));
  document.getElementById('help-tab-gp')?.addEventListener('click', () => showHelpTab('gp'));
  document.getElementById('help-popup')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) toggleHelp(false);
  });

  document.getElementById('restart-btn')?.addEventListener('click', onRestart);
  document.getElementById('share-btn')?.addEventListener('click', onShare);

  const onGyroChange = () => { toggleGyro(); saveCbPrefs(); };
  document.getElementById('gyro-cb')?.addEventListener('change', onGyroChange);
  document.getElementById('gyro-ls')?.addEventListener('change', onGyroChange);

  const onBgmChange = e => {
    const checked = e.target.checked;
    ['bgm-cb', 'bgm-ls'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = checked; });
    toggleBGM(checked);
    saveCbPrefs();
  };
  document.getElementById('bgm-cb')?.addEventListener('change', onBgmChange);
  document.getElementById('bgm-ls')?.addEventListener('change', onBgmChange);

  document.getElementById('ap-wrap')?.addEventListener('click', onCycleAp);
  document.getElementById('ap-ls-wrap')?.addEventListener('click', onCycleAp);

  document.getElementById('bgm-vol')?.addEventListener('input', e => setBGMVolume(e.target.value));
  document.getElementById('dbg-nomerge-cb')?.addEventListener('change', e => onToggleNoMerge(e.target.checked));
  document.getElementById('update-toast')?.addEventListener('click', () => location.reload());
}