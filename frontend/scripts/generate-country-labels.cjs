// Offline CLDR region labels, generated with Node 24 / ICU; no runtime fetch or native Intl requirement.
const fs=require('node:fs');
const locales=['en','tr','de','fr','es','it','pt','nl','pl','ru','ja','ko','zh','ar'];
const english=new Intl.DisplayNames(['en'],{type:'region',fallback:'code'});
const codes=[];
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b);if(english.of(code)!==code&&code!=='ZZ')codes.push(code);}
const names=Object.fromEntries(locales.map(locale=>{const display=new Intl.DisplayNames([locale],{type:'region'});return [locale,Object.fromEntries(codes.map(code=>[code,display.of(code)]))];}));
fs.writeFileSync('src/data/countryNames.json',JSON.stringify(names,null,0)+'\n');
console.log(`${locales.length} languages × ${codes.length} region labels`);
