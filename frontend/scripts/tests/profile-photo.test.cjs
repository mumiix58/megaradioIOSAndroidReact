const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const fileMod={exports:{}};vm.runInNewContext(code('src/utils/profilePhoto.ts'),{exports:fileMod.exports,module:fileMod});const file=fileMod.exports.profilePhotoFile;
assert.equal(file({uri:'file:///photo.png',fileSize:5*1024*1024}).type,'image/png');assert.equal(file({uri:'blob:photo',fileName:'photo.webp',file:{size:100,type:'image/webp'}}).name,'photo.webp');assert.throws(()=>file({uri:'file:///photo.png',fileSize:5*1024*1024+1}),/avatar_file_size/);assert.throws(()=>file({uri:'file:///photo.gif',mimeType:'image\/gif'}),/avatar_file_type/);assert.equal(file({uri:'file:///photo.jpg'}).type,'image/jpeg');
const stored=new Map();const storage={async getItem(key){return stored.get(key)||null;},async setItem(key,value){stored.set(key,value);}};
let setters=[],effects=[];
const React={useState:()=>[false,value=>setters.push(value)],useRef:current=>({current}),useCallback:f=>f,useEffect:f=>effects.push(f)};
const mod={exports:{}};vm.runInNewContext(code('src/hooks/useProfilePhotoCoach.ts'),{exports:mod.exports,module:mod,Promise,Map,require:id=>id==='react'?React:{default:storage}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function mount(owner,visible=true,preview=false){setters=[];effects=[];const result=mod.exports.useProfilePhotoCoach(owner,visible,preview);const cleanup=effects.map(f=>f());await tick();await tick();return {show:setters.includes(true),result,cleanup};}
(async()=>{
 assert.equal((await mount('a')).show,true);assert.equal((await mount('a')).show,false,'normal revisit must not show tutorial again');assert.equal((await mount('b')).show,true,'tutorial is account scoped');
 const size=stored.size;assert.equal((await mount('preview',true,true)).show,true);assert.equal(stored.size,size,'preview must not consume a real first visit');assert.equal((await mount('hidden',false)).show,false);assert.equal(stored.has('@mega_profile_photo_coach_v2:hidden'),false);
 console.log('PASS supported avatar files, exact 5 MB boundary, invalid MIME, once-per-owner tutorial, hidden screen and non-consuming preview');
})().catch(error=>{console.error(error);process.exitCode=1;});
