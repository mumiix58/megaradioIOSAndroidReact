const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:n=>mocks[n],Date,Number,String,Intl,console});return mod.exports;}
const u=load('src/utils/nowPlaying.ts'),{normalizeNowPlaying:n,currentTrackText:track,resolveNowPlaying:resolve}=u;
for(const input of [
 {title:'Song',song:'<html>bad</html>',artist:'Artist'},
 {title:'https://diagnostic.invalid',song:'Song',artist:'Artist'},
 {metadata:{title:'Song',artist:'<html>Error</html>'}},
 {metadata:{StreamTitle:"StreamTitle='Artist - Song';StreamUrl='https://station.test';"}},
 {title:'text=&quot;Artist - Song&quot;'},
 {metadata:[{title:'Artist - Song'}]},
])assert.ok(track(n(input,'Station'),'Station'),JSON.stringify(input));
assert.equal(track(n({title:'text=&quot;Artist - Song&quot;'},'Station'),'Station'),'Artist - Song');
assert.equal(track(n({title:'Song',artist:'Artist',song:'<html>Error</html>'},'Station'),'Station'),'Artist - Song');
for(const input of [{title:'<html>502</html>'},{title:'There is no sound on the radio'},{title:'{"error":"bad"}'},{title:'AdCreativeId=abc; adw_ad=foo'},{title:'https://example.test'},{metadata:{title:'An advert',AdCreativeId:'abc'}}])assert.equal(n(input,'Station'),null,JSON.stringify(input));
assert.equal(track({title:'Live',artist:'Sia'},'Station'),'Sia - Live');
assert.equal(track({title:'Lightning Crashes',artist:'Live'},'Station'),'Live - Lightning Crashes');
assert.equal(track({title:'Energy',artist:'Beyoncé'},'Energy','UK'),'Beyoncé - Energy');
assert.equal(track({title:'Dreams',artist:'Canada'},'Station','Canada'),'Canada - Dreams');
assert.equal(track({title:'Station',artist:'Austria'},'Station','Austria'),null);
assert.equal(track({title:'Live Radio',artist:'Live Stream'},'Station','Austria'),null);
for(const title of ['爱','夜曲','上を向いて歩こう','봄날','أغنية','Песня','Çağrı','L’amour'])assert.equal(track({title},'Station'),title);
assert.equal(track(n({title:'Dreck Dieser Welt | FM4 OKFM4',artist:'Berglind'},'FM4 | ORF'),'FM4 | ORF'),'Berglind - Dreck Dieser Welt | FM4 OKFM4');
const now=Date.now(),prev={title:'Clean song',artist:'Artist',station:'Station',timestamp:now-30000};
assert.equal(resolve(null,prev,'Station','Austria',now).metadata,prev);assert.equal(resolve({title:'Station'},prev,'Station','Austria',now).retained,true);
assert.equal(resolve(null,{...prev,timestamp:now-120000},'Station','Austria',now).status,'error');
assert.equal(resolve({title:'Station'},null,'Station','Austria',now).status,'unavailable');assert.equal(resolve({title:'New song'},prev,'Station','Austria',now).retained,false);
assert.equal(resolve(null,{...prev,station:'Other'},'Station','Austria',now).metadata,null);
assert.equal(n(n(prev,'Station'),'Station').timestamp,prev.timestamp,'store normalization cannot renew a held track forever');
assert.equal(u.hasFreshIcyMetadata(now-30000,now),true);assert.equal(u.hasFreshIcyMetadata(now-120000,now),false);
const {metadataNotice}=load('src/utils/metadataNotice.ts');
for(const lang of ['en','tr','de','fr','es','it','pt','nl','pl','ru','ja','ko','zh','ar'])for(const state of ['loading','unavailable','error'])assert.ok(metadataNotice(state,lang).message.length>5);
assert.equal(metadataNotice('unavailable','tr').message,'Bu istasyon şarkı bilgisi paylaşmıyor.');assert.notEqual(metadataNotice('error','tr').message,metadataNotice('unavailable','tr').message);
console.log('PASS independent field salvage, encoded/ICY wrappers, diagnostics/ad rejection, real Live titles/artists, station/country fallbacks, Unicode songs, bounded retention, fresh-ICY expiry and 14-language notices');
