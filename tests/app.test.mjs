import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const boundary="import { AsciiField, compositionLayoutAt } from './renderer.js';";
assert.ok(source.startsWith(boundary));assert.ok(source.includes('export { renderer };'));
const handlers=source.slice(boundary.length).replace('export { renderer };','');
function element(){
 const flags=new Set();
 return{textContent:'',value:'',disabled:false,hidden:false,style:{},attributes:{},children:{},listeners:{},
  getBoundingClientRect:()=>({width:390,height:844}),
  classList:{add:v=>flags.add(v),toggle(v,on){if(on)flags.add(v);else flags.delete(v)},contains:v=>flags.has(v)},
  setAttribute(k,v){this.attributes[k]=v},querySelector(k){return this.children[k]??=element()},
  addEventListener(k,v){this.listeners[k]=v},click(){if(!this.disabled)this.listeners.click?.()},
  input(v){this.value=String(v);this.listeners.input?.()}};
}
function mount({reduced=false,deferDecode=false,decodeUnavailable=false,rendererUnavailable=false}={}){
 const elements={},trace=[],lifecycle={},images=[],masks=[];
 for(const selector of ['#scene','#field','#pause','#replay','#motion','#status','.controls','.fallback','.fallback-logo','.fallback-lettering','#flow-speed','#flow-value','#formation-duration','#duration-value'])elements[selector]=element();
 const media={matches:reduced,addEventListener(k,v){this.handler=v},change(v){this.matches=v;this.handler?.({matches:v})}};
 let field,resolveDecode;
 const decoded=deferDecode?new Promise(resolve=>{resolveDecode=resolve}):decodeUnavailable?Promise.reject(Error('decode unavailable')):Promise.resolve();
 class Image{
  constructor(){this.id=images.length;images.push(this)}
  decode(){assert.equal(this.src,['./assets/china-mobile-logo.svg','./assets/hk-innovation-lettering.svg'][this.id]);trace.push('decode'+this.id);return decoded.then(()=>trace.push('decoded'+this.id))}
 }
 const pixels=[{width:449,height:445,data:new Uint8ClampedArray(449*445*4)},{width:1290,height:250,data:new Uint8ClampedArray(1290*250*4)}];
 class AsciiField{
  constructor(canvas,options){assert.equal(canvas,elements['#field']);assert.equal(options.logoPixels,pixels[0]);assert.equal(options.textPixels,pixels[1]);trace.push('renderer');if(rendererUnavailable)throw Error('unavailable');this.paused=false;this.reduced=options.reduced;this.replays=0;this.flow=1;this.duration=45;field=this}
  setPaused(v){this.paused=v}setReduced(v){this.reduced=v}replay(){this.paused=false;this.replays++}
  setFlowSpeed(v){this.flow=v}setFormationDuration(v){this.duration=v}
 }
 const ready=runInNewContext('(async()=>{'+handlers+'\nreturn renderer;})()',{
  AsciiField,Image,compositionLayoutAt(viewport,logo,text){assert.deepEqual({...viewport},{width:390,height:844});assert.equal(logo.width,449);assert.equal(text.width,1290);return{parts:{logo:{x:40,y:110,width:300,height:300*445/449},lettering:{x:20,y:430,width:350,height:350*250/1290}}}},
  document:{querySelector:k=>elements[k],createElement(tag){assert.equal(tag,'canvas');const id=masks.length,mask={width:0,height:0,getContext(type,options){assert.equal(type,'2d');assert.equal(options.willReadFrequently,true);return{
   drawImage(image,...args){assert.equal(image,images[id]);assert.deepEqual(args,[0,0,pixels[id].width,pixels[id].height]);assert.equal(mask.width,pixels[id].width);assert.equal(mask.height,pixels[id].height);trace.push('draw'+id)},
   getImageData(...args){assert.deepEqual(args,[0,0,pixels[id].width,pixels[id].height]);return pixels[id]}}}};masks.push(mask);return mask}},
  matchMedia:q=>{assert.equal(q,'(prefers-reduced-motion: reduce)');return media},window:{addEventListener(k,v){lifecycle[k]=v}},console:{warn(){}}
 },{filename:'app.js'});
 return{elements,media,trace,masks,ready,get field(){return field},resolveDecode:()=>resolveDecode?.(),event:k=>lifecycle[k]?.()};
}
async function loaded(options){const app=mount(options);assert.equal(await app.ready,app.field);return app}
const loading=mount({deferDecode:true});
assert.deepEqual(loading.trace,['decode0','decode1']);assert.equal(loading.field,undefined);assert.equal(loading.masks.length,0);
assert.equal(loading.elements['.fallback'].classList.contains('positioned'),true);assert.equal(loading.elements['.fallback-lettering'].style.width,'350px');
loading.resolveDecode();await loading.ready;
assert.deepEqual(loading.trace,['decode0','decode1','decoded0','decoded1','draw0','draw1','renderer']);assert.equal(loading.elements['#scene'].classList.contains('canvas-ready'),true);
loading.event('resize');assert.equal(loading.elements['.fallback-logo'].style.left,'40px');
const reduced=await loaded({reduced:true});
assert.equal(reduced.field.reduced,true);assert.equal(reduced.elements['#motion'].attributes['aria-pressed'],'false');assert.equal(reduced.elements['#motion'].attributes['aria-label'],'开启动效');
assert.match(reduced.elements['#status'].textContent,/静态.*设备偏好减少动态效果/);assert.equal(reduced.elements['#pause'].disabled,true);assert.equal(reduced.elements['#replay'].disabled,true);
reduced.elements['#replay'].click();assert.equal(reduced.field.replays,0);
reduced.elements['#flow-speed'].input(2);reduced.elements['#formation-duration'].input(30);
assert.equal(reduced.field.reduced,true);assert.equal(reduced.field.flow,2);assert.equal(reduced.field.duration,30);assert.equal(reduced.field.replays,0);
reduced.elements['#motion'].click();assert.equal(reduced.field.reduced,false);assert.equal(reduced.field.paused,false);assert.equal(reduced.elements['#pause'].disabled,false);assert.equal(reduced.elements['#motion'].attributes['aria-pressed'],'true');
assert.match(reduced.elements['#status'].textContent,/字符自由流动.*香港创新院/);
reduced.media.change(false);reduced.media.change(true);assert.equal(reduced.field.reduced,false);
reduced.elements['#pause'].click();assert.equal(reduced.field.paused,true);assert.equal(reduced.elements['#pause'].children.span.textContent,'播放');
reduced.event('pagehide');reduced.event('pagehide');reduced.event('pageshow');assert.equal(reduced.field.paused,true);assert.match(reduced.elements['#status'].textContent,/已暂停/);
reduced.elements['#motion'].click();assert.equal(reduced.field.reduced,true);assert.match(reduced.elements['#status'].textContent,/动效已关闭.*静态图形/);
reduced.elements['#motion'].click();assert.equal(reduced.field.paused,false);assert.equal(reduced.elements['#pause'].children.span.textContent,'暂停');
reduced.elements['#pause'].click();reduced.elements['#replay'].click();assert.equal(reduced.field.paused,false);assert.equal(reduced.field.replays,1);assert.equal(reduced.field.flow,2);assert.equal(reduced.field.duration,30);assert.match(reduced.elements['#status'].textContent,/重播完整成形过程/);
reduced.event('pagehide');assert.equal(reduced.field.paused,true);reduced.event('pageshow');reduced.event('pageshow');assert.equal(reduced.field.paused,false);
const automatic=await loaded();automatic.media.change(true);assert.equal(automatic.field.reduced,true);automatic.media.change(false);assert.equal(automatic.field.reduced,false);
automatic.elements['#motion'].click();automatic.media.change(true);automatic.media.change(false);assert.equal(automatic.field.reduced,true);
const controls=await loaded();
assert.equal(controls.elements['#flow-value'].textContent,'1.00×');assert.equal(controls.elements['#duration-value'].textContent,'45秒');
controls.elements['#flow-speed'].input(99);assert.equal(controls.field.flow,2);
controls.elements['#flow-speed'].input(-1);assert.equal(controls.field.flow,.25);assert.equal(controls.elements['#flow-speed'].attributes['aria-valuetext'],'0.25倍流动速度');
controls.elements['#formation-duration'].input(0);assert.equal(controls.field.duration,30);
controls.elements['#formation-duration'].input(999);assert.equal(controls.field.duration,60);assert.equal(controls.elements['#formation-duration'].attributes['aria-valuetext'],'总时长60秒，包含10秒开场。');
controls.elements['#flow-speed'].input('invalid');controls.elements['#formation-duration'].input('invalid');assert.equal(controls.field.flow,.25);assert.equal(controls.field.duration,60);assert.equal(controls.field.replays,0);assert.equal(controls.field.paused,false);
for(const options of [{decodeUnavailable:true},{rendererUnavailable:true}]){
 const fallback=await loaded(options);assert.equal(fallback.elements['.controls'].hidden,true);assert.equal(fallback.elements['#scene'].classList.contains('canvas-ready'),false);assert.match(fallback.elements['#status'].textContent,/无法加载.*原始标志与香港创新院字形/);
 if(options.decodeUnavailable)assert.equal(fallback.masks.length,0);
}
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html+source,/\ufffd/);
const status=html.match(/<[^>]+id="status"[^>]*>/)[0];assert.match(status,/role="status"/);assert.match(status,/aria-live="polite"/);assert.doesNotMatch(status,/sr-only|hidden/);
assert.equal((html.match(/id="status"/g)??[]).length,1);assert.match(html,/<html lang="zh-CN">/);assert.match(html,/aria-describedby="status"/);
for(const [id,min,max,step,value]of[['flow-speed','0.25','2','0.05','1'],['formation-duration','30','60','1','45']]){
 const tag=html.match(new RegExp('<input[^>]+id="'+id+'"[^>]*>'))[0];
 for(const [key,expected]of Object.entries({min,max,step,value}))assert.match(tag,new RegExp(key+'="'+expected+'"'));
 assert.match(tag,/type="range"/);assert.match(tag,/aria-describedby="timing-help"/);assert.match(html,new RegExp('<label for="'+id+'">'));
}
assert.match(html,/包含10秒开场。调整后保留进度；重播将重新开始完整周期。/);
assert.match(html,/class="fallback-logo" src="\.\/assets\/china-mobile-logo\.svg"/);assert.match(html,/class="fallback-lettering" src="\.\/assets\/hk-innovation-lettering\.svg"/);
console.log('PASS: both original SVG-mask pipelines; responsive fallback; Chinese accessible controls; independent settings/clamps; preferences; pause/replay/BFCache; load failure fallback.');
