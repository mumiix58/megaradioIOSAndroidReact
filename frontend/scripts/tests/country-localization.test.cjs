const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const labels=require('../../src/data/countryNames.json');
const compiled=ts.transpileModule(fs.readFileSync('src/utils/countryLocalization.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleMock={exports:{}};
vm.runInNewContext(compiled,{module:moduleMock,exports:moduleMock.exports,require:()=>labels,Intl:undefined});
const u=moduleMock.exports;
const countries=Object.entries(labels.en).map(([code,name])=>({code,name,nativeName:name}));
for(const [lang,names] of Object.entries(labels))for(const [code,name] of Object.entries(names)){
 const country=countries.find(row=>row.code===code);
 assert.equal(u.localizedCountryName(country,lang+'-XX'),name);
 assert.ok(u.filterCountries(countries,name).includes(country),`${lang} ${name} should resolve ${code}`);
}
const germany=countries.find(c=>c.code==='DE');
for(const query of ['Almanya','almanya','ALMANYA','Deutschland','Germany','Alemania','Allemagne','ドイツ','德国','ألمانيا','DE'])assert.ok(u.filterCountries(countries,query).includes(germany),query);
for(const query of ['Avusturya','Österreich','osterreich','AUSTRIA'])assert.ok(u.filterCountries(countries,query).some(row=>row.code==='AT'),query);
for(const query of ['Turkey','TÜRKİYE','turkiye','Türkiye','土耳其'])assert.ok(u.filterCountries(countries,query).some(row=>row.code==='TR'),query);
assert.equal(u.localizedCountryName(germany,'tr'),'Almanya');assert.equal(germany.name,'Germany');
assert.equal(u.filterCountries(countries,'  '),countries);assert.equal(u.filterCountries(countries,'a country that does not exist').length,0);
assert.equal(u.localizedCountryName({code:'XX',name:'Unlisted'},'tr'),'Unlisted');
assert.equal(u.localizedCountryName(germany,'unsupported'),'Germany');
console.log(`PASS ${Object.keys(labels).length} languages × ${countries.length} region labels/searches, Unicode, aliases, offline/native fallback and canonical API identity`);

const france=countries.find(c=>c.code==='FR'),nl=countries.find(c=>c.code==='NL');
const shuffled=[nl,countries.find(c=>c.code==='GF'),countries.find(c=>c.code==='PF'),france];
for(const query of ['fransa','france','francia'])assert.equal(u.filterCountries(shuffled,query)[0].code,'FR',query);
assert.equal(u.uniqueCountries([nl,{...nl,name:'Duplicate Netherlands'},france]).length,2);
assert.equal(u.uniqueCountries([nl,{...nl,code:'nl'},france])[0],nl);
console.log('PASS exact country names rank first; duplicate ISO rows eliminated');
