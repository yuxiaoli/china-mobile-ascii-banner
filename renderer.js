/**
 * China Mobile / ASCII field, original Canvas 2D implementation.
 * Dependency-free, no GPU requirement. Instantiate, then destroy on unmount.
 * The field samples an imaginary text grid through an inverse-radius twist.
 */
export const DEFAULTS = Object.freeze({
 maxDpr: 1.5, fps: 30, revealSeconds: 42, revealDelay: 1.8,
 // Visible continuous ribbon flow without speeding up the gradual logo reveal.
 vortexRadiansPerSecond: .04, arcRadiansPerSecond: .09,
 glyphCycleSeconds: 56, glyphCrossfadeSeconds: 12,
 shimmerRadiansPerSecond: .028, pointerEaseSeconds: 2.4,
 replayFadeSeconds: 5.5, background: '#ffffff'
});
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=(v)=>{v=clamp(v);return v*v*(3-2*v)};
const hash=(x,y)=>{let n=Math.imul(x|0,374761393)+Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295};
const ALPHABET='01.:+*=/<>[]{}';
export const BRAND = Object.freeze({blue:'#0085cc',green:'#95c11f'});
export function regionAt(pixels,x,y){
 const i=(Math.floor(y)*pixels.width+Math.floor(x))*4;
 if(x<0||y<0||x>=pixels.width||y>=pixels.height||pixels.data[i+3]<160)return null;
 return pixels.data[i+1]>pixels.data[i+2]?BRAND.green:BRAND.blue;
}
export function logoPose(p,progress,shimmer=0){
 const delay=clamp(p.radial*.2+p.n*.04,0,.35),local=smooth((progress-delay)/(1-delay));
 const drift=16*Math.pow(1-local,2);
 return {local,x:p.x+Math.cos(p.angle+shimmer)*drift,y:p.y+Math.sin(p.angle+shimmer)*drift};
}
// A single continuous clock. No startup acceleration or frame-count-based motion.
export function timingAt(seconds, options=DEFAULTS) {
 const t=Math.max(0,seconds), progress=clamp((t-options.revealDelay)/options.revealSeconds);
 return { progress, reveal:smooth(progress), spin:.6+t*options.vortexRadiansPerSecond, arc:t*options.arcRadiansPerSecond, shimmer:t*options.shimmerRadiansPerSecond };
}
export function glyphStateAt(i,j,t,options=DEFAULTS) {
 const phase=t/options.glyphCycleSeconds+hash(i+193,j-113), cycle=Math.floor(phase);
 const interval=options.glyphCrossfadeSeconds/options.glyphCycleSeconds;
 return { from:ALPHABET[Math.floor(hash(i+cycle*137,j+37)*ALPHABET.length)], to:ALPHABET[Math.floor(hash(i+(cycle+1)*137,j+37)*ALPHABET.length)], blend:smooth((phase-cycle-(1-interval))/interval) };
}
export class AsciiField {
 constructor(canvas,options={}) {
  this.canvas=canvas;this.options={...DEFAULTS,...options};this.context=canvas.getContext('2d',{alpha:false});
  if(!this.context)throw new Error('Canvas 2D unavailable');
  this.time=0;this.paused=false;this.reduced=!!options.reduced;this.visible=!document.hidden;this.destroyed=false;this.raf=0;this.previous=0;this.lastDraw=0;
  this.replaySnapshot=null;this.replayElapsed=0;this.pointer={x:0,y:0};this.target={x:0,y:0};this.frameCount=0;
  this.onPointer=e=>{const r=canvas.getBoundingClientRect();this.target={x:((e.clientX-r.left)/r.width-.5)*8,y:((e.clientY-r.top)/r.height-.5)*6}};
  this.onLeave=()=>{this.target={x:0,y:0}};
  this.onVisibility=()=>{this.visible=!document.hidden;this.schedule()};
  this.tick=this.tick.bind(this);this.resize=this.resize.bind(this);
  this.resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(this.resize):null;
  this.resizeObserver?.observe(canvas);window.addEventListener('resize',this.resize,{passive:true});
  canvas.parentElement.addEventListener('pointermove',this.onPointer,{passive:true});canvas.parentElement.addEventListener('pointerleave',this.onLeave,{passive:true});
  document.addEventListener('visibilitychange',this.onVisibility);
  this.intersection=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{this.inView=entries[0]?.isIntersecting!==false;this.schedule()}):null;
  this.intersection?.observe(canvas);this.inView=true;this.resize();this.schedule();
 }
 resize(){if(this.destroyed)return;const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.dpr=Math.min(window.devicePixelRatio||1,this.options.maxDpr);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.context.setTransform(this.dpr,0,0,this.dpr,0,0);this.mobile=this.width<=700;this.cx=this.width/2;this.cy=this.height*.47;this.cell=Math.max(6.1,Math.min(8.7,this.width/155));this.row=this.cell*1.5;this.buildLogo();this.render()}
 buildLogo(){
  const pixels=this.options.logoPixels;
  if(!pixels?.data)throw new Error('Logo pixels are required');
  const side=Math.min(this.width*.76,this.height*.66,460),scale=side/pixels.width;
  this.logoBounds={width:side,height:pixels.height*scale};
  const left=this.cx-side/2,top=this.cy-this.logoBounds.height/2;
  const stepX=this.mobile?3.5:4.2,stepY=this.mobile?5:6;
  this.title=[];this.titleFont=this.mobile?5.3:6.3;
  for(let y=stepY/2;y<this.logoBounds.height;y+=stepY)for(let x=stepX/2;x<side;x+=stepX){
   const color=regionAt(pixels,x/scale,y/scale);if(!color)continue;
   const nx=(x-side/2)/(side/2),ny=(y-this.logoBounds.height/2)/(this.logoBounds.height/2);
   this.title.push({x:left+x,y:top+y,n:hash(Math.round(x*10),Math.round(y*10)),radial:Math.hypot(nx,ny),angle:Math.atan2(ny,nx),color});
  }
 }
 schedule(){cancelAnimationFrame(this.raf);this.raf=0;this.previous=0;if(!this.destroyed&&!this.paused&&!this.reduced&&this.visible&&this.inView)this.raf=requestAnimationFrame(this.tick)}
 tick(now){
  if(this.destroyed||this.paused||this.reduced||!this.visible||!this.inView)return;
  this.raf=0;const dt=this.previous?Math.min((now-this.previous)/1000,.075):0;this.previous=now;this.time+=dt;
  if(this.replaySnapshot){this.replayElapsed+=dt;if(this.replayElapsed>=this.options.replayFadeSeconds)this.replaySnapshot=null}
  const ease=1-Math.exp(-dt/this.options.pointerEaseSeconds);
  this.pointer.x+=(this.target.x-this.pointer.x)*ease;this.pointer.y+=(this.target.y-this.pointer.y)*ease;
  if(now-this.lastDraw>=1000/this.options.fps){this.render();this.lastDraw=now}
  if(!this.paused&&!this.reduced&&this.visible&&this.inView)this.raf=requestAnimationFrame(this.tick)
 }
 setPaused(value){this.paused=!!value;this.schedule()}
 setReduced(value){this.reduced=!!value;this.replaySnapshot=null;this.render();this.schedule()}
 replay(){
  if(this.reduced)return;
  // Retain the current frame, then dissolve into the new reveal without a cut.
  const snapshot=document.createElement('canvas');snapshot.width=this.canvas.width;snapshot.height=this.canvas.height;
  const context=snapshot.getContext('2d');if(context){context.drawImage(this.canvas,0,0);this.replaySnapshot=snapshot;this.replayElapsed=0}
  this.time=0;this.paused=false;this.previous=0;this.render();this.schedule()
 }
 render(){
  const c=this.context,w=this.width,h=this.height;if(!w||!h)return;this.frameCount++;
  const t=this.reduced?this.options.revealDelay+this.options.revealSeconds+8:this.time;
  const timing=timingAt(t,this.options),{reveal}=timing;
  const cx=this.cx+(this.reduced?0:this.pointer.x),cy=this.cy+(this.reduced?0:this.pointer.y),size=Math.min(w,h);
  c.globalAlpha=1;c.fillStyle=this.options.background;c.fillRect(0,0,w,h);
  c.font=`${this.row*.88}px "SFMono-Regular",Consolas,"Liberation Mono",monospace`;c.textAlign='center';c.textBaseline='middle';
  const cols=Math.ceil(w/this.cell),rows=Math.ceil(h/this.row),intro=1-reveal;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=(i+.5)*this.cell,y=(j+.5)*this.row,dx=(x-cx)/size,dy=(y-cy)/size,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
   const twist=1.5/(r+.23)+timing.spin,ca=Math.cos(twist),sa=Math.sin(twist),sx=dx*ca-dy*sa,sy=dx*sa+dy*ca;
   const stripe=Math.sin(sx*32+Math.sin(sy*10)*.6),ribbon=Math.pow(Math.max(0,stripe),5);
   const arc=Math.pow(Math.max(0,Math.sin(a*3+r*19-timing.arc)),10);
   const core=1-Math.exp(-r*r*24),edge=clamp(1.18-r*.87);
   const centerClear=1-.98*reveal*Math.exp(-Math.pow((x-this.cx)/(this.logoBounds.width*.78),6)-Math.pow((y-this.cy)/(this.logoBounds.height*.78),4));
   let intensity=(.085+ribbon*.52+arc*.16)*core*edge*centerClear+intro*.15*Math.exp(-r*4);
   // Spatial texture stays anchored to the glyph lattice; only the broad flow moves.
   intensity*=.58+.42*hash(i+71,j-18);
   const alpha=clamp(intensity*.38)*(1-reveal*.22),glyph=glyphStateAt(i,j,t,this.options);
   c.fillStyle=hash(i+19,j-43)>.78?BRAND.green:BRAND.blue;
   c.globalAlpha=alpha*(1-glyph.blend);c.fillText(glyph.from,x,y);
   if(glyph.blend>0){c.globalAlpha=alpha*glyph.blend;c.fillText(glyph.to,x,y)}
  }
  c.font=`${this.titleFont}px "SFMono-Regular",Consolas,"Liberation Mono",monospace`;c.textAlign='center';c.textBaseline='middle';
  for(const p of this.title){
   const {local,x,y}=logoPose(p,timing.progress,timing.shimmer);
   const char=p.n>.78?'+':p.n>.35?'#':p.n>.12?'=':'0',transition=smooth((local-.08)/.68);
   const shimmer=.985+.015*Math.sin(p.x*.023+p.y*.018+timing.shimmer);
   const opacity=local*shimmer;
   c.fillStyle=p.color;
   c.globalAlpha=opacity*(1-transition);c.fillText(p.n>.5?':':'.',x,y);
   c.globalAlpha=opacity*transition;c.fillText(char,x,y);
  }
  if(this.replaySnapshot){c.globalAlpha=1-smooth(this.replayElapsed/this.options.replayFadeSeconds);c.drawImage(this.replaySnapshot,0,0,this.replaySnapshot.width,this.replaySnapshot.height,0,0,w,h)}
  c.globalAlpha=1;
 }
 destroy(){this.replaySnapshot=null;this.destroyed=true;cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();this.intersection?.disconnect();window.removeEventListener('resize',this.resize);document.removeEventListener('visibilitychange',this.onVisibility);this.canvas.parentElement.removeEventListener('pointermove',this.onPointer);this.canvas.parentElement.removeEventListener('pointerleave',this.onLeave)}
}
