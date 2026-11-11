const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>load('src/utils/'+id.replace('./','')+'.ts')});return m.exports;}
const m={exports:load('src/utils/groupRadioDiscovery.ts')};
const {groupRadioDeck,groupRadioDiscoveryStep,matchesGroupGenre}=m.exports;
const {WorldCountryRotation}=load('src/utils/worldCountryRotation.ts');
const station=(id,tags,clickCount=0)=>({_id:id.repeat(24),name:id,url:'https://example.com/live',tags,clickCount});
(async()=>{
 assert.equal(matchesGroupGenre(station('f','románticas'),'love'),true,'romantic aliases match love discovery');
 assert.equal(matchesGroupGenre(station('f','love songs'),'love'),true);
 assert.equal(matchesGroupGenre(station('f','pop'),'love'),false,'unrelated pop does not leak into love-only discovery');
 const jazz=station('a','jazz',80),shared=station('b','jazz,rock',40),rock=station('c','rock',90),wrong=station('d','pop',999),broken={...station('e','jazz'),lastCheckOk:false};
 const deck=groupRadioDeck([[shared,wrong,jazz,broken],[shared,rock]],['jazz','rock']);
 assert.deepEqual(Array.from(deck,s=>s._id),[jazz._id,rock._id,shared._id]);
 assert.equal(groupRadioDeck([[wrong]],['jazz']).length,0);
 const countries=['US','GB','DE','FR','ES','IT','AT','CA','AU','NL'];
 const global=countries.map((country,i)=>({...station((i+1).toString(16),'pop'),countrycode:country,country}));
 const rotation=new WorldCountryRotation(),heard=new Set(),draws=[];let current=0;
 for(let i=0;i<10;i++){const choice=groupRadioDiscoveryStep(global,current,rotation.blocked(),heard,'pop');assert.ok(choice.distance>=8);current=choice.index;const picked=global[current];draws.push(picked.countrycode);rotation.remember(picked);heard.add(picked._id);if(draws.length>=10)assert.ok(new Set(draws.slice(-10)).size>=9,'each ten draws must span nine countries when enough countries exist');}
 assert.equal(groupRadioDiscoveryStep(global,current,rotation.blocked(),heard,'pop'),null,'exhaustion must never replay a heard station');
 const unseenBlocked={...global[0],_id:'f'.repeat(24)};const choice=groupRadioDiscoveryStep([...global,unseenBlocked],0,new Set(['US']),heard,'pop');assert.equal(choice.index,10,'an unseen station in a recent country beats any repeat');
 const backwards=groupRadioDiscoveryStep(global,0,new Set(),new Set(),'pop',-1);assert.ok(backwards.distance<=-8);assert.ok(backwards.index>=0&&backwards.index<global.length,'negative carousel positions wrap to a valid station');const leftwards=groupRadioDiscoveryStep(global,0,new Set(),new Set(),'pop',1);assert.equal(Math.sign(backwards.distance),-Math.sign(leftwards.distance));
 const crowded=Array.from({length:80},(_,i)=>({...station((i%15+1).toString(16),'pop'),_id:i.toString(16).padStart(24,'0'),countrycode:i<65?'US':countries[(i-65)%countries.length],country:'',clickCount:1000-i}));
 const capped=groupRadioDeck([crowded],['pop']);assert.equal(capped.length,54);assert.equal(new Set(capped.map(s=>s.countrycode)).size,10,'deck cap must retain country breadth');
 console.log('PASS genre isolation, bounded popularity deck, country preservation and strict non-repetition, exhaustion and fresh-station priority');
})().catch(e=>{console.error(e);process.exitCode=1;});
