/**
 * China Mobile / ASCII field, original Canvas 2D implementation.
 * Dependency-free, no GPU requirement. Instantiate, then destroy on unmount.
 * The field samples an imaginary text grid through an inverse-radius twist.
 */
export const DEFAULTS = Object.freeze({
 maxDpr: 1.5, fps: 30, revealSeconds: 96, revealDelay: 1.8, wanderSeconds: 18, flowSpeed: 1, totalDuration: 45,
 // The ribbon travels across several character cells in a few seconds, while
 // the full field still takes over two minutes to make one gentle turn.
 vortexRadiansPerSecond: .04, arcRadiansPerSecond: .09,
 localMotionRadiansPerSecond: .9,
 glyphCycleSeconds: 56, glyphCrossfadeSeconds: 12,
 shimmerRadiansPerSecond: .028, pointerEaseSeconds: 2.4,
 replayFadeSeconds: 5.5, background: '#ffffff'
});
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=(v)=>{v=clamp(v);return v*v*(3-2*v)};
const hash=(x,y)=>{let n=Math.imul(x|0,374761393)+Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295};
const ALPHABET='01.:+*=/<>[]{}';
const SEQUENCE_SECONDS=DEFAULTS.revealDelay+DEFAULTS.wanderSeconds+DEFAULTS.revealSeconds;
const OPENING_SECONDS=10;
export const BRAND = Object.freeze({blue:'#0085cc',green:'#95c11f'});
export function regionAt(pixels,x,y){
 const i=(Math.floor(y)*pixels.width+Math.floor(x))*4;
 if(x<0||y<0||x>=pixels.width||y>=pixels.height||pixels.data[i+3]<160)return null;
 return pixels.data[i+1]>pixels.data[i+2]?BRAND.green:BRAND.blue;
}
export function compositionLayoutAt(viewport,logoPixels,textPixels){
 const w=viewport.width,h=viewport.height,mobile=w<=700,logoAspect=logoPixels.width/logoPixels.height,textAspect=textPixels.width/textPixels.height;
 const padding=Math.min(32,w*.07),top=Math.min(72,h*.18),bottom=Math.min(200,h*.49);
 const availableWidth=Math.max(1,w-padding*2),availableHeight=Math.max(1,h-top-bottom);
 let logoWidth,logoHeight,textWidth,textHeight,gap,width,height;
 if(mobile){
  gap=Math.min(24,availableHeight*.08);
  textHeight=Math.min(Math.min(availableWidth,w*.88)/textAspect,Math.max(1,(availableHeight-gap)*.28));textWidth=textHeight*textAspect;
  logoHeight=Math.min(260,w*.62/logoAspect,Math.max(1,availableHeight-gap-textHeight));logoWidth=logoHeight*logoAspect;
  width=Math.max(logoWidth,textWidth);height=logoHeight+gap+textHeight;
 }else{
  gap=Math.min(56,availableWidth*.045);
  logoHeight=Math.min(280,availableHeight,(availableWidth-gap)/(logoAspect+textAspect*.625));logoWidth=logoHeight*logoAspect;
  textHeight=logoHeight*.625;textWidth=textHeight*textAspect;width=logoWidth+gap+textWidth;height=logoHeight;
 }
 const x=(w-width)/2,y=top+(availableHeight-height)/2;
 const logo={x:mobile?(w-logoWidth)/2:x,y,width:logoWidth,height:logoHeight};
 const lettering={x:mobile?(w-textWidth)/2:x+logoWidth+gap,y:mobile?y+logoHeight+gap:y+(height-textHeight)/2,width:textWidth,height:textHeight};
 return{parts:{logo,lettering},bounds:{x,y,width,height}};
}
export function logoPose(p,progress,shimmer=0){
 const delay=clamp(p.radial*.2+p.n*.04,0,.35),local=smooth((progress-delay)/(1-delay));
 const drift=16*Math.pow(1-local,2);
 return {local,x:p.x+Math.cos(p.angle+shimmer)*drift,y:p.y+Math.sin(p.angle+shimmer)*drift};
}
// A single continuous clock. No startup acceleration or frame-count-based motion.
export function timingAt(seconds, options=DEFAULTS) {
 const t=Math.max(0,seconds), progress=clamp((t-options.revealDelay-options.wanderSeconds)/options.revealSeconds);
 return { progress, reveal:smooth(progress), spin:.6+t*options.vortexRadiansPerSecond, arc:t*options.arcRadiansPerSecond, shimmer:t*options.shimmerRadiansPerSecond };
}
export function glyphStateAt(i,j,t,options=DEFAULTS) {
 const phase=t/options.glyphCycleSeconds+hash(i+193,j-113), cycle=Math.floor(phase);
 const interval=options.glyphCrossfadeSeconds/options.glyphCycleSeconds;
 return { from:ALPHABET[Math.floor(hash(i+cycle*137,j+37)*ALPHABET.length)], to:ALPHABET[Math.floor(hash(i+(cycle+1)*137,j+37)*ALPHABET.length)], blend:smooth((phase-cycle-(1-interval))/interval) };
}
// Stable, overlapping frequencies make curved paths without frame-wise noise.
function curveAt(seed,seconds,rate){
 const phase=seed*Math.PI*2,clock=Math.max(0,seconds)*rate*(.76+seed*.36);
 return {
  x:.62*Math.sin(clock+phase)+.26*Math.sin(clock*1.91+phase*.61)+.12*Math.cos(clock*.47-phase*1.7),
  y:.57*Math.cos(clock*.83+phase*1.31)+.31*Math.sin(clock*1.37-phase*.73)+.12*Math.sin(clock*.53+phase*2.3)
 };
}
export function particlePoseAt(id,target,viewport,seconds,options=DEFAULTS){
 const w=viewport.width,h=viewport.height,size=Math.min(w,h),font=viewport.fontSize??14;
 const marginX=Math.min(w/2,Math.max(8,font)),marginY=Math.min(h/2,Math.max(8,font));
 const ampX=Math.min(56,size*.08,Math.max(0,(w-2*marginX)/4));
 const ampY=Math.min(42,size*.065,Math.max(0,(h-2*marginY)/4));
 // Scatter origins depend on identity and viewport, never on a letter target.
 const originX=marginX+ampX+hash(id+319,91)*(w-2*(marginX+ampX));
 const originY=marginY+ampY+hash(id-127,613)*(h-2*(marginY+ampY));
 const curve=curveAt(hash(id+73,231),viewport.flowSeconds??seconds,options.localMotionRadiansPerSecond);
 const delay=.1+hash(id+911,73)*.32;
 const settle=smooth(((viewport.formationProgress??timingAt(seconds,options).progress)-delay)/(1-delay));
 if(settle===1)return{x:target.x,y:target.y,settle};
 const x=originX+ampX*curve.x,y=originY+ampY*curve.y;
 return {x:x+(target.x-x)*settle,y:y+(target.y-y)*settle,settle};
}
export function fieldPoseAt(i,j,viewport,seconds,options=DEFAULTS){
 const {width:w,height:h,cell,row}=viewport;
 const marginX=Math.min(w/2,cell*.6),marginY=Math.min(h/2,row*.55);
 const x=clamp((i+.5)*cell,marginX,w-marginX),y=clamp((j+.5)*row,marginY,h-marginY);
 // Reserve enough room for the whole curve; edge glyphs never wrap or clip.
 const ampX=Math.max(0,Math.min(cell*1.8,x-marginX,w-marginX-x));
 const ampY=Math.max(0,Math.min(row*1.25,y-marginY,h-marginY-y));
 const curve=curveAt(hash(i+571,j-613),viewport.flowSeconds??seconds,options.localMotionRadiansPerSecond);
 return {x:x+ampX*curve.x,y:y+ampY*curve.y};
}
export class AsciiField {
 constructor(canvas,options={}) {
  this.canvas=canvas;this.options={...DEFAULTS,...options,revealDelay:DEFAULTS.revealDelay,wanderSeconds:DEFAULTS.wanderSeconds,revealSeconds:DEFAULTS.revealSeconds};this.context=canvas.getContext('2d',{alpha:false});
  if(!this.context)throw new Error('Canvas 2D unavailable');
  this.time=0;this.paused=false;this.reduced=!!options.reduced;this.visible=!document.hidden;this.destroyed=false;this.raf=0;this.previous=0;this.lastDraw=0;
  this.flowSpeed=clamp(Number(this.options.flowSpeed)||1,.25,2);this.flowOffset=0;
  this.totalDuration=clamp(Number(options.totalDuration??options.formationDuration??DEFAULTS.totalDuration)||45,30,60);this.formationOffset=0;
  this.options.flowSpeed=this.flowSpeed;this.options.totalDuration=this.totalDuration;
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
  const logoPixels=this.options.logoPixels,textPixels=this.options.textPixels;
  if(!logoPixels?.data)throw new Error('Logo pixels are required');
  if(!textPixels?.data)throw new Error('textPixels are required for outlined lettering');
  const layout=compositionLayoutAt({width:this.width,height:this.height},logoPixels,textPixels);
  this.parts=layout.parts;this.compositionBounds=layout.bounds;this.logoBounds={width:layout.bounds.width,height:layout.bounds.height};
  this.cx=layout.bounds.x+layout.bounds.width/2;this.cy=layout.bounds.y+layout.bounds.height/2;
  this.title=[];this.titleFont=this.mobile?5.3:6.3;
  for(const part of ['logo','lettering']){
   const pixels=part==='logo'?logoPixels:textPixels,rect=layout.parts[part],scale=rect.width/pixels.width;
   const stepX=part==='logo'?(this.mobile?3.5:4.2):(this.mobile?2.5:3.2),stepY=part==='logo'?(this.mobile?5:6):(this.mobile?3.5:4.4);
   const fontSize=part==='logo'?this.titleFont:(this.mobile?3:4.2);
   for(let y=stepY/2;y<rect.height;y+=stepY)for(let x=stepX/2;x<rect.width;x+=stepX){
    const sourceX=x/scale,sourceY=y/scale,region=regionAt(pixels,sourceX,sourceY);if(!region)continue;
    const px=rect.x+x,py=rect.y+y,nx=(px-this.cx)/(layout.bounds.width/2),ny=(py-this.cy)/(layout.bounds.height/2);
    this.title.push({x:px,y:py,n:hash(Math.round(x*10)+(part==='lettering'?7919:0),Math.round(y*10)),radial:Math.hypot(nx,ny),angle:Math.atan2(ny,nx),color:part==='lettering'?BRAND.blue:region,part,sourceX,sourceY,fontSize});
   }
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
 get flowTime(){return Math.max(0,this.time*this.flowSpeed+this.flowOffset)}
 get openingProgress(){return clamp(Math.max(0,this.time)/OPENING_SECONDS)}
 get totalProgress(){return this.sequenceSeconds/SEQUENCE_SECONDS}
 get sequenceSeconds(){return(DEFAULTS.revealDelay+DEFAULTS.wanderSeconds)*this.openingProgress+DEFAULTS.revealSeconds*this.formationProgress}
 // Compatibility names now describe the whole sequence, including its opening.
 get formationDuration(){return this.totalDuration}
 get formationProgress(){return clamp(Math.max(0,this.time-OPENING_SECONDS)/(this.totalDuration-OPENING_SECONDS)+this.formationOffset)}
 getFrameState(){return{wallSeconds:this.time,flowSeconds:this.flowTime/DEFAULTS.totalDuration*SEQUENCE_SECONDS,openingProgress:this.openingProgress,openingSeconds:OPENING_SECONDS,totalProgress:this.totalProgress,sequenceSeconds:this.sequenceSeconds,formationProgress:this.formationProgress,flowSpeed:this.flowSpeed,totalDuration:this.totalDuration,formationDuration:this.totalDuration}}
 setFlowSpeed(multiplier){
  const value=Number(multiplier);if(!Number.isFinite(value))return this.flowSpeed;
  const phase=this.flowTime;this.flowSpeed=clamp(value,.25,2);this.options.flowSpeed=this.flowSpeed;
  this.flowOffset=phase-this.time*this.flowSpeed;this.render();return this.flowSpeed;
 }
 setTotalDuration(seconds){
  const value=Number(seconds);if(!Number.isFinite(value))return this.totalDuration;
  const progress=this.formationProgress,active=Math.max(0,this.time-OPENING_SECONDS);this.totalDuration=clamp(value,30,60);this.options.totalDuration=this.totalDuration;
  this.formationOffset=progress-active/(this.totalDuration-OPENING_SECONDS);this.render();return this.totalDuration;
 }
 setFormationDuration(seconds){return this.setTotalDuration(seconds)}
 replay(){
  if(this.reduced)return;
  // Retain the current frame, then dissolve into the new reveal without a cut.
  const snapshot=document.createElement('canvas');snapshot.width=this.canvas.width;snapshot.height=this.canvas.height;
  const context=snapshot.getContext('2d');if(context){context.drawImage(this.canvas,0,0);this.replaySnapshot=snapshot;this.replayElapsed=0}
  this.time=0;this.flowOffset=0;this.formationOffset=0;this.paused=false;this.previous=0;this.render();this.schedule()
 }
 render(){
  const c=this.context,w=this.width,h=this.height;if(!w||!h)return;this.frameCount++;
  const frame=this.getFrameState(),t=this.reduced?SEQUENCE_SECONDS+8:frame.sequenceSeconds;
  const flowSeconds=this.reduced?t:frame.flowSeconds,progress=this.reduced?1:frame.formationProgress;
  const timing={...timingAt(flowSeconds,this.options),progress,reveal:smooth(progress)},{reveal}=timing;

  const cx=this.cx+(this.reduced?0:this.pointer.x),cy=this.cy+(this.reduced?0:this.pointer.y),size=Math.min(w,h);
  c.globalAlpha=1;c.fillStyle=this.options.background;c.fillRect(0,0,w,h);
  c.font=`600 ${this.row*.88}px "SFMono-Regular",Consolas,"Liberation Mono",monospace`;c.textAlign='center';c.textBaseline='middle';
  const cols=Math.ceil(w/this.cell),rows=Math.ceil(h/this.row),intro=1-reveal,fieldViewport={width:w,height:h,cell:this.cell,row:this.row,flowSeconds,formationProgress:progress};
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=(i+.5)*this.cell,y=(j+.5)*this.row,dx=(x-cx)/size,dy=(y-cy)/size,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
   const twist=1.5/(r+.23)+timing.spin,ca=Math.cos(twist),sa=Math.sin(twist),sx=dx*ca-dy*sa,sy=dx*sa+dy*ca;
   const stripe=Math.sin(sx*32+Math.sin(sy*10)*.6),ribbon=Math.pow(Math.max(0,stripe),4);
   const arc=Math.pow(Math.max(0,Math.sin(a*3+r*19-timing.arc)),10);
   const core=1-Math.exp(-r*r*24),edge=clamp(1.18-r*.87);
   const centerClear=1-(this.mobile?.6:.85)*reveal*Math.max(...Object.values(this.parts).map(part=>Math.exp(-Math.pow((x-part.x-part.width/2)/(part.width*.63),6)-Math.pow((y-part.y-part.height/2)/(part.height*.74),4))));
   let intensity=(.085+ribbon*.52+arc*.16)*core*edge*centerClear+intro*.15*Math.exp(-r*4);
   // Spatial texture stays anchored to the glyph lattice; only the broad flow moves.
   intensity*=.58+.42*hash(i+71,j-18);
   const alpha=Math.pow(clamp(intensity*.64),.76),glyph=glyphStateAt(i,j,flowSeconds,this.options),pose=this.reduced?{x,y}:fieldPoseAt(i,j,fieldViewport,t,this.options);
   c.fillStyle=hash(i+19,j-43)>.78?BRAND.green:BRAND.blue;
   c.globalAlpha=alpha*(1-glyph.blend);c.fillText(glyph.from,pose.x,pose.y);
   if(glyph.blend>0){c.globalAlpha=alpha*glyph.blend;c.fillText(glyph.to,pose.x,pose.y)}
  }
  c.font=`${this.titleFont}px "SFMono-Regular",Consolas,"Liberation Mono",monospace`;c.textAlign='center';c.textBaseline='middle';
  const titleViewport={width:w,height:h,fontSize:this.titleFont,flowSeconds,formationProgress:progress};
  let paintFont=this.titleFont;
  for(let id=0;id<this.title.length;id++){
   const p=this.title[id],font=p.fontSize??this.titleFont;
   if(font!==paintFont){c.font=`${font}px "SFMono-Regular",Consolas,"Liberation Mono",monospace`;paintFont=font}
   titleViewport.fontSize=font;
   const pose=this.reduced?{x:p.x,y:p.y,settle:1}:particlePoseAt(id,p,titleViewport,t,this.options),local=pose.settle;
   c.fillStyle=p.color;
   // Bright, stable characters wander first and gradually settle into the mark.
   const char=p.n>.75?'+':p.n>.25?'#':'=',transition=.55+.45*smooth((local-.12)/.7);
   const shimmer=.965+.035*Math.sin(p.x*.023+p.y*.018+timing.shimmer);
   const opacity=(.72+.28*smooth(t/this.options.revealDelay))*shimmer*.96;
   c.globalAlpha=opacity*(1-transition);c.fillText(p.n>.5?':':'.',pose.x,pose.y);
   c.globalAlpha=opacity*transition;c.fillText(char,pose.x,pose.y);
   if(p.n>.92){c.globalAlpha=local*.1;c.fillText(char,pose.x+.6,pose.y)}
  }
  if(this.replaySnapshot){c.globalAlpha=1-smooth(this.replayElapsed/this.options.replayFadeSeconds);c.drawImage(this.replaySnapshot,0,0,this.replaySnapshot.width,this.replaySnapshot.height,0,0,w,h)}
  c.globalAlpha=1;
 }
 destroy(){this.replaySnapshot=null;this.destroyed=true;cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();this.intersection?.disconnect();window.removeEventListener('resize',this.resize);document.removeEventListener('visibilitychange',this.onVisibility);this.canvas.parentElement.removeEventListener('pointermove',this.onPointer);this.canvas.parentElement.removeEventListener('pointerleave',this.onLeave)}
}
