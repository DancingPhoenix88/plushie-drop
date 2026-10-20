export const VERSION = 'v35';
export const IS_DEBUG = false;
export const IS_GP_DEBUG = false;

export const W = 632;
export const H = 1049;
export const WALL = 11;
export const DY = 178;
export const DROPY = 94;
export const PAD = Math.round(W * 0.05);

export const SOURCE_W = Math.round(W * 0.10);
export const REFLECT_VIS = Math.round(W * 0.05);
export const REFLECT_SCALE = 0.5;
export const FS = W / 460;

export const GRAV = 0.38;
export const DAMP = 0.994;
export const REST = 0.35;
export const FRIC = 0.84;
export const SUBSTEPS = 6;
export const ITERS = 4;
export const V_EPS = 0.08;
export const AV_MAX = 0.12;

export const TRAP_ANIM_SPEED = 1 / (60 * 0.25);
export const WIPEOUT_DAMP = 0.97;
export const CLAW_OPEN_FRAMES = 18;

export const PD = [null,
  { name: 'May', r: 30, body: '#8ee8ff', stroke: '#38a8d0' },
  { name: 'Bo', r: 41, body: '#4a8c40', stroke: '#245820' },
  { name: 'Shaun', r: 52, body: '#f5f5f5', stroke: '#b8b8b8' },
  { name: 'Ai Ai', r: 62, body: '#e83030', stroke: '#980808' },
  { name: 'Baby', r: 73, physR: 66, body: '#fff0f8', stroke: '#d89ab8' },
  { name: 'Poko', r: 84, physR: 80, body: '#c87830', stroke: '#884808' },
  { name: 'Lapas', r: 95, physR: 91, body: '#f0c820', stroke: '#b08800' },
  { name: 'Mama', r: 105, body: '#1090e8', stroke: '#0055b0' },
  { name: 'Bunny', r: 116, body: '#f060a0', stroke: '#a81858' },
  { name: 'Mimi', r: 125, body: '#9848d4', stroke: '#601898' },
  { name: 'Racoon', r: 136, physR: 129, body: '#282838', stroke: '#080818' },
];

export const PTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 100];
export const MASS = [0, 900, 1681, 2704, 3844, 4356, 6400, 8281, 11025, 13456, 15625, 16641];
export const INV_MASS = [0, ...MASS.slice(1).map(m => 1 / m)];
export const MERGE_DIST = [0, 66, 88, 110, 130, 138, 166, 188, 216, 238, 256, 264];
export const MERGE_DIST_SQ = MERGE_DIST.map(d => d * d);
export const DAMP_DT = Math.pow(0.994, 1 / 6);
export const NSIDES = [0, 8, 8, 9, 10, 10, 11, 11, 12, 12, 13, 14];
export const CONFETTI_COLORS = ['#ff5a5a', '#ffb830', '#ffe234', '#4ddc7a', '#38c5f5', '#c84dff', '#ff6eb4', '#ffffff'];

export const TD = { x: -30, w: 690, h: 38, bottomY: H, capL: 90, capR: 90 };

export function imgR(lvl) {
  return lvl <= 8 ? 65 : 90;
}

export function cssHex(css) {
  if (!css) return 0xffffff;
  if (css.startsWith('#')) {
    const h = css.slice(1);
    if (h.length === 3) return parseInt(h[0] + h[0] + h[1] + h[1] + h[2] + h[2], 16);
    return parseInt(h, 16);
  }
  return 0xffffff;
}