const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n)},console,Intl,Number,Error,AbortController,URLSearchParams,__DEV__:true});return mod.exports;}
const logoState=load('src/utils/stationLogoState.ts');
const utils=load('src/utils/stationSearch.ts',{'./stationLogoState':logoState});
assert.deepEqual(Array.from(utils.stationSearchRequests('viyana fm')),['viyana','viyanafm','vienna']);assert.deepEqual(Array.from(utils.stationSearchRequests('maximum')),['maximum']);assert.equal(utils.stationSearchRequests('100%').length,1);
const station=(id,name,votes=0)=>({_id:id,name,votes,url:'https://example.test/live',country:'Austria',state:'Vienna'});
const rows=[station('exact','MAXIMUM',1),station('target','Radyo Maximum',0),station('radio','Radio Maximum',20),...Array.from({length:50},(_,i)=>station('theme'+i,'Radio Maximum - Theme '+i,90000+i))];
assert.deepEqual(Array.from(utils.rankStationSearch(rows,'maximum',3),s=>s._id),['exact','theme49','theme48']);
const vienna=[station('local','ViyanaFM',1),station('english','Vienna FM',90000)];
for(const q of ['viyana','viyana fm','VİYANA FM','viyana-fm'])assert.ok(utils.rankStationSearch(vienna,q,30).some(row=>row._id==='local'));
assert.equal(utils.rankStationSearch([station('literal','100% Music'),station('other','1000 Music')],'100%',30).length,1);
assert.equal(utils.rankStationSearch([station('no','Radyo Seven')],'radyo maximum',30).length,0);
assert.equal(utils.rankStationSearch([station('accent','ŞİRAN')],'siran',30)[0]._id,'accent');
for(const [name,query] of [['北京音乐广播','北京'],['東京ラジオ','東京'],['서울 음악','서울'],['راديو الموسيقى','الموسيقى'],['Радио Максимум','максимум'],['Rádio São Paulo','sao paulo'],['Radio Łódź','lodz'],['Radio Köln','koln'],['Radio Français','francais'],['Radio Música','musica'],['Radio Città','citta'],['Radio Nederland','nederland'],['Türkçe Radyo','turkce'],['English Radio','english']])assert.equal(utils.rankStationSearch([station('unicode',name)],query,30)[0]?._id,'unicode',query);
let calls=[],fail=false;
const api={get:async(url,options)=>{if(url==='/api/genres')return {data:{genres:[]}};calls.push({url,...options});if(fail)throw Error('offline');return {data:{stations:options.params.search==='viyanafm'?[vienna[0]]:vienna}};}};
const {stationService}=load('src/services/stationService.ts',{'axios':require('axios'),'../utils/stationSearch':utils,'../utils/nearbyScope':{},'./api':api,'../constants/api':{API_ENDPOINTS:{stations:{search:'/api/stations/precomputed',list:'/api/stations'}},API_BASE_URL:''}});
(async()=>{const signal=new AbortController().signal;const result=await stationService.searchStations('viyana fm',30,signal);assert.equal(result[0]._id,'local');assert.ok(result.some(row=>row._id==='local'));assert.equal(result.length,2);assert.equal(calls.length,4);assert.ok(calls.every(c=>c.signal===signal&&c.params.limit<=100&&c.params.slim===1));calls=[];await stationService.searchStations('maximum',30);assert.equal(calls.length,2);calls=[];await stationService.searchStations('kral',500,signal,{country:'Austria',genre:'pop'});assert.ok(calls.every(c=>c.params.countryName==='Austria'&&c.params.genre==='pop'&&c.params.sort==='votes'&&c.params.limit<=500&&!('hasLogo' in c.params)));calls=[];await stationService.searchStations('klasik',30,signal,{country:'Austria'});assert.equal(calls.length,1);assert.equal(calls[0].params.genre,'classical');assert.equal(calls[0].params.countryName,'Austria');assert.ok(!('search' in calls[0].params));calls=[];await stationService.searchStations('x',30);assert.equal(calls.length,0);fail=true;await assert.rejects(stationService.searchStations('maximum',30));fail=false;const abort=new AbortController();abort.abort();await assert.rejects(stationService.searchStations('maximum',30,abort.signal),/cancelled/);console.log('PASS name relevance first and votes only within equal matches, joined words, accents/case, synonyms, literals, dedupe, bounded reads, cancellation and errors');})().catch(e=>{console.error(e);process.exitCode=1;});

assert.ok(utils.stationSearchRequests('vienna').includes('viyana'));
const logos=[{...station('logo','Kral FM',10),favicon:'https://example.test/logo.png'},station('no-logo','Kral',100)];
assert.equal(utils.rankStationSearch(logos,'kral',20)[0]._id,'no-logo');

const kral=[station('turk','KRAL TÜRK FM',10438),station('exact-kral','KRAL FM',2311),station('joined-kral','KralFM',2400),station('partial','Kral FM Hits',4000)];
for(const query of ['kral fm','KRAL FM','kral-fm','kralfm'])assert.deepEqual(Array.from(utils.rankStationSearch(kral,query,4),row=>row._id),query.includes(' ')?['exact-kral','joined-kral','partial','turk']:['joined-kral','exact-kral','partial']);
assert.deepEqual(Array.from(utils.rankStationSearch(kral,'kral',4),row=>row._id),['turk','partial','joined-kral','exact-kral']);

const metadata=[{...station('city-only','Station One',1),state:undefined,city:'Wien',country:'Austria',genres:['Jazz']},{...station('country-only','Station Two',2),state:undefined,country:'Germany'}];
for(const q of ['viyana','vienna','wien','avusturya','austria','jazz'])assert.equal(utils.rankStationSearch(metadata,q,20)[0]?._id,'city-only',q);
for(const q of ['almanya','germany'])assert.equal(utils.rankStationSearch(metadata,q,20)[0]?._id,'country-only',q);
assert.equal(utils.stationSearchLocation('viyana'),'vienna');assert.equal(utils.stationSearchLocation('Wien'),'vienna');

assert.equal(logoState.isDefaultStationLogoUrl('/logo.png'),true);
assert.equal(logoState.hasStationLogoMetadata({favicon:'https://themegaradio.com/logo.png'}),false);
assert.equal(logoState.hasStationLogoMetadata({favicon:'https://station.test/logo.png'}),true);
assert.equal(utils.stationSearchGenre('klasik'),'classical');
assert.equal(utils.stationSearchGenre('Pop FM'),undefined);
const genres=[{...station('named','Pop FM',1),tags:'talk'},{...station('high','Station A',100),tags:'pop'},{...station('placeholder','Station B',100),tags:'pop',favicon:'https://themegaradio.com/logo.png'},{...station('real','Station C',100),tags:'pop',favicon:'https://station.test/logo.png'}];
assert.deepEqual(Array.from(utils.rankStationSearch(genres,'pop',20),row=>row._id),['real','high','placeholder']);
