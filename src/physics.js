import { 
  PD, MASS, INV_MASS, NSIDES, GRAV, REST, FRIC, DAMP_DT, 
  WIPEOUT_DAMP, SUBSTEPS, ITERS, V_EPS, AV_MAX, PAD, W, H, WALL, DROPY, imgR 
} from './config.js';

export class Ball {
  constructor(x, y, lvl, texture, shadowFilter, container) {
    this.x = x;
    this.y = y;
    this.r = PD[lvl].physR ?? PD[lvl].r;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.av = 0;
    this.level = lvl;
    this.mass = MASS[lvl];
    this.invMass = INV_MASS[lvl];
    this.born = Date.now();
    this.px = x;
    this.py = y;
    this.movH = new Float32Array(30);
    this.movI = 0;
    this.movS = 0;
    this.dxH = new Float32Array(30);
    this.dyH = new Float32Array(30);
    this.dxS = 0;
    this.dyS = 0;
    this.landed = false;
    this.sprite = null;
    this._dangerLevel = 0;
    this._polyText = null;
    this._nameText = null;

    if (texture && container) {
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.label = PD[lvl].name;
      this.sprite.zIndex = 11 - lvl;
      this.sprite.anchor.set(0.5, 0.5);
      this.sprite.scale.set(PD[lvl].r / imgR(lvl));
      if (shadowFilter) this.sprite.filters = [shadowFilter];
      container.addChild(this.sprite);
    }
  }
  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
}

export function destroyBall(b, dangerMap) {
  if (!b) return;
  if (dangerMap) delete dangerMap[b.born];
  if (b.sprite) { b.sprite.destroy(); b.sprite = null; }
  if (b._nameText) { b._nameText.destroy(); b._nameText = null; }
  if (b._polyText) { b._polyText.destroy(); b._polyText = null; }
}

export function getSides(lvl, sidesOffset = 0) {
  return Math.max(3, NSIDES[lvl] + sidesOffset);
}

export function getVerts(p, sidesOffset = 0) {
  const n = getSides(p.level, sidesOffset);
  const v = [];
  for (let k = 0; k < n; k++) {
    const a = p.angle + 2 * Math.PI * k / n;
    v.push([p.x + p.r * Math.cos(a), p.y + p.r * Math.sin(a)]);
  }
  return v;
}

export function satTest(av, bv) {
  let minOv = Infinity, bnx = 0, bny = 0;
  for (let pass = 0; pass < 2; pass++) {
    const vs = pass ? bv : av, n = vs.length;
    for (let i = 0; i < n; i++) {
      const v0 = vs[i], v1 = vs[(i + 1) % n];
      const ex = v1[0] - v0[0], ey = v1[1] - v0[1];
      const len = Math.hypot(ex, ey);
      if (len < 0.0001) continue;
      const axX = -ey / len, axY = ex / len;
      let minA = 1e9, maxA = -1e9, minB = 1e9, maxB = -1e9;
      for (const v of av) {
        const p = v[0] * axX + v[1] * axY;
        if (p < minA) minA = p; if (p > maxA) maxA = p;
      }
      for (const v of bv) {
        const p = v[0] * axX + v[1] * axY;
        if (p < minB) minB = p; if (p > maxB) maxB = p;
      }
      const ov = Math.min(maxA, maxB) - Math.max(minA, minB);
      if (ov <= 0) return null;
      if (ov < minOv) { minOv = ov; bnx = axX; bny = axY; }
    }
  }
  let cax = 0, cay = 0, cbx = 0, cby = 0;
  for (const v of av) { cax += v[0]; cay += v[1]; }
  for (const v of bv) { cbx += v[0]; cby += v[1]; }
  if ((cbx / bv.length - cax / av.length) * bnx + (cby / bv.length - cay / av.length) * bny < 0) {
    bnx = -bnx; bny = -bny;
  }
  return { ov: minOv, nx: bnx, ny: bny };
}

export function stepPhysics(plushies, { tiltAngle, wipeOutActive, trapDoorScale, sidesOffset = 0 }) {
  const dt = 1 / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) {
    const _damp = wipeOutActive ? WIPEOUT_DAMP * DAMP_DT : DAMP_DT;
    for (const p of plushies) {
      p.vx += GRAV * Math.sin(tiltAngle) * dt;
      p.vy += GRAV * Math.cos(tiltAngle) * dt;
      p.vx *= _damp;
      p.vy *= _damp;
      const spd2 = p.vx * p.vx + p.vy * p.vy;
      if (spd2 > 196) {
        const f = 14 / Math.sqrt(spd2);
        p.vx *= f; p.vy *= f;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.av = Math.max(-AV_MAX, Math.min(AV_MAX, p.av)) * 0.93;
      p.angle += p.av;
    }

    for (const p of plushies) {
      if (p.x - p.r < PAD) { p.x = PAD + p.r; if (p.vx < 0) p.vx = -p.vx * REST; }
      if (p.x + p.r > W - PAD) { p.x = W - PAD - p.r; if (p.vx > 0) p.vx = -p.vx * REST; }
      if (p.y - p.r < 0) { p.y = p.r; if (p.vy < 0) p.vy = -p.vy * REST; }
      if (trapDoorScale < 1) {
        if (p.y + p.r > H - WALL) {
          p.y = H - WALL - p.r;
          p.vy = -Math.abs(p.vy) * REST;
          p.vx *= FRIC;
          p.landed = true;
        }
      }
    }

    if (wipeOutActive) continue;

    for (let it = 0; it < ITERS; it++) {
      for (let i = 0; i < plushies.length; i++) {
        for (let j = i + 1; j < plushies.length; j++) {
          const a = plushies[i], b = plushies[j];
          const dx = b.x - a.x, dy = b.y - a.y, md = a.r + b.r;
          if (dx * dx + dy * dy > md * md) continue;
          const col = satTest(getVerts(a, sidesOffset), getVerts(b, sidesOffset));
          if (!col) continue;
          const { ov, nx, ny } = col;
          const ma = a.mass, mb = b.mass, mT = ma + mb, invMT = 1 / mT;
          a.x -= nx * ov * (mb * invMT); a.y -= ny * ov * (mb * invMT);
          b.x += nx * ov * (ma * invMT); b.y += ny * ov * (ma * invMT);
          a.landed = true; b.landed = true;

          if (it === 0) {
            const dvx = b.vx - a.vx, dvy = b.vy - a.vy, rel = dvx * nx + dvy * ny;
            if (rel < 0) {
              const imp = -(1 + REST) * rel * (ma * mb * invMT);
              a.vx -= imp * a.invMass * nx; a.vy -= imp * a.invMass * ny;
              b.vx += imp * b.invMass * nx; b.vy += imp * b.invMass * ny;
              if (rel < -1.2) {
                const tv = dvx - rel * nx;
                a.av = Math.max(-AV_MAX, Math.min(AV_MAX, a.av + tv * 0.006 * (mb * invMT)));
                b.av = Math.max(-AV_MAX, Math.min(AV_MAX, b.av - tv * 0.006 * (ma * invMT)));
              }
            }
          }
        }
      }
    }
  }

  for (const p of plushies) {
    if (Math.abs(p.vx) < V_EPS) p.vx = 0;
    if (Math.abs(p.vy) < V_EPS) p.vy = 0;
    const dx2 = p.x - p.px, dy2 = p.y - p.py, moved = dx2 * dx2 + dy2 * dy2;
    p.movS -= p.movH[p.movI]; p.movH[p.movI] = moved; p.movS += moved;
    p.dxS -= p.dxH[p.movI]; p.dxH[p.movI] = dx2; p.dxS += dx2;
    p.dyS -= p.dyH[p.movI]; p.dyH[p.movI] = dy2; p.dyS += dy2;
    p.movI = (p.movI + 1) % 30;
    if (p.movS / 30 < 0.0625 && Math.abs(p.av) > 0.002) p.av = 0;
    if (Math.abs(p.av) < 0.002) p.av = 0;
    p.px = p.x; p.py = p.y;
  }
}

export function predictLanding(x, r, plushies) {
  let y = H - WALL - r;
  for (const p of plushies) {
    const dx = x - p.x, md = r + p.r;
    if (Math.abs(dx) < md) {
      const dy = Math.sqrt(md * md - dx * dx), cy = p.y - dy;
      if (cy > DROPY + r && cy < y) y = cy;
    }
  }
  return y;
}