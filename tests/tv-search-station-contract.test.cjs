const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');const ts=require(path.join(root,'frontend/tvanddesktop/apple-tv-and-macos/web-preview/node_modules/typescript'));
test('Search normalizes actual production camelCase stream URL for playback and preserves result count',async()=>{
 const original='https://somafm.com/groovesalad.pls', resolved='https://ice2.somafm.com/groovesalad-128-mp3';
 const backend={_id:'station-soma',name:'SomaFM Groove Salad (128k MP3)',url:original,urlResolved:resolved,logoAssets:{status:'completed',webp256:'https://logos.example/soma.webp'}};
 const module={exports:{}};const calls=[];
 const source=fs.readFileSync(path.join(root,'frontend/tvanddesktop/apple-tv-and-macos/web-preview/src/services/megaRadioApi.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,{module,exports:module.exports,console,Map,setTimeout,clearTimeout,AbortController,URLSearchParams,window:undefined,navigator:{userAgent:''},fetch:async u=>{calls.push(u);return {ok:true,json:async()=>({stations:[backend],totalCount:17})}}});
 const result=await module.exports.megaRadioApi.searchStations({q:'SomaFM Groove Salad',limit:3});
 assert.equal(result.results.length,1);assert.equal(result.total,17);assert.equal(result.results[0].url,original);assert.equal(result.results[0].url_resolved,resolved);
 // This is the existing player URL selection contract: it must choose direct audio, not PLS.
 assert.equal(result.results[0].url_resolved||result.results[0].url,resolved);
 assert.equal(result.results[0].favicon,'https://logos.example/soma.webp');assert.match(calls[0],/search=SomaFM/);
});
