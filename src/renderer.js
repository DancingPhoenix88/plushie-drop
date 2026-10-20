import { 
  W, H, PD, DY, DROPY, FS, SOURCE_W, REFLECT_SCALE, REFLECT_VIS, 
  CONFETTI_COLORS, CLAW_OPEN_FRAMES, imgR, cssHex, TD, VERSION 
} from './config.js';
import { predictLanding, getSides, getVerts } from './physics.js';

export const app = new PIXI.Application();

Object.defineProperty(window, '__PIXI_DEVTOOLS__', {
  get: () => ({ app, stage: app.stage ?? undefined, renderer: app.renderer ?? undefined }),
  configurable: true
});

export let layerBg, layerUI, layerClaw, layerPlushie, layerFx;
let gfxUI, gfxClaw, gfxFx;
let clawSprBack, clawSprFront, clawHeldSpr, trapDoorSpr;
let _dangerText, _versionText, _tapText;
let _reflectLtRT = null, _reflectRtRT = null;
let _reflectSprLt = null, _reflectSprRt = null;
let _coverTopLt = null, _coverTopRt = null, _coverBotLt = null, _coverBotRt = null;
let _reflectFrame = 0;
let _reflectEnabled = false;
let _reflectState = 'probing';
let _reflectWindowStart = 0;
const REFLECT_WINDOW_MS = 2000, REFLECT_FPS_ON = 55, REFLECT_FPS_OFF = 55;
const _rfpsD = new Float32Array(60); 
let _rfpsI = 0, _rfpsPrev = 0;

export const plushieTextures = new Array(12);
let _clawTexBack, _clawTexFront, _clawTexOpen;
export const imgSprites = new Array(12);
const _extraImgs = { back: null, front: null, open: null, floor: null, coverTopLt: null, coverBotLt: null };

let _glareT = -1, _glareStart = 0;
const GLARE_DUR = 480;
let _glareNextAt = Date.now() + 5000 + Math.random() * 5000;

export function triggerGlare() {
  _glareT = 0;
  _glareStart = Date.now();
  _glareNextAt = Date.now() + GLARE_DUR + 5000 + Math.random() * 5000;
}

export function tickGlare() {
  const now = Date.now();
  if (_glareT < 0) {
    if (now >= _glareNextAt) { _glareT = 0; _glareStart = now; }
  } else {
    _glareT = (now - _glareStart) / GLARE_DUR;
    if (_glareT >= 1) { _glareT = -1; _glareNextAt = now + 5000 + Math.random() * 5000; }
  }
}

export function makeShadow() {
  const F = globalThis.PixiFilters || PIXI?.filters;
  if (!F?.DropShadowFilter) return null;
  const dpr = window.devicePixelRatio || 1;
  return new F.DropShadowFilter({ offset: { x: 2, y: 5 }, blur: 4, alpha: 0.28, color: 0x000000, resolution: dpr });
}

export async function initPixi(canvas) {
  const isMobile = window.matchMedia('(pointer:coarse)').matches;
  const dpr = window.devicePixelRatio || 1;

  await app.init({
    canvas, width: W, height: H, backgroundAlpha: 0,
    antialias: !isMobile, resolution: dpr, autoDensity: true,
    powerPreference: 'high-performance'
  });
  app.ticker.stop();

  const stage = app.stage;
  stage.label = 'root';
  canvas.style.width = '';
  canvas.style.height = '';

  _reflectEnabled = !isMobile;
  _reflectState = isMobile ? 'probing' : 'on';

  layerBg = new PIXI.Container();      layerBg.label = 'layer_bg';
  layerUI = new PIXI.Container();      layerUI.label = 'layer_ui';
  layerClaw = new PIXI.Container();    layerClaw.label = 'layer_claw';
  layerPlushie = new PIXI.Container(); layerPlushie.label = 'layer_plushies'; layerPlushie.sortableChildren = true;
  layerFx = new PIXI.Container();      layerFx.label = 'layer_fx';
  stage.addChild(layerBg, layerUI, layerClaw, layerPlushie, layerFx);

  gfxUI = new PIXI.Graphics(); layerUI.addChild(gfxUI);
  gfxClaw = new PIXI.Graphics(); layerClaw.addChild(gfxClaw);
  gfxFx = new PIXI.Graphics(); layerFx.addChild(gfxFx);

  clawSprBack = new PIXI.Sprite(PIXI.Texture.EMPTY); clawSprBack.visible = false;
  clawSprFront = new PIXI.Sprite(PIXI.Texture.EMPTY); clawSprFront.visible = false;
  clawHeldSpr = new PIXI.Sprite(PIXI.Texture.EMPTY); clawHeldSpr.anchor.set(0.5, 0.5); clawHeldSpr.visible = false;
  layerClaw.addChild(clawSprBack, clawHeldSpr, clawSprFront);

  const rW = Math.ceil(SOURCE_W * REFLECT_SCALE), rH = Math.ceil(H * REFLECT_SCALE);
  _reflectLtRT = PIXI.RenderTexture.create({ width: rW, height: rH });
  _reflectRtRT = PIXI.RenderTexture.create({ width: rW, height: rH });
  _reflectSprLt = new PIXI.Sprite(_reflectLtRT);
  _reflectSprRt = new PIXI.Sprite(_reflectRtRT);
  _reflectSprLt.alpha = _reflectSprRt.alpha = 0.22;
  const rScl = 1 / REFLECT_SCALE;
  _reflectSprLt.scale.set(-rScl, rScl); _reflectSprLt.x = REFLECT_VIS;
  _reflectSprRt.scale.set(-rScl, rScl); _reflectSprRt.x = W - REFLECT_VIS + SOURCE_W;
  _reflectSprLt.visible = _reflectSprRt.visible = false;

  _coverTopLt = new PIXI.Sprite(PIXI.Texture.EMPTY);
  _coverTopRt = new PIXI.Sprite(PIXI.Texture.EMPTY);
  _coverBotLt = new PIXI.Sprite(PIXI.Texture.EMPTY);
  _coverBotRt = new PIXI.Sprite(PIXI.Texture.EMPTY);
  layerBg.addChild(_reflectSprLt, _reflectSprRt, _coverTopLt, _coverBotLt, _coverTopRt, _coverBotRt);

  trapDoorSpr = new PIXI.NineSliceSprite({ texture: PIXI.Texture.EMPTY, leftWidth: 90, rightWidth: 90, topHeight: 0, bottomHeight: 0 });
  trapDoorSpr.visible = false;
  layerBg.addChild(trapDoorSpr);

  // Initialize texts with system fallbacks immediately:
  _dangerText = new PIXI.Text({ 
    text: 'DANGER', 
    style: { fontFamily: "'Share Tech Mono', monospace, sans-serif", fontSize: Math.round(11 * FS), fontWeight: '700', fill: '#D23737' } 
  });
  _dangerText.x = W * 0.1 + 5; _dangerText.y = DY - Math.round(14 * FS);
  layerUI.addChild(_dangerText);

  _versionText = new PIXI.Text({ 
    text: VERSION, 
    style: { fontFamily: "'Share Tech Mono', monospace, sans-serif", fontSize: Math.round(9 * FS), fontWeight: '700', fill: '#5a3820' } 
  });
  _versionText.anchor.set(1, 1); _versionText.x = W - W * 0.1 - 4; _versionText.y = DY - 5; _versionText.alpha = 0.45;
  layerUI.addChild(_versionText);

  _tapText = new PIXI.Text({ 
    text: 'TAP TO DROP', 
    style: { fontFamily: "'Cherry Bomb One', 'Segoe UI', system-ui, sans-serif", fontSize: Math.round(36 * FS), fill: '#5a3820', stroke: { color: '#ffffff', width: 3 } } 
  });
  _tapText.anchor.set(0.5, 0.5); _tapText.x = W / 2; _tapText.y = H / 2; _tapText.visible = false;
  layerUI.addChild(_tapText);
}

// Export a hot-swap function for when Google Fonts finishes downloading
export function refreshFontStyles() {
  if (_tapText && !_tapText.destroyed) {
    _tapText.style = {
      fontFamily: "'Cherry Bomb One', 'Segoe UI', system-ui, sans-serif",
      fontSize: Math.round(36 * FS),
      fontWeight: '400',
      fill: '#5a3820',
      stroke: { color: '#ffffff', width: 3 }
    };
  }
  if (_dangerText && !_dangerText.destroyed) {
    _dangerText.style.fontFamily = "'Share Tech Mono', monospace";
  }
  if (_versionText && !_versionText.destroyed) {
    _versionText.style.fontFamily = "'Share Tech Mono', monospace";
  }
}

// Asynchronous, incremental sprite loading (never blocks boot)
export function loadSprites() {
  for (let lvl = 1; lvl <= 11; lvl++) {
    const img = new Image();
    img.src = `Sprites/characters/level_${lvl}.png`;
    imgSprites[lvl] = img;
    img.onload = () => {
      plushieTextures[lvl] = PIXI.Texture.from(img);
    };
  }

  const loadExtra = (key, path, onLoaded) => {
    const img = new Image();
    img.src = path;
    _extraImgs[key] = img;
    img.onload = () => {
      const tex = PIXI.Texture.from(img);
      onLoaded(tex, img);
    };
  };

  loadExtra('back', 'Sprites/claw/claw_back.png', tex => {
    _clawTexBack = tex;
    if (clawSprBack) clawSprBack.texture = tex;
  });
  loadExtra('front', 'Sprites/claw/claw_front.png', tex => {
    _clawTexFront = tex;
    if (clawSprFront) clawSprFront.texture = tex;
  });
  loadExtra('open', 'Sprites/claw/claw_open.png', tex => {
    _clawTexOpen = tex;
  });
  loadExtra('floor', 'Sprites/machine/claw_machine_floor_tile.png', tex => {
    const ns = new PIXI.NineSliceSprite({ texture: tex, leftWidth: 90, rightWidth: 90, topHeight: 0, bottomHeight: 0 });
    ns.visible = false;
    layerBg.removeChild(trapDoorSpr);
    trapDoorSpr.destroy();
    trapDoorSpr = ns;
    layerBg.addChild(trapDoorSpr);
  });
  loadExtra('coverTopLt', 'Sprites/machine/claw_machine_top_left_reflection_cover.png', (tex, img) => {
    _coverTopLt.texture = tex;
    _coverTopRt.texture = tex;
    _coverTopRt.scale.x = -1;
    _coverTopRt.x = W;
  });
  loadExtra('coverBotLt', 'Sprites/machine/claw_machine_bottom_left_reflection_cover.png', (tex, img) => {
    _coverBotLt.texture = tex;
    _coverBotRt.texture = tex;
    _coverBotRt.scale.x = -1;
    _coverBotLt.y = H - img.naturalHeight;
    _coverBotRt.y = H - img.naturalHeight;
    _coverBotRt.x = W;
  });
}

export function drawAtFit(c, cW, cH, lvl, alpha = 1) {
  const img = imgSprites[lvl];
  if (!img || !img.naturalWidth) return;
  const sc = Math.min(cW / img.naturalWidth, cH / img.naturalHeight);
  const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
  c.save(); c.globalAlpha = alpha; c.drawImage(img, (cW - w) / 2, (cH - h) / 2, w, h); c.restore();
}

export function tickReflect(now) {
  const isMobile = window.matchMedia('(pointer:coarse)').matches;
  if (!isMobile) { _reflectEnabled = true; return; }
  if (_reflectState === 'off_permanent') { _reflectEnabled = false; return; }
  if (_rfpsPrev > 0) { _rfpsD[_rfpsI % 60] = now - _rfpsPrev; _rfpsI++; }
  _rfpsPrev = now;
  const n = Math.min(_rfpsI, 60); let avg = 0; for (let i = 0; i < n; i++) avg += _rfpsD[i];
  const fps = n > 0 ? 1000 / (avg / n) : 60;
  if (_reflectWindowStart === 0) _reflectWindowStart = now;
  const elapsed = now - _reflectWindowStart;
  if (_reflectState === 'probing') {
    if (fps < REFLECT_FPS_ON) _reflectWindowStart = now;
    else if (elapsed >= REFLECT_WINDOW_MS) { _reflectState = 'on'; _reflectEnabled = true; _reflectWindowStart = now; }
  } else if (_reflectState === 'on') {
    _reflectEnabled = true;
    if (fps < REFLECT_FPS_OFF) {
      if (elapsed >= REFLECT_WINDOW_MS) { _reflectState = 'off_permanent'; _reflectEnabled = false; }
    } else {
      _reflectWindowStart = now;
    }
  }
}

export function captureReflect() {
  if (!_reflectEnabled || !_reflectLtRT) return;
  if (++_reflectFrame % 3 !== 0) return;
  const rs = REFLECT_SCALE, rv = REFLECT_VIS;
  _reflectSprLt.visible = _reflectSprRt.visible = false;
  app.renderer.render({ container: app.stage, target: _reflectLtRT, transform: new PIXI.Matrix(rs, 0, 0, rs, -rv * rs, 0), clear: true });
  app.renderer.render({ container: app.stage, target: _reflectRtRT, transform: new PIXI.Matrix(rs, 0, 0, rs, -(W - rv - SOURCE_W) * rs, 0), clear: true });
  _reflectSprLt.visible = _reflectSprRt.visible = _reflectEnabled;
}

function _dashLineH(g, x0, x1, y, dash, gap) {
  for (let x = x0; x < x1; x += dash + gap) { g.moveTo(x, y); g.lineTo(Math.min(x + dash, x1), y); }
}
function _dashLineV(g, x, y0, y1, dash, gap) {
  for (let y = y0; y < y1; y += dash + gap) { g.moveTo(x, y); g.lineTo(x, Math.min(y + dash, y1)); }
}
function _dashCircle(g, cx, cy, r, dash, gap) {
  const dashA = dash / r, gapA = gap / r;
  for (let a = 0; a < 2 * Math.PI; a += dashA + gapA) {
    g.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    const a2 = Math.min(a + dashA, 2 * Math.PI);
    const steps = Math.max(2, Math.ceil(dashA / 0.1));
    for (let k = 1; k <= steps; k++) {
      const aa = a + (a2 - a) * k / steps;
      g.lineTo(cx + r * Math.cos(aa), cy + r * Math.sin(aa));
    }
  }
}
function _star4(g, x, y, r) {
  const ir = r * 0.3, pts = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 4 * k, cr = k % 2 === 0 ? r : ir;
    pts.push(x + cr * Math.cos(a), y + cr * Math.sin(a));
  }
  g.poly(pts);
}

export function cleanRender(plushies) {
  const prev = {
    dA: _dangerText?.alpha, vA: _versionText?.alpha, tV: _tapText?.visible,
    cTL: _coverTopLt?.visible, cTR: _coverTopRt?.visible, cBL: _coverBotLt?.visible, cBR: _coverBotRt?.visible
  };
  if (_dangerText) _dangerText.alpha = 0;
  if (_versionText) _versionText.alpha = 0;
  if (_tapText) _tapText.visible = false;
  if (_reflectSprLt) _reflectSprLt.visible = false;
  if (_reflectSprRt) _reflectSprRt.visible = false;
  if (_coverTopLt) _coverTopLt.visible = false;
  if (_coverTopRt) _coverTopRt.visible = false;
  if (_coverBotLt) _coverBotLt.visible = false;
  if (_coverBotRt) _coverBotRt.visible = false;
  plushies.forEach(p => { if (p.sprite) p.sprite.tint = 0xFFFFFF; });
  app.renderer.render(app.stage);
  const cv = document.getElementById('gc');
  const url = cv.toDataURL('image/png');
  if (_dangerText) _dangerText.alpha = prev.dA ?? 0.65;
  if (_versionText) _versionText.alpha = prev.vA ?? 0.45;
  if (_tapText) _tapText.visible = prev.tV ?? false;
  if (_reflectSprLt) _reflectSprLt.visible = _reflectSprRt.visible = _reflectEnabled;
  if (_coverTopLt) _coverTopLt.visible = prev.cTL ?? true;
  if (_coverTopRt) _coverTopRt.visible = prev.cTR ?? true;
  if (_coverBotLt) _coverBotLt.visible = prev.cBL ?? true;
  if (_coverBotRt) _coverBotRt.visible = prev.cBR ?? true;
  return url;
}

export function renderScene(state) {
  captureReflect();
  if (_reflectSprLt) _reflectSprLt.visible = _reflectSprRt.visible = _reflectEnabled;
  gfxUI.clear(); gfxClaw.clear(); gfxFx.clear();

  const now = Date.now();
  const plushies = state.plushies || [];
  const parts = state.parts || [];
  const confetti = state.confetti || [];
  const sparkles = state.sparkles || [];

  const blink = plushies.some(p => p.landed && (p.y - PD[p.level].r < DY + 100)) && (now % 600) < 300;
  const dzPad = W * 0.1;
  _dashLineH(gfxUI, dzPad, W - dzPad, DY, 7, 5);
  gfxUI.stroke({ width: blink ? 2.5 : 1.5, color: blink ? 0xDC1E1E : 0xD23737, alpha: blink ? 0.95 : 0.55 });
  _dangerText.style.fill = blink ? '#DC1E1E' : '#D23737';
  _dangerText.alpha = blink ? 0.95 : 0.65;

  _tapText.visible = state.tapHint && !state.dead && !state.wipeOutActive;
  if (_tapText.visible) _tapText.alpha = (0.4 + 0.6 * Math.abs(Math.sin(now / 700))) * 0.75;

  clawSprBack.visible = false; clawSprFront.visible = false; clawHeldSpr.visible = false;
  if (!state.dead && state.showClaw !== false) {
    const lvl = (state.clawState === 'opening') ? state.clawLvl : state.cur;
    const gr = PD[lvl].r, cx = state.clawX, cy = DROPY, cw = Math.max(70, gr * 3.0), imgY = cy - cw * 0.78;
    if (state.clawState === 'idle') {
      const gy = predictLanding(cx, gr, plushies);
      _dashLineV(gfxClaw, cx, cy + gr, gy - gr, 3, 5); gfxClaw.stroke({ width: 1, color: 0x8C5A28, alpha: 0.18 });
      _dashCircle(gfxClaw, cx, gy, gr, 5, 4); gfxClaw.stroke({ width: 2, color: cssHex(PD[state.cur].stroke), alpha: 0.82 });
    }
    gfxClaw.moveTo(cx, 0).lineTo(cx, imgY + cw * 0.06);
    gfxClaw.stroke({ width: 2, color: 0xA09080, alpha: 1 });
    if (_clawTexBack) { clawSprBack.texture = _clawTexBack; clawSprBack.x = cx - cw / 2; clawSprBack.y = imgY; clawSprBack.width = cw; clawSprBack.height = cw; clawSprBack.visible = true; }
    if (plushieTextures[lvl] && (state.clawState === 'idle' || (state.clawState === 'opening' && state.clawOpenTimer > CLAW_OPEN_FRAMES - 2))) {
      clawHeldSpr.texture = plushieTextures[lvl];
      clawHeldSpr.scale.set(PD[lvl].r / imgR(lvl));
      clawHeldSpr.x = cx; clawHeldSpr.y = cy; clawHeldSpr.visible = true;
    }
    const frontTex = (state.clawState === 'opening' && _clawTexOpen) ? _clawTexOpen : _clawTexFront;
    if (frontTex) { clawSprFront.texture = frontTex; clawSprFront.x = cx - cw / 2; clawSprFront.y = imgY; clawSprFront.width = cw; clawSprFront.height = cw; clawSprFront.visible = true; }
  }

  for (const p of plushies) {
    if (!p.sprite && plushieTextures[p.level]) {
      p.sprite = new PIXI.Sprite(plushieTextures[p.level]);
      p.sprite.zIndex = 11 - p.level;
      p.sprite.anchor.set(0.5, 0.5);
      p.sprite.scale.set(PD[p.level].r / imgR(p.level));
      const sh = makeShadow();
      if (sh) p.sprite.filters = [sh];
      layerPlushie.addChild(p.sprite);
    }
    if (p.sprite) {
      p.sprite.x = p.x; p.sprite.y = p.y; p.sprite.rotation = p.angle;
      const lv = p._dangerLevel || 0;
      if (lv === 3) {
        const gb = Math.round(255 * (1 - (0.5 + 0.5 * Math.sin(now / 24))));
        p.sprite.tint = (0xFF << 16) | (gb << 8) | gb;
      } else if (lv === 2) {
        const gb = Math.round(255 * (1 - (0.3 + 0.3 * Math.sin(now / 80))));
        p.sprite.tint = (0xFF << 16) | (gb << 8) | gb;
      } else {
        p.sprite.tint = 0xFFFFFF;
      }
      if (state.solidMode) {
        p.sprite.visible = false;
        const n = getSides(p.level, state.sidesOffset), r = PD[p.level].physR ?? PD[p.level].r, pts = [];
        for (let k = 0; k < n; k++) { const a = p.angle + 2 * Math.PI * k / n; pts.push(p.x + r * Math.cos(a), p.y + r * Math.sin(a)); }
        gfxFx.poly(pts).fill({ color: cssHex(PD[p.level].body) }).stroke({ width: 2, color: cssHex(PD[p.level].stroke) });
        if (!p._nameText) {
          p._nameText = new PIXI.Text({ text: PD[p.level].name, style: { fontFamily: 'monospace', fontSize: Math.max(8, Math.round(r * 0.28)), fontWeight: 'bold', fill: 'rgba(0,0,0,0.65)' } });
          p._nameText.anchor.set(0.5, 0.5);
          layerFx.addChild(p._nameText);
        }
        p._nameText.x = p.x; p._nameText.y = p.y; p._nameText.visible = true;
      } else {
        p.sprite.visible = true;
        if (p._nameText) p._nameText.visible = false;
      }
    }
  }

  for (const p of parts) gfxFx.circle(p.x, p.y, p.r).fill({ color: cssHex(p.color), alpha: p.life * 0.85 });

  if (trapDoorSpr.texture && trapDoorSpr.texture !== PIXI.Texture.EMPTY) {
    if (state.trapDoorScale <= 0.001) trapDoorSpr.visible = false;
    else {
      const sh = TD.h * state.trapDoorScale;
      trapDoorSpr.x = TD.x; trapDoorSpr.y = TD.bottomY - sh; trapDoorSpr.width = TD.w; trapDoorSpr.height = sh; trapDoorSpr.visible = true;
    }
  }

  if (_glareT >= 0) {
    const cx2 = (_glareT * 1.6 - 0.3) * W, angle = -Math.PI / 7, cos = Math.cos(angle), sin = Math.sin(angle), hh = H * 1.5;
    const hw1 = W * 0.11;
    gfxFx.poly([[-hw1, -hh], [hw1, -hh], [hw1, hh], [-hw1, hh]].map(([px, py]) => [cx2 + px * cos - py * sin, H / 2 + px * sin + py * cos]).flat()).fill({ color: 0xFFFFFF, alpha: 0.40 });
    const hw2 = W * 0.05, off2 = W * 0.28;
    gfxFx.poly([[-hw2 + off2, -hh], [hw2 + off2, -hh], [hw2 + off2, hh], [-hw2 + off2, hh]].map(([px, py]) => [cx2 + px * cos - py * sin, H / 2 + px * sin + py * cos]).flat()).fill({ color: 0xFFFFFF, alpha: 0.25 });
  }

  for (const p of confetti) {
    if (p.shape === 'rect') {
      const cos = Math.cos(p.rot), sin = Math.sin(p.rot), hw = p.w / 2, hh = p.h / 2;
      gfxFx.poly([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([px, py]) => [p.x + px * cos - py * sin, p.y + px * sin + py * cos]).flat()).fill({ color: cssHex(p.color), alpha: p.life * 0.9 });
    } else {
      gfxFx.circle(p.x, p.y, p.r).fill({ color: cssHex(p.color), alpha: p.life * 0.9 });
    }
  }

  for (const s of sparkles) {
    if (s.delay > 0) continue;
    _star4(gfxFx, s.x, s.y, s.r);
    gfxFx.fill({ color: 0xFFFFFF, alpha: Math.min(s.life, 1) * 0.92 });
  }

  if (state.dbg) {
    for (const p of plushies) {
      const sp = Math.abs(p.av) > 0.01, bc = cssHex(PD[p.level].body);
      _dashCircle(gfxFx, p.x, p.y, p.r, 4, 3);
      gfxFx.stroke({ width: 2.5, color: sp ? 0xFF3232 : bc, alpha: 0.88 });
      gfxFx.circle(p.x, p.y, 3.5).fill({ color: sp ? 0xFF2020 : 0x20CC20 });
    }
  }

  if (state.dbgPoly) {
    for (const p of plushies) {
      const verts = getVerts(p, state.sidesOffset);
      gfxFx.poly(verts.flat()).stroke({ width: 3, color: cssHex(PD[p.level].stroke), alpha: 0.92 });
      for (const [vx, vy] of verts) gfxFx.circle(vx, vy, 3).fill({ color: cssHex(PD[p.level].body) });
      if (!p._polyText) {
        p._polyText = new PIXI.Text({ text: '', style: { fontFamily: 'monospace', fontSize: Math.max(12, Math.round(p.r * 0.3)), fontWeight: 'bold', fill: 'rgba(0,0,0,0.7)' } });
        p._polyText.anchor.set(0.5, 0.5);
        layerFx.addChild(p._polyText);
      }
      p._polyText.text = getSides(p.level, state.sidesOffset) + '-gon';
      p._polyText.x = p.x; p._polyText.y = p.y + 4; p._polyText.visible = true;
    }
  } else {
    for (const p of plushies) if (p._polyText) p._polyText.visible = false;
  }

  app.renderer.render(app.stage);
}