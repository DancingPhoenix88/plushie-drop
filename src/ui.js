import { PD, VERSION, W, FS } from './config.js';
import { toggleBGM, setBGMVolume } from './audio.js';
import { toggleGyro, gpConnected } from './input.js';

const SCORE_CHAR_RATIO = 0.8;
const CB_KEY = 'plushie_cb_prefs';
const HS_KEY = 'plushie_highscore';
const RIVAL_KEY = 'plushie_rival';

let ncls = null, nctxls = null;
let userJoyToggle = true;
let _helpTab = 'kb';
let _polaroidDataURL = null;
let _shareDataURL = null;

export function initNextCanvas() {
  ncls = document.getElementById('nc-ls');
  if (ncls) {
    const dpr = window.devicePixelRatio || 1;
    nctxls = ncls.getContext('2d');
    ncls.width = 98 * dpr; 
    ncls.height = 80 * dpr;
    ncls.style.width = '98px'; 
    ncls.style.height = '80px';
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
  const el = document.getElementById('sc'); 
  if (el) el.textContent = s;
  const elp = document.getElementById('sc-p'); 
  if (elp) elp.textContent = s;
  const ll = document.getElementById('level-label'); 
  if (ll) ll.textContent = `· LV ${level}`;
  fitScoreFont();
}

export function updateNextUI(nxt, gameLevel, drawAtFitFn) {
  const nc = document.getElementById('nc'); 
  if (nc) nc.src = `Sprites/characters/level_${nxt}.png`;
  const nl = document.getElementById('nl-ls'); 
  if (nl) nl.textContent = PD[nxt].name;
  const lbl = document.getElementById('fz-next-label'); 
  if (lbl) lbl.textContent = `NEXT (Lv${gameLevel})`;
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
  updateEvoUnlocks(firstMerged);
}

export function updateEvoUnlocks(firstMerged) {
  document.querySelectorAll('img[data-unlock-lvl]').forEach(img => {
    const lvl = +img.dataset.unlockLvl;
    img.classList.toggle('evo-locked', lvl > 3 && !firstMerged.has(lvl));
  });
}

export function updateEvoLabels(showSpawnRate, computeRatesFn) {
  const rates = computeRatesFn();
  document.querySelectorAll('[data-lvl]').forEach(el => {
    const lvl = +el.dataset.lvl;
    if (showSpawnRate) {
      const pct = rates[lvl] * 100;
      el.textContent = pct >= 0.1 ? pct.toFixed(1) + '%' : '—';
      el.style.color = pct > 0 ? '#c05020' : '#b0a090';
    } else {
      el.textContent = PD[lvl].name;
      el.style.color = '';
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

export function setUserJoyToggle(val) {
  userJoyToggle = val;
  updateJoystickLayout();
}

export function toggleUserJoy() {
  userJoyToggle = !userJoyToggle;
  updateJoystickLayout();
}

export function updateJoystickLayout() {
  const joy = document.getElementById('joyctrl');
  const scoreNext = document.getElementById('fz-scorenext');
  const ctrl = document.getElementById('fz-ctrl');
  if (!joy || !scoreNext || !ctrl) return;

  if (!userJoyToggle) {
    joy.classList.add('hidden');
    return;
  }
  joy.classList.remove('hidden');

  const snRect = scoreNext.getBoundingClientRect();
  const ctrlRect = ctrl.getBoundingClientRect();
  const availableGap = ctrlRect.left - snRect.right;
  const minimumNeededWidth = 110;

  if (availableGap < minimumNeededWidth) {
    joy.classList.add('cramped');
  } else {
    joy.classList.remove('cramped');
  }
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
      ['bgm-cb', 'bgm-ls'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = p.bgm;
      });
    }
    const isMobile = window.matchMedia('(pointer:coarse)').matches;
    if (p.gyro === true && isMobile) {
      ['gyro-cb', 'gyro-ls'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = true;
      });
    }
  } catch (e) {}
}

export function loadHighScore() {
  try { return parseInt(localStorage.getItem(HS_KEY) || '0') || 0; } catch (e) { return 0; }
}
export function saveHighScore(v) {
  try { localStorage.setItem(HS_KEY, v); } catch (e) {}
}

export function loadRival() {
  try {
    const v = parseInt(localStorage.getItem(RIVAL_KEY) || '0') || 0;
    return v || Math.round(700000 + Math.random() * 100000);
  } catch (e) {
    return Math.round(700000 + Math.random() * 100000);
  }
}
export function saveRival(v) {
  try { localStorage.setItem(RIVAL_KEY, v); } catch (e) {}
}

export function buildOvHint(isNewHS, highScore, firstMerged, gameLevel, ptsM) {
  const isMobile = window.matchMedia('(pointer:coarse)').matches;
  const isStandalone = navigator.standalone === true || window.matchMedia('(display-mode:standalone)').matches;
  const pins = isMobile && !isStandalone ? '<br>📱 Add to Home Screen to play offline, 1-tap!' : '';

  if (!isNewHS) {
    return `You've done <strong>${highScore.toLocaleString()}</strong> before — beat it!${pins}`;
  }

  const unseenLvl = [...Array(12).keys()].slice(4).find(i => !firstMerged.has(i));
  if (unseenLvl) {
    return `<img src="Sprites/characters/level_${unseenLvl}.png" class="ov-hint-secret-img"><span>??? Keep merging to unlock a secret character!</span>`;
  }

  if (gameLevel < 2) {
    return `💡 Merge two Racoons for a <strong>WIPE OUT</strong> — the score multiplier doubles!${pins}`;
  }

  const rival = loadRival();
  const newRival = Math.max(rival, highScore) + Math.round(10000 + Math.random() * 10000);
  saveRival(newRival);

  const teases = [
    () => {
      const a = Math.ceil(Math.random() * 10) + 1, b = a + 1 <= 11 ? a + 1 : a;
      const gain = ptsM[Math.min(b, 11)];
      return `💰 Merging two <em>${PD[a].name}</em>s next level = <strong>+${gain.toLocaleString()} pts</strong>!${pins}`;
    },
    () => `🏆 Someone scored <strong>${newRival.toLocaleString()}</strong>… think you can beat that?${pins}`,
  ];
  return teases[Math.floor(Math.random() * teases.length)]();
}

export function updateHelpMeta() {
  const meta = document.getElementById('help-meta');
  if (!meta) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  meta.textContent = `${VERSION}  ·  ${vw}×${vh}  ar:${(vw / vh).toFixed(3)}`;
}

export function showHelpTab(tab) {
  _helpTab = tab;
  const kbTabBtn = document.getElementById('help-tab-kb');
  const gpTabBtn = document.getElementById('help-tab-gp');
  const kbContent = document.getElementById('help-content-kb');
  const gpContent = document.getElementById('help-content-gp');

  const isKb = tab === 'kb';
  // Use explicit 'table' so it overrides game.css #help-content-gp { display: none; }
  if (kbContent) kbContent.style.display = isKb ? 'table' : 'none';
  if (gpContent) gpContent.style.display = !isKb ? 'table' : 'none';

  // Toggle active button tab styling
  if (kbTabBtn) {
    kbTabBtn.style.background = isKb ? '#f0e4d4' : '#fff8f2';
    kbTabBtn.style.color = isKb ? '#5a3820' : '#b09878';
  }
  if (gpTabBtn) {
    gpTabBtn.style.background = !isKb ? '#f0e4d4' : '#fff8f2';
    gpTabBtn.style.color = !isKb ? '#5a3820' : '#b09878';
  }
}

export function toggleHelpTab() {
  if (!gpConnected()) return;
  showHelpTab(_helpTab === 'kb' ? 'gp' : 'kb');
}

export function toggleHelp(force) {
  const el = document.getElementById('help-popup');
  if (!el) return;
  const show = force !== undefined ? force : !el.classList.contains('show');
  el.classList.toggle('show', show);
  if (show) {
    updateHelpMeta();
    updateGpVisuals();
    // Default to the current tab or keyboard
    showHelpTab(_helpTab || 'kb');
  }
  updateGpGuide();
}

export function updateGpVisuals() {
  const v = gpConnected();
  const gpTab = document.getElementById('help-tab-gp');
  // Use explicit 'block' so it overrides game.css 'display: none'
  if (gpTab) gpTab.style.display = v ? 'block' : 'none';

  document.querySelectorAll('.gp-badge').forEach(el => {
    if (el.closest('#help-content-gp')) return;
    el.style.display = v ? 'inline-block' : 'none';
  });
  updateGpGuide();
}

export function dismissFsPrompt() {
  document.getElementById('fs-prompt')?.classList.remove('show');
  updateGpGuide();
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

export function showGyroPrompt() {
  document.getElementById('gyro-prompt')?.classList.add('show');
}

export function hideGyroPrompt() {
  document.getElementById('gyro-prompt')?.classList.remove('show');
}

export function takePolaroid(cleanRenderFn, plushies, layerFx) {
  try {
    _polaroidDataURL = cleanRenderFn(plushies);
    const lbl = new PIXI.Text({
      text: 'BB Tower',
      style: { fontFamily: "'Cherry Bomb One',sans-serif", fontSize: Math.round(28 * FS), fill: '#ffffff', stroke: { color: '#000000', width: 4 } }
    });
    lbl.anchor.set(0.5, 0); lbl.x = W / 2; lbl.y = 18;
    layerFx.addChild(lbl);
    _shareDataURL = cleanRenderFn(plushies);
    lbl.destroy();

    const img = document.getElementById('ov-polaroid-img');
    const wrap = document.getElementById('ov-polaroid');
    if (img && wrap) { img.src = _polaroidDataURL; wrap.style.display = 'block'; }
  } catch (e) {}
}

export function shareScore(score) {
  const url = window.location.origin + window.location.pathname;
  const text = `I scored ${score.toLocaleString()} in BB Tower 🧸! Can you beat me?\n${url}`;
  const doShare = (blob) => {
    if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'score.png', { type: 'image/png' })] })) {
      navigator.share({ title: 'BB Tower', text, files: [new File([blob], 'score.png', { type: 'image/png' })] }).catch(() => {});
    } else if (navigator.share) {
      navigator.share({ title: 'BB Tower', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!')).catch(() => prompt('Share this:', text));
    }
  };
  if (_shareDataURL) {
    fetch(_shareDataURL).then(r => r.blob()).then(doShare).catch(() => doShare(null));
  } else {
    try {
      const cv = document.getElementById('gc');
      cv.toBlob(blob => doShare(blob), 'image/png');
    } catch (e) {
      doShare(null);
    }
  }
}

export function showGameOverModal(score, isNewHS, hintHtml) {
  const fsEl = document.getElementById('fs');
  if (fsEl) fsEl.textContent = score.toLocaleString();
  const sub = document.getElementById('ov-sub');
  if (sub) sub.textContent = isNewHS ? '🎉 New High Score!' : 'Final Score';
  const title = document.getElementById('ov-title');
  if (title) title.textContent = isNewHS ? 'Amazing!' : ['Well Played!', 'So Close!', 'Nice Score!'][Math.floor(Math.random() * 3)];
  const hint = document.getElementById('ov-hint');
  if (hint) hint.innerHTML = hintHtml;
  document.getElementById('ov')?.classList.add('show');
  updateGpGuide();
}

export function hideGameOverModal() {
  document.getElementById('ov')?.classList.remove('show');
  const polaroid = document.getElementById('ov-polaroid');
  if (polaroid) polaroid.style.display = 'none';
  _polaroidDataURL = null;
  _shareDataURL = null;
  updateGpGuide();
}

function _gpGuideItem(letter, bgClass, label) {
  return `<span class="gpg-item"><span class="gpg-btn ${bgClass}">${letter}</span><span class="gpg-lbl">${label}</span></span>`;
}
function _gpRectBtn(label, bgClass) {
  return `<span class="gpg-btn rect ${bgClass}">${label}</span>`;
}
const _gpSep = '<span class="gpg-sep">·</span>';

export function updateKbGuide(dead) {
  const kb = document.getElementById('kb-guide');
  if (!kb) return;
  const anyPopup = document.getElementById('help-popup')?.classList.contains('show') ||
                   document.getElementById('fs-prompt')?.classList.contains('show') ||
                   document.getElementById('ov')?.classList.contains('show');
  kb.style.display = (!gpConnected() && !anyPopup && !dead) ? 'flex' : 'none';
}

export function updateGpGuide(dead) {
  updateKbGuide(dead);
  const guide = document.getElementById('gp-guide');
  if (!guide) return;
  if (!gpConnected()) { guide.style.display = 'none'; return; }

  const helpOpen = document.getElementById('help-popup')?.classList.contains('show');
  const fsOpen = document.getElementById('fs-prompt')?.classList.contains('show');
  const ovOpen = document.getElementById('ov')?.classList.contains('show');

  let html = '';
  let align = 'centered';
  if (helpOpen) {
    html = [_gpGuideItem('B', 'btn-red', 'Close'), _gpSep, `<span class="gpg-item">${_gpRectBtn('LT', 'btn-gray')}<span class="gpg-lbl">/</span>${_gpRectBtn('RT', 'btn-gray')}<span class="gpg-lbl">Vol</span></span>`].join('');
  } else if (ovOpen) {
    html = [_gpGuideItem('A', 'btn-green', 'Restart'), _gpSep, _gpGuideItem('Y', 'btn-yellow', 'Share')].join('');
  } else if (fsOpen) {
    html = _gpGuideItem('A', 'btn-green', 'Got it');
  } else {
    align = 'right-aligned';
    html = [`<span class="gpg-item">${_gpRectBtn('LT', 'btn-gray')}<span class="gpg-lbl">+</span><span class="gpg-btn btn-gray">LS</span><span class="gpg-lbl">Sprint</span></span>`, _gpSep, _gpGuideItem('B', 'btn-red', 'Help')].join('');
  }
  guide.className = align;
  if (html) {
    guide.innerHTML = html;
    guide.style.display = 'flex';
    guide.style.visibility = 'visible';
  } else {
    guide.style.display = 'none';
  }
}

export function showGyroHud(msg) {
  const el = document.getElementById('gyro-drag-hud');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
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

  const isMobile = window.matchMedia('(pointer:coarse)').matches;
  const onGyroChange = (e) => {
    if (!isMobile) {
      e.preventDefault();
      ['gyro-cb', 'gyro-ls'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
      showGyroPrompt();
      return;
    }
    toggleGyro();
    saveCbPrefs();
  };
  document.getElementById('gyro-cb')?.addEventListener('change', onGyroChange);
  document.getElementById('gyro-ls')?.addEventListener('change', onGyroChange);

  document.getElementById('gyro-prompt-close-btn')?.addEventListener('click', hideGyroPrompt);
  document.getElementById('gyro-prompt')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) hideGyroPrompt();
  });

  const onBgmChange = e => {
    const checked = e.target.checked;
    ['bgm-cb', 'bgm-ls'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    });
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