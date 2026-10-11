import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Exercise the shipped app's actual async loader and event handlers. DOM,
// Image decoding, mask canvas, and the renderer boundary are test substitutes.
const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const rendererImport="import { AsciiField } from './renderer.js';";
const rendererExport='export { renderer };';
assert.ok(appSource.startsWith(rendererImport));
assert.ok(appSource.includes(rendererExport),'embedding renderer export is preserved');
const handlers=appSource.slice(rendererImport.length).replace(rendererExport,'');

function createElement(){
 const flags=new Set();
 return {
  textContent:'',disabled:false,hidden:false,attributes:{},children:{},listeners:{},
  classList:{add(value){flags.add(value)},toggle(value,on){if(on)flags.add(value);else flags.delete(value)},contains(value){return flags.has(value)}},
  setAttribute(name,value){this.attributes[name]=value},
  querySelector(selector){return this.children[selector]??=createElement()},
  addEventListener(name,handler){this.listeners[name]=handler},
  click(){if(!this.disabled)this.listeners.click?.()}
 };
}

function mount({reduced=false,deferDecode=false,decodeUnavailable=false,rendererUnavailable=false}={}){
 const elements={};
 for(const selector of ['#scene','#field','#pause','#replay','#motion','#status','.controls'])elements[selector]=createElement();
 const media={matches:reduced,listeners:{},addEventListener(name,handler){this.listeners[name]=handler},change(value){this.matches=value;this.listeners.change?.({matches:value})}};
 const lifecycle={},trace=[],pixels={width:449,height:445,data:new Uint8ClampedArray(449*445*4)};
 let field,image,resolveDecode;
 const decoded=deferDecode?new Promise(resolve=>{resolveDecode=resolve}):decodeUnavailable?Promise.reject(new Error('Image decode unavailable')):Promise.resolve();
 class Image {
  constructor(){image=this;trace.push('image')}
  decode(){assert.equal(this.src,'./assets/china-mobile-logo.svg','original relative logo asset is used');trace.push('decode');return decoded.then(()=>trace.push('decoded'))}
 }
 const mask={width:0,height:0,getContext(type,options){
  assert.equal(type,'2d');assert.equal(options.willReadFrequently,true);trace.push('context');
  return {
   drawImage(logo,...args){assert.equal(logo,image);assert.deepEqual(args,[0,0,449,445]);assert.equal(mask.width,449);assert.equal(mask.height,445);trace.push('draw')},
   getImageData(...args){assert.deepEqual(args,[0,0,449,445]);trace.push('pixels');return pixels}
  };
 }};
 class AsciiField {
  constructor(canvas,options){
   assert.equal(canvas,elements['#field']);
   assert.equal(options.logoPixels,pixels,'the original 449 by 445 decoded pixel mask reaches the renderer');
   trace.push('renderer');
   if(rendererUnavailable)throw new Error('Canvas 2D unavailable');
   this.paused=false;this.reduced=options.reduced;this.replays=0;field=this;
  }
  setPaused(value){this.paused=value}
  setReduced(value){this.reduced=value}
  replay(){this.paused=false;this.replays++}
 }
 const ready=runInNewContext(`(async()=>{${handlers}\nreturn renderer;})()`,{
  AsciiField,Image,
  document:{querySelector:selector=>elements[selector],createElement:tag=>{assert.equal(tag,'canvas');trace.push('mask');return mask}},
  matchMedia:query=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return media},
  window:{addEventListener:(name,handler)=>{lifecycle[name]=handler}},
  console:{warn(){}}
 },{filename:'app.js'});
 return {elements,media,trace,ready,get field(){return field},resolveDecode:()=>resolveDecode?.(),event:name=>lifecycle[name]?.()};
}
async function loaded(options){const app=mount(options);assert.equal(await app.ready,app.field,'exported renderer remains available after initialization');return app}

const loading=mount({deferDecode:true});
assert.deepEqual(loading.trace,['image','decode']);
assert.equal(loading.field,undefined,'renderer waits for original SVG decode');
assert.equal(loading.elements['#scene'].classList.contains('canvas-ready'),false);
loading.resolveDecode();
assert.equal(await loading.ready,loading.field);
assert.deepEqual(loading.trace,['image','decode','decoded','mask','context','draw','pixels','renderer'],'decode precedes 449 by 445 mask drawing and renderer construction');

const reduced=await loaded({reduced:true});
assert.equal(reduced.field.reduced,true,'device preference defaults to a still composition');
assert.equal(reduced.elements['#motion'].children['.motion-label'].textContent,'开启动效');
assert.equal(reduced.elements['#motion'].attributes['aria-pressed'],'false','motion off is not pressed');
assert.equal(reduced.elements['#motion'].attributes['aria-label'],'开启动效');
assert.match(reduced.elements['#status'].textContent,/静态.*设备偏好减少动态效果/);
assert.equal(reduced.elements['#pause'].disabled,true);
assert.equal(reduced.elements['#replay'].disabled,true);
reduced.elements['#replay'].click();
assert.equal(reduced.field.replays,0,'disabled reduced replay cannot start animation');
reduced.elements['#motion'].click();
assert.equal(reduced.field.reduced,false);
assert.equal(reduced.field.paused,false,'deliberate enable starts playback');
assert.equal(reduced.elements['#motion'].attributes['aria-pressed'],'true','motion on is pressed');
assert.equal(reduced.elements['#pause'].disabled,false);
assert.equal(reduced.elements['#replay'].disabled,false);
assert.match(reduced.elements['#status'].textContent,/缓缓流动/);
reduced.media.change(false);reduced.media.change(true);
assert.equal(reduced.field.reduced,false,'explicit enabled choice survives device preference changes');

reduced.elements['#pause'].click();
assert.equal(reduced.field.paused,true);
assert.equal(reduced.elements['#pause'].children.span.textContent,'播放');
reduced.event('pagehide');reduced.event('pagehide');reduced.event('pageshow');
assert.equal(reduced.field.paused,true,'page restoration preserves intentional pause');
assert.match(reduced.elements['#status'].textContent,/已暂停/);
reduced.elements['#motion'].click();
assert.equal(reduced.field.reduced,true);
assert.equal(reduced.elements['#motion'].attributes['aria-pressed'],'false');
assert.match(reduced.elements['#status'].textContent,/动效已关闭.*静态图形/);
reduced.elements['#motion'].click();
assert.equal(reduced.field.reduced,false);
assert.equal(reduced.field.paused,false,'Enable motion resumes even after a prior pause');
assert.equal(reduced.elements['#pause'].children.span.textContent,'暂停');
reduced.elements['#pause'].click();reduced.elements['#replay'].click();
assert.equal(reduced.field.paused,false,'replay resumes animation');
assert.equal(reduced.field.replays,1);
assert.match(reduced.elements['#status'].textContent,/正在重播渐显动画/);
reduced.event('pagehide');assert.equal(reduced.field.paused,true);
reduced.event('pageshow');reduced.event('pageshow');
assert.equal(reduced.field.paused,false,'page restoration resumes previously running animation');

const automatic=await loaded();
assert.equal(automatic.field.reduced,false);
assert.equal(automatic.elements['#motion'].attributes['aria-pressed'],'true');
automatic.media.change(true);assert.equal(automatic.field.reduced,true,'device changes apply before an explicit choice');
automatic.media.change(false);assert.equal(automatic.field.reduced,false);
automatic.elements['#motion'].click();
automatic.media.change(true);automatic.media.change(false);
assert.equal(automatic.field.reduced,true,'explicit still choice also survives device changes');

for(const options of [{decodeUnavailable:true},{rendererUnavailable:true}]){
 const fallback=await loaded(options);
 assert.equal(fallback.elements['.controls'].hidden,true,'unusable controls stay hidden');
 assert.equal(fallback.elements['#scene'].classList.contains('canvas-ready'),false,'original logo fallback remains visible');
 assert.match(fallback.elements['#status'].textContent,/无法加载.*原始标志/);
 if(options.decodeUnavailable)assert.deepEqual(fallback.trace,['image','decode'],'failed decode does not create a mask or renderer');
}

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const statusTag=html.match(/<[^>]+id="status"[^>]*>/)?.[0];
assert.ok(statusTag);assert.match(statusTag,/class="motion-status"/);assert.doesNotMatch(statusTag,/sr-only|hidden/);
assert.match(statusTag,/role="status"/);assert.match(statusTag,/aria-live="polite"/);
assert.match(html,/aria-describedby="status"/);
assert.equal((html.match(/id="status"/g)??[]).length,1);
assert.match(html,/<html lang="zh-CN">/);
assert.match(html,/<img class="fallback" src="\.\/assets\/china-mobile-logo\.svg" alt="中国移动图形标志">/);

console.log('PASS: async original SVG decode and 449x445 pixel-mask pipeline; renderer export; Chinese visible reduced state; deliberate enable/resume; per-page preference override; motion aria state; pause/replay; BFCache; original-logo fallback.');
