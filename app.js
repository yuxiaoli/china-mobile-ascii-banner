import { AsciiField, compositionLayoutAt } from './renderer.js';
const scene=document.querySelector('#scene'),canvas=document.querySelector('#field');
const pause=document.querySelector('#pause'),replay=document.querySelector('#replay'),motion=document.querySelector('#motion'),status=document.querySelector('#status');
const flowSpeed=document.querySelector('#flow-speed'),flowValue=document.querySelector('#flow-value');
const formationDuration=document.querySelector('#formation-duration'),durationValue=document.querySelector('#duration-value');
const preference=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,userPaused=false,pageHidden=false,motionOverride=null,selectedFlow=1,selectedDuration=45;
function syncFlow(){flowSpeed.value=String(selectedFlow);flowValue.textContent=`${selectedFlow.toFixed(2)}×`;flowSpeed.setAttribute('aria-valuetext',`${selectedFlow.toFixed(2)}倍流动速度`)}
function syncDuration(){formationDuration.value=String(selectedDuration);durationValue.textContent=`${selectedDuration}秒`;formationDuration.setAttribute('aria-valuetext',`总时长${selectedDuration}秒，包含10秒开场。`)}
function layoutFallback(){
 const {width,height}=scene.getBoundingClientRect();
 const layout=compositionLayoutAt({width,height},{width:449,height:445},{width:1290,height:250});
 for(const [part,rect] of Object.entries(layout.parts)){
  const image=document.querySelector(`.fallback-${part}`);
  for(const property of ['left','top','width','height'])image.style[property]=`${rect[property==='left'?'x':property==='top'?'y':property]}px`;
 }
 document.querySelector('.fallback').classList.add('positioned');
}
function imagePixels(image,width,height){
 const mask=document.createElement('canvas');mask.width=width;mask.height=height;
 const context=mask.getContext('2d',{willReadFrequently:true});
 if(!context)throw new Error('Canvas 2D unavailable');
 context.drawImage(image,0,0,width,height);return context.getImageData(0,0,width,height);
}
function sync(message=''){
 scene.classList.toggle('paused',userPaused);scene.classList.toggle('reduced',renderer.reduced);
 pause.querySelector('span').textContent=userPaused?'播放':'暂停';pause.setAttribute('aria-label',userPaused?'播放动画':'暂停动画');
 pause.disabled=renderer.reduced;replay.disabled=renderer.reduced;
 motion.setAttribute('aria-pressed',String(!renderer.reduced));
 motion.setAttribute('aria-label',renderer.reduced?'开启动效':'关闭动效');
 motion.title=renderer.reduced?'开启动效并播放动画':'切换静态画面';
 motion.querySelector('.motion-label').textContent=renderer.reduced?'开启动效':'动效';
 motion.querySelector('.motion-state').textContent=renderer.reduced?'关':'开';
 status.textContent=renderer.reduced
  ?(motionOverride===null&&preference.matches?'当前为静态画面。设备偏好减少动态效果。':'动效已关闭，显示静态图形。可点击开启动效来播放。')
  :userPaused?'动画已暂停。点击「播放」继续。':message||'字符自由流动，逐渐形成标志与香港创新院字形。';
}
try{
 layoutFallback();window.addEventListener('resize',layoutFallback,{passive:true});
 const logo=new Image(),text=new Image();logo.src='./assets/china-mobile-logo.svg';text.src='./assets/hk-innovation-lettering.svg';
 await Promise.all([logo.decode(),text.decode()]);
 renderer=new AsciiField(canvas,{reduced:preference.matches,logoPixels:imagePixels(logo,449,445),textPixels:imagePixels(text,1290,250)});
 scene.classList.add('canvas-ready');sync();syncFlow();syncDuration();
 flowSpeed.addEventListener('input',()=>{const value=Number(flowSpeed.value);if(Number.isFinite(value))selectedFlow=Math.max(.25,Math.min(2,value));renderer.setFlowSpeed(selectedFlow);syncFlow()});
 formationDuration.addEventListener('input',()=>{const value=Number(formationDuration.value);if(Number.isFinite(value))selectedDuration=Math.max(30,Math.min(60,value));renderer.setFormationDuration(selectedDuration);syncDuration()});
 pause.addEventListener('click',()=>{userPaused=!userPaused;renderer.setPaused(userPaused||pageHidden);sync()});
 replay.addEventListener('click',()=>{userPaused=false;renderer.replay();if(pageHidden)renderer.setPaused(true);sync('正在重播完整成形过程。')});
 motion.addEventListener('click',()=>{motionOverride=!renderer.reduced;renderer.setReduced(motionOverride);if(!motionOverride){userPaused=false;renderer.setPaused(pageHidden)}sync()});
 // Follow the device until the visitor deliberately chooses a motion setting.
 preference.addEventListener?.('change',e=>{if(motionOverride===null){renderer.setReduced(e.matches);sync()}});
 // Lifecycle suspension is separate from the visitor's intentional pause.
 window.addEventListener('pagehide',()=>{pageHidden=true;renderer.setPaused(true)});
 window.addEventListener('pageshow',()=>{if(pageHidden){pageHidden=false;renderer.setPaused(userPaused);sync()}});
}catch(error){console.warn('ASCII renderer unavailable; displaying the source artwork.',error);document.querySelector('.controls').hidden=true;status.textContent='动画无法加载，显示原始标志与香港创新院字形。'}
// Exported for integration QA and embedding lifecycle control.
export { renderer };
