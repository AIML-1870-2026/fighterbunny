// ─────────────────────────────────────────────
// CANVAS — full screen, responsive
// ─────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
let W, H, FLOOR_Y;

function resizeCanvas() {
  W       = window.innerWidth;
  H       = window.innerHeight;
  FLOOR_Y = H - 32;
  canvas.width  = W;
  canvas.height = H;
  // Scale jump so fish always reaches ~57% of play height, regardless of screen size
  JUMP_V  = -Math.round(Math.sqrt(FLOOR_Y * GRAVITY * 1.15));
  if (player && player.onGround) player.y = FLOOR_Y;
}
window.addEventListener('resize', resizeCanvas);

// ─────────────────────────────────────────────
// LEVEL CONFIG
// ─────────────────────────────────────────────
// minH / maxH are fractions of FLOOR_Y, computed at obstacle-spawn time.
// This keeps difficulty consistent regardless of screen size.
// Single-obstacle levels cap at 36% of FLOOR_Y so the fish can always clear them.
// Dual-obstacle levels use a safe gap formula in the Obstacle constructor.
const LEVELS = [
  { name:'Sunlight Zone',  depth:[0,200],     bg:['#00C8F0','#007EC8'], spd:190, freq:530, minH:0.07, maxH:0.16, dual:false, bgn:5, accent:'#00D4FF', shafts:true,  vig:0.0, bio:0.0, obs:0 },
  { name:'Shallow Light',  depth:[200,500],    bg:['#00A0D8','#024FA0'], spd:225, freq:470, minH:0.09, maxH:0.21, dual:false, bgn:4, accent:'#00D4FF', shafts:true,  vig:0.1, bio:0.0, obs:1 },
  { name:'Twilight Zone',  depth:[500,1000],   bg:['#024AB0','#020570'], spd:255, freq:420, minH:0.12, maxH:0.26, dual:false, bgn:3, accent:'#0088FF', shafts:false, vig:0.3, bio:0.1, obs:2 },
  { name:'Deep Twilight',  depth:[1000,2000],  bg:['#020570','#03001E'], spd:285, freq:480, minH:0.13, maxH:0.34, dual:true,  bgn:3, accent:'#0066CC', shafts:false, vig:0.5, bio:0.2, obs:3 },
  { name:'Midnight Zone',  depth:[2000,4000],  bg:['#03001E','#010010'], spd:318, freq:435, minH:0.15, maxH:0.36, dual:true,  bgn:2, accent:'#8800FF', shafts:false, vig:0.7, bio:0.5, obs:4 },
  { name:'Abyssal Zone',   depth:[4000,6000],  bg:['#140000','#060000'], spd:355, freq:395, minH:0.16, maxH:0.37, dual:true,  bgn:2, accent:'#FF3300', shafts:false, vig:0.9, bio:0.7, obs:5 },
  { name:'Hadal Trench',   depth:[6000,11000], bg:['#060000','#000000'], spd:395, freq:355, minH:0.17, maxH:0.38, dual:true,  bgn:1, accent:'#00FFCC', shafts:false, vig:1.0, bio:1.0, obs:6 },
];

const SHAKE_PX    = [3,4,5,7,9,11,12];
const BUBBLES     = [6,8,10,13,16,20,28];
const WEIGHTS     = [1.0,1.2,1.5,1.7,2.0,2.2,2.5];
const LEVEL_LENGTH = 6000;
let   JUMP_V      = -600;   // recomputed in resizeCanvas
const GRAVITY     = 1200;
const HANG_THRESH = 80;
const HANG_MULT   = 0.3;

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const lerp  = (a,b,t) => a+(b-a)*t;
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const rand  = (lo,hi) => lo+Math.random()*(hi-lo);
const ri    = (lo,hi) => Math.floor(rand(lo,hi+1));
function h2r(hex){return{r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)};}
function lc(c1,c2,t){const a=h2r(c1),b=h2r(c2);return `rgb(${Math.round(lerp(a.r,b.r,t))},${Math.round(lerp(a.g,b.g,t))},${Math.round(lerp(a.b,b.b,t))})`;}
function aabb(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}

// ─────────────────────────────────────────────
// AUDIO — SFX
// ─────────────────────────────────────────────
let actx=null, muted=false;
function ensureAudio(){
  if(!actx) actx=new(window.AudioContext||window['webkitAudioContext'])();
  if(actx.state==='suspended') actx.resume();
}
function tone(freq,type,dur,vol,bend=0){
  if(muted||!actx) return;
  const o=actx.createOscillator(),g=actx.createGain();
  o.connect(g); g.connect(actx.destination);
  o.type=type; o.frequency.value=freq*(1+rand(-0.04,0.04));
  if(bend) o.frequency.exponentialRampToValueAtTime(freq*bend,actx.currentTime+dur);
  g.gain.setValueAtTime(vol,actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,actx.currentTime+dur);
  o.start(); o.stop(actx.currentTime+dur);
}
const sfxJump    = ()=>{ ensureAudio(); tone(380+rand(-30,30),'sine',0.14,0.28,1.6); };
const sfxJump2   = ()=>{ ensureAudio(); tone(520+rand(-20,20),'sine',0.11,0.22,1.8); };
const sfxDeath   = ()=>{ ensureAudio(); tone(380,'sawtooth',0.4,0.3,0.1); setTimeout(()=>tone(180,'sine',0.4,0.3,0.2),120); };
const sfxLevelOK = ()=>{ ensureAudio(); [440,550,660,880].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.3,0.3),i*80)); };
const sfxNear    = ()=>{ ensureAudio(); tone(820,'sine',0.08,0.12,1.2); };
const sfxVictory = ()=>{ ensureAudio(); [440,550,660,770,880,990,1100].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.38,0.35),i*95)); };
const sfxCollect = ()=>{ ensureAudio(); tone(880,'sine',0.1,0.22,1.5); setTimeout(()=>tone(1108,'sine',0.12,0.2),80); };

// ─────────────────────────────────────────────
// MUSIC — per-level procedural scheduler
// ─────────────────────────────────────────────
// Melody + bass patterns (0 = rest). Frequencies in Hz.
const MUSIC = [
  { // L1 Sunlight — bright C-major arpeggios, fast
    mel:[523,659,784,880,784,659,523,659,784,1047,784,659],
    bas:[131,0,196,0,131,0,174,0,131,0,196,0],
    tempo:165, mt:'sine',     bt:'triangle', mv:0.11, bv:0.07
  },
  { // L2 Shallow — G-major, warm and bouncy
    mel:[392,494,587,784,587,494,392,494,587,784,659,494],
    bas:[196,0,147,0,196,0,220,0,196,0,147,0],
    tempo:210, mt:'sine',     bt:'triangle', mv:0.10, bv:0.065
  },
  { // L3 Twilight — D-natural minor, mysterious
    mel:[587,698,880,0,698,587,0,698,523,587,0,440],
    bas:[147,0,220,0,147,0,196,0,147,0,220,0],
    tempo:300, mt:'triangle', bt:'sine',     mv:0.09, bv:0.06
  },
  { // L4 Deep Twilight — A-minor, dark & slower
    mel:[440,523,659,0,659,523,440,0,523,659,698,0],
    bas:[110,0,165,0,110,0,130,0,110,0,165,0],
    tempo:365, mt:'triangle', bt:'sine',     mv:0.08, bv:0.055
  },
  { // L5 Midnight — E-phrygian, sparse drones
    mel:[330,349,0,392,0,440,0,392,349,330,0,0],
    bas:[82,0,0,123,0,0,82,0,0,110,0,0],
    tempo:445, mt:'sine',     bt:'triangle', mv:0.08, bv:0.07
  },
  { // L6 Abyssal — chromatic descent, industrial tension
    mel:[494,0,466,0,440,0,415,0,440,0,466,0],
    bas:[82,0,78,0,73,0,69,0,73,0,78,0],
    tempo:315, mt:'square',   bt:'sawtooth', mv:0.055,bv:0.048
  },
  { // L7 Hadal — ultra-sparse, eerie single pulses
    mel:[185,0,0,0,196,0,0,0,185,0,0,0],
    bas:[46,0,0,0,62,0,0,0,46,0,0,0],
    tempo:560, mt:'sine',     bt:'sine',     mv:0.07, bv:0.065
  },
];

let musicBeat=0, musicLevel=-1, musicTimer=null, musicBus=null, musicFilt=null;

function startMusic(li) {
  stopMusic();
  if (muted) return;
  ensureAudio();
  musicLevel = li;
  musicBeat  = 0;
  // Route all music notes through a low-pass filter that gets murkier at depth
  musicBus  = actx.createGain(); musicBus.gain.value = 1.0;
  musicFilt = actx.createBiquadFilter();
  musicFilt.type = 'lowpass';
  musicFilt.frequency.value = lerp(14000, 650, li / 6);
  musicFilt.Q.value = 1.2;
  musicBus.connect(musicFilt); musicFilt.connect(actx.destination);
  scheduleBeat();
}
function stopMusic() {
  if (musicTimer !== null) { clearTimeout(musicTimer); musicTimer = null; }
  musicLevel = -1; musicBus = null; musicFilt = null;
}
function scheduleBeat() {
  if (muted || musicLevel < 0) return;
  const pat = MUSIC[musicLevel];
  const mel = pat.mel[musicBeat % pat.mel.length];
  const bas = pat.bas[musicBeat % pat.bas.length];
  const nd  = pat.tempo / 1000 * 0.72;
  const bd  = pat.tempo / 1000 * 0.88;
  if (mel > 0) musicNote(mel, pat.mt, nd,  pat.mv);
  if (bas > 0) musicNote(bas, pat.bt, bd,  pat.bv);
  musicBeat = (musicBeat + 1) % pat.mel.length;
  musicTimer = setTimeout(scheduleBeat, pat.tempo);
}
function musicNote(freq, type, dur, vol) {
  if (muted || !actx || !musicBus) return;
  const o=actx.createOscillator(), g=actx.createGain();
  o.connect(g); g.connect(musicBus);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime+dur);
  o.start(); o.stop(actx.currentTime+dur);
}

// ─────────────────────────────────────────────
// PARTICLES
// ─────────────────────────────────────────────
class Particle {
  constructor(x,y,vx,vy,r,color,life,type){
    Object.assign(this,{x,y,vx,vy,r,color,life,maxLife:life,type,dead:false});
  }
  update(dt){
    this.x+=this.vx*dt; this.y+=this.vy*dt;
    if(this.type==='bubble'||this.type==='trail'){this.vy-=28*dt; this.vx*=0.98;}
    else if(this.type==='smoke'){this.vy-=18*dt; this.vx+=rand(-8,8)*dt;}
    this.life-=dt; if(this.life<=0) this.dead=true;
  }
  draw(ctx){
    const a=clamp(this.life/this.maxLife,0,1);
    const r=this.r*(0.4+0.6*(this.life/this.maxLife));
    ctx.save(); ctx.globalAlpha=a*0.85;
    if(this.type==='sparkle'){
      ctx.fillStyle=this.color; ctx.shadowColor=this.color; ctx.shadowBlur=7;
      ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.fill();
    } else if(this.type==='smoke'){
      ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle=this.color; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
}
class Particles {
  constructor(){ this.list=[]; }
  emit(x,y,n,type,o={}){
    for(let i=0;i<n;i++){
      const ang = o.ang!==undefined ? rand(o.ang-o.spread,o.ang+o.spread) : rand(0,Math.PI*2);
      const spd = rand(o.minS||20,o.maxS||100);
      const vx=Math.cos(ang)*spd, vy=Math.sin(ang)*spd;
      const r    = rand(o.minR||2,o.maxR||5);
      const life = rand(o.minL||0.4,o.maxL||0.9);
      const cols = o.cols||['rgba(200,230,255,0.9)'];
      this.list.push(new Particle(x,y,vx,vy,r,cols[ri(0,cols.length-1)],life,type));
    }
  }
  update(dt){ for(let i=this.list.length-1;i>=0;i--){ this.list[i].update(dt); if(this.list[i].dead) this.list.splice(i,1); } }
  draw(ctx){ this.list.forEach(p=>p.draw(ctx)); }
  clear(){ this.list=[]; }
}

// ─────────────────────────────────────────────
// BACKGROUND FISH  — vibrant per-zone palettes
// ─────────────────────────────────────────────
const BFISH_COLS = [
  ['#FFE033','#33EEFF','#FF6B6B','#88FF44'],   // L1 — gold, cyan, coral, lime
  ['#FF8C00','#FF4500','#FFD700','#FF69B4'],   // L2 — vivid oranges + hot-pink
  ['#00E5FF','#DA70D6','#7B68EE','#00FA9A'],   // L3 — teal, orchid, slate-blue, mint
  ['#00FF7F','#ADFF2F','#40E0D0','#00BFFF'],   // L4 — vivid greens + turquoise
  ['#FF00FF','#00FFFF','#FF69B4','#BF5FFF'],   // L5 — magenta, cyan, hot-pink, violet
  ['#FF4500','#FF0000','#FF6347','#FF8C69'],   // L6 — vivid reds/salmon
  ['#00FF88','#00FFFF','#AAFFEE','#00CCFF'],   // L7 — vivid teals
];

class BgFish {
  constructor(li){ this.li=li; this.reset(true); }
  reset(init=false){
    this.dir   = Math.random()>0.5?1:-1;
    this.x     = this.dir===1 ? rand(-150,-20) : rand(W+20,W+150);
    if(init) this.x = rand(0,W);
    this.y     = rand(35,FLOOR_Y-10);
    this.spd   = rand(28,85);
    this.sz    = rand(7,22);
    this.alpha = rand(0.28,0.55);   // boosted from original 0.18-0.45
    this.wob   = Math.random()*Math.PI*2;
    this.wobSpd= rand(2,5);
    this.type  = ri(0,3);
    const cols = BFISH_COLS[this.li];
    this.color = cols[ri(0,cols.length-1)];
  }
  update(dt){
    this.x+=this.dir*this.spd*dt; this.wob+=this.wobSpd*dt;
    if(this.x>W+100||this.x<-100) this.reset();
  }
  draw(ctx){
    ctx.save();
    ctx.globalAlpha=this.alpha;
    ctx.translate(this.x, this.y+Math.sin(this.wob)*3);
    if(this.dir===-1) ctx.scale(-1,1);
    ctx.fillStyle=this.color;
    if(this.type===2){
      ctx.beginPath(); ctx.ellipse(0,0,this.sz*1.9,this.sz*0.38,0,0,Math.PI*2); ctx.fill();
    } else if(this.type===1){
      ctx.beginPath(); ctx.arc(0,0,this.sz*0.75,0,Math.PI*2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(0,0,this.sz,this.sz*0.48,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-this.sz,0); ctx.lineTo(-this.sz*1.55,-this.sz*0.48); ctx.lineTo(-this.sz*1.55,this.sz*0.48); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
// OBSTACLE — vibrant color palette
// ─────────────────────────────────────────────
const OBS_W=[16,18,28,22,32,20,26];

// Vibrant obstacle colors
const OBS_COLORS = [
  {b:'#00FF44',d:'#00BB22'},  // 0 Seagrass    — neon green
  {b:'#FF9900',d:'#CC5500'},  // 1 Kelp         — vivid amber
  {b:'#FF2200',d:'#FF6633'},  // 2 Coral Fan    — vivid red-orange
  {b:'#FF00BB',d:'#CC0088'},  // 3 Anemone      — vivid magenta
  {b:'#FF5500',d:'#CC2200'},  // 4 Tube Worms   — vivid orange
  {b:'#00FFFF',d:'#00AAFF'},  // 5 Biolum. Vine — vivid cyan
  {b:'#888888',d:'#444444'},  // 6 Vent Chimney — medium gray
];

class Obstacle {
  constructor(x,li,cfg){
    this.x=x; this.li=li; this.type=cfg.obs;
    this.isDual=cfg.dual&&Math.random()>0.38;
    this.w=OBS_W[this.type];
    this.sway=Math.random()*Math.PI*2;
    this.swaySpd=rand(1.4,3.2)*(1+li*0.09);
    this.swayAmp=rand(2,6);
    this.passed=false; this.flash=0;

    // Heights derived from LEVELS fractions × current FLOOR_Y so they scale
    // with any screen size and remain clearable relative to the fish's jump arc.
    // Max jump height ≈ JUMP_V² / (2*GRAVITY) ≈ 0.575 * FLOOR_Y
    // Fish apex y-coordinate ≈ 0.425 * FLOOR_Y (from top of screen, y increases down).
    if(this.isDual){
      // CEILING-FIRST DESIGN: fix the ceiling height so its bottom edge is always
      // below the fish's apex (y > 0.425*FLOOR_Y), guaranteeing the apex is inside
      // the gap. Range lerps from shallower (ceiling shorter) to deeper (taller).
      const ceilMinFrac = lerp(0.26, 0.32, li/6);
      const ceilMaxFrac = lerp(0.36, 0.40, li/6);
      const gapFrac     = lerp(0.28, 0.21, li/6);
      this.ceilH  = rand(ceilMinFrac, ceilMaxFrac) * FLOOR_Y;
      this.floorH = Math.max(15, FLOOR_Y - this.ceilH - gapFrac * FLOOR_Y);
    } else {
      // Single floor obstacle: cap at 34% of FLOOR_Y (well below ~47% jump apex).
      const mn = cfg.minH * FLOOR_Y;
      const mx = Math.min(cfg.maxH * FLOOR_Y, FLOOR_Y * 0.34);
      this.floorH = rand(mn, mx);
    }
    // Pre-compute tube worm heights so they don't flicker each frame
    if(this.type===4) this.tubeH=[rand(0.72,1.0),rand(0.72,1.0),rand(0.72,1.0)];
  }
  update(dt){ this.sway+=this.swaySpd*dt; if(this.flash>0) this.flash-=dt; }
  sw(){ return Math.sin(this.sway)*this.swayAmp; }
  floorBounds(){ return{x:this.x+this.sw()-this.w/2, y:FLOOR_Y-this.floorH, w:this.w, h:this.floorH}; }
  ceilBounds(){ if(!this.isDual) return null; return{x:this.x+this.sw()-this.w/2, y:0, w:this.w, h:this.ceilH}; }
  draw(ctx){
    const sw=this.sw(), fl=this.flash>0;
    this._draw(ctx,this.x+sw,FLOOR_Y,this.floorH,false,fl);
    if(this.isDual) this._draw(ctx,this.x+sw,0,this.ceilH,true,fl);
  }
  _draw(ctx,x,baseY,height,fromTop,flash){
    const c = OBS_COLORS[this.type];
    const bc=flash?'#FFF':c.b, dc=flash?'#EEE':c.d;
    ctx.save(); ctx.translate(x,baseY); if(fromTop) ctx.scale(1,-1);

    if(this.type===0){ // Seagrass
      ctx.strokeStyle=bc; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(7,-height*.5,2,-height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5,0); ctx.quadraticCurveTo(-9,-height*.45,-4,-height*.88); ctx.stroke();

    } else if(this.type===1){ // Kelp
      ctx.strokeStyle=bc; ctx.lineWidth=5;
      ctx.beginPath(); ctx.moveTo(0,0);
      for(let i=1;i<=6;i++){const t=i/6; ctx.lineTo(Math.sin(t*Math.PI*2+this.sway)*7,-height*t);}
      ctx.stroke();
      ctx.fillStyle=dc;
      for(let i=1;i<=3;i++){const t=i/3.5; const kx=Math.sin(t*Math.PI*2+this.sway)*7,ky=-height*t; ctx.beginPath(); ctx.ellipse(kx+9,ky,9,4,0.5,0,Math.PI*2); ctx.fill();}

    } else if(this.type===2){ // Coral Fan
      ctx.fillStyle=bc; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-this.w*.85,-height); ctx.lineTo(this.w*.85,-height); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=dc; ctx.lineWidth=1.5;
      for(let i=-2;i<=2;i++){ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(i*this.w*.38,-height); ctx.stroke();}

    } else if(this.type===3){ // Anemone
      ctx.fillStyle=bc; ctx.beginPath(); ctx.rect(-this.w/2,-height,this.w,height); ctx.fill();
      ctx.strokeStyle=bc; ctx.lineWidth=3;
      for(let i=-2;i<=2;i++){
        const tx=i*(this.w/5), ty=-height, wv=Math.sin(this.sway*1.5+i)*9;
        ctx.beginPath(); ctx.moveTo(tx,ty); ctx.quadraticCurveTo(tx+wv,ty-14,tx+wv*.5,ty-23); ctx.stroke();
      }

    } else if(this.type===4){ // Tube Worms (pre-computed heights)
      for(let t=0;t<3;t++){
        const tx=(t-1)*8, th=height*this.tubeH[t];
        ctx.fillStyle=t%2===0?bc:dc; ctx.beginPath(); ctx.rect(tx-4,-th,8,th); ctx.fill();
        ctx.fillStyle='#FF5500'; ctx.beginPath(); ctx.ellipse(tx,-th,5,3,0,0,Math.PI*2); ctx.fill();
      }

    } else if(this.type===5){ // Bioluminescent Vine
      ctx.strokeStyle=bc; ctx.lineWidth=4; ctx.shadowColor=bc; ctx.shadowBlur=15;
      ctx.beginPath(); ctx.moveTo(0,0);
      for(let s=1;s<=9;s++){const t=s/9; ctx.lineTo(Math.sin(t*Math.PI*3+this.sway)*9,-height*t);}
      ctx.stroke(); ctx.shadowBlur=0;

    } else { // Vent Chimney
      ctx.fillStyle=bc; ctx.beginPath(); ctx.rect(-this.w/2,-height,this.w,height); ctx.fill();
      ctx.strokeStyle=dc; ctx.lineWidth=2;
      for(let r=1;r<=4;r++){const ry=-height*(r/5); ctx.beginPath(); ctx.moveTo(-this.w/2,ry); ctx.lineTo(this.w/2,ry); ctx.stroke();}
      ctx.fillStyle='#0A0A0A'; ctx.beginPath(); ctx.ellipse(0,-height,this.w/2+2,5,0,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
// PLAYER
// ─────────────────────────────────────────────
class Player {
  constructor(){
    this.x=110; this.y=FLOOR_Y; this.vy=0; this.onGround=true;
    this.sx=1; this.sy=1; this.sqTimer=0; this.sqDur=0; this.sqTx=1; this.sqTy=1;
    this.anim=0; this.dead=false; this.jumpsLeft=2;
  }
  jump(){
    if(this.jumpsLeft<=0||this.dead) return false;
    const isSecond=!this.onGround;
    this.vy=isSecond?JUMP_V*0.82:JUMP_V;
    this.onGround=false; this.jumpsLeft--;
    this.sx=0.8; this.sy=1.3; this.sqTimer=0; this.sqDur=0.09; this.sqTx=1; this.sqTy=1;
    if(isSecond) sfxJump2(); else sfxJump();
    return true;
  }
  update(dt,li){
    this.anim+=dt;
    const w=WEIGHTS[li];
    if(!this.onGround){
      const gm=Math.abs(this.vy)<HANG_THRESH?HANG_MULT:1.0;
      this.vy+=GRAVITY*w*gm*dt;
    }
    this.y+=this.vy*dt;
    if(this.y>=FLOOR_Y){
      if(!this.onGround){
        this.onGround=true; this.vy=0; this.jumpsLeft=2;
        this.sx=1.3; this.sy=0.6; this.sqTimer=0; this.sqDur=0.28; this.sqTx=1; this.sqTy=1;
        // No landing SFX (removed per request)
        return 'landed';
      }
      this.y=FLOOR_Y; this.vy=0; this.onGround=true;
    }
    if(this.sqDur>0){
      this.sqTimer+=dt; const t=Math.min(this.sqTimer/this.sqDur,1);
      const ov=Math.sin(t*Math.PI)*0.1*(this.sy<1?1:-1);
      this.sx=lerp(this.sx,this.sqTx,t*0.18)+ov;
      this.sy=lerp(this.sy,this.sqTy,t*0.18);
      if(t>=1){this.sx=1; this.sy=1; this.sqDur=0;}
    }
    return null;
  }
  hitbox(soft=true){
    const s=soft?0.82:1; const hw=40*s, hh=28*s;
    return{x:this.x-hw/2, y:this.y-hh/2, w:hw, h:hh};
  }
  draw(ctx,li){
    const t=clamp(li/6,0,1);
    const body=lc('#FF6B35','#0AFFEF',t*t);
    const fin =lc('#FF9A5C','#00BFBF',t*t);
    const glow=t*14;
    const FS=1.5; // fish draw scale — visual only, hitbox handled separately
    ctx.save(); ctx.translate(this.x,this.y); ctx.scale(this.sx*FS,this.sy*FS);
    if(glow){ctx.shadowColor=body; ctx.shadowBlur=glow;}
    const tw=Math.sin(this.anim*8)*0.15;
    ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(0,0,18,11,0,0,Math.PI*2); ctx.fill();
    if(li<3){ctx.save(); ctx.globalAlpha=0.45; ctx.strokeStyle='#FFF'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(2,0,9,-0.8,0.8); ctx.stroke(); ctx.restore();}
    ctx.fillStyle=fin; ctx.save(); ctx.translate(-18,0); ctx.rotate(tw);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-10,-9); ctx.lineTo(-10,9); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle=fin; ctx.beginPath(); ctx.moveTo(-5,-10); ctx.lineTo(4,-18); ctx.lineTo(10,-10); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(9,-2,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1A1A2E'; ctx.beginPath(); ctx.arc(10,-2,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(11,-3,1.2,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.restore();
  }
}

// ─────────────────────────────────────────────
// LIGHT SHAFT
// ─────────────────────────────────────────────
class Shaft {
  constructor(){ this.reset(); }
  reset(){ this.x=rand(0,W); this.w=rand(28,75); this.spd=rand(18,48); this.alpha=rand(0.05,0.11); }
  update(dt){ this.x+=this.spd*dt; if(this.x-this.w>W) this.reset(); }
  draw(ctx){
    ctx.save(); ctx.globalAlpha=this.alpha;
    const g=ctx.createLinearGradient(this.x,0,this.x+this.w*.3,H);
    g.addColorStop(0,'#FFF'); g.addColorStop(1,'transparent'); ctx.fillStyle=g;
    ctx.beginPath(); ctx.moveTo(this.x,0); ctx.lineTo(this.x+this.w,0); ctx.lineTo(this.x+this.w*.55,H); ctx.lineTo(this.x-this.w*.45,H); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
// SAND DOLLAR — collectible, +10 pts each
// ─────────────────────────────────────────────
class SandDollar {
  constructor(x, y){
    this.x=x; this.y=y; this.baseY=y;
    this.r=13;
    this.bobPhase=Math.random()*Math.PI*2;
    this.bobSpd=rand(1.5,2.5);
    this.glowPhase=Math.random()*Math.PI*2;
  }
  update(dt, scrollSpd){
    this.x -= scrollSpd * dt;
    this.bobPhase  += this.bobSpd * dt;
    this.glowPhase += 2.2 * dt;
    this.y = this.baseY + Math.sin(this.bobPhase) * 5;
  }
  draw(ctx){
    const glow = 6 + Math.sin(this.glowPhase) * 3;
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = glow;
    // Outer disc
    ctx.fillStyle = '#F4D03F'; ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    // Inner ring
    ctx.strokeStyle = '#DAA520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0,0,this.r*0.65,0,Math.PI*2); ctx.stroke();
    // 5 petals of the flower pattern
    ctx.fillStyle = '#E8B84B'; ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 1;
    for(let p=0;p<5;p++){
      const ang=(p/5)*Math.PI*2 - Math.PI/2;
      const px=Math.cos(ang)*this.r*0.43, py=Math.sin(ang)*this.r*0.43;
      ctx.beginPath(); ctx.arc(px,py,this.r*0.27,0,Math.PI*2); ctx.fill(); ctx.stroke();
    }
    // Star lines from center
    ctx.strokeStyle='#8B6914'; ctx.lineWidth=1;
    for(let s=0;s<5;s++){
      const ang=(s/5)*Math.PI*2-Math.PI/2;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ang)*this.r*0.75,Math.sin(ang)*this.r*0.75); ctx.stroke();
    }
    // Center dot
    ctx.fillStyle='#8B6914'; ctx.beginPath(); ctx.arc(0,0,this.r*0.15,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.restore();
  }
  bounds(){ return{x:this.x-this.r, y:this.y-this.r, w:this.r*2, h:this.r*2}; }
}

// ─────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────
let state='MENU';
let li=0;
let player, parts, obs, bgfish, shafts, ambBubbles;
let sandDollars=[], score=0, nextSD=0;
let scrollDist, nextObs, speedBonus;
let shakeX=0, shakeY=0, shakeTimer=0, shakeDur=0, shakeAmp=0;
let deadAlpha=0, levelDoneTimer=0, victTimer=0, menuT=0;
let finishDone=false;

function initLevel(idx){
  li=idx;
  player=new Player();
  parts=new Particles();
  obs=[]; sandDollars=[];
  scrollDist=0; nextObs=350; speedBonus=0; finishDone=false; deadAlpha=0;
  nextSD = rand(500,900);
  if(idx===0) score=0;   // reset score only on new game

  const cfg=LEVELS[idx];
  bgfish=[];
  for(let i=0;i<cfg.bgn+2;i++) bgfish.push(new BgFish(idx));
  shafts=[];
  if(cfg.shafts) for(let i=0;i<5;i++) shafts.push(new Shaft());
  ambBubbles=[];
  for(let i=0;i<14;i++) ambBubbles.push({x:rand(0,W),y:rand(0,H),r:rand(2,5),spd:rand(14,38),a:rand(0.08,0.28)});

  if(!muted) startMusic(idx);
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function triggerShake(idx){
  shakeAmp=SHAKE_PX[idx]; shakeDur=lerp(0.1,0.25,idx/6); shakeTimer=0;
}
function burstLand(x,y,idx){
  parts.emit(x,y,BUBBLES[idx],'bubble',{ang:-Math.PI/2,spread:Math.PI/2,minS:50,maxS:180,minR:2,maxR:6,minL:0.5,maxL:0.9,cols:['rgba(200,230,255,.9)','rgba(160,210,240,.8)','rgba(255,255,255,.7)']});
}
function burstDeath(x,y){
  parts.emit(x,y,22,'bubble',{ang:0,spread:Math.PI,minS:80,maxS:250,minR:3,maxR:8,minL:0.6,maxL:1.2,cols:['rgba(255,100,100,.9)','rgba(255,200,100,.8)','rgba(255,255,255,.7)']});
}
function trailJump(x,y){
  parts.emit(x-18,y,2,'trail',{ang:Math.PI,spread:Math.PI/6,minS:18,maxS:55,minR:1,maxR:3,minL:0.2,maxL:0.38,cols:['rgba(180,220,255,.6)']});
}
function bioSparkle(){
  if(li<4) return; const s=LEVELS[li].bio;
  if(Math.random()<s*0.04){
    parts.emit(rand(0,W),rand(20,H-40),1,'sparkle',{ang:0,spread:Math.PI,minS:4,maxS:18,minR:1.5,maxR:4,minL:0.8,maxL:2.0,cols:['#00FFFF','#00FF88','#AA00FF','#00FFCC']});
  }
}
function ventSmoke(x,y){
  parts.emit(x,y,1,'smoke',{ang:-Math.PI/2,spread:Math.PI/8,minS:18,maxS:48,minR:3,maxR:7,minL:0.8,maxL:1.3,cols:['rgba(40,40,40,.5)','rgba(60,50,50,.4)']});
}

// ─────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────
function doJump(){
  ensureAudio();
  if(state==='MENU'   ){ state='PLAYING'; initLevel(0); return; }
  if(state==='DEAD'   ){ state='PLAYING'; initLevel(li); return; }
  if(state==='VICTORY'){ state='MENU'; li=0; return; }
  if(state==='PLAYING') player.jump();
}
document.addEventListener('keydown', e=>{ if(e.code==='Space'||e.key===' '){ e.preventDefault(); doJump(); } });
canvas.addEventListener('click', e=>{
  const r=canvas.getBoundingClientRect();
  const mx=(e.clientX-r.left)*(W/r.width), my=(e.clientY-r.top)*(H/r.height);
  if(mx>W-55&&my<45){ muted=!muted; if(muted) stopMusic(); else startMusic(li); return; }
  doJump();
});
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); doJump(); },{ passive:false });

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
function update(dt){
  if(state==='MENU'){ menuT+=dt; return; }
  if(state==='DEAD'){ deadAlpha=Math.min(deadAlpha+dt*1.6,0.62); parts.update(dt); return; }
  if(state==='LEVEL_COMPLETE'){
    levelDoneTimer+=dt; parts.update(dt);
    if(levelDoneTimer>2.2){
      const nx=li+1;
      if(nx>=LEVELS.length){ state='VICTORY'; victTimer=0; sfxVictory(); }
      else{ initLevel(nx); state='PLAYING'; }
    }
    return;
  }
  if(state==='VICTORY'){
    victTimer+=dt; parts.update(dt);
    if(Math.random()<0.28) parts.emit(rand(0,W),rand(0,H),3,'bubble',{ang:-Math.PI/2,spread:Math.PI,minS:28,maxS:95,minR:3,maxR:8,minL:0.8,maxL:1.6,cols:['#00FFCC','#00D4FF','#FFF','#FFD700']});
    return;
  }

  // ── PLAYING ──
  const cfg=LEVELS[li];
  speedBonus=Math.min(speedBonus+dt*(cfg.spd*0.03/20), cfg.spd*0.18);
  const spd=cfg.spd+speedBonus;
  scrollDist+=spd*dt;

  // Player
  const res=player.update(dt,li);
  if(res==='landed'){ triggerShake(li); burstLand(player.x,player.y,li); }
  if(!player.onGround) trailJump(player.x,player.y);

  // Screen shake
  if(shakeTimer<shakeDur){
    shakeTimer+=dt; const p=1-shakeTimer/shakeDur;
    shakeX=rand(-1,1)*shakeAmp*p; shakeY=rand(-1,1)*shakeAmp*p;
  } else { shakeX=0; shakeY=0; }

  // Obstacles
  for(let i=obs.length-1;i>=0;i--){
    obs[i].x-=spd*dt; obs[i].update(dt);
    if(obs[i].x<-60){ obs.splice(i,1); continue; }
    if(obs[i].type===6&&li>=5) ventSmoke(obs[i].x, obs[i].floorBounds().y);

    if(!player.dead){
      const hb=player.hitbox(true);
      const fb=obs[i].floorBounds(), cb=obs[i].ceilBounds();
      if(aabb(hb.x,hb.y,hb.w,hb.h,fb.x,fb.y,fb.w,fb.h)||(cb&&aabb(hb.x,hb.y,hb.w,hb.h,cb.x,cb.y,cb.w,cb.h))){
        player.dead=true; state='DEAD'; deadAlpha=0; burstDeath(player.x,player.y); sfxDeath(); stopMusic(); break;
      }
      if(!obs[i].passed&&obs[i].x<player.x){
        obs[i].passed=true;
        const nhb={x:hb.x-hb.w*.25,y:hb.y,w:hb.w*1.5,h:hb.h};
        if(aabb(nhb.x,nhb.y,nhb.w,nhb.h,fb.x,fb.y,fb.w,fb.h)||(cb&&aabb(nhb.x,nhb.y,nhb.w,nhb.h,cb.x,cb.y,cb.w,cb.h))){
          obs[i].flash=0.15; sfxNear();
        }
      }
    }
  }
  if(state==='DEAD') return;

  // Spawn obstacles
  if(scrollDist>=nextObs){
    obs.push(new Obstacle(W+55,li,cfg));
    nextObs=scrollDist+rand(cfg.freq*.72,cfg.freq*1.28);
  }

  // Sand dollars — spawn + update + collect
  if(scrollDist>=nextSD){
    const sdY = cfg.dual
      ? rand(H*0.22, H*0.65)   // dual levels: middle area
      : rand(55, FLOOR_Y*0.52); // floor-only levels: upper clear zone
    sandDollars.push(new SandDollar(W+40, sdY));
    nextSD = scrollDist + rand(900, 1600);
  }
  for(let i=sandDollars.length-1;i>=0;i--){
    sandDollars[i].update(dt, spd);
    if(sandDollars[i].x < -30){ sandDollars.splice(i,1); continue; }
    if(!player.dead){
      const hb=player.hitbox(false);
      const sb=sandDollars[i].bounds();
      if(aabb(hb.x,hb.y,hb.w,hb.h,sb.x,sb.y,sb.w,sb.h)){
        score+=10;
        parts.emit(sandDollars[i].x,sandDollars[i].y,12,'sparkle',{
          ang:0,spread:Math.PI,minS:40,maxS:130,minR:2,maxR:5,minL:0.4,maxL:0.85,
          cols:['#FFD700','#FFF8DC','#FFB300','#FFFACD']
        });
        sfxCollect();
        sandDollars.splice(i,1);
      }
    }
  }

  // Level end
  if(!finishDone&&scrollDist>=LEVEL_LENGTH){
    finishDone=true;
    if(li===6){ state='VICTORY'; victTimer=0; sfxVictory(); stopMusic(); }
    else{ state='LEVEL_COMPLETE'; levelDoneTimer=0; sfxLevelOK(); stopMusic(); }
  }

  bgfish.forEach(f=>f.update(dt));
  parts.update(dt); bioSparkle();
  shafts.forEach(s=>s.update(dt));
  ambBubbles.forEach(b=>{ b.y-=b.spd*dt; if(b.y<-10) b.y=H+10; b.x+=Math.sin(b.y*.05)*.5; });
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function render(){
  ctx.save(); ctx.translate(shakeX,shakeY);
  if(state==='MENU'   ){ drawMenu();    ctx.restore(); return; }
  if(state==='VICTORY'){ drawVictory(); ctx.restore(); return; }

  drawBg();
  obs.forEach(o=>o.draw(ctx));
  sandDollars.forEach(s=>s.draw(ctx));
  if(li===6&&scrollDist>=LEVEL_LENGTH-400) drawFinish();
  player.draw(ctx,li);
  parts.draw(ctx);
  drawHUD();
  if(state==='DEAD')           drawDead();
  if(state==='LEVEL_COMPLETE') drawLevelDone();
  ctx.restore();
}

function drawBg(){
  const cfg=LEVELS[li];
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,cfg.bg[0]); g.addColorStop(1,cfg.bg[1]);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  shafts.forEach(s=>s.draw(ctx));
  bgfish.forEach(f=>f.draw(ctx));

  ctx.save();
  ambBubbles.forEach(b=>{ ctx.globalAlpha=b.a; ctx.strokeStyle='#AADDFF'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke(); });
  ctx.restore();

  const fg=ctx.createLinearGradient(0,FLOOR_Y,0,H);
  const fc=[['#8B7355','#5D4037'],['#795548','#4E342E'],['#546E7A','#263238'],['#37474F','#1C2A30'],['#1A1A2E','#0D0D1A'],['#3E1F00','#1A0D00'],['#1A1A1A','#000']];
  fg.addColorStop(0,fc[li][0]); fg.addColorStop(1,fc[li][1]);
  ctx.fillStyle=fg; ctx.fillRect(0,FLOOR_Y,W,H-FLOOR_Y);

  const vs=0.28+LEVELS[li].vig*.52;
  const vg=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.8);
  vg.addColorStop(0,'transparent'); vg.addColorStop(1,`rgba(0,0,0,${vs})`);
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);

  if(li<2){
    ctx.save(); ctx.globalAlpha=0.28; ctx.strokeStyle='#AAEEFF'; ctx.lineWidth=2;
    ctx.beginPath();
    for(let x=0;x<=W;x+=20){ const y=8+Math.sin(x*.05+menuT*3)*3; if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    ctx.stroke(); ctx.restore();
  }
}

function drawFinish(){
  const dist=LEVEL_LENGTH-scrollDist;
  const fx=W+(dist*1.0);
  if(fx>W+100) return;
  ctx.save();
  ctx.shadowColor='#00FFCC'; ctx.shadowBlur=25;
  ctx.strokeStyle='#00FFCC'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(fx,0); ctx.lineTo(fx,FLOOR_Y); ctx.stroke();
  [[fx-6,FLOOR_Y-100],[fx+6,FLOOR_Y-130]].forEach(([px,py])=>{
    ctx.fillStyle='#00FFCC'; ctx.beginPath(); ctx.rect(px-5,py,10,FLOOR_Y-py); ctx.fill();
  });
  ctx.shadowBlur=8; ctx.font='bold 17px Nunito,sans-serif';
  ctx.fillStyle='#00FFCC'; ctx.textAlign='center';
  ctx.fillText('THE BOTTOM',fx,55); ctx.fillText('11,000m',fx,76);
  ctx.restore();
}

function drawHUD(){
  const cfg=LEVELS[li], ac=cfg.accent;
  const prog=clamp(scrollDist/LEVEL_LENGTH,0,1);
  const depth=Math.round(lerp(cfg.depth[0],cfg.depth[1],prog));

  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.9)'; ctx.shadowBlur=6;

  // Left column
  ctx.fillStyle=ac; ctx.textAlign='left';
  ctx.font='bold 15px Nunito,sans-serif'; ctx.fillText(`↓ ${depth}m`,12,26);
  ctx.font='12px Nunito,sans-serif'; ctx.fillText(`Zone: ${cfg.name}`,12,43);
  ctx.fillText(`Level ${li+1} / 7`,12,59);

  // Score (top centre)
  ctx.textAlign='center';
  ctx.font='bold 15px Nunito,sans-serif'; ctx.fillStyle='#FFD700';
  ctx.fillText(`★ ${score} pts`,W/2,26);

  // Mute button (top right)
  ctx.textAlign='right'; ctx.font='18px sans-serif';
  ctx.fillStyle=muted?'#666':ac; ctx.shadowBlur=0;
  ctx.fillText(muted?'🔇':'🔊',W-14,26);

  // Progress bar
  const bx=18,by=H-13,bw=W-36,bh=5;
  ctx.fillStyle='rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,3); ctx.fill();
  const bg=ctx.createLinearGradient(bx,0,bx+bw,0);
  bg.addColorStop(0,ac); bg.addColorStop(1,'#FFF');
  ctx.fillStyle=bg; ctx.beginPath(); ctx.roundRect(bx,by,bw*prog,bh,3); ctx.fill();
  ctx.restore();
}

function drawDead(){
  ctx.fillStyle=`rgba(160,0,0,${deadAlpha})`; ctx.fillRect(0,0,W,H);
  if(deadAlpha>0.28){
    ctx.save(); ctx.textAlign='center';
    ctx.font='bold 38px Nunito,sans-serif'; ctx.fillStyle='#FFF';
    ctx.shadowColor='rgba(0,0,0,.9)'; ctx.shadowBlur=8;
    ctx.fillText('WIPED OUT',W/2,H/2-32);
    const fl=lerp(0.4,1.0,Math.sin(Date.now()*.006)*.5+.5);
    ctx.globalAlpha=fl; ctx.font='bold 18px Nunito,sans-serif'; ctx.fillStyle='#FFE44D';
    ctx.fillText('SPACE / TAP  — RESTART LEVEL',W/2,H/2+18);
    ctx.restore();
  }
}

function drawLevelDone(){
  const t=clamp(levelDoneTimer/.6,0,1);
  ctx.fillStyle=`rgba(0,18,38,${t*.72})`; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.textAlign='center';
  ctx.font='bold 26px Nunito,sans-serif'; ctx.fillStyle='#00D4FF'; ctx.shadowColor='#00D4FF'; ctx.shadowBlur=14;
  ctx.fillText('Descending…',W/2,H/2-22);
  const nd=LEVELS[Math.min(li+1,6)].depth[0];
  ctx.font='17px Nunito,sans-serif'; ctx.shadowBlur=8; ctx.fillText(`↓ ${nd}m`,W/2,H/2+14);
  ctx.font='22px sans-serif';
  for(let b=0;b<5;b++){
    const bx=W/2+Math.sin(levelDoneTimer*2.8+b*1.2)*38;
    const by=H/2-85-(levelDoneTimer*55+b*18)%90;
    ctx.globalAlpha=.65; ctx.fillStyle='#FFF'; ctx.fillText('○',bx,by);
  }
  ctx.restore();
}

function drawMenu(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#00C8F0'); g.addColorStop(1,'#03045E');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  ctx.save();
  for(let i=0;i<4;i++){
    const x=80+i*165+Math.sin(menuT*.4+i)*22;
    ctx.globalAlpha=.07; ctx.fillStyle='#FFF';
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+60,0); ctx.lineTo(x+32,H); ctx.lineTo(x-32,H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  ctx.save();
  const fcols=['#FFE033','#33EEFF','#FF6B6B','#88FF44','#FF9900'];
  for(let i=0;i<5;i++){
    const fx=(menuT*58+i*148)%(W+70)-35;
    const fy=52+i*(H/8)+Math.sin(menuT*1.5+i)*13;
    ctx.globalAlpha=.35; ctx.fillStyle=fcols[i];
    ctx.save(); ctx.translate(fx,fy); ctx.scale(.9+i*.08,.9);
    ctx.beginPath(); ctx.ellipse(0,0,12,7,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(-20,-6); ctx.lineTo(-20,6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.fillStyle='#5D4037'; ctx.fillRect(0,FLOOR_Y,W,H-FLOOR_Y);

  ctx.save(); ctx.textAlign='center';
  ctx.font=`bold ${Math.round(H*0.14)}px Nunito,sans-serif`; ctx.fillStyle='#FFF';
  ctx.shadowColor='#0077B6'; ctx.shadowBlur=22;
  ctx.fillText('DEEP DIVE',W/2,H/2-H*0.15);
  ctx.font=`${Math.round(H*0.05)}px Nunito,sans-serif`; ctx.shadowBlur=10; ctx.fillStyle='#A8E4FF';
  ctx.fillText('Underwater Spikejumper',W/2,H/2-H*0.07);
  const pulse=Math.sin(menuT*3)*.5+.5;
  ctx.globalAlpha=lerp(.58,1,pulse); ctx.font=`bold ${Math.round(H*0.055)}px Nunito,sans-serif`;
  ctx.fillStyle='#00D4FF'; ctx.shadowColor='#00D4FF'; ctx.shadowBlur=14;
  ctx.fillText('SPACE / CLICK  to  DIVE IN',W/2,H/2+H*0.07);
  ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.font=`${Math.round(H*0.035)}px Nunito,sans-serif`; ctx.fillStyle='#80CCFF';
  ctx.fillText('7 depth zones · collect sand dollars · reach the Hadal Trench',W/2,H/2+H*0.165);
  ctx.restore();

  ctx.save(); ctx.font='12px Nunito,sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#A8E4FF';
  ctx.fillText('↓ 0m — Sunlight Zone',12,24); ctx.restore();
}

function drawVictory(){
  ctx.fillStyle='#000005'; ctx.fillRect(0,0,W,H);
  parts.draw(ctx);
  ctx.save(); ctx.textAlign='center';
  const p=Math.sin(victTimer*2)*.5+.5;
  ctx.font=`bold ${Math.round(H*0.13)}px Nunito,sans-serif`; ctx.fillStyle='#00FFCC';
  ctx.shadowColor='#00FFCC'; ctx.shadowBlur=28+p*18;
  ctx.fillText('YOU REACHED',W/2,H/2-H*0.2);
  ctx.fillText('THE BOTTOM!',W/2,H/2-H*0.07);
  ctx.font=`bold ${Math.round(H*0.065)}px Nunito,sans-serif`; ctx.fillStyle='#FFF'; ctx.shadowBlur=10;
  ctx.fillText('Depth: 11,000m — Mariana Trench',W/2,H/2+H*0.05);
  // Final score
  ctx.font=`bold ${Math.round(H*0.06)}px Nunito,sans-serif`; ctx.fillStyle='#FFD700'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=12;
  ctx.fillText(`★  ${score} pts`,W/2,H/2+H*0.14);
  ctx.globalAlpha=lerp(.45,1,Math.sin(victTimer*2.4)*.5+.5);
  ctx.font=`${Math.round(H*0.045)}px Nunito,sans-serif`; ctx.fillStyle='#00FFCC'; ctx.shadowBlur=0;
  ctx.fillText('SPACE / CLICK  to  PLAY AGAIN',W/2,H/2+H*0.23);
  ctx.restore();
}

// ─────────────────────────────────────────────
// GAME LOOP
// ─────────────────────────────────────────────
let last=0;
function loop(ts){
  const dt=Math.min((ts-last)/1000,.05); last=ts;
  menuT+=dt;
  update(dt); render();
  requestAnimationFrame(loop);
}

// Kick off — initialise canvas size before first frame
resizeCanvas();
requestAnimationFrame(loop);
