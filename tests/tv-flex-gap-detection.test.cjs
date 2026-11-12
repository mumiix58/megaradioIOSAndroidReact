const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const source=fs.readFileSync(path.join(base,'compat/runtime-entry.js'),'utf8').replace(/^import[^;]+;$/gm,'');
function environment(nativeFlexGap,{legacyColors=false,layoutThrows=false}={}){
 let measures=0,appends=0,removals=0;
 function Element(){this.children=[];this.style={cssText:''};this.parentNode=null;this.className='preserved'}
 Element.prototype.matches=()=>false;
 Element.prototype.appendChild=function(child){if(this===root){appends++;if(layoutThrows)throw Error('No layout')}this.children.push(child);child.parentNode=this;return child};
 Element.prototype.removeChild=function(child){if(this===root)removals++;this.children.splice(this.children.indexOf(child),1);child.parentNode=null};
 Object.defineProperty(Element.prototype,'scrollHeight',{get(){measures++;assert.match(this.style.cssText,/display:flex/);assert.match(this.style.cssText,/flex-direction:column/);assert.match(this.style.cssText,/row-gap:1px/);assert.equal(this.children.length,2);for(const child of this.children)assert.match(child.style.cssText,/height:1px/);return nativeFlexGap?3:2}});
 const root=new Element();const document={documentElement:root,body:null,createElement:()=>new Element()};
 const window={CustomEvent:function(){},CSS:{supports:()=>!legacyColors}};const ctx={Element,document,window};return {ctx,root,counts:()=>({measures,appends,removals})};
}
test('actual pre-body runtime probe detects missing flex gap even when CSS.supports claims gap support',()=>{
 const h=environment(false);vm.runInNewContext(source,h.ctx);assert.match(h.root.className,/mr-no-flex-gap/);assert.doesNotMatch(h.root.className,/mr-legacy-css/);assert.equal(h.root.children.length,0);assert.deepEqual(h.counts(),{measures:1,appends:1,removals:1});assert.equal(h.ctx.window.__MR_COMPAT_READY__,true);
 vm.runInNewContext(source,h.ctx);assert.equal(h.root.className.match(/mr-no-flex-gap/g).length,1);
});
test('actual runtime keeps modern native flex spacing and independent old-color fallback separate',()=>{
 const modern=environment(true);vm.runInNewContext(source,modern.ctx);assert.equal(modern.root.className,'preserved');assert.equal(modern.root.children.length,0);
 const old=environment(false,{legacyColors:true});vm.runInNewContext(source,old.ctx);assert.match(old.root.className,/mr-legacy-css/);assert.match(old.root.className,/mr-no-flex-gap/);assert.equal(old.root.children.length,0);
});
test('unavailable layout does not throw or assert missing support and still permits app startup',()=>{
 const h=environment(false,{layoutThrows:true});vm.runInNewContext(source,h.ctx);assert.equal(h.root.className,'preserved');assert.equal(h.root.children.length,0);assert.equal(h.ctx.window.__MR_COMPAT_READY__,true);
});
