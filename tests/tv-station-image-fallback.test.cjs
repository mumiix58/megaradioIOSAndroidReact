const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview');const ts=require(path.join(base,'node_modules/typescript'));const {JSDOM}=require(require.resolve('jsdom',{paths:[base]}));
function harness(remote){
 const dom=new JSDOM('<img id="station">',{url:'file:///media/developer/apps/usr/palm/applications/com.radiomega.tv/app/index.html'});if(remote)dom.window.__MR_ASSET_BASE__='https://cdn.themegaradio.com/';
 const exports={},ctx={exports,window:dom.window,require:()=>({getProductionApiOrigin:()=> 'https://themegaradio.com'})};
 for(const name of ['assetPath','imageUtils']){let source=fs.readFileSync(path.join(base,'src/lib/'+name+'.ts'),'utf8');source=source.replace('(import.meta as any).env?.BASE_URL',"'/api/tv-app/'");vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx)}
 const fallback=exports.assetPath('images/fallback-station.png'),img=dom.window.document.getElementById('station');img.src='https://station.example/missing.png';const descriptor=Object.getOwnPropertyDescriptor(dom.window.HTMLImageElement.prototype,'src');let writes=0;Object.defineProperty(img,'src',{get(){return descriptor.get.call(this)},set(value){writes++;descriptor.set.call(this,value)}});
 return {img,fallback,error:()=>exports.handleStationImageError({currentTarget:img},null,fallback),writes:()=>writes};
}
test('actual file-context asset/helper chain assigns a relative final fallback once across repeated errors',()=>{
 const h=harness(false);assert.equal(h.fallback,'./images/fallback-station.png');for(let i=0;i<5;i++)h.error();assert.equal(h.writes(),1);assert.equal(h.img.dataset.fbStep,'fallback');assert.ok(h.img.src.startsWith('file:///'));assert.equal(h.img.getAttribute('src'),h.fallback);
});
test('actual CDN fallback remains bounded and a reused image can fall back after a new primary fails',()=>{
 for(const remote of [false,true]){const h=harness(remote);for(let i=0;i<5;i++)h.error();assert.equal(h.writes(),1);h.img.src='https://station.example/new-primary.png';const before=h.writes();h.error();assert.equal(h.writes(),before+1);assert.equal(h.img.getAttribute('src'),h.fallback);h.error();assert.equal(h.writes(),before+1)}
});
