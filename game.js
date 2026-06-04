
'use strict';
const IS_DEBUG = true; // set to false on release branch
const IS_GP_DEBUG = false; // force gamepad-connected visuals for testing; false on release (follows IS_DEBUG)
if(!IS_DEBUG){
  const dbgSection=document.getElementById('help-debug-section');
  if(dbgSection) dbgSection.style.display='none';
} else {
  document.body.classList.add('debug-mode');
}
const PD=[null,
  {name:'Mây',r:30,body:'#8ee8ff',stroke:'#38a8d0'},
  {name:'Bơ',r:41,body:'#4a8c40',stroke:'#245820'},
  {name:'Vincam',r:52,body:'#f5f5f5',stroke:'#b8b8b8'},
  {name:'Mini Dora',r:62,body:'#e83030',stroke:'#980808'},
  {name:'Baby Bunny',r:73,physR:66,body:'#fff0f8',stroke:'#d89ab8'},
  {name:'Poko',r:84,physR:80,body:'#c87830',stroke:'#884808'},
  {name:'Doraemi',r:95,physR:91,body:'#f0c820',stroke:'#b08800'},
  {name:'Doraemon',r:105,body:'#1090e8',stroke:'#0055b0'},
  {name:'Bunny',r:116,body:'#f060a0',stroke:'#a81858'},
  {name:'Mimi',r:125,body:'#9848d4',stroke:'#601898'},
  {name:'Racoon',r:136,physR:129,body:'#282838',stroke:'#080818'},
];
const PTS=[0,1,3,6,10,15,21,28,36,45,55,100];
const W=632,H=1049,WALL=11,DY=178,DROPY=94;
const PAD=Math.round(W*0.05);
// ── REFLECTION CONSTANTS ──────────────────────────────────────────────
const SOURCE_W  =Math.round(W*0.10); // source strip width (sampled near each wall)
const REFLECT_VIS=Math.round(W*0.05);// visible reflection zone (5% W each side)
const REFLECT_SCALE=0.5;             // half-res buffer
const FS=W/460;
const GRAV=0.38,DAMP=0.994,REST=0.35,FRIC=0.84;
const SUBSTEPS=6,ITERS=4;
const V_EPS=0.08,AV_MAX=0.12;
let plushies=[],parts=[],mergeQ=[],popups=[],confetti=[],celebrations=[],sparkles=[];
let score=0,best=0,cur=1,nxt=1;
let mx=W/2,cooling=false,dead=false,tapHint=false;
let danger={},firstMerged=new Set();
let gameLevel=1,wipeOutActive=false,scoreMultiplier=1;
let trapDoorOpen=false,trapDoorScale=0,trapDoorDir=0;
const TRAP_ANIM_SPEED=1/(60*0.25); // 0.25s; scale 0=hidden, 1=fully shown
const WIPEOUT_DAMP=0.97; // ~85% velocity retained per frame // per-substep extra damping during wipeout (~74% velocity retained per frame)        // extra per-frame damping during wipeout to slow terminal velocity     // gravity multiplier while plushies fall through (1=normal, lower=slower)
window.TD={x:0,w:W,h:44,bottomY:H,capL:90,capR:90};
const PTS_M=new Array(12);
function rebuildPtsTable(){for(let i=1;i<=11;i++)PTS_M[i]=PTS[i]*scoreMultiplier;}
let showClaw=true;
function toggleClaw(v){showClaw=v;}
let clawY=DROPY,clawX=W/2,clawDropX=W/2,clawLvl=1;
let clawState='idle',clawOpenTimer=0;
const CLAW_OPEN_FRAMES=18;
const dpr=window.devicePixelRatio||1;

// ── PIXI SETUP (v8 — async init) ──────────────────────────────────────
const cv=document.getElementById('gc');
const app=new PIXI.Application();
// DevTools getter — always returns live stage/renderer even before async init
Object.defineProperty(window,'__PIXI_DEVTOOLS__',{
  get:()=>({app,stage:app.stage??undefined,renderer:app.renderer??undefined}),
  configurable:true
});

// Populated by initPixi() before loop starts
let stage,layerBg,layerUI,layerClaw,layerPlushie,layerFx;
let gfxUI,gfxClaw,gfxFx;
let clawSprBack,clawSprFront,clawHeldSpr,trapDoorSpr;
let _dangerText,_versionText,_tapText;
const plushieTextures=new Array(12);
let _clawTexBack,_clawTexFront,_clawTexOpen;
// Reflection
let _reflectLtRT=null,_reflectRtRT=null;  // quarter-res RenderTextures
let _reflectSprLt=null,_reflectSprRt=null;// display sprites (in layerBg)
let _coverTopLt=null,_coverTopRt=null,_coverBotLt=null,_coverBotRt=null; // corner covers
let _reflectFrame=0;
// Adaptive reflection state (matches main v14 logic)
let _reflectState='probing'; // set correctly in initPixi after isMobile is known
let _reflectWindowStart=0;
const REFLECT_WINDOW_MS=2000, REFLECT_FPS_ON=55, REFLECT_FPS_OFF=55;
const _rfpsD=new Float32Array(60); let _rfpsI=0,_rfpsPrev=0;
let _reflectEnabled=false; // set in initPixi

async function initPixi(){
  await app.init({
    canvas:cv, width:W, height:H,
    backgroundAlpha:0,
    antialias:!isMobile,      // antialias+transparent canvas breaks on iOS Safari
    resolution:dpr,
    autoDensity:true,
    powerPreference:'high-performance',
  });
  app.ticker.stop();
  stage=app.stage; stage.label='root';
  // __PIXI_DEVTOOLS__ is a getter defined at module level — no reassignment needed
  cv.style.width='';cv.style.height=''; // let CSS width:100% win
  // Reflection state — now isMobile is accessible
  _reflectEnabled = !isMobile;
  _reflectState   = isMobile ? 'probing' : 'on';

  layerBg=new PIXI.Container();      layerBg.label='layer_bg';
  layerUI=new PIXI.Container();      layerUI.label='layer_ui';
  layerClaw=new PIXI.Container();    layerClaw.label='layer_claw';
  layerPlushie=new PIXI.Container(); layerPlushie.label='layer_plushies'; layerPlushie.sortableChildren=true; layerPlushie.sortableChildren=true;
  layerFx=new PIXI.Container();      layerFx.label='layer_fx';
  stage.addChild(layerBg,layerUI,layerClaw,layerPlushie,layerFx);

  gfxUI  =new PIXI.Graphics(); gfxUI.label='ui_lines';   layerUI.addChild(gfxUI);
  gfxClaw=new PIXI.Graphics(); gfxClaw.label='claw_guide';layerClaw.addChild(gfxClaw);
  gfxFx  =new PIXI.Graphics(); gfxFx.label='fx_shapes';  layerFx.addChild(gfxFx);

  clawSprBack =new PIXI.Sprite(PIXI.Texture.EMPTY); clawSprBack.label='claw_back';  clawSprBack.visible=false;
  clawSprFront=new PIXI.Sprite(PIXI.Texture.EMPTY); clawSprFront.label='claw_front';clawSprFront.visible=false;
  clawHeldSpr =new PIXI.Sprite(PIXI.Texture.EMPTY); clawHeldSpr.label='claw_held';  clawHeldSpr.anchor.set(0.5,0.5);clawHeldSpr.visible=false;
  layerClaw.addChild(clawSprBack,clawHeldSpr,clawSprFront);

  // NineSliceSprite so the cap corners aren't stretched (capL=capR=90px from TD meta)
  // ── Reflections — two RenderTextures at quarter-res (one strip each) ──
  const rW=Math.ceil(SOURCE_W*REFLECT_SCALE), rH=Math.ceil(H*REFLECT_SCALE); // 32×525 at 0.5x
  _reflectLtRT=PIXI.RenderTexture.create({width:rW,height:rH,resolution:1});
  _reflectRtRT=PIXI.RenderTexture.create({width:rW,height:rH,resolution:1});
  _reflectSprLt=new PIXI.Sprite(_reflectLtRT); _reflectSprLt.label='reflect_left';
  _reflectSprRt=new PIXI.Sprite(_reflectRtRT); _reflectSprRt.label='reflect_right';
  _reflectSprLt.alpha=_reflectSprRt.alpha=0.22;
  // Left: scale flip, anchor at x=REFLECT_VIS; Right: scale flip, anchor at x=W
  // Scale = 1/REFLECT_SCALE → maps RT pixels 1:1 to game units (no stretch)
  // Negative scaleX flips horizontally (mirrors the wall reflection)
  const rScl=1/REFLECT_SCALE;
  // Left:  x=REFLECT_VIS        → RT pixel 0 (game x=REFLECT_VIS) at screen x=REFLECT_VIS
  // Right: x=W-REFLECT_VIS+SOURCE_W → RT pixel 31 (game x=W-REFLECT_VIS) at screen x=W-REFLECT_VIS
  _reflectSprLt.scale.set(-rScl, rScl); _reflectSprLt.x=REFLECT_VIS;                    _reflectSprLt.y=0;
  _reflectSprRt.scale.set(-rScl, rScl); _reflectSprRt.x=W-REFLECT_VIS+SOURCE_W;         _reflectSprRt.y=0;
  // No mask — cover patches hide any bleed at the corners
  _reflectSprLt.visible=_reflectSprRt.visible=false; // hidden until enabled
  // ── Cover patches — corner sprites that frame the reflection zones ──
  _coverTopLt=new PIXI.Sprite(PIXI.Texture.EMPTY); _coverTopLt.label='cover_top_lt';
  _coverTopRt=new PIXI.Sprite(PIXI.Texture.EMPTY); _coverTopRt.label='cover_top_rt';
  _coverBotLt=new PIXI.Sprite(PIXI.Texture.EMPTY); _coverBotLt.label='cover_bot_lt';
  _coverBotRt=new PIXI.Sprite(PIXI.Texture.EMPTY); _coverBotRt.label='cover_bot_rt';
  // Layer order in bg: reflections → cover patches → trap door
  layerBg.addChild(_reflectSprLt,_reflectSprRt,_coverTopLt,_coverBotLt,_coverTopRt,_coverBotRt);

  trapDoorSpr=new PIXI.NineSliceSprite({texture:PIXI.Texture.EMPTY,leftWidth:90,rightWidth:90,topHeight:0,bottomHeight:0});
  trapDoorSpr.label='trap_door'; trapDoorSpr.visible=false;
  layerBg.addChild(trapDoorSpr);

  _dangerText=new PIXI.Text({text:'DANGER',style:{fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:Math.round(11*FS),fill:'#D23737'}});
  _dangerText.label='danger_label';_dangerText.x=W*0.1+5;_dangerText.y=DY-Math.round(14*FS);layerUI.addChild(_dangerText);

  _versionText=new PIXI.Text({text:'v31',style:{fontFamily:"'Segoe UI',system-ui,sans-serif",fontSize:Math.round(9*FS),fill:'#5a3820'}});
  _versionText.label='version_label';_versionText.anchor.set(1,1);_versionText.x=W-W*0.1-4;_versionText.y=DY-5;_versionText.alpha=0.45;layerUI.addChild(_versionText);

  _tapText=new PIXI.Text({text:'TAP TO DROP',style:{fontFamily:"'Cherry Bomb One','Segoe UI',system-ui,sans-serif",fontSize:Math.round(36*FS),fontWeight:'400',fill:'#5a3820',stroke:{color:'#ffffff',width:3}}});
  // Note: dropShadow removed — causes white background on iOS mobile WebGL
  _tapText.label='tap_hint';_tapText.anchor.set(0.5,0.5);_tapText.x=W/2;_tapText.y=H/2;_tapText.visible=false;layerUI.addChild(_tapText);
}

function makeShadow(){
  const F=globalThis.PixiFilters||PIXI?.filters;
  if(!F?.DropShadowFilter)return null;
  return new F.DropShadowFilter({offset:{x:2,y:5},blur:4,alpha:0.28,color:0x000000,resolution:dpr});
}
function cssHex(css){
  if(!css)return 0xffffff;
  if(css.startsWith('#')){const h=css.slice(1);if(h.length===3)return parseInt(h[0]+h[0]+h[1]+h[1]+h[2]+h[2],16);return parseInt(h,16);}
  return 0xffffff;
}

const nc=document.getElementById('nc');
const ncls=document.getElementById('nc-ls'),nctxls=ncls.getContext('2d');
ncls.width=98*dpr;ncls.height=80*dpr;ncls.style.width='98px';ncls.style.height='80px';
nctxls.scale(dpr,dpr);nctxls.imageSmoothingEnabled=true;nctxls.imageSmoothingQuality='high';

const MASS=[0,900,1681,2704,3844,4356,6400,8281,11025,13456,15625,16641];
const INV_MASS=[0,...MASS.slice(1).map(m=>1/m)];
const MERGE_DIST=[0,66,88,110,130,138,166,188,216,238,256,264];
const MERGE_DIST_SQ=MERGE_DIST.map(d=>d*d);
const DAMP_DT=Math.pow(0.994,1/6);
const NSIDES=[0,8,8,9,10,10,11,11,12,12,13,14];
let sidesOffset=0;
const SIDES_MIN=-1,SIDES_MAX=18;
function getSides(lvl){return Math.max(3,NSIDES[lvl]+sidesOffset);}
function getVerts(p){const n=getSides(p.level),v=[];for(let k=0;k<n;k++){const a=p.angle+2*Math.PI*k/n;v.push([p.x+p.r*Math.cos(a),p.y+p.r*Math.sin(a)]);}return v;}
function satTest(av,bv){
  let minOv=Infinity,bnx=0,bny=0;
  for(let pass=0;pass<2;pass++){const vs=pass?bv:av,n=vs.length;for(let i=0;i<n;i++){const v0=vs[i],v1=vs[(i+1)%n];const ex=v1[0]-v0[0],ey=v1[1]-v0[1];const len=Math.hypot(ex,ey);if(len<0.0001)continue;const axX=-ey/len,axY=ex/len;let minA=1e9,maxA=-1e9,minB=1e9,maxB=-1e9;for(const v of av){const p=v[0]*axX+v[1]*axY;if(p<minA)minA=p;if(p>maxA)maxA=p;}for(const v of bv){const p=v[0]*axX+v[1]*axY;if(p<minB)minB=p;if(p>maxB)maxB=p;}const ov=Math.min(maxA,maxB)-Math.max(minA,minB);if(ov<=0)return null;if(ov<minOv){minOv=ov;bnx=axX;bny=axY;}}}
  let cax=0,cay=0,cbx=0,cby=0;for(const v of av){cax+=v[0];cay+=v[1];}for(const v of bv){cbx+=v[0];cby+=v[1];}
  if((cbx/bv.length-cax/av.length)*bnx+(cby/bv.length-cay/av.length)*bny<0){bnx=-bnx;bny=-bny;}
  return{ov:minOv,nx:bnx,ny:bny};
}

class Ball{
  constructor(x,y,lvl){
    this.x=x;this.y=y;this.r=PD[lvl].physR??PD[lvl].r;
    this.vx=0;this.vy=0;this.angle=0;this.av=0;
    this.level=lvl;this.mass=MASS[lvl];this.invMass=INV_MASS[lvl];this.born=Date.now();
    this.px=x;this.py=y;this.movH=new Float32Array(30);this.movI=0;this.movS=0;
    this.dxH=new Float32Array(30);this.dyH=new Float32Array(30);this.dxS=0;this.dyS=0;
    this.landed=false; // true once plushie touches floor or another plushie
    this.sprite=null;
    if(plushieTextures[lvl]){this.sprite=new PIXI.Sprite(plushieTextures[lvl]);this.sprite.label=PD[lvl].name;this.sprite.zIndex=11-lvl;this.sprite.anchor.set(0.5,0.5);this.sprite.scale.set(PD[lvl].r/imgR(lvl));const sh=makeShadow();if(sh)this.sprite.filters=[sh];layerPlushie.addChild(this.sprite);}
  }
  get speed(){return Math.hypot(this.vx,this.vy);}
}
function _destroyBall(b){if(!b)return;delete danger[b.born];if(b.sprite){b.sprite.destroy();b.sprite=null;}if(b._nameText){b._nameText.destroy();b._nameText=null;}if(b._polyText){b._polyText.destroy();b._polyText=null;}}
function clearPlushies(){plushies.forEach(_destroyBall);plushies=[];}


function step(){
  const dt=1/SUBSTEPS;
  for(let s=0;s<SUBSTEPS;s++){
    const _damp=wipeOutActive?WIPEOUT_DAMP*DAMP_DT:DAMP_DT;
    for(const p of plushies){p.vx+=GRAV*Math.sin(tiltAngle)*dt;p.vy+=GRAV*Math.cos(tiltAngle)*dt;p.vx*=_damp;p.vy*=_damp;const spd2=p.vx*p.vx+p.vy*p.vy;if(spd2>196){const f=14/Math.sqrt(spd2);p.vx*=f;p.vy*=f;}p.x+=p.vx;p.y+=p.vy;p.av=Math.max(-AV_MAX,Math.min(AV_MAX,p.av))*0.93;p.angle+=p.av;}
    for(const p of plushies){if(p.x-p.r<PAD){p.x=PAD+p.r;if(p.vx<0)p.vx=-p.vx*REST;}if(p.x+p.r>W-PAD){p.x=W-PAD-p.r;if(p.vx>0)p.vx=-p.vx*REST;}if(p.y-p.r<0){p.y=p.r;if(p.vy<0)p.vy=-p.vy*REST;}
      // Floor: active until door is FULLY open; removed once scale=1 so plushies fall through
      if(trapDoorScale<1){if(p.y+p.r>H-WALL){p.y=H-WALL-p.r;p.vy=-Math.abs(p.vy)*REST;p.vx*=FRIC;p.landed=true;}}}
    // SAT: off for entire wipeout duration; restored by _onTrapDoorClosed (wipeOutActive=false)
    if(wipeOutActive) continue;
    for(let it=0;it<ITERS;it++){for(let i=0;i<plushies.length;i++){for(let j=i+1;j<plushies.length;j++){const a=plushies[i],b=plushies[j];const dx=b.x-a.x,dy=b.y-a.y,md=a.r+b.r;if(dx*dx+dy*dy>md*md)continue;const col=satTest(getVerts(a),getVerts(b));if(!col)continue;const{ov,nx,ny}=col;const ma=a.mass,mb=b.mass,mT=ma+mb,invMT=1/mT;a.x-=nx*ov*(mb*invMT);a.y-=ny*ov*(mb*invMT);b.x+=nx*ov*(ma*invMT);b.y+=ny*ov*(ma*invMT);a.landed=true;b.landed=true;if(it===0){const dvx=b.vx-a.vx,dvy=b.vy-a.vy,rel=dvx*nx+dvy*ny;if(rel<0){const imp=-(1+REST)*rel*(ma*mb*invMT);a.vx-=imp*a.invMass*nx;a.vy-=imp*a.invMass*ny;b.vx+=imp*b.invMass*nx;b.vy+=imp*b.invMass*ny;if(rel<-1.2){const tv=dvx-rel*nx;a.av=Math.max(-AV_MAX,Math.min(AV_MAX,a.av+tv*0.006*(mb*invMT)));b.av=Math.max(-AV_MAX,Math.min(AV_MAX,b.av-tv*0.006*(ma*invMT)));}}}}}
      }
    }
  for(const p of plushies){if(Math.abs(p.vx)<V_EPS)p.vx=0;if(Math.abs(p.vy)<V_EPS)p.vy=0;const dx2=p.x-p.px,dy2=p.y-p.py,moved=dx2*dx2+dy2*dy2;p.movS-=p.movH[p.movI];p.movH[p.movI]=moved;p.movS+=moved;p.dxS-=p.dxH[p.movI];p.dxH[p.movI]=dx2;p.dxS+=dx2;p.dyS-=p.dyH[p.movI];p.dyH[p.movI]=dy2;p.dyS+=dy2;p.movI=(p.movI+1)%30;if(p.movS/30<0.0625&&Math.abs(p.av)>0.002)p.av=0;if(Math.abs(p.av)<0.002)p.av=0;p.px=p.x;p.py=p.y;}
}

function detectMerges(){
  if(wipeOutActive) return;
  const used=new Set();
  for(let i=0;i<plushies.length;i++){for(let j=i+1;j<plushies.length;j++){if(used.has(i)||used.has(j))continue;const a=plushies[i],b=plushies[j];if(a.level!==b.level)continue;const dx=b.x-a.x,dy=b.y-a.y;if(dx*dx+dy*dy<MERGE_DIST_SQ[a.level]){mergeQ.push([i,j]);used.add(i);used.add(j);}}}
}

function processMerges(){
  if(!mergeQ.length) return;
  if(IS_DEBUG && noMerge){ mergeQ=[]; return; }
  const pairs=mergeQ.splice(0).sort((a,b)=>Math.max(b[0],b[1])-Math.max(a[0],a[1]));
  const toRemove=new Set(),toAdd=[];let wipeOutPos=null;
  for(const[i,j]of pairs){if(toRemove.has(i)||toRemove.has(j))continue;const a=plushies[i],b=plushies[j];const px=(a.x+b.x)/2,py=(a.y+b.y)/2,nl=a.level+1;toRemove.add(i);toRemove.add(j);if(nl>11){wipeOutPos={x:px,y:py};continue;}toAdd.push({x:px,y:py,lvl:nl});const pts=PTS_M[nl];score+=pts;if(score>best)best=score;burst(px,py,PD[nl].body);updUI();sfxMerge(nl);if(showSpawnRate)updateEvoLabels();popups.push({x:px,y:py,text:'+'+pts.toLocaleString(),color:PD[nl].body,life:1});if(!firstMerged.has(nl)){firstMerged.add(nl);spawnCelebration(px,py,nl,pts);updateEvoUnlocks();}}
  plushies.filter((_,i)=>toRemove.has(i)).forEach(_destroyBall);
  plushies=plushies.filter((_,i)=>!toRemove.has(i));
  for(const{x,y,lvl}of toAdd){const b=new Ball(x,y,lvl);b.vx=(Math.random()-.5)*2;b.vy=-3;b.av=(Math.random()-.5)*AV_MAX*0.4;plushies.push(b);}
  if(wipeOutPos)triggerWipeOut(wipeOutPos.x,wipeOutPos.y);
}

// ── FRAME-EVENT SCHEDULER — keeps physics & graphics in sync with step mode ──
let _gameFrame=0;
let _frameEvents=[];
function scheduleAt(delayFrames,fn){_frameEvents.push({at:_gameFrame+Math.max(1,Math.round(delayFrames)),fn});}
function clearScheduled(){_frameEvents=[];}
function tickScheduled(){
  _gameFrame++;
  _frameEvents=_frameEvents.filter(e=>{if(_gameFrame>=e.at){e.fn();return false;}return true;});
}

function triggerWipeOut(x,y){
  wipeOutActive=true; trapDoorOpen=false;
  // Force-drop anything the claw is holding, reset to rank 1–3
  clawState='idle'; cooling=false; clawOpenTimer=0;
  cur=rnd(); nxt=rnd(); updNext(); // rnd() always returns 1–3 when tank empties
  clawX=W/2; clawLvl=cur;

  // Frame-based timing (synced with P/. step mode)
  // Phase 1: wait OPEN_F frames, then open door (SAT still ON during animation)
  // Phase 2: tickTrapDoor auto-triggers scatter when scale reaches 1.0 (fully open)
  // Phase 3: after plushies fall, close door — tickTrapDoor fires _onTrapDoorClosed when scale=0
  const OPEN_F = Math.round(1/TRAP_ANIM_SPEED);         // ~15f — door starts opening
  const fallF  = Math.ceil(Math.sqrt(2*(H+136)/(GRAV*SUBSTEPS))*1.5);
  const CLOSE_F = OPEN_F + OPEN_F + fallF;               // wait for open anim + fall time

  scheduleAt(OPEN_F,  ()=>{ trapDoorOpen=true;  }); // start opening — scatter fires in tickTrapDoor
  scheduleAt(CLOSE_F, ()=>{
    clearPlushies(); // destroy all remaining plushies before door closes
    trapDoorOpen=false; // start closing — level-up fires in _onTrapDoorClosed
  });

  // Immediate: tally, confetti, WIPE OUT text, glare+sparkles+SFX
  let totalPts=0;
  for(const p of plushies){totalPts+=PTS_M[p.level];p.vy=Math.max(p.vy,1+Math.random()*2);}
  danger={};mergeQ=[];_gyroMultiDangerSince=null;
  score+=totalPts;if(score>best)best=score;updUI();

  for(let i=0;i<160;i++){const fromTop=i<50;const cx=fromTop?Math.random()*W:x,cy=fromTop?-10:y;const a=fromTop?(Math.PI/2+Math.random()*.8-.4):(Math.random()*Math.PI*2);const spd=fromTop?(4+Math.random()*7):(5+Math.random()*10);confetti.push({x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:4+Math.random()*5,rot:Math.random()*Math.PI*2,rv:(Math.random()-.5)*0.3,w:5+Math.random()*6,h:7+Math.random()*9,color:CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)],life:1.2,shape:Math.random()<0.6?'rect':'circle'});}
  celebrations.push({x:W/2,y:H/2-80,name:'WIPE OUT!',level:0,pts:totalPts,color:'#ff3030',stroke:'#800000',life:1,scale:0.1,phase:'in',isWipeOut:true});
  if(totalPts>0)popups.push({x:W/2,y:H/2+60,text:'+'+totalPts.toLocaleString(),color:'#f0c500',life:1.8,big:true});
  triggerClear();
}

// ── CLEAR sequence — triple glare + sparkles + SFX (all frame-scheduled) ──
function triggerClear(){
  if(showClaw){
    triggerGlare();           // glare #1 immediately
    scheduleAt(18,triggerGlare); // glare #2 at ~300ms
    scheduleAt(37,triggerGlare); // glare #3 at ~620ms
  }
  sfxWipeOut();
  // Sparkle emitter: 20 sparkles, 1 every 6 frames starting at frame 18
  for(let i=0;i<20;i++){
    scheduleAt(18+i*6,()=>{
      const baseR=10+Math.random()*18;
      sparkles.push({x:PAD+Math.random()*(W-PAD*2),y:Math.random()*H,r:baseR,baseR,rot:0,color:'#ffffff',life:1.2+Math.random()*0.8,delay:0,phase:Math.random()*Math.PI*2});
    });
  }
}

function sfxWipeOut(){if(muted)return;const a=getAC(),t=a.currentTime;const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a._sfxBus||a.destination);o.type='sawtooth';o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(880,t+0.8);g.gain.setValueAtTime(0.4,t);g.gain.exponentialRampToValueAtTime(0.001,t+1.0);o.start(t);o.stop(t+1.1);[523,659,784,1047].forEach((f,k)=>{const o2=a.createOscillator(),g2=a.createGain();o2.connect(g2);g2.connect(a._sfxBus||a.destination);o2.type='triangle';o2.frequency.value=f;g2.gain.setValueAtTime(0,t+0.3+k*0.06);g2.gain.linearRampToValueAtTime(0.2,t+0.35+k*0.06);g2.gain.exponentialRampToValueAtTime(0.001,t+1.4);o2.start(t+0.3+k*0.06);o2.stop(t+1.5);});}

function sfxLevelUp(){
  if(muted)return;const a=getAC(),t=a.currentTime;
  [523,659,784,1047,1319].forEach((f,k)=>{const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a._sfxBus||a.destination);o.type='triangle';o.frequency.value=f;const on=t+k*0.08;g.gain.setValueAtTime(0,on);g.gain.linearRampToValueAtTime(0.22,on+0.04);g.gain.exponentialRampToValueAtTime(0.001,on+0.5);o.start(on);o.stop(on+0.55);});
  const os=a.createOscillator(),gs=a.createGain();os.connect(gs);gs.connect(a._sfxBus||a.destination);os.type='sine';os.frequency.value=2093;gs.gain.setValueAtTime(0,t+0.35);gs.gain.linearRampToValueAtTime(0.1,t+0.4);gs.gain.exponentialRampToValueAtTime(0.001,t+1.2);os.start(t+0.35);os.stop(t+1.3);
}

// ── GAME OVER ─────────────────────────────────────────────────────────
let _gyroMultiDangerSince=null;
// ── 3-TIER DANGER SYSTEM ──────────────────────────────────────────────
// Level 1: top  above DY  (p.y-p.r < DY)              → blink danger line
// Level 2: center above DY, bottom below (p.y < DY && p.y+p.r >= DY) → slow pulse
// Level 3: bottom above DY (p.y+p.r < DY)             → fast pulse + 1s → lose
function checkDanger(){
  const now=Date.now();
  for(const p of plushies){
    if(!p.landed){p._dangerLevel=0;delete danger[p.born];continue;} // still in free fall
    const vr=PD[p.level].r; // visual radius (sprite size), not physics radius
    const topAbove   =p.y-vr<DY;          // top crosses DY
    const bottomNearLine=p.y+vr<DY+10;    // bottom within 10px of crossing DY
    if(bottomNearLine&&now-p.born>500){
      p._dangerLevel=3;
      danger[p.born]=danger[p.born]??now;
      if(now-danger[p.born]>1000){gameOver();return;}
    } else if(topAbove){
      p._dangerLevel=2; delete danger[p.born];
    } else {
      p._dangerLevel=0; delete danger[p.born];
    }
  }
}
function sfxGameOver(){
  if(muted)return;const a=getAC(),t=a.currentTime;
  // sad descending arpeggio
  [[392,.00,'sine',.25,.4],[330,.18,'sine',.22,.45],[261.63,.38,'sine',.2,.5],[196,.6,'sine',.18,.7]].forEach(([f,d,tp,v,u])=>tone(f,d,tp,v,u));
  // low groan underneath
  const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a._sfxBus||a.destination);
  o.type='sawtooth';o.frequency.setValueAtTime(120,t);o.frequency.linearRampToValueAtTime(60,t+1.2);
  g.gain.setValueAtTime(0.08,t);g.gain.linearRampToValueAtTime(0,t+1.2);
  o.start(t);o.stop(t+1.3);
}
// ── HIGHSCORE + RIVAL ────────────────────────────────────────────────
const HS_KEY='plushie_highscore';
const RIVAL_KEY='plushie_rival';
let _highScore=0;
function _loadHS(){ try{ _highScore=parseInt(localStorage.getItem(HS_KEY)||'0')||0; }catch(e){} }
function _saveHS(v){ try{ localStorage.setItem(HS_KEY,v); }catch(e){} }
function _loadRival(){ try{ const v=parseInt(localStorage.getItem(RIVAL_KEY)||'0')||0; return v||Math.round(700000+Math.random()*100000); }catch(e){ return Math.round(700000+Math.random()*100000); } }
function _saveRival(v){ try{ localStorage.setItem(RIVAL_KEY,v); }catch(e){} }
_loadHS();

function _buildOvHint(isNewHS){
  // homescreen tip for non-standalone mobile
  const pins=isMobile&&!isStandalone?'<br>📱 Add to Home Screen to play offline, 1-tap!':'';
  if(!isNewHS){
    return `You've done <strong>${_highScore.toLocaleString()}</strong> before — beat it!${pins}`;
  }
  // new highscore hints
  const unseenLvl=[...Array(12).keys()].slice(4).find(i=>!firstMerged.has(i));
  if(unseenLvl){
    return `<img src="Sprites/characters/level_${unseenLvl}.png" style="width:36px;height:36px;object-fit:contain;filter:brightness(0);opacity:0.4;display:inline-block;vertical-align:middle;margin-right:4px;"><span>???  Keep merging to unlock a secret character!</span>`;
  }
  if(gameLevel<2){
    return `💡 Merge two Racoons for a <strong>WIPE OUT</strong> — the score multiplier doubles!${pins}`;
  }
  // random provoke / tease
  const rival=_loadRival();
  const newRival=Math.max(rival,_highScore)+Math.round(10000+Math.random()*10000);
  _saveRival(newRival);
  const teases=[
    ()=>{
      const a=Math.ceil(Math.random()*10)+1,b=a+1<=11?a+1:a;
      const gain=PTS_M[Math.min(b,11)];
      return `💰 Merging two <em>${PD[a].name}</em>s next level = <strong>+${gain.toLocaleString()} pts</strong>!${pins}`;
    },
    ()=>`🏆 Someone scored <strong>${newRival.toLocaleString()}</strong>… think you can beat that?${pins}`,
  ];
  return teases[Math.floor(Math.random()*teases.length)]();
}

let _polaroidDataURL=null; // clean snapshot — used for polaroid display
let _shareDataURL=null;    // label-stamped snapshot — used for sharing
function _cleanRender(){
  // Hide UI overlays + reset tints, render, restore
  const prev={dA:_dangerText?.alpha,vA:_versionText?.alpha,tV:_tapText?.visible,
    cTL:_coverTopLt?.visible,cTR:_coverTopRt?.visible,cBL:_coverBotLt?.visible,cBR:_coverBotRt?.visible};
  if(_dangerText)_dangerText.alpha=0;
  if(_versionText)_versionText.alpha=0;
  if(_tapText)_tapText.visible=false;
  if(_reflectSprLt)_reflectSprLt.visible=false;
  if(_reflectSprRt)_reflectSprRt.visible=false;
  if(_coverTopLt)_coverTopLt.visible=false;
  if(_coverTopRt)_coverTopRt.visible=false;
  if(_coverBotLt)_coverBotLt.visible=false;
  if(_coverBotRt)_coverBotRt.visible=false;
  plushies.forEach(p=>{if(p.sprite)p.sprite.tint=0xFFFFFF;});
  app.renderer.render(stage);
  const url=cv.toDataURL('image/png');
  if(_dangerText)_dangerText.alpha=prev.dA??0.65;
  if(_versionText)_versionText.alpha=prev.vA??0.45;
  if(_tapText)_tapText.visible=prev.tV??false;
  if(_reflectSprLt)_reflectSprLt.visible=_reflectSprRt.visible=_reflectEnabled;
  if(_coverTopLt)_coverTopLt.visible=prev.cTL??true;
  if(_coverTopRt)_coverTopRt.visible=prev.cTR??true;
  if(_coverBotLt)_coverBotLt.visible=prev.cBL??true;
  if(_coverBotRt)_coverBotRt.visible=prev.cBR??true;
  return url;
}
function _takePolaroid(){
  try{
    _polaroidDataURL=_cleanRender();
    // Share capture: "BB Tower" label at top on highest layer, then re-render
    const lbl=new PIXI.Text({text:'BB Tower',style:{fontFamily:"'Cherry Bomb One','Segoe UI',system-ui,sans-serif",fontSize:Math.round(28*FS),fontWeight:'400',fill:'#ffffff',stroke:{color:'#000000',width:4}}});
    lbl.label='share_watermark';lbl.anchor.set(0.5,0);lbl.x=W/2;lbl.y=18;
    layerFx.addChild(lbl);
    _shareDataURL=_cleanRender();
    lbl.destroy();
    // Show 1:1 center-cropped polaroid on popup
    const img=document.getElementById('ov-polaroid-img');
    const wrap=document.getElementById('ov-polaroid');
    if(img&&wrap){img.src=_polaroidDataURL;wrap.style.display='block';}
  }catch(e){}
}
function gameOver(){
  dead=true;sfxGameOver();
  _takePolaroid();
  _loadHS();
  const isNewHS=score>_highScore;
  if(isNewHS){ _highScore=score; _saveHS(score); }
  document.getElementById('fs').textContent=score.toLocaleString();
  const sub=document.getElementById('ov-sub');
  if(sub) sub.textContent=isNewHS?'🎉 New High Score!':'Final Score';
  const title=document.getElementById('ov-title');
  if(title) title.textContent=isNewHS?'Amazing!':score<_highScore*0.7?'Keep Trying!':['Well Played!','So Close!','Nice Score!'][Math.floor(Math.random()*3)];
  const hint=document.getElementById('ov-hint');
  if(hint) hint.innerHTML=_buildOvHint(isNewHS);
  document.getElementById('ov').classList.add('show');
  updateGpGuide();
}

// ── SHARE ────────────────────────────────────────────────────────────
function shareScore(){
  const url='https://DancingPhoenix88.github.io/plushie-drop/';
  const text=`I scored ${score.toLocaleString()} in BB Tower 🧸! Can you beat me?\n${url}`;
  const polaroidImg=document.getElementById('ov-polaroid-img');
  const doShare=(blob)=>{
    if(blob&&navigator.canShare&&navigator.canShare({files:[new File([blob],'score.png',{type:'image/png'})]})){
      navigator.share({title:'BB Tower',text,files:[new File([blob],'score.png',{type:'image/png'})]}).catch(()=>{});
    } else if(navigator.share){
      navigator.share({title:'BB Tower',text}).catch(()=>{});
    } else {
      navigator.clipboard.writeText(text).then(()=>alert('Copied to clipboard!')).catch(()=>prompt('Share this:',text));
    }
  };
  if(_shareDataURL){
    fetch(_shareDataURL).then(r=>r.blob()).then(doShare).catch(()=>doShare(null));
  }else{
    try{cv.toBlob(blob=>doShare(blob),'image/png');}catch(e){doShare(null);}
  }
}
function restart(){
  dead=false;cooling=false;wipeOutActive=false;trapDoorOpen=false;trapDoorScale=0;trapDoorDir=0;gameLevel=1;scoreMultiplier=1;rebuildPtsTable();
  const glEl=document.getElementById('gl-ls');if(glEl)glEl.textContent=1;
  popups.forEach(p=>{if(p.pixiText)p.pixiText.destroy();});
  celebrations.forEach(c=>{if(c.pixiText)c.pixiText.destroy();if(c.pixiSub)c.pixiSub.destroy();});
  clearScheduled();
  clearPlushies();
  parts=[];mergeQ=[];popups=[];confetti=[];celebrations=[];sparkles=[];danger={};_gyroMultiDangerSince=null;firstMerged=new Set();score=0;updUI();
  document.getElementById('ov').classList.remove('show');
  updateGpGuide();
  _polaroidDataURL=null;_shareDataURL=null;
  const polaroid=document.getElementById('ov-polaroid');if(polaroid)polaroid.style.display='none';
  cur=rnd();nxt=rnd();updNext();clawState='idle';clawY=DROPY;clawLvl=cur;resetClawForNewRound();
  triggerClear();resumeLoop();
  // Restart BGM with fade in
  if(bgmOn&&!muted){const el=_bgmEl();if(el)el.currentTime=0;bgmRunning=false;startBGM();}
}

function burst(x,y,color){for(let i=0;i<11;i++){const a=Math.PI*2*i/11+Math.random()*.5,spd=2+Math.random()*4;parts.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:3+Math.random()*4,color,life:1});}}
function tickReflect(now){
  if(!isMobile){ _reflectEnabled=true; return; }
  if(_reflectState==='off_permanent'){ _reflectEnabled=false; return; }
  if(_rfpsPrev>0){ _rfpsD[_rfpsI%60]=now-_rfpsPrev; _rfpsI++; }
  _rfpsPrev=now;
  const n=Math.min(_rfpsI,60); let avg=0; for(let i=0;i<n;i++)avg+=_rfpsD[i];
  const fps=n>0?1000/(avg/n):60;
  if(_reflectWindowStart===0)_reflectWindowStart=now;
  const elapsed=now-_reflectWindowStart;
  if(_reflectState==='probing'){
    if(fps<REFLECT_FPS_ON)_reflectWindowStart=now;
    else if(elapsed>=REFLECT_WINDOW_MS){_reflectState='on';_reflectEnabled=true;_reflectWindowStart=now;}
  } else if(_reflectState==='on'){
    _reflectEnabled=true;
    if(fps<REFLECT_FPS_OFF){if(elapsed>=REFLECT_WINDOW_MS){_reflectState='off_permanent';_reflectEnabled=false;}}
    else _reflectWindowStart=now;
  }
}

// Capture source strips to RenderTextures (called in render, every 3rd frame)
function captureReflect(){
  if(!_reflectEnabled||!_reflectLtRT) return;
  if(++_reflectFrame%3!==0) return;
  const rs=REFLECT_SCALE, sw=SOURCE_W, rv=REFLECT_VIS;
  // Hide reflection sprites to avoid feedback loop
  _reflectSprLt.visible=_reflectSprRt.visible=false;
  // Left strip: game x∈[rv, rv+sw] → RT x∈[0, sw*rs]
  const ltM=new PIXI.Matrix(rs,0,0,rs,-rv*rs,0);
  app.renderer.render({container:stage,target:_reflectLtRT,transform:ltM,clear:true});
  // Right strip: game x∈[W-rv-sw, W-rv] → RT x∈[0, sw*rs]
  const rtM=new PIXI.Matrix(rs,0,0,rs,-(W-rv-sw)*rs,0);
  app.renderer.render({container:stage,target:_reflectRtRT,transform:rtM,clear:true});
  _reflectSprLt.visible=_reflectSprRt.visible=_reflectEnabled;
}

function tickTrapDoor(){
  const target=trapDoorOpen?1:0;
  if(trapDoorScale===target) return;
  const prev=trapDoorScale;
  trapDoorScale=target>prev?Math.min(1,prev+TRAP_ANIM_SPEED):Math.max(0,prev-TRAP_ANIM_SPEED);
  // Door just became FULLY OPEN → scatter forces (SAT now disabled via trapDoorScale>=1)
  if(prev<1&&trapDoorScale>=1&&wipeOutActive){
    for(const p of plushies){p.av=(Math.random()-.5)*AV_MAX*10;p.vx+=(Math.random()-.5)*3;}
  }
  // Door just became FULLY CLOSED → end wipeout, level up
  if(prev>0&&trapDoorScale<=0&&wipeOutActive) _onTrapDoorClosed();
}

function _onTrapDoorClosed(){
  wipeOutActive=false;
  gameLevel++;scoreMultiplier=Math.pow(2,gameLevel-1);rebuildPtsTable();
  const glEl=document.getElementById('gl-ls');if(glEl)glEl.textContent=gameLevel;
  firstMerged=new Set();updateEvoUnlocks();
  // plushies already destroyed at CLOSE_F before door started closing
  scheduleAt(30,()=>{ // ~500ms — LEVEL card + SFX
    celebrations.push({x:W/2,y:H/2-60,name:'LEVEL '+gameLevel,level:0,pts:0,color:'#f0c500',stroke:'#8a6000',life:1,scale:0.1,phase:'in',isLevelUp:true});
    sfxLevelUp();
  });
}
function tickParts(){parts=parts.filter(p=>p.life>0);parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.18;p.life-=.044;p.r*=.93;});}
function tickPopups(){
  popups.forEach(p=>{p.y-=(p.big?0.4:1.2);p.life-=0.022;if(!p.pixiText&&p.life>0){const sz=p.big?Math.round(68*FS):Math.round(36*FS);p.pixiText=new PIXI.Text({text:p.text,style:{fontFamily:"'Cherry Bomb One','Segoe UI',system-ui,sans-serif",fontSize:sz,fontWeight:'700',fill:p.color,stroke:{color:'#000000',width:3}}});p.pixiText.label='score_popup';p.pixiText.anchor.set(0.5,0.5);layerFx.addChild(p.pixiText);}if(p.pixiText){const sz=p.big?Math.round((48+p.life*20)*FS):Math.round((22+p.life*14)*FS);p.pixiText.style.fontSize=sz;p.pixiText.x=p.x;p.pixiText.y=p.y;p.pixiText.alpha=Math.min(p.life,1)*0.92;}});
  popups.filter(p=>p.life<=0).forEach(p=>{if(p.pixiText)p.pixiText.destroy();});
  popups=popups.filter(p=>p.life>0);
}

const CONFETTI_COLORS=['#ff5a5a','#ffb830','#ffe234','#4ddc7a','#38c5f5','#c84dff','#ff6eb4','#ffffff'];
function spawnCelebration(x,y,lvl,actualPts){
  if(showClaw)triggerGlare();
  playCharacterName(lvl);
  celebrations.push({x:W/2,y:H/2-30,name:PD[lvl].name,level:lvl,pts:actualPts??PTS[lvl],color:PD[lvl].body,stroke:PD[lvl].stroke,life:1,scale:0.1,phase:'in'});
  setTimeout(()=>{for(let i=0;i<60;i++){const fromTop=i<20;const cx=fromTop?Math.random()*W:x,cy=fromTop?-10:y;const a=fromTop?(Math.PI/2+Math.random()*.8-.4):(Math.random()*Math.PI*2);const spd=fromTop?(3+Math.random()*5):(4+Math.random()*7);confetti.push({x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:3+Math.random()*4,rot:Math.random()*Math.PI*2,rv:(Math.random()-.5)*0.25,w:4+Math.random()*5,h:6+Math.random()*8,color:CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)],life:1,shape:Math.random()<0.6?'rect':'circle'});}},80);
}
function tickSparkles(){sparkles=sparkles.filter(s=>s.life>0);sparkles.forEach(s=>{if(s.delay>0){s.delay-=16;return;}s.phase+=0.12;s.r=s.baseR*(0.7+0.3*Math.sin(s.phase));s.life-=0.018;});}
function tickConfetti(){confetti=confetti.filter(p=>p.life>0);confetti.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.22;p.vx*=0.99;p.rot+=p.rv;p.life-=0.012;});}
function tickCelebrations(){
  celebrations.forEach(c=>{
    if(c.phase==='in'){c.scale=Math.min(1,c.scale+0.12);c.y-=0.4;if(c.scale>=1){c.phase='hold';c.holdTimer=60;}}
    else if(c.phase==='hold'){c.holdTimer--;c.y-=0.4;if(c.holdTimer<=0)c.phase='out';}
    else{c.life-=0.022;c.y-=0.8;}
    if(!c.pixiText&&c.life>0){let sub='';if(c.isWipeOut){sub=c.pts>0?'+'+c.pts.toLocaleString()+' bonus pts':'';}else if(c.isLevelUp){sub='×'+Math.pow(2,gameLevel-1)+' points multiplier';}else{sub=`Rank ${c.level}  ·  +${c.pts.toLocaleString()} pts`;}c.pixiText=new PIXI.Text({text:c.name,style:{fontFamily:"'Cherry Bomb One','Segoe UI',system-ui,sans-serif",fontSize:Math.round(52*FS),fontWeight:'400',fill:c.color,stroke:{color:c.stroke,width:8}}});c.pixiText.label='celebration_'+c.name;c.pixiText.anchor.set(0.5,0.5);layerFx.addChild(c.pixiText);if(sub){c.pixiSub=new PIXI.Text({text:sub,style:{fontFamily:"'Cherry Bomb One','Segoe UI',system-ui,sans-serif",fontSize:Math.round(16*FS),fontWeight:'400',fill:'#ffffff',stroke:{color:'#000000',width:3}}});c.pixiSub.label='celebration_sub';c.pixiSub.anchor.set(0.5,0.5);layerFx.addChild(c.pixiSub);}}
    if(c.pixiText){const alpha=c.phase==='out'?c.life*0.95:0.97;c.pixiText.x=c.x;c.pixiText.y=c.y;c.pixiText.scale.set(c.scale);c.pixiText.alpha=alpha;if(c.pixiSub){c.pixiSub.x=c.x;c.pixiSub.y=c.y+34*c.scale;c.pixiSub.scale.set(c.scale);c.pixiSub.alpha=alpha;}}
  });
  celebrations.forEach(c=>{if(c.life<=0){if(c.pixiText){c.pixiText.destroy();c.pixiText=null;}if(c.pixiSub){c.pixiSub.destroy();c.pixiSub=null;}}});
  celebrations=celebrations.filter(c=>c.life>0);
}

function processKeys(){if(dead)return;const hasL=keysDown.has('ArrowLeft'),hasR=keysDown.has('ArrowRight');if(!hasL&&!hasR)return;const speed=keysDown.has('Shift')?6.5:2.6;const mn=WALL+PD[cur].r+1,mx2=W-WALL-PD[cur].r-1,range=mx2-mn;if(range<=0)return;const delta=hasL?-speed:speed;mx=((mx+delta-mn)%range+range)%range+mn;}

// ── GAMEPAD ───────────────────────────────────────────────────────────
const GP_DEADZONE=0.2;
let _gpBtnPrev={};
function processGamepad(){
  const pads=navigator.getGamepads?navigator.getGamepads():[];let gp=null;
  for(const p of pads){if(p){gp=p;break;}}if(!gp)return;
  const pressed=i=>gp.buttons[i]?.pressed&&!_gpBtnPrev[i];
  if(dead){
    if(pressed(0)){setInputSource('gamepad');restart();}
    if(pressed(3)){setInputSource('gamepad');shareScore();}
    for(let i=0;i<gp.buttons.length;i++)_gpBtnPrev[i]=gp.buttons[i]?.pressed;return;
  }
  // fs-prompt: A = dismiss
  if(document.getElementById('fs-prompt').classList.contains('show')){
    if(pressed(0)){setInputSource('gamepad');dismissFsPrompt();}
    for(let i=0;i<gp.buttons.length;i++)_gpBtnPrev[i]=gp.buttons[i]?.pressed;return;
  }
  const lt=gp.buttons[6]?.value??0, rt=gp.buttons[7]?.value??0;
  // LT/RT analog [0,1]: sprint speed (base 2, max 10) + BGM volume adjustment
  const triggerVal=Math.max(lt,rt);const speed=2+triggerVal*8;
  if(lt>0.02||rt>0.02){const delta=(rt-lt)*0.006;const nv=Math.max(0,Math.min(1,_bgmVolume+delta));if(Math.abs(delta)>0.0001){setBGMVolume(nv);const sl=document.getElementById('bgm-vol');if(sl)sl.value=nv;}}
  const ax=gp.axes[0]??0;if(Math.abs(ax)>GP_DEADZONE){setInputSource('gamepad');const mn=WALL+PD[cur].r+1,mx2=W-WALL-PD[cur].r-1,range=mx2-mn;if(range>0)mx=Math.max(mn,Math.min(mx2,mx+ax*speed));}
  if(pressed(0)){setInputSource('gamepad');if(!wipeOutActive&&!dead)(function tryDrop(){if(wipeOutActive||dead)return;if(cooling)requestAnimationFrame(tryDrop);else drop();})();}
  if(pressed(1)){setInputSource('gamepad');toggleHelp();}
  if(pressed(2)){setInputSource('gamepad');toggleBGMAll(!bgmOn);}
  if(pressed(3)){setInputSource('gamepad');cycleAp();}
  // D-pad left/right (buttons 14/15)
  const mn=WALL+PD[cur].r+1,mx2=W-WALL-PD[cur].r-1;
  if(gp.buttons[14]?.pressed){setInputSource('gamepad');if(mx2-mn>0)mx=Math.max(mn,Math.min(mx2,mx-speed));}
  if(gp.buttons[15]?.pressed){setInputSource('gamepad');if(mx2-mn>0)mx=Math.max(mn,Math.min(mx2,mx+speed));}
  for(let i=0;i<gp.buttons.length;i++)_gpBtnPrev[i]=gp.buttons[i]?.pressed;
}
let inputSource='keyboard';
function setInputSource(src){if(inputSource!==src){inputSource=src;}}
let _gpConnected=false;
function gpConnected(){return _gpConnected||IS_GP_DEBUG;}
function updateGpVisuals(){
  const v=gpConnected();
  const gpTab=document.getElementById('help-tab-gp');
  if(gpTab) gpTab.style.display=v?'':'none';
  document.querySelectorAll('.gp-badge').forEach(el=>{if(el.closest('#help-content-gp'))return;el.style.display=v?'inline-block':'none';});
  document.querySelectorAll('.gp-joy-hint').forEach(el=>el.style.display=v?'flex':'none');
  if(v && document.getElementById('help-popup').classList.contains('show')) showHelpTab('gp');
  updateGpGuide();
}
// Build a guide item: colored circle + label
function _gpGuideItem(letter,bg,label){
  return `<span class="gpg-item"><span class="gpg-btn" style="background:${bg}">${letter}</span><span class="gpg-lbl">${label}</span></span>`;
}
function _gpRectBtn(label,bg){
  return `<span class="gpg-btn" style="background:${bg};border-radius:4px;min-width:20px">${label}</span>`;
}
const _gpSep='<span class="gpg-sep">·</span>';
function updateKbGuide(){
  const kb=document.getElementById('kb-guide');
  if(!kb) return;
  const anyPopup=document.getElementById('help-popup').classList.contains('show')||document.getElementById('fs-prompt').classList.contains('show')||document.getElementById('ov').classList.contains('show');
  kb.style.display=(!gpConnected()&&!anyPopup&&!dead)?'flex':'none';
}
function updateGpGuide(){
  updateKbGuide();
  const guide=document.getElementById('gp-guide');
  if(!guide) return;
  if(!gpConnected()){guide.style.display='none';return;}
  const helpOpen=document.getElementById('help-popup').classList.contains('show');
  const fsOpen=document.getElementById('fs-prompt').classList.contains('show');
  const ovOpen=document.getElementById('ov').classList.contains('show');
  let html='';
  let align='centered';
  if(helpOpen){
    html=[_gpGuideItem('B','#b02020','Close'),_gpSep,`<span class="gpg-item">${_gpRectBtn('LT','#607080')}<span class="gpg-lbl">/</span>${_gpRectBtn('RT','#607080')}<span class="gpg-lbl">Vol</span></span>`].join('');
  } else if(ovOpen){
    html=[_gpGuideItem('A','#2a7d2a','Restart'),_gpSep,_gpGuideItem('Y','#b8980a','Share')].join('');
  } else if(fsOpen){
    html=_gpGuideItem('A','#2a7d2a','Got it');
  } else {
    align='right-aligned';
    html=[`<span class="gpg-item">${_gpRectBtn('LT','#607080')}<span class="gpg-lbl">+</span><span class="gpg-btn" style="background:#607080">LS</span><span class="gpg-lbl">Sprint</span></span>`,_gpSep,_gpGuideItem('B','#b02020','Help')].join('');
  }
  guide.className=align;
  if(html){guide.innerHTML=html;guide.style.display='flex';guide.style.visibility='visible';}
  else{guide.style.display='none';}
}
function setGpConnected(v){_gpConnected=v;updateGpVisuals();}
window.addEventListener('gamepadconnected',()=>{setInputSource('gamepad');setGpConnected(true);});
window.addEventListener('gamepaddisconnected',()=>{inputSource='keyboard';setGpConnected(false);});
window.addEventListener('mousemove',()=>setInputSource('keyboard'),{passive:true});
window.addEventListener('keydown',()=>setInputSource('keyboard'),{passive:true,capture:true});
window.addEventListener('touchstart',()=>setInputSource('touch'),{passive:true,capture:true});

function loop(){
  tickScheduled();
  tickReflect(performance.now());
  processGamepad();
  tickTrapDoor();
  processKeys();
  if(!dead){step();detectMerges();processMerges();}
  updateClaw();
  if(showJoy){const hasL=keysDown.has('ArrowLeft'),hasR=keysDown.has('ArrowRight');if(hasL){updateJoyDir('left');_joyNoMovFrames=0;}else if(hasR){updateJoyDir('right');_joyNoMovFrames=0;}else{const dMx=(_joyLastMx!==null)?mx-_joyLastMx:0;if(Math.abs(dMx)>0.5){_joyNoMovFrames=0;updateJoyDir(dMx<0?'left':'right');}else{_joyNoMovFrames++;if(_joyNoMovFrames>=3)updateJoyDir('none');}}_joyLastMx=mx;}
  if(wipeOutActive){plushies.filter(p=>p.y-p.r>=H+80).forEach(_destroyBall);plushies=plushies.filter(p=>p.y-p.r<H+80);}
  tickParts();tickPopups();tickConfetti();tickSparkles();tickCelebrations();
  if(!dead)checkDanger();if(showClaw)tickGlare();if(typeof tickShakeCooldown==='function')tickShakeCooldown();render();
  if(!dead&&!stepMode)requestAnimationFrame(loop);
}
function resumeLoop(){requestAnimationFrame(loop);}

function predictLanding(x,r){let y=H-WALL-r;for(const p of plushies){const dx=x-p.x,md=r+p.r;if(Math.abs(dx)<md){const dy=Math.sqrt(md*md-dx*dx),cy=p.y-dy;if(cy>DROPY+r&&cy<y)y=cy;}}return y;}

function _dashLineH(g,x0,x1,y,dash,gap){for(let x=x0;x<x1;x+=dash+gap){g.moveTo(x,y);g.lineTo(Math.min(x+dash,x1),y);}}
function _dashLineV(g,x,y0,y1,dash,gap){for(let y=y0;y<y1;y+=dash+gap){g.moveTo(x,y);g.lineTo(x,Math.min(y+dash,y1));}}
function _dashCircle(g,cx,cy,r,dash,gap){const dashA=dash/r,gapA=gap/r;for(let a=0;a<2*Math.PI;a+=dashA+gapA){g.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a));const a2=Math.min(a+dashA,2*Math.PI);const steps=Math.max(2,Math.ceil(dashA/0.1));for(let k=1;k<=steps;k++){const aa=a+(a2-a)*k/steps;g.lineTo(cx+r*Math.cos(aa),cy+r*Math.sin(aa));}}}
function _star4(g,x,y,r){const ir=r*0.3,pts=[];for(let k=0;k<8;k++){const a=Math.PI/4*k,cr=k%2===0?r:ir;pts.push(x+cr*Math.cos(a),y+cr*Math.sin(a));}g.poly(pts);} // caller applies .fill()
function _setHeldSprite(x,y,lvl,alpha){if(!plushieTextures[lvl]){clawHeldSpr.visible=false;return;}if(clawHeldSpr.texture!==plushieTextures[lvl]){clawHeldSpr.texture=plushieTextures[lvl];clawHeldSpr.scale.set(PD[lvl].r/imgR(lvl));}clawHeldSpr.x=x;clawHeldSpr.y=y;clawHeldSpr.alpha=alpha;clawHeldSpr.visible=true;}

// TD updated to match v25 values
window.TD={x:-30,w:690,h:38,bottomY:H,capL:90,capR:90};
function render(){
  captureReflect(); // capture source strips to RTs every 3rd frame (before clearing)
  // Update reflection sprite visibility
  if(_reflectSprLt) _reflectSprLt.visible=_reflectSprRt.visible=_reflectEnabled;
  gfxUI.clear(); gfxClaw.clear(); gfxFx.clear();

  // ── danger line — blinks when any plushie's top crosses DY (level 1+) ──
  const _now=Date.now();
  const blink=plushies.some(p=>p.landed&&(p.y-PD[p.level].r<DY+100))&&(_now%600)<300;
  const dzPad=W*0.1;
  _dashLineH(gfxUI,dzPad,W-dzPad,DY,7,5);
  gfxUI.stroke({width:blink?2.5:1.5,color:blink?0xDC1E1E:0xD23737,alpha:blink?0.95:0.55});
  _dangerText.style.fill=blink?'#DC1E1E':'#D23737';
  _dangerText.style.fontWeight=blink?'bold':'normal';
  _dangerText.alpha=blink?0.95:0.65;

  // ── tap hint ───────────────────────────────────────────────────────
  if(tapHint&&!dead&&!wipeOutActive){
    _tapText.visible=true; _tapText.alpha=(0.4+0.6*Math.abs(Math.sin(Date.now()/700)))*0.75;
  } else { _tapText.visible=false; }

  // ── claw ───────────────────────────────────────────────────────────
  clawSprBack.visible=false; clawSprFront.visible=false; clawHeldSpr.visible=false;
  if(!dead&&!showClaw){
    const gx=clamp(mx,cur),gr=PD[cur].r,gy=predictLanding(gx,gr);
    _dashLineV(gfxClaw,gx,DROPY+gr,gy-gr,3,5);
    gfxClaw.stroke({width:1,color:0x8C5A28,alpha:0.18});
    if(!cooling){ _dashCircle(gfxClaw,gx,gy,gr,5,4); gfxClaw.stroke({width:2,color:cssHex(PD[cur].stroke),alpha:0.82}); }
    _setHeldSprite(gx,DROPY,cur,0.6);
  }
  if(!dead&&showClaw){
    const lvl=(clawState==='opening')?clawLvl:cur;
    const gr=PD[lvl].r,cx=clawX,cy=DROPY,cw=Math.max(70,gr*3.0),imgY=cy-cw*0.78;
    if(clawState==='idle'){
      const gy=predictLanding(cx,gr);
      _dashLineV(gfxClaw,cx,cy+gr,gy-gr,3,5); gfxClaw.stroke({width:1,color:0x8C5A28,alpha:0.18});
      _dashCircle(gfxClaw,cx,gy,gr,5,4);       gfxClaw.stroke({width:2,color:cssHex(PD[cur].stroke),alpha:0.82});
    }
    gfxClaw.moveTo(cx,0).lineTo(cx,imgY+cw*0.06);
    gfxClaw.stroke({width:2,color:0xA09080,alpha:1});
    if(_clawTexBack){clawSprBack.texture=_clawTexBack;clawSprBack.x=cx-cw/2;clawSprBack.y=imgY;clawSprBack.width=cw;clawSprBack.height=cw;clawSprBack.visible=true;}
    if(clawState==='idle'||(clawState==='opening'&&clawOpenTimer>CLAW_OPEN_FRAMES-2)) _setHeldSprite(cx,cy,lvl,1.0);
    const frontTex=(clawState==='opening'&&_clawTexOpen)?_clawTexOpen:_clawTexFront;
    if(frontTex){clawSprFront.texture=frontTex;clawSprFront.x=cx-cw/2;clawSprFront.y=imgY;clawSprFront.width=cw;clawSprFront.height=cw;clawSprFront.visible=true;}
  }

  // ── plushies (sortableChildren+zIndex handles draw order — no removeChildren needed) ──
  for(const p of plushies){
    if(!p.sprite&&plushieTextures[p.level]){
      p.sprite=new PIXI.Sprite(plushieTextures[p.level]);
      p.sprite.zIndex=11-p.level;
      p.sprite.label=PD[p.level].name;
      p.sprite.anchor.set(0.5,0.5); p.sprite.scale.set(PD[p.level].r/imgR(p.level));
      const sh=makeShadow();if(sh)p.sprite.filters=[sh];
      layerPlushie.addChild(p.sprite);
    }
    if(p.sprite){
      p.sprite.x=p.x; p.sprite.y=p.y; p.sprite.rotation=p.angle;
      // Tint by danger level
      const _lv=p._dangerLevel||0;
      if(_lv===3){
        // Fast pulse red — 0.15s period
        const pulse=0.5+0.5*Math.sin(_now/24);
        const gb=Math.round(255*(1-pulse));
        p.sprite.tint=(0xFF<<16)|(gb<<8)|gb;
      } else if(_lv===2){
        // Slow pulse red — 0.5s period
        const pulse=0.3+0.3*Math.sin(_now/80);
        const gb=Math.round(255*(1-pulse));
        p.sprite.tint=(0xFF<<16)|(gb<<8)|gb;
      } else {
        p.sprite.tint=0xFFFFFF;
      }
      if(solidMode){
        p.sprite.visible=false;
        const n=getSides(p.level),r=PD[p.level].physR??PD[p.level].r,pts=[];
        for(let k=0;k<n;k++){const a=p.angle+2*Math.PI*k/n;pts.push(p.x+r*Math.cos(a),p.y+r*Math.sin(a));}
        gfxFx.poly(pts).fill({color:cssHex(PD[p.level].body)}).stroke({width:2,color:cssHex(PD[p.level].stroke)});
      } else { p.sprite.visible=true; if(!p.sprite.parent)layerPlushie.addChild(p.sprite); }
    }
  }

  // ── particles ────────────────────────────────────────────────────────
  for(const p of parts) gfxFx.circle(p.x,p.y,p.r).fill({color:cssHex(p.color),alpha:p.life*0.85});

  // ── trap door ────────────────────────────────────────────────────────
  if(trapDoorSpr.texture&&trapDoorSpr.texture!==PIXI.Texture.EMPTY){
    if(trapDoorScale<=0.001){ trapDoorSpr.visible=false; }
    else { const{x,w,h,bottomY}=window.TD,sh=h*trapDoorScale; trapDoorSpr.x=x;trapDoorSpr.y=bottomY-sh;trapDoorSpr.width=w;trapDoorSpr.height=sh;trapDoorSpr.visible=true; }
  }

  // ── glare flash ─────────────────────────────────────────────────────
  if(showClaw&&_glareT>=0){
    const cx2=(_glareT*1.6-0.3)*W,angle=-Math.PI/7,cos=Math.cos(angle),sin=Math.sin(angle),hh=H*1.5;
    const hw1=W*0.11; // reduced from 0.20
    gfxFx.poly([[-hw1,-hh],[hw1,-hh],[hw1,hh],[-hw1,hh]].map(([px,py])=>[cx2+px*cos-py*sin,H/2+px*sin+py*cos]).flat())
         .fill({color:0xFFFFFF,alpha:0.40});
    const hw2=W*0.05,off2=W*0.28; // reduced from 0.09
    gfxFx.poly([[-hw2+off2,-hh],[hw2+off2,-hh],[hw2+off2,hh],[-hw2+off2,hh]].map(([px,py])=>[cx2+px*cos-py*sin,H/2+px*sin+py*cos]).flat())
         .fill({color:0xFFFFFF,alpha:0.25});
  }

  // ── confetti ─────────────────────────────────────────────────────────
  for(const p of confetti){
    if(p.shape==='rect'){
      const cos=Math.cos(p.rot),sin=Math.sin(p.rot),hw=p.w/2,hh=p.h/2;
      gfxFx.poly([[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([px,py])=>[p.x+px*cos-py*sin,p.y+px*sin+py*cos]).flat())
           .fill({color:cssHex(p.color),alpha:p.life*0.9});
    } else { gfxFx.circle(p.x,p.y,p.r).fill({color:cssHex(p.color),alpha:p.life*0.9}); }
  }

  // ── sparkles ─────────────────────────────────────────────────────────
  for(const s of sparkles){
    if(s.delay>0) continue;
    _star4(gfxFx,s.x,s.y,s.r);
    gfxFx.fill({color:0xFFFFFF,alpha:Math.min(s.life,1)*0.92});
  }

  // ── D: collider circles — dashed ring in character color, red tint if spinning ──
  if(dbg){
    for(const p of plushies){
      const sp=Math.abs(p.av)>0.01;
      const bc=cssHex(PD[p.level].body);
      // dashed collider ring using character body color, red when spinning
      _dashCircle(gfxFx,p.x,p.y,p.r,4,3);
      gfxFx.stroke({width:2.5,color:sp?0xFF3232:bc,alpha:0.88});
      // center dot: green=still, red=spinning
      gfxFx.circle(p.x,p.y,3.5).fill({color:sp?0xFF2020:0x20CC20});
    }
  }
  // ── C: polygon colliders — character colors, thick stroke, vertex dots, edge count ──
  if(dbgPoly){
    for(const p of plushies){
      const verts=getVerts(p);
      const bc=cssHex(PD[p.level].body), sc=cssHex(PD[p.level].stroke);
      // polygon outline
      gfxFx.poly(verts.flat()).stroke({width:3,color:sc,alpha:0.92});
      // vertex circles
      for(const [vx,vy] of verts)
        gfxFx.circle(vx,vy,3).fill({color:bc});
      // edge count label — create once, update text every frame (sides can change with [/])
      if(!p._polyText){
        p._polyText=new PIXI.Text({text:'',style:{fontFamily:'monospace',fontSize:Math.max(12,Math.round(p.r*0.3)),fontWeight:'bold',fill:'rgba(0,0,0,0.7)'}});
        p._polyText.anchor.set(0.5,0.5);
        layerFx.addChild(p._polyText);
      }
      p._polyText.text=getSides(p.level)+'-gon';
      p._polyText.x=p.x; p._polyText.y=p.y+4; p._polyText.visible=true;
    }
  } else {
    for(const p of plushies) if(p._polyText) p._polyText.visible=false;
  }
  // ── H: solid n-gon with character name label ─────────────────────────
  if(solidMode){
    for(const p of plushies){
      if(p.sprite&&!p.sprite.visible){
        // name label drawn as PIXI.Text — create once, reuse
        if(!p._nameText){
          p._nameText=new PIXI.Text({text:PD[p.level].name,style:{fontFamily:'monospace',fontSize:Math.max(8,Math.round(p.r*.28)),fontWeight:'bold',fill:'rgba(0,0,0,0.65)'}});
          p._nameText.anchor.set(0.5,0.5);
          layerFx.addChild(p._nameText);
        }
        p._nameText.x=p.x; p._nameText.y=p.y; p._nameText.visible=true;
      } else if(p._nameText){ p._nameText.visible=false; }
    }
  } else {
    // hide all name texts when solidMode off
    for(const p of plushies) if(p._nameText) p._nameText.visible=false;
  }

  app.renderer.render(stage);
}

const imgSprites=new Array(12);
function imgR(lvl){return lvl<=8?65:90;}
const _extraImgs={back:null,front:null,open:null,floor:null,coverTopLt:null,coverBotLt:null};
function loadSprites(cb){
  const total=11+6; let done=0;
  const tick=()=>{ if(++done===total) _loadPixiAssets(cb); };
  for(let lvl=1;lvl<=11;lvl++){
    const img=new Image(); img.onload=img.onerror=tick;
    img.src=`Sprites/characters/level_${lvl}.png`; imgSprites[lvl]=img;
  }
  ['back','front','open'].forEach(k=>{
    const img=new Image(); img.onload=img.onerror=tick;
    img.src=`Sprites/claw/claw_${k}.png`; _extraImgs[k]=img;
  });
  const floor=new Image(); floor.onload=floor.onerror=tick;
  floor.src='Sprites/machine/claw_machine_floor_tile.png'; _extraImgs.floor=floor;
  // Cover patches for reflection corners
  const ct=new Image(); ct.onload=ct.onerror=tick;
  ct.src='Sprites/machine/claw_machine_top_left_reflection_cover.png'; _extraImgs.coverTopLt=ct;
  const cb2=new Image(); cb2.onload=cb2.onerror=tick;
  cb2.src='Sprites/machine/claw_machine_bottom_left_reflection_cover.png'; _extraImgs.coverBotLt=cb2;
}
function _loadPixiAssets(cb){
  // All textures from already-loaded Image objects — no PIXI.Assets network calls
  for(let i=1;i<=11;i++){
    const img=imgSprites[i];
    if(img&&img.naturalWidth) plushieTextures[i]=PIXI.Texture.from(img);
  }
  const mkTex=img=>img&&img.naturalWidth?PIXI.Texture.from(img):null;
  _clawTexBack =mkTex(_extraImgs.back);
  _clawTexFront=mkTex(_extraImgs.front);
  _clawTexOpen =mkTex(_extraImgs.open);
  if(_clawTexBack) clawSprBack.texture=_clawTexBack;
  if(_clawTexFront)clawSprFront.texture=_clawTexFront;
  const td=mkTex(_extraImgs.floor);
  if(td){
    const ns=new PIXI.NineSliceSprite({texture:td,leftWidth:90,rightWidth:90,topHeight:0,bottomHeight:0});
    ns.label='trap_door'; ns.visible=false;
    layerBg.removeChild(trapDoorSpr); trapDoorSpr.destroy();
    trapDoorSpr=ns; layerBg.addChild(trapDoorSpr);
  }
  // Cover patches (reflection corner frames)
  const mkCover=(spr,img,flipX)=>{
    if(!img||!img.naturalWidth) return;
    spr.texture=PIXI.Texture.from(img);
    spr.scale.x=flipX?-1:1; // x position set separately per cover
  };
  mkCover(_coverTopLt, _extraImgs.coverTopLt, false);
  mkCover(_coverTopRt, _extraImgs.coverTopLt, true);   // right = left flipped
  mkCover(_coverBotLt, _extraImgs.coverBotLt, false);
  mkCover(_coverBotRt, _extraImgs.coverBotLt, true);
  // Position bottom covers at bottom of canvas
  if(_extraImgs.coverBotLt&&_extraImgs.coverBotLt.naturalHeight){
    _coverBotLt.y=H-_extraImgs.coverBotLt.naturalHeight;
    _coverBotRt.y=H-_extraImgs.coverBotLt.naturalHeight;
    _coverBotRt.x=W; // scaleX=-1 → extends leftward from W to W-width ✓
  }
  _coverTopRt.x=W; // same logic for top-right cover
  cb();
}
function drawAtFit(c,cW,cH,lvl,alpha=1){const img=imgSprites[lvl];if(!img||!img.naturalWidth)return;const sc=Math.min(cW/img.naturalWidth,cH/img.naturalHeight);const w=img.naturalWidth*sc,h=img.naturalHeight*sc;c.save();c.globalAlpha=alpha;c.drawImage(img,(cW-w)/2,(cH-h)/2,w,h);c.restore();}

function updateClaw(){if(dead)return;if(clawState==='idle'){clawX=clamp(mx,cur);clawY=DROPY;}else if(clawState==='opening'){clawOpenTimer--;if(clawOpenTimer===CLAW_OPEN_FRAMES-2){sfxDrop();if(bgmOn&&!bgmRunning)startBGM();const b=new Ball(clawDropX,DROPY,clawLvl);b.av=(Math.random()-.5)*AV_MAX*0.3;plushies.push(b);cur=nxt;nxt=rnd();updNext();}if(clawOpenTimer<=0){clawState='idle';cooling=false;}}}

// (canvas draw helpers removed — not needed in PixiJS port)

// drawSolidNgon: draws filled n-gon centered at current ctx origin (already translated+rotated)
function drawSolidNgon(c,lvl){
  const n=getSides(lvl), r=PD[lvl].physR??PD[lvl].r;
  c.beginPath();
  for(let k=0;k<n;k++){
    const a=2*Math.PI*k/n;
    k===0?c.moveTo(r*Math.cos(a),r*Math.sin(a)):c.lineTo(r*Math.cos(a),r*Math.sin(a));
  }
  c.closePath();
  c.fillStyle=PD[lvl].body; c.fill();
  c.strokeStyle=PD[lvl].stroke; c.lineWidth=2; c.stroke();
  // name label
  c.fillStyle='rgba(0,0,0,0.55)'; c.textAlign='center';
  c.font=`bold ${Math.max(8,Math.round(r*.28))}px sans-serif`;
  c.fillText(PD[lvl].name,0,4);
}


// ── SHARED DRAW HELPERS ───────────────────────────────────────────────
function wEyes(c,r,ex,ey,er,col='#111'){
  for(const s of[-1,1]){
    c.beginPath();c.arc(s*ex,ey,er,0,Math.PI*2);c.fillStyle=col;c.fill();
    c.beginPath();c.arc(s*ex-er*.34,ey-er*.32,er*.38,0,Math.PI*2);c.fillStyle='white';c.fill();
  }
}
function wNose(c,r,col,sc=1){
  c.beginPath();c.ellipse(0,r*.1*sc,r*.07*sc,r*.055*sc,0,0,Math.PI*2);c.fillStyle=col;c.fill();
}
function wSmile(c,r,oy,col='#444',span=.22){
  c.beginPath();c.arc(0,r*oy,r*span,.22,Math.PI-.22);
  c.strokeStyle=col;c.lineWidth=1.5;c.stroke();
}
function wBlush(c,r,col='rgba(255,140,180,.3)'){
  for(const s of[-1,1]){c.beginPath();c.arc(s*r*.38,r*.12,r*.2,0,Math.PI*2);c.fillStyle=col;c.fill();}
}
function wWhiskers(c,r,col='#888'){
  c.strokeStyle=col;c.lineWidth=0.9;
  for(const s of[-1,1])for(const dy of[-r*.02,r*.09,r*.2]){
    c.beginPath();c.moveTo(s*r*.12,dy);c.lineTo(s*r*.72,dy-r*.02);c.stroke();
  }
}
function wCatEars(c,r,bodyCol,strkCol){
  for(const s of[-1,1]){
    c.beginPath();c.moveTo(s*r*.12,-r*.7);c.lineTo(s*r*.55,-r*.98);c.lineTo(s*r*.64,-r*.5);
    c.closePath();c.fillStyle=bodyCol;c.fill();c.strokeStyle=strkCol;c.lineWidth=1.2;c.stroke();
    c.beginPath();c.moveTo(s*r*.18,-r*.68);c.lineTo(s*r*.48,-r*.9);c.lineTo(s*r*.56,-r*.54);
    c.closePath();c.fillStyle='rgba(255,200,210,.55)';c.fill();
  }
}
function wBell(c,r,y){
  c.beginPath();c.arc(0,r*y,r*.11,0,Math.PI*2);
  c.fillStyle='#f8d000';c.fill();c.strokeStyle='#c0a000';c.lineWidth=1.2;c.stroke();
  c.beginPath();c.moveTo(-r*.08,r*y);c.lineTo(r*.08,r*y);c.strokeStyle='#b09000';c.lineWidth=0.9;c.stroke();
}
function wCollar(c,r,y,col,stk){
  c.beginPath();c.ellipse(0,r*y,r*.82,r*.13,0,0,Math.PI*2);
  c.fillStyle=col;c.fill();c.strokeStyle=stk;c.lineWidth=1.2;c.stroke();
}
// old mkNose/mkEars removed — replaced by wNose / wEyes etc above

// ── 11 CHARACTER DRAW FUNCTIONS (called once during prerender) ─────────
function drawSheep(c,r,d){
  // wool bumps
  for(let k=0;k<7;k++){const a=2*Math.PI*k/7-Math.PI/2;c.beginPath();c.arc(Math.cos(a)*r*.72,Math.sin(a)*r*.72,r*.38,0,Math.PI*2);c.fillStyle='#eeeee8';c.fill();c.strokeStyle=d.stroke;c.lineWidth=0.8;c.stroke();}
  c.beginPath();c.ellipse(0,r*.1,r*.46,r*.42,0,0,Math.PI*2);c.fillStyle='#f0e8d8';c.fill();
  for(const s of[-1,1]){c.beginPath();c.arc(s*r*.46,-r*.55,r*.22,0,Math.PI*2);c.fillStyle='#eeeeea';c.fill();c.beginPath();c.arc(s*r*.46,-r*.55,r*.12,0,Math.PI*2);c.fillStyle='#f8c0c8';c.fill();}
  wEyes(c,r,r*.22,-r*.06,r*.1);wNose(c,r,'#f0a0b0',.8);
}

function drawVincam(c,r,d){
  // 3 simple top bumps
  for(const[bx,by,br]of[[-r*.42,-r*.6,r*.34],[0,-r*.72,r*.38],[r*.42,-r*.6,r*.34]]){
    c.beginPath();c.arc(bx,by,br,0,Math.PI*2);c.fillStyle='#d0f0ff';c.fill();
    c.strokeStyle=d.stroke;c.lineWidth=0.8;c.stroke();
  }
  wBlush(c,r,'rgba(140,215,255,.38)');
  wEyes(c,r,r*.26,-r*.06,r*.14,'#1a2a40');
  wSmile(c,r,.14,'#2878a8',.2);
}

function drawBo_unused(c,r,d){
  c.beginPath();c.ellipse(0,r*.12,r*.64,r*.7,0,0,Math.PI*2);c.fillStyle='#c8e050';c.fill();
  c.beginPath();c.ellipse(0,r*.26,r*.3,r*.34,0,0,Math.PI*2);c.fillStyle='#6a3810';c.fill();
  c.beginPath();c.ellipse(0,r*.26,r*.22,r*.26,0,0,Math.PI*2);c.fillStyle='#8a5028';c.fill();
  wEyes(c,r,r*.23,-r*.22,r*.12,'#2a3a10');wNose(c,r,'#5a8820',.9);
  c.beginPath();c.arc(0,-r*.04,r*.18,.22,Math.PI-.22);c.strokeStyle='#4a7010';c.lineWidth=1.4;c.stroke();
  c.beginPath();c.ellipse(0,-r*.95,r*.14,r*.3,-0.3,0,Math.PI*2);c.fillStyle='#3a7828';c.fill();c.strokeStyle='#246018';c.lineWidth=1;c.stroke();
}

function drawBabyBunny(c,r,d){
  for(const s of[-1,1]){c.save();c.translate(s*r*.36,-r*.76);c.beginPath();c.ellipse(0,0,r*.22,r*.46,s*.08,0,Math.PI*2);c.fillStyle='#fff0f8';c.fill();c.strokeStyle=d.stroke;c.lineWidth=1.2;c.stroke();c.beginPath();c.ellipse(0,0,r*.12,r*.32,s*.08,0,Math.PI*2);c.fillStyle='#ffc0d8';c.fill();c.restore();}
  wBlush(c,r,'rgba(255,140,190,.3)');
  for(const s of[-1,1]){c.beginPath();c.arc(s*r*.27,-r*.08,r*.16,0,Math.PI*2);c.fillStyle='#1a1a2a';c.fill();c.beginPath();c.arc(s*r*.27-r*.05,-r*.13,r*.07,0,Math.PI*2);c.fillStyle='white';c.fill();c.beginPath();c.arc(s*r*.27+r*.04,-r*.04,r*.035,0,Math.PI*2);c.fillStyle='rgba(255,255,255,.5)';c.fill();}
  wNose(c,r,'#ff80a8');c.beginPath();c.moveTo(-r*.08,r*.18);c.quadraticCurveTo(0,r*.26,r*.08,r*.18);c.strokeStyle='#cc4878';c.lineWidth=1.4;c.stroke();
}

function drawMiniDora(c,r,d){
  wCatEars(c,r,'#c80010',d.stroke);
  c.beginPath();c.arc(0,-r*.05,r*.64,0,Math.PI*2);c.fillStyle='white';c.fill();
  wEyes(c,r,r*.28,-r*.22,r*.14);
  c.beginPath();c.moveTo(0,-r*.02);c.lineTo(-r*.07,r*.07);c.lineTo(r*.07,r*.07);c.closePath();c.fillStyle='#e83030';c.fill();
  wWhiskers(c,r,'#888');
  wCollar(c,r,.52,'#e83030','#a01010');wBell(c,r,.6);
}

function drawPoko(c,r,d){
  for(const s of[-1,1]){c.beginPath();c.moveTo(s*r*.14,-r*.78);c.lineTo(s*r*.54,-r*.98);c.lineTo(s*r*.62,-r*.52);c.closePath();c.fillStyle='#b06820';c.fill();c.strokeStyle=d.stroke;c.lineWidth=1.2;c.stroke();c.beginPath();c.moveTo(s*r*.18,-r*.76);c.lineTo(s*r*.48,-r*.9);c.lineTo(s*r*.55,-r*.56);c.closePath();c.fillStyle='#f8b080';c.fill();}
  c.beginPath();c.ellipse(0,-r*.35,r*.22,r*.28,0,0,Math.PI*2);c.fillStyle='#e8a060';c.fill();
  c.beginPath();c.ellipse(0,r*.16,r*.44,r*.36,0,0,Math.PI*2);c.fillStyle='#fef0e0';c.fill();
  wEyes(c,r,r*.3,-r*.13,r*.14);
  c.beginPath();c.ellipse(0,r*.08,r*.09,r*.07,0,0,Math.PI*2);c.fillStyle='#222';c.fill();
  c.beginPath();c.moveTo(-r*.1,r*.18);c.quadraticCurveTo(0,r*.27,r*.1,r*.18);c.strokeStyle='#555';c.lineWidth=1.4;c.stroke();
}

function drawDoraemi(c,r,d){
  wCatEars(c,r,'#d8b010',d.stroke);
  c.beginPath();c.ellipse(0,-r*.06,r*.6,r*.64,0,0,Math.PI*2);c.fillStyle='#fffce8';c.fill();
  wEyes(c,r,r*.28,-r*.2,r*.14);
  c.beginPath();c.moveTo(0,-r*.02);c.lineTo(-r*.06,r*.07);c.lineTo(r*.06,r*.07);c.closePath();c.fillStyle='#e08080';c.fill();
  wWhiskers(c,r,'#aaa');
  // bow
  c.save();c.translate(r*.52,-r*.72);
  for(const s of[-1,1]){c.beginPath();c.ellipse(s*r*.22,0,r*.22,r*.14,s*.3,0,Math.PI*2);c.fillStyle='#ff5090';c.fill();c.strokeStyle='#c0206a';c.lineWidth=1.2;c.stroke();}
  c.beginPath();c.arc(0,0,r*.09,0,Math.PI*2);c.fillStyle='#ff2070';c.fill();c.restore();
}

function drawDoraemon(c,r,d){
  wCatEars(c,r,'#0070c8',d.stroke);
  c.beginPath();c.arc(0,-r*.06,r*.66,0,Math.PI*2);c.fillStyle='white';c.fill();
  wEyes(c,r,r*.28,-r*.24,r*.15);
  c.beginPath();c.arc(0,-r*.04,r*.11,0,Math.PI*2);c.fillStyle='#e03030';c.fill();c.strokeStyle='#a01010';c.lineWidth=1;c.stroke();
  wWhiskers(c,r,'#666');
  c.beginPath();c.arc(0,r*.1,r*.18,.3,Math.PI-.3);c.strokeStyle='#333';c.lineWidth=1.5;c.stroke();
  wCollar(c,r,.54,'#e83030','#a81010');wBell(c,r,.62);
}

function drawBunny9(c,r,d){
  for(const s of[-1,1]){c.save();c.translate(s*r*.42,-r*.7);c.beginPath();c.ellipse(0,0,r*.28,r*.5,s*.1,0,Math.PI*2);c.fillStyle='#f060a0';c.fill();c.strokeStyle=d.stroke;c.lineWidth=1.5;c.stroke();c.beginPath();c.ellipse(0,0,r*.16,r*.36,s*.1,0,Math.PI*2);c.fillStyle='#ff88c0';c.fill();c.restore();}
  wBlush(c,r,'rgba(255,80,140,.24)');
  for(const s of[-1,1]){c.beginPath();c.arc(s*r*.3,-r*.1,r*.17,0,Math.PI*2);c.fillStyle='#1a1a2a';c.fill();c.beginPath();c.arc(s*r*.3-r*.06,-r*.16,r*.07,0,Math.PI*2);c.fillStyle='white';c.fill();c.beginPath();c.arc(s*r*.3+r*.04,-r*.06,r*.04,0,Math.PI*2);c.fillStyle='rgba(255,255,255,.5)';c.fill();}
  wNose(c,r,'#ff3888');c.beginPath();c.moveTo(-r*.1,r*.18);c.quadraticCurveTo(0,r*.28,r*.1,r*.18);c.strokeStyle='#b81848';c.lineWidth=1.6;c.stroke();
}

function drawMimi(c,r,d){
  wCatEars(c,r,'#7830b8',d.stroke);
  c.beginPath();c.ellipse(0,-r*.02,r*.62,r*.64,0,0,Math.PI*2);c.fillStyle='#e8d0f8';c.fill();
  for(const s of[-1,1]){
    c.beginPath();c.arc(s*r*.28,-r*.18,r*.16,0,Math.PI*2);c.fillStyle='#5028a0';c.fill();
    c.beginPath();c.arc(s*r*.28,-r*.18,r*.1,0,Math.PI*2);c.fillStyle='#1a0840';c.fill();
    c.beginPath();c.arc(s*r*.28-r*.04,-r*.23,r*.055,0,Math.PI*2);c.fillStyle='white';c.fill();
    c.strokeStyle='#1a0840';c.lineWidth=1.2;
    for(let k=-1;k<=1;k++){c.beginPath();c.moveTo(s*r*.28+k*r*.07,-r*.34);c.lineTo(s*r*.28+k*r*.1,-r*.44);c.stroke();}
  }
  wNose(c,r,'#e070b0');wWhiskers(c,r,'#9060c0');
  c.save();c.translate(r*.55,-r*.7);
  for(const s of[-1,1]){c.beginPath();c.ellipse(s*r*.22,0,r*.23,r*.14,s*.3,0,Math.PI*2);c.fillStyle='#f8d020';c.fill();c.strokeStyle='#b89000';c.lineWidth=1.2;c.stroke();}
  c.beginPath();c.arc(0,0,r*.1,0,Math.PI*2);c.fillStyle='#f0c000';c.fill();c.restore();
}

function drawRacoon(c,r,d){
  c.beginPath();c.ellipse(0,r*.28,r*.55,r*.52,0,0,Math.PI*2);c.fillStyle='#5a5a6a';c.fill();
  for(const s of[-1,1]){c.beginPath();c.arc(s*r*.56,-r*.66,r*.28,0,Math.PI*2);c.fillStyle='#1a1a22';c.fill();c.strokeStyle=d.stroke;c.lineWidth=1.5;c.stroke();c.beginPath();c.arc(s*r*.56,-r*.66,r*.15,0,Math.PI*2);c.fillStyle='#888898';c.fill();}
  for(const s of[-1,1]){c.beginPath();c.ellipse(s*r*.3,-r*.1,r*.26,r*.22,0,0,Math.PI*2);c.fillStyle='#e8e8f0';c.fill();}
  wEyes(c,r,r*.3,-r*.1,r*.14,'#1a1a2a');
  c.beginPath();c.ellipse(0,r*.1,r*.22,r*.18,0,0,Math.PI*2);c.fillStyle='#484858';c.fill();
  c.beginPath();c.ellipse(0,r*.08,r*.1,r*.08,0,0,Math.PI*2);c.fillStyle='#222230';c.fill();
  c.beginPath();c.moveTo(-r*.1,r*.22);c.quadraticCurveTo(0,r*.3,r*.1,r*.22);c.strokeStyle='#333';c.lineWidth=1.6;c.stroke();
  // crown
  c.save();c.translate(0,-r*.9);
  c.beginPath();c.rect(-r*.44,0,r*.88,r*.28);c.fillStyle='#f0c500';c.fill();c.strokeStyle='#b09000';c.lineWidth=1.5;c.stroke();
  for(let k=0;k<5;k++){const x=-r*.38+k*r*.19;c.beginPath();c.moveTo(x,0);c.lineTo(x+r*.095,-r*.36);c.lineTo(x+r*.19,0);c.closePath();c.fillStyle='#f8d020';c.fill();c.strokeStyle='#b09000';c.lineWidth=1.5;c.stroke();}
  for(let k=0;k<3;k++){c.beginPath();c.arc(-r*.24+k*r*.24,r*.14,r*.075,0,Math.PI*2);c.fillStyle=['#e82020','#3090e8','#20c060'][k];c.fill();}
  c.restore();
}

// prerender() removed — images loaded via loadSprites()

// ── CLAW ANIMATION ────────────────────────────────────────────────────────
function updateClaw(){
  if(dead) return;
  if(clawState==='idle'){
    clawX=clamp(mx,cur); clawY=DROPY;
  } else if(clawState==='opening'){
    clawX=clamp(mx,cur); // keep claw tracking mouse/finger during open animation
    clawOpenTimer--;
    if(clawOpenTimer===CLAW_OPEN_FRAMES-2){
      // spawn plushie a couple frames in so player sees it "fall out"
      sfxDrop(); if(bgmOn&&!bgmRunning) startBGM();
      const b=new Ball(clawDropX, DROPY, clawLvl);
      b.av=(Math.random()-.5)*AV_MAX*0.3;
      plushies.push(b);
      cur=nxt; nxt=rnd(); updNext();
    }
    if(clawOpenTimer<=0){ clawState='idle'; cooling=false; }
  }
}

// ── INPUT ─────────────────────────────────────────────────────────────
function clamp(x,lvl){const r=PD[lvl].r;return Math.max(PAD+r+1,Math.min(W-PAD-r-1,x));}
let dbg=false,dbgPoly=false,solidMode=false,noMerge=false;
let stepMode=false; // P = pause physics, . = advance one frame
let showJoy=!window.matchMedia('(pointer:coarse)').matches;
const isMobile=window.matchMedia('(pointer:coarse)').matches;
let _joyLastMx=null,_joyNoMovFrames=0;
let _glareT=-1,_glareStart=0;
const GLARE_DUR=480;
let _glareNextAt=Date.now()+5000+Math.random()*5000;
function triggerGlare(){_glareT=0;_glareStart=Date.now();_glareNextAt=Date.now()+GLARE_DUR+5000+Math.random()*5000;}
function tickGlare(){const now=Date.now();if(_glareT<0){if(now>=_glareNextAt){_glareT=0;_glareStart=now;}}else{_glareT=(now-_glareStart)/GLARE_DUR;if(_glareT>=1){_glareT=-1;_glareNextAt=now+5000+Math.random()*5000;}}}
const joyEl=()=>document.getElementById('joyctrl');
const joyImg=()=>document.getElementById('joy-img');
const dropBtn=()=>document.getElementById('drop-btn');
let btnPressTO=null;
function updateJoyDir(dir){const img=joyImg();if(!img)return;if(dir==='none'){img.src='Sprites/ui/joystick_released.png';img.classList.remove('flip');}else{img.src='Sprites/ui/joystick_tilted.png';img.classList.toggle('flip',dir==='right');}}
function flashDropBtn(){const btn=dropBtn();if(!btn)return;btn.src='Sprites/ui/button_pressed.png';clearTimeout(btnPressTO);btnPressTO=setTimeout(()=>{btn.src='Sprites/ui/button_released.png';},300);}
function toggleJoy(){showJoy=!showJoy;const el=joyEl();if(!el)return;el.style.display=showJoy?'flex':'none';}
const keysDown=new Set();
document.addEventListener('keyup',e=>keysDown.delete(e.key));
window.addEventListener('blur',()=>keysDown.clear());
document.addEventListener('keydown',e=>{
  if(dead&&e.key==='Enter'){e.preventDefault();restart();return;}
  if(e.key==='j'||e.key==='J'){toggleJoy();return;}
  if(e.key==='a'||e.key==='A'){cycleAp();return;}
  if(e.key==='?'||e.key==='/'){toggleHelp();return;}
  if(e.key==='Escape'){toggleHelp(false);return;}
  if(IS_DEBUG){
    if(e.key==='m'||e.key==='M'){
      noMerge=!noMerge;
      const cb=document.getElementById('dbg-nomerge-cb');if(cb)cb.checked=noMerge;
      _gyroHud(noMerge?'🚫 MERGE OFF':'✅ MERGE ON');
      setTimeout(()=>_gyroHud(null),1500);
      return;
    }
    if(e.key==='p'||e.key==='P'){
      stepMode=!stepMode;
      _gyroHud(stepMode?'⏸ PAUSED  (. = next frame)':'▶ RUNNING');
      setTimeout(()=>_gyroHud(null),1200);
      if(!stepMode&&!dead) resumeLoop(); // unpause restarts loop
      return;
    }
    if(e.key==='.'&&stepMode){
      // advance exactly one frame — includes scheduler so wipeout events fire correctly
      tickScheduled();
      tickTrapDoor();
      if(!dead){step();detectMerges();processMerges();}
      updateClaw();
      tickParts();tickPopups();tickConfetti();tickSparkles();tickCelebrations();
      if(showClaw)tickGlare();if(typeof tickShakeCooldown==='function')tickShakeCooldown();
      render();
      return;
    }
    if(e.key==='s'||e.key==='S'){showSpawnRate=!showSpawnRate;updateEvoLabels();return;}
    if(e.key==='d'||e.key==='D'){dbg=!dbg;if(dbg)dbgPoly=false;return;}
    if(e.key==='c'||e.key==='C'){dbgPoly=!dbgPoly;if(dbgPoly){dbg=false;solidMode=false;}return;}
    if(e.key==='h'||e.key==='H'){solidMode=!solidMode;if(solidMode)dbgPoly=false;return;}
    if(e.key==='w'||e.key==='W'){if(!dead&&!wipeOutActive){for(let i=1;i<=11;i++)firstMerged.add(i);updateEvoUnlocks();triggerWipeOut(W/2,H/2);}return;}
    if(e.key==='['){e.preventDefault();sidesOffset=Math.max(SIDES_MIN,sidesOffset-1);if(!solidMode){dbg=false;dbgPoly=true;}return;}
    if(e.key===']'){e.preventDefault();sidesOffset=Math.min(SIDES_MAX,sidesOffset+1);if(!solidMode){dbg=false;dbgPoly=true;}return;}
  }
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Shift'){e.preventDefault();keysDown.add(e.key);return;}
  if(e.key===' '||e.key==='ArrowDown'){e.preventDefault();drop();return;}
  if(!IS_DEBUG)return;
  const lvMap={'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'0':10,'1':11};
  const lvl=lvMap[e.key];if(lvl&&!dead){const b=new Ball(clamp(mx,lvl),DROPY,lvl);b.av=(Math.random()-.5)*AV_MAX*0.3;plushies.push(b);}
});
let apSpeed=0;
const AP_DELAYS=[0,1200,820,500]; // ms per speed level (0 = off)
let _apTimer=null;
function setApSpeed(spd){
  apSpeed=spd;
  // update both dials
  ['ap','ap-ls'].forEach(id=>{
    const dial=document.getElementById(id);
    if(!dial) return;
    dial.querySelectorAll('.ap-seg').forEach(seg=>{
      seg.classList.toggle('active', +seg.dataset.spd===spd);
    });
  });
  // restart timer — self-scheduling timeout so drops are never skipped when cooling
  if(_apTimer){ clearTimeout(_apTimer); _apTimer=null; }
  if(spd>0){
    const schedule=()=>{
      _apTimer=setTimeout(()=>{
        if(!apSpeed){ _apTimer=null; return; } // turned off
        (function waitCool(){ if(wipeOutActive||dead){ schedule(); return; } if(cooling){ requestAnimationFrame(waitCool); } else { drop(); schedule(); } })();
      }, AP_DELAYS[apSpeed]);
    };
    schedule();
  }
}
function cycleAp(){ setApSpeed((apSpeed+1)%4); }
function syncAp(v){ setApSpeed(v?1:0); } // legacy compat (keyboard 'A')

function resetClawForNewRound(){
  if(apSpeed===0){ mx=PAD+PD[cur].r+1; tapHint=true; } // far left + hint
  else { tapHint=false; }
}
function drop(){
  if(cooling||dead||wipeOutActive) return;
  tapHint=false;
  if(showJoy) flashDropBtn();
  clawDropX=clamp(mx,cur); clawLvl=cur;
  clawState='opening'; clawOpenTimer=CLAW_OPEN_FRAMES; cooling=true;
}
function setMx(raw){ mx=Math.max(PAD,Math.min(W-PAD,raw)); }
cv.addEventListener('mousemove',e=>{
  if(typeof _gKeyDown !== 'undefined' && _gKeyDown) return; // G held = tilt sim
  const r=cv.getBoundingClientRect();
  setMx((e.clientX-r.left)*(W/r.width));
});
cv.addEventListener('click',e=>{
  if(dead||wipeOutActive) return;
  (function tryDrop(){if(wipeOutActive||dead) return; if(cooling) requestAnimationFrame(tryDrop); else drop();})();
});
// ── TOUCH: tween claw on tap, drop on tween completion ──────────────────
let _touchTween=null; // {raf, cancelled, dropOnDone}

function cancelTween(){
  if(!_touchTween) return;
  cancelAnimationFrame(_touchTween.raf);
  _touchTween.cancelled=true;
  _touchTween=null;
}

function tweenClawTo(targetX, duration){
  cancelTween();
  const startX=clawX, startTime=performance.now();
  _touchTween={raf:null, cancelled:false, dropOnDone:false};
  const tween=_touchTween;
  function tick(now){
    if(tween.cancelled) return;
    const t=Math.min(1,(now-startTime)/duration);
    const ease=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; // easeInOutQuad
    clawX=startX+(targetX-startX)*ease;
    mx=clawX;
    if(t<1){ tween.raf=requestAnimationFrame(tick); }
    else{
      _touchTween=null;
      if(tween.dropOnDone){
        // retry until cooling clears (handles rare case tween finishes just before cooldown ends)
        (function tryDrop(){if(wipeOutActive||dead) return; if(cooling) requestAnimationFrame(tryDrop); else drop();})();
      }
    }
  }
  tween.raf=requestAnimationFrame(tick);
}

cv.addEventListener('touchstart',e=>{
  e.preventDefault();
  if(dead||wipeOutActive) return;
  const r=cv.getBoundingClientRect();
  const tx=Math.max(PAD,Math.min(W-PAD,(e.touches[0].clientX-r.left)*(W/r.width)));
  const dist=Math.abs(tx-mx);
  const pct=dist/W; // distance as fraction of game width
  if(pct<0.05){
    // close enough — snap immediately
    cancelTween(); mx=tx;
  } else if(pct<0.30){
    // interpolate duration linearly: 5%→0ms, 30%→300ms
    const dur=((pct-0.05)/(0.30-0.05))*300;
    tweenClawTo(tx, dur);
  } else {
    tweenClawTo(tx, 300);
  }
},{passive:false});

cv.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(dead||wipeOutActive) return;
  const r=cv.getBoundingClientRect();
  const tx=(e.touches[0].clientX-r.left)*(W/r.width);
  cancelTween(); // drag: cancel tween, follow finger directly
  mx=Math.max(PAD,Math.min(W-PAD,tx)); // bypass setMx cooling guard for touch
},{passive:false});

cv.addEventListener('touchend',e=>{
  e.preventDefault();
  if(dead||wipeOutActive) return;
  if(_touchTween){
    _touchTween.dropOnDone=true; // drop when tween finishes (cooling will have cleared)
  } else {
    drop();
  }
});

// ── UI ────────────────────────────────────────────────────────────────
function rnd(){
  const top=plushies.reduce((m,p)=>Math.max(m,p.level),0);
  // spawnable levels: 1 … max(top-1, 3)
  // when top=0 (empty tank) allow up to lv3 so the game can start
  const maxL=Math.max(top-1, 3);

  // geometric weights: w(L) = 0.64^(L-1)
  // decay=0.64 preserves the original ~50/32/18% split for lv1-3
  // and naturally extends to lv4+ as rarer entries
  let total=0;
  const weights=[];
  for(let L=1;L<=maxL;L++){
    const w=Math.pow(0.64,L-1);
    weights.push(w); total+=w;
  }

  let r=Math.random()*total;
  for(let L=1;L<=maxL;L++){
    r-=weights[L-1];
    if(r<=0) return L;
  }
  return 1;
}
// score font size: monospace-like font — scale by char count vs container width
const SCORE_CHAR_RATIO=0.8; // estimated char width / font-size for Cherry Bomb One
function fitScoreFontEl(el, maxPx){
  if(!el||!el.textContent) return;
  const len=el.textContent.length; if(!len) return;
  const containerW=el.getBoundingClientRect().width; if(!containerW) return;
  el.style.fontSize=Math.min(maxPx, Math.floor(containerW/(len*SCORE_CHAR_RATIO)))+'px';
}
function fitScoreFont(){
  fitScoreFontEl(document.getElementById('sc-p'), 30); // portrait floor zone
  fitScoreFontEl(document.getElementById('sc'),   21); // landscape sidebar
}
let _lastScoreLen=0;
function updUI(){
  const s=score.toLocaleString();
  document.getElementById('sc').textContent=s;
  const elp=document.getElementById('sc-p');
  elp.textContent=s;
  if(s.length!==_lastScoreLen){ _lastScoreLen=s.length; fitScoreFont(); }
  const ll=document.getElementById('level-label');
  if(ll) ll.textContent='· LV '+gameLevel;
}
window.addEventListener('resize',()=>{ _lastScoreLen=0; fitScoreFont(); }); // force recheck on resize
function updNext(){
  const name=PD[nxt].name;
  nc.src=`Sprites/characters/level_${nxt}.png`;
  nctxls.clearRect(0,0,98,80); drawAtFit(nctxls,98,80,nxt);
  document.getElementById('nl-ls').textContent=name;
  const lbl=document.getElementById('fz-next-label');
  if(lbl) lbl.textContent=`NEXT (Lv${gameLevel})`;
}
function buildEvo(){
  const el=document.getElementById('ev'); el.innerHTML='';
  const es=document.getElementById('ev-s'); es.innerHTML='';
  for(let i=1;i<=11;i++){
    const sc=i<=8?'transform:scale(1.3);transform-origin:center;':'';
    const base=`src="Sprites/characters/level_${i}.png" data-unlock-lvl="${i}" style="object-fit:contain;flex-shrink:0;${sc}"`;
    // landscape row
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:6px;padding:0;';
    row.innerHTML=`<img ${base.replace('flex-shrink:0;','flex-shrink:0;width:32px;height:32px;')}>
      <span data-lvl="${i}" style="font-size:9px;color:#8a7060;">${PD[i].name}</span>`;
    el.appendChild(row);
    // portrait cell
    const cell=document.createElement('div'); cell.className='ec';
    cell.innerHTML=`<img ${base.replace('flex-shrink:0;','flex-shrink:0;width:100%;aspect-ratio:1;')}>
      <div class="ec-shadow"></div>
      <span class="en" data-lvl="${i}">${PD[i].name}</span>`;
    es.appendChild(cell);
  }
  updateEvoUnlocks();
}
function updateEvoUnlocks(){
  document.querySelectorAll('img[data-unlock-lvl]').forEach(img=>{
    const lvl=+img.dataset.unlockLvl;
    img.classList.toggle('evo-locked', lvl>3 && !firstMerged.has(lvl));
  });
}
// ── CHECKBOX PERSISTENCE (per device via localStorage) ───────────────────
const CB_KEY='plushie_cb_prefs';
function saveCbPrefs(){
  try{
    localStorage.setItem(CB_KEY, JSON.stringify({
      bgm: document.getElementById('bgm-cb')?.checked??false,
      gyro: document.getElementById('gyro-cb')?.checked??false,
    }));
  }catch(e){}
}
function loadCbPrefs(){
  try{
    const p=JSON.parse(localStorage.getItem(CB_KEY)||'{}');
    if(p.bgm!=null){ toggleBGM(p.bgm); ['bgm-cb','bgm-ls'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=p.bgm; }); }
    if(p.gyro&&p.gyro===true){
      // On iOS, DeviceOrientation permission requires a direct user gesture —
      // can't call requestPermission() on page load. Just pre-check the box;
      // the user tapping it will trigger toggleGyro() and the permission prompt.
      ['gyro-cb','gyro-ls'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=true; });
    }
  }catch(e){}
}
function updateHelpMeta(){
  const meta=document.getElementById('help-meta');
  if(!meta) return;
  const vw=window.innerWidth,vh=window.innerHeight;
  meta.textContent=`v31  ·  ${vw}×${vh}  ar:${(vw/vh).toFixed(3)}`;
}
let _helpTab='kb';
function showHelpTab(tab){
  _helpTab=tab;
  const gp=gpConnected();
  document.getElementById('help-tabs').style.display='none';
  document.getElementById('help-content-kb').style.display=(!gp&&tab==='kb')?'':'none';
  document.getElementById('help-content-gp').style.display=(gp||tab==='gp')?'':'none';
}
function toggleHelpTab(){
  if(!gpConnected()) return;
  showHelpTab(_helpTab==='kb'?'gp':'kb');
}
function toggleHelp(force){
  const el=document.getElementById('help-popup');
  const show=force!==undefined?force:!el.classList.contains('show');
  el.classList.toggle('show',show);
  if(show){updateHelpMeta();showHelpTab(gpConnected()?'gp':_helpTab);}
  updateGpGuide();
}
window.addEventListener('resize',()=>{ if(document.getElementById('help-popup').classList.contains('show')) updateHelpMeta(); });
document.getElementById('help-popup').addEventListener('click',e=>{
  if(e.target===e.currentTarget) toggleHelp(false);
});

// ── SPAWN RATE DISPLAY ────────────────────────────────────────────────
let showSpawnRate=false;
function computeSpawnRates(){
  const top=plushies.reduce((m,p)=>Math.max(m,p.level),0);
  const maxL=Math.max(top-1,3);
  const rates=new Array(12).fill(0);
  let total=0;
  for(let L=1;L<=maxL;L++){total+=Math.pow(0.64,L-1);}
  for(let L=1;L<=maxL;L++){rates[L]=Math.pow(0.64,L-1)/total;}
  return rates;
}
function updateEvoLabels(){
  const rates=computeSpawnRates();
  document.querySelectorAll('[data-lvl]').forEach(el=>{
    const lvl=+el.dataset.lvl;
    if(showSpawnRate){
      const pct=rates[lvl]*100;
      el.textContent=pct>=0.1?pct.toFixed(1)+'%':'—';
      el.style.color=pct>0?'#c05020':'#b0a090';
    } else {
      el.textContent=PD[lvl].name;
      el.style.color='';
    }
  });
}

// ── CHARACTER NAME AUDIO ──────────────────────────────────────────────
// [start, duration] in seconds per voice
// Order: Mây, Bơ, Vincam, Mini Dora, Baby Bunny, Poko, Doraemi, Doraemon, Bunny, Mimi, Racoon
const NAME_SEGS_BAP=[null,
  [0.000, 3.389],  // 1 Mây
  [3.389, 2.407],  // 2 Bơ
  [5.796, 3.038],  // 3 Vincam
  [8.834, 3.248],  // 4 Mini Dora
  [12.082, 2.477], // 5 Baby Bunny
  [14.559, 2.244], // 6 Poko
  [16.803, 2.407], // 7 Doraemi
  [19.210, 2.384], // 8 Doraemon
  [21.594, 1.752], // 9 Bunny
  [23.346, 1.473], // 10 Mimi
  [24.819, 2.000], // 11 Racoon (estimated)
];
const NAME_SEGS_BONG=[null,
  [0.000, 2.389],  // 1 Mây
  [2.389, 2.257],  // 2 Bơ
  [4.646, 3.002],  // 3 Vincam
  [7.648, 3.190],  // 4 Mini Dora
  [10.838, 3.118], // 5 Baby Bunny
  [13.956, 2.752], // 6 Poko
  [16.708, 3.264], // 7 Doraemi
  [19.972, 3.312], // 8 Doraemon
  [23.284, 2.753], // 9 Bunny
  [26.037, 2.728], // 10 Mimi
  [28.765, 2.000], // 11 Racoon (estimated)
];
let _namesBufBap=null, _namesBufBong=null;
(async function _loadNames(){
  async function _loadBuf(url){
    const resp=await fetch(url);
    const arr=await resp.arrayBuffer();
    const tmpAC=new(window.AudioContext||window.webkitAudioContext)();
    return await tmpAC.decodeAudioData(arr);
  }
  try{ _namesBufBap=await _loadBuf('Audio/Names_Bap.mp3'); }catch(e){}
  try{ _namesBufBong=await _loadBuf('Audio/Names_Bong.mp3'); }catch(e){}
})();
function playCharacterName(lvl){
  if(muted)return;
  const voices=[];
  if(_namesBufBap) voices.push([_namesBufBap, NAME_SEGS_BAP]);
  if(_namesBufBong) voices.push([_namesBufBong, NAME_SEGS_BONG]);
  if(!voices.length)return;
  const [buf,segs]=voices[Math.floor(Math.random()*voices.length)];
  const seg=segs[lvl];
  if(!seg)return;
  const a=getAC();
  const src=a.createBufferSource();
  src.buffer=buf;
  const g=a.createGain();g.gain.value=1.0;
  src.connect(g);g.connect(a._sfxBus||a.destination);
  src.start(a.currentTime,seg[0],seg[1]);
}

// ── AUDIO ─────────────────────────────────────────────────────────────
let ac=null, muted=false, bgmRunning=false, bgmOn=true;
let _bgmVolume=0.4;
let _bgmGain=null, _bgmSrcNode=null;
// Route BGM through a Web Audio GainNode so volume works on iOS
// (iOS ignores el.volume; GainNode.gain.value is respected)
function _initBgmRouting(){
  if(_bgmGain)return _bgmGain;
  const el=_bgmEl();if(!el)return null;
  try{
    const a=getAC();
    _bgmSrcNode=a.createMediaElementSource(el);
    _bgmGain=a.createGain();
    _bgmGain.gain.value=_bgmVolume;
    _bgmSrcNode.connect(_bgmGain);
    _bgmGain.connect(a.destination);
  }catch(e){}
  return _bgmGain;
}
function setBGMVolume(v){
  _bgmVolume=parseFloat(v);
  if(_bgmGain)_bgmGain.gain.value=_bgmVolume;
  else{const el=_bgmEl();if(el)el.volume=_bgmVolume;}
  const lbl=document.getElementById('bgm-vol-label');if(lbl)lbl.textContent=Math.round(_bgmVolume*100)+'%';
  try{localStorage.setItem('plushie_bgm_vol',_bgmVolume);}catch(e){}
}
(function(){try{const v=parseFloat(localStorage.getItem('plushie_bgm_vol'));if(!isNaN(v)){_bgmVolume=v;const sl=document.getElementById('bgm-vol');if(sl)sl.value=v;const lbl=document.getElementById('bgm-vol-label');if(lbl)lbl.textContent=Math.round(v*100)+'%';}}catch(e){}})();

function getAC(){
  if(!ac){
    ac=new(window.AudioContext||window.webkitAudioContext)();
    // master limiter: clamps total SFX output so overlapping sounds don't spike the volume
    const comp=ac.createDynamicsCompressor();
    comp.threshold.value=-6;   // dBFS ceiling
    comp.knee.value=3;
    comp.ratio.value=20;       // near-hard limit
    comp.attack.value=0.001;
    comp.release.value=0.1;
    comp.connect(ac.destination);
    ac._sfxBus=comp;           // all SFX connect here instead of ac.destination
  }
  if(ac.state==='suspended') ac.resume();
  return ac;
}
function tone(freq,start,type,vol,dur){
  const a=getAC(),t=a.currentTime+start;
  const o=a.createOscillator(),g=a.createGain();
  o.connect(g);g.connect(a._sfxBus||a.destination);
  o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(vol,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.start(t);o.stop(t+dur+0.05);
}

// Drop: soft thud
function sfxDrop(){
  if(muted||apSpeed>0)return; // silent on auto
  const a=getAC(),t=a.currentTime;
  const o=a.createOscillator(),g=a.createGain();
  o.connect(g);g.connect(a._sfxBus||a.destination);
  o.type='sine';
  o.frequency.setValueAtTime(480,t);
  o.frequency.exponentialRampToValueAtTime(280,t+0.06);
  g.gain.setValueAtTime(0.12,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
  o.start(t);o.stop(t+0.10);
}

// Per-level merge arpeggios — bigger level = more notes, grander sound
const MSFX=[null,
  [[330,.00,'sine',.22,.2],[494,.10,'sine',.18,.2]],
  [[392,.00,'triangle',.2,.22],[523,.09,'triangle',.18,.22]],
  [[440,.00,'sine',.2,.18],[554,.08,'sine',.2,.18],[659,.16,'sine',.22,.22]],
  [[392,.00,'triangle',.2,.15],[494,.08,'triangle',.2,.15],[587,.16,'triangle',.2,.15],[784,.24,'triangle',.22,.22]],
  [[880,.00,'square',.12,.22],[659,.13,'square',.12,.28]],
  [[330,.00,'sawtooth',.12,.12],[440,.07,'sawtooth',.12,.12],[550,.14,'sawtooth',.12,.14],[659,.22,'sawtooth',.1,.22]],
  [[523,.00,'triangle',.2,.13],[587,.07,'triangle',.2,.13],[659,.14,'triangle',.2,.13],[784,.21,'triangle',.2,.15],[1047,.30,'triangle',.22,.25]],
  [[784,.00,'square',.13,.2],[784,.13,'square',.1,.15],[1047,.25,'square',.16,.3]],
  [[523,.00,'triangle',.22,.15],[659,.08,'triangle',.22,.15],[784,.17,'triangle',.22,.15],[1047,.26,'triangle',.25,.22],[1319,.36,'triangle',.22,.3]],
  [[1047,.00,'sine',.22,.15],[1319,.07,'sine',.22,.15],[1568,.14,'sine',.24,.15],[2093,.21,'sine',.26,.25]],
  [[523,.00,'triangle',.26,.5],[659,.07,'triangle',.26,.45],[784,.14,'triangle',.26,.4],[1047,.21,'triangle',.3,.5],[1319,.32,'triangle',.28,.55]],
];
function sfxMerge(lvl){
  if(muted)return;
  (MSFX[lvl]||[]).forEach(([f,d,t,v,u])=>tone(f,d,t,v,u));
}

// BGM — MP3 via <audio> element
const _bgmEl=()=>document.getElementById('bgm-audio');
let _bgmFadeTimer=null;
function _bgmFadeIn(el){
  clearInterval(_bgmFadeTimer);
  const gain=_bgmGain;
  if(gain)gain.gain.value=0; else el.volume=0;
  const step=_bgmVolume/60; // 60 steps × 50ms = 3s
  _bgmFadeTimer=setInterval(()=>{
    if(_bgmGain){
      _bgmGain.gain.value=Math.min(_bgmVolume,_bgmGain.gain.value+step);
      if(_bgmGain.gain.value>=_bgmVolume)clearInterval(_bgmFadeTimer);
    }else{
      el.volume=Math.min(_bgmVolume,el.volume+step);
      if(el.volume>=_bgmVolume)clearInterval(_bgmFadeTimer);
    }
  },50);
}
function startBGM(){
  if(muted||!bgmOn)return;
  const el=_bgmEl();if(!el)return;
  _initBgmRouting();
  el.play().catch(()=>{});
  _bgmFadeIn(el);
  bgmRunning=true;
}
function stopBGM(){
  clearInterval(_bgmFadeTimer);
  const el=_bgmEl();if(!el)return;
  el.pause();
  bgmRunning=false;
}
function toggleBGM(on){
  bgmOn=on;
  if(bgmOn&&!muted)startBGM();
  else stopBGM();
}
function toggleMute(){
  muted=!muted;
  const icon=muted?'🔇':'🔊';
  const muteLs=document.getElementById('mute-ls');
  if(muteLs) muteLs.textContent=icon;
  if(muted) stopBGM();
  else if(bgmOn) startBGM();
}
function toggleBGMAll(v){
  document.getElementById('bgm-cb').checked=v;
  document.getElementById('bgm-ls').checked=v;
  toggleBGM(v);
}

// ── GYRO / TILT ───────────────────────────────────────────────────────
let tiltAngle = 0;   // current effective tilt (radians), updated by deviceorientation
let gyroOn = false;
// Direction is negated vs raw gamma/accelerometer — PixiJS coordinate system requires this flip

function onDeviceOrientation(e){
  if(e.gamma === null) return;
  // Only use gamma fallback on non-iOS devices (iOS requires explicit DeviceMotion permission;
  // using gamma without it would apply tilt without the user granting access).
  // On Android/desktop DeviceMotion fires automatically so _motionAvailable will be true soon.
  if(!_motionAvailable && !isIOS){
    tiltAngle = -e.gamma * Math.PI / 180;
    updateGyroArrow(-e.gamma);
  }
}
let _motionAvailable = false;

// ── GYRO ARROW ────────────────────────────────────────────────────────
function updateGyroArrow(gammaDeg){
  const el=document.getElementById('gyro-arrow');
  if(!el) return;
  el.style.transform=`rotate(${-gammaDeg}deg)`;
}
function showGyroArrow(v){
  const jc=joyEl(); if(!jc) return;
  const arrow=document.getElementById('gyro-arrow');
  const joyImg=document.getElementById('joy-img');
  const dropBtnEl=document.getElementById('drop-btn');
  if(!arrow) return;
  if(v){
    jc.style.display='flex';
    arrow.classList.add('visible');
    // hide joystick images so arrow takes center stage
    if(joyImg)   joyImg.style.display='none';
    if(dropBtnEl) dropBtnEl.style.display='none';
  } else {
    arrow.classList.remove('visible');
    // restore joystick images if joy is supposed to be visible
    if(showJoy){
      if(joyImg)   joyImg.style.display='';
      if(dropBtnEl) dropBtnEl.style.display='';
    }
    if(!showJoy) jc.style.display='none';
  }
}

// ── SHAKE / PUSH FORCE ────────────────────────────────────────────────
// applyShakeForce(fx, fy): push all plushies with a directional force.
// fx/fy are already in game-units/frame — caller is responsible for scaling.
const SHAKE_FORCE_SCALE = 0.025; // tuning knob
function applyShakeForce(fx, fy){
  plushies.forEach(p=>{ p.vx += fx; p.vy += fy; });
}

// DeviceMotion: dual purpose —
//   accelerationIncludingGravity → derive tilt angle (full ±180°, beyond gamma's ±90° limit)
//   acceleration (no gravity)    → directional shake force
let _prevAccel = null;
function onDeviceMotion(e){
  // ── tilt from gravity vector (full rotation) ──
  _motionAvailable = true;
  const g = e.accelerationIncludingGravity;
  if(g && g.x != null && g.y != null){
    // atan2(-gx, -gy): upright=0, right=+90°, upside-down=±180°
    // Low-pass filter to smooth sensor noise
    // atan2(gx, -gy): upright=0, left=+90° — negated vs raw to match PixiJS direction flip
    const rawAngle = Math.atan2(g.x, -g.y);
    tiltAngle = tiltAngle * 0.7 + rawAngle * 0.3;
    updateGyroArrow(tiltAngle * 180 / Math.PI);
  }
  // ── shake force from linear acceleration ──
  const a = e.acceleration;
  if(a && a.x != null){
    const fx =  a.x * SHAKE_FORCE_SCALE;
    const fy = -a.y * SHAKE_FORCE_SCALE;
    if(Math.abs(fx) > 0.05 || Math.abs(fy) > 0.05) applyShakeForce(fx, fy);
  }
}

// legacy no-arg shake kept for Q/E keyboard path
let _shakeCD = 0;
function _triggerShake(){
  if(_shakeCD>0) return; _shakeCD=18;
  plushies.forEach(p=>{ p.vx+=(Math.random()-.5)*3; p.vy-=Math.random()*3; });
}
function tickShakeCooldown(){ if(_shakeCD>0) _shakeCD--; }

// Debug helper: simulate tilt with a given gamma (degrees)
function _simGyro(gammaDeg){
  if(!gyroOn) enableGyro();
  onDeviceOrientation({ gamma: Math.max(-90, Math.min(90, gammaDeg)) });
}

// ── DEBUG MOUSE GYRO SIM (IS_DEBUG only) ──────────────────────────────
// Hold G + move mouse left/right  → tilt (gamma). No mouse button needed.
// Hold F + move mouse fast         → shake (any direction).
// G and F can be held simultaneously.
var _gKeyDown = false, _fKeyDown = false; // var so visible outside if(IS_DEBUG) block
var _tiltPrevX = null;  // previous mouse X while G held, for delta accumulation
var _shakeTrackX = 0, _shakeTrackY = 0, _shakeTrackT = 0;
const GYRO_DRAG_SCALE = 0.4; // px delta → degrees delta

function _gyroHud(msg){
  const el=document.getElementById('gyro-drag-hud');
  if(!el) return;
  if(msg){ el.textContent=msg; el.classList.add('active'); }
  else   { el.classList.remove('active'); }
}
function _updateGyroHud(){
  if(!_gKeyDown && !_fKeyDown){ _gyroHud(null); return; }
  const parts=[];
  if(_gKeyDown) parts.push(`G ←→ tilt: ${(tiltAngle*180/Math.PI).toFixed(1)}°`);
  if(_fKeyDown) parts.push(`F fast-move: shake`);
  _gyroHud('🎮 ' + parts.join('   '));
}

if(IS_DEBUG){
  document.addEventListener('keydown', e=>{
    if(e.repeat) return;
    if(e.key==='g'||e.key==='G'){
      _gKeyDown=true;
      if(!gyroOn) enableGyro();
      _tiltPrevX=null;
      if(!_fKeyDown) showGyroArrow(true);
      updateGyroArrow(tiltAngle*180/Math.PI);
      _updateGyroHud();
    }
    if(e.key==='f'||e.key==='F'){
      _fKeyDown=true;
      if(!gyroOn) enableGyro();
      _shakeTrackT=0;
      if(!_gKeyDown) showGyroArrow(true);
      updateGyroArrow(tiltAngle*180/Math.PI);
      _updateGyroHud();
    }
  });
  document.addEventListener('keyup', e=>{
    if(e.key==='g'||e.key==='G'){
      _gKeyDown=false; _tiltPrevX=null;
      tiltAngle=0; // reset gravity to normal on release
      if(!_fKeyDown) showGyroArrow(false);
      _updateGyroHud();
    }
    if(e.key==='f'||e.key==='F'){
      _fKeyDown=false;
      if(!_gKeyDown) showGyroArrow(false);
      _updateGyroHud();
    }
  });

  document.addEventListener('mousemove', e=>{
    if(!_gKeyDown && !_fKeyDown) return;

    if(_gKeyDown){
      if(_tiltPrevX !== null){
        // delta mouse X → delta gamma (accumulates on top of existing tilt)
        const ddeg = (e.clientX - _tiltPrevX) * GYRO_DRAG_SCALE;
        // tiltAngle is negated vs gamma, so subtract ddeg to keep mouse-right = tilt-right
        const newGamma = Math.max(-90, Math.min(90,
                          -tiltAngle * 180/Math.PI + ddeg));
        tiltAngle = -newGamma * Math.PI / 180;
        updateGyroArrow(-newGamma);
      }
      _tiltPrevX = e.clientX;
    }

    if(_fKeyDown){
      const now = performance.now();
      const dt = now - _shakeTrackT;
      if(_shakeTrackT > 0 && dt > 0 && dt < 80){
        const ddx = e.clientX - _shakeTrackX;
        const ddy = e.clientY - _shakeTrackY;
        // velocity in px/ms → scale to game units/frame force
        const fx = -(ddx / dt) * 1.2;
        const fy = -(ddy / dt) * 1.2;
        if(Math.abs(fx) > 0.05 || Math.abs(fy) > 0.05) applyShakeForce(fx, fy);
      }
      _shakeTrackX=e.clientX; _shakeTrackY=e.clientY; _shakeTrackT=now;
    }

    _updateGyroHud();
  });
}

function _syncGyroCb(v){ const cb=document.getElementById('gyro-cb'); if(cb) cb.checked=v; }
function toggleGyro(){
  if(gyroOn){ disableGyro(); return; }
  if(typeof DeviceOrientationEvent !== 'undefined' &&
     typeof DeviceOrientationEvent.requestPermission === 'function'){
    DeviceOrientationEvent.requestPermission().then(state => {
      if(state === 'granted'){ enableGyro(); }
      else { alert('Tilt permission denied.'); _syncGyroCb(false); }
    }).catch(err => { alert('Could not request tilt permission: ' + err); _syncGyroCb(false); });
  } else {
    // Android & desktop — no permission needed
    enableGyro();
  }
}
function _syncGyroBoth(v){
  ['gyro-cb','gyro-ls'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=v; });
}
function _requestMotionPermission(cb){
  if(typeof DeviceMotionEvent !== 'undefined' &&
     typeof DeviceMotionEvent.requestPermission === 'function'){
    DeviceMotionEvent.requestPermission()
      .then(s=>{ if(s==='granted') cb(); })
      .catch(()=>{}); // motion permission failure is non-fatal
  } else {
    cb(); // Android / desktop — no permission needed
  }
}
function enableGyro(){
  window.addEventListener('deviceorientation', onDeviceOrientation);
  _requestMotionPermission(()=>{
    window.addEventListener('devicemotion', onDeviceMotion);
  });
  gyroOn = true;
  _syncGyroBoth(true);
  showGyroArrow(true);
}
function disableGyro(){
  window.removeEventListener('deviceorientation', onDeviceOrientation);
  window.removeEventListener('devicemotion', onDeviceMotion);
  gyroOn = false; tiltAngle = 0; _prevAccel=null; _motionAvailable=false;
  _syncGyroBoth(false);
  showGyroArrow(false);
}

// ── VIEWPORT SCALE ────────────────────────────────────────────────────
function fitToViewport(){
  const root=document.getElementById('game-root');
  root.style.transform='translate(-50%,-50%)'; // reset to measure natural size
  const scale=Math.min(
    window.innerHeight / root.offsetHeight,
    window.innerWidth  / root.offsetWidth
  );
  root.style.transform=`translate(-50%,-50%) scale(${scale.toFixed(4)})`;
}
window.addEventListener('resize', fitToViewport);

// ── BOOT ──────────────────────────────────────────────────────────────
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
window.addEventListener('orientationchange',()=>setTimeout(fitToViewport,200));
cur=rnd();nxt=rnd();clawLvl=cur;updUI();buildEvo();loadCbPrefs();setApSpeed(0);rebuildPtsTable();
// sync BGM checkbox to actual bgmOn state (bgmOn defaults true)
['bgm-cb','bgm-ls'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=bgmOn;});
// apply gamepad debug state on load
updateGpVisuals();
// start BGM after first user gesture (browser autoplay policy)
{let _bgmStarted=false;const _bgmUnlock=()=>{if(_bgmStarted)return;_bgmStarted=true;if(bgmOn&&!muted)startBGM();};document.addEventListener('click',_bgmUnlock,{once:true});document.addEventListener('touchstart',_bgmUnlock,{once:true});}
if(showJoy){const el=joyEl();if(el)el.style.display='flex';}
Promise.all([document.fonts.load("400 16px 'Cherry Bomb One'","ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789Mây Bơ"),document.fonts.ready,initPixi()]).then(()=>{loadSprites(()=>{updNext();fitToViewport();resetClawForNewRound();requestAnimationFrame(loop);});});
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js');
  navigator.serviceWorker.addEventListener('message',e=>{
    if(e.data?.type==='SW_UPDATED'){
      const toast=document.getElementById('update-toast');
      if(toast)toast.style.display='block';
    }
  });
}
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandaloneMode=navigator.standalone===true||window.matchMedia('(display-mode:standalone)').matches;
// isStandalone kept as alias for legacy refs
const isStandalone=isStandaloneMode;
function enterFullscreen(){const el=document.documentElement;const req=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen;if(req)req.call(el).catch(()=>{});dismissFsPrompt();}
function dismissFsPrompt(){document.getElementById('fs-prompt').classList.remove('show');updateGpGuide();}

let _deferredInstall=null;
let _appAlreadyInstalled=false; // set true if getInstalledRelatedApps detects it, or beforeinstallprompt never fires on Chrome

// Chrome/Android: capture install prompt; if it never fires, app is likely already installed
let _installPromptFired=false;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();_deferredInstall=e;_installPromptFired=true;
});
function _installApp(){
  if(_deferredInstall){_deferredInstall.prompt();_deferredInstall=null;}
  dismissFsPrompt();
}

function _showAlreadyInstalled(action){
  const div=document.getElementById(isMobile?'fsp-installed-mobile':'fsp-installed-pc');
  if(div)div.style.display='';
  action.innerHTML='<button onclick="dismissFsPrompt()">Got it!</button>';
  document.getElementById('fs-prompt').classList.add('show');updateGpGuide();
}

(async function(){
  if(isStandaloneMode)return; // already running as app — skip entirely
  if(!isMobile&&(document.fullscreenElement||document.webkitFullscreenElement))return;

  const action=document.getElementById('fs-prompt-action');

  // Try getInstalledRelatedApps (Chrome on Android)
  if('getInstalledRelatedApps' in navigator){
    try{
      const apps=await navigator.getInstalledRelatedApps();
      if(apps&&apps.length>0){_showAlreadyInstalled(action);return;}
    }catch(e){}
  }

  // On Chrome desktop/Android: wait a tick — if beforeinstallprompt didn't fire, app is likely installed
  if(!isIOS&&!isStandaloneMode){
    await new Promise(r=>setTimeout(r,500));
    if(!_installPromptFired&&!isIOS){
      // App probably installed — show nudge on mobile, skip prompt on desktop
      if(isMobile){_showAlreadyInstalled(action);return;}
      // Desktop with no install prompt = already installed or not installable — skip
      return;
    }
  }

  // Not installed — show install instructions
  if(isIOS){
    document.getElementById('fsp-ios').style.display='';
    action.innerHTML='<button onclick="dismissFsPrompt()">Got it!</button>';
  } else if(isMobile){
    document.getElementById('fsp-android').style.display='';
    action.innerHTML='<button onclick="enterFullscreen()">Got it!</button>';
  } else {
    document.getElementById('fsp-pc').style.display='';
    action.innerHTML='<button onclick="_installApp()">Got it!</button>';
  }
  document.getElementById('fs-prompt').classList.add('show');updateGpGuide();
})();
