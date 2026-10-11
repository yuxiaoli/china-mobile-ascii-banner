import { AsciiField } from './renderer.js';
const scene=document.querySelector('#scene'),canvas=document.querySelector('#field');
const pause=document.querySelector('#pause'),replay=document.querySelector('#replay'),motion=document.querySelector('#motion'),status=document.querySelector('#status');
const preference=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,userPaused=false,pageHidden=false,motionOverride=null;
function sync(message=''){
 scene.classList.toggle('paused',userPaused);scene.classList.toggle('reduced',renderer.reduced);
 pause.querySelector('span').textContent=userPaused?'播放':'暂停';pause.setAttribute('aria-label',userPaused?'播放动画':'暂停动画');
 pause.disabled=renderer.reduced;replay.disabled=renderer.reduced;
 motion.setAttribute('aria-pressed',String(!renderer.reduced));
 motion.setAttribute('aria-label',renderer.reduced?'开启动效':'关闭动效');
 motion.title=renderer.reduced?'开启动效，播放动画':'切换静态画面';
 motion.querySelector('.motion-label').textContent=renderer.reduced?'开启动效':'动效';
 motion.querySelector('.motion-state').textContent=renderer.reduced?'关':'开';
 status.textContent=renderer.reduced
  ?(motionOverride===null&&preference.matches?'当前为静态画面。设备偏好减少动态效果。':'动效已关闭，显示静态图形。点击「开启动效」播放。')
  :userPaused?'动画已暂停。点击「播放」继续。':message||'动画缓缓流动中。';
}
try{
 const logo=new Image();logo.src='./assets/china-mobile-logo.svg';await logo.decode();
 const mask=document.createElement('canvas');mask.width=449;mask.height=445;
 const context=mask.getContext('2d',{willReadFrequently:true});context.drawImage(logo,0,0,449,445);
 renderer=new AsciiField(canvas,{reduced:preference.matches,logoPixels:context.getImageData(0,0,449,445)});
 scene.classList.add('canvas-ready');sync();
 pause.addEventListener('click',()=>{userPaused=!userPaused;renderer.setPaused(userPaused||pageHidden);sync()});
 replay.addEventListener('click',()=>{userPaused=false;renderer.replay();if(pageHidden)renderer.setPaused(true);sync('正在重播渐显动画。')});
 motion.addEventListener('click',()=>{motionOverride=!renderer.reduced;renderer.setReduced(motionOverride);if(!motionOverride){userPaused=false;renderer.setPaused(pageHidden)}sync()});
 // Follow the device until the visitor deliberately chooses a motion setting.
 preference.addEventListener?.('change',e=>{if(motionOverride===null){renderer.setReduced(e.matches);sync()}});
 // Lifecycle suspension is separate from the visitor's intentional pause.
 window.addEventListener('pagehide',()=>{pageHidden=true;renderer.setPaused(true)});
 window.addEventListener('pageshow',()=>{if(pageHidden){pageHidden=false;renderer.setPaused(userPaused);sync()}});
}catch(error){console.warn('ASCII renderer unavailable; displaying the original logo.',error);document.querySelector('.controls').hidden=true;status.textContent='动画无法加载，显示原始标志。'}
// Exported for integration QA and embedding lifecycle control.
export { renderer };
