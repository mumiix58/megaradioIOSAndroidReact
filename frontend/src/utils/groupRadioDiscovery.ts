import type {Station} from '../types';
import {worldCountryKeys,worldCountryKey} from './worldCountryRotation';
const aliases:Record<string,string[]>={love:['love','romantic','romance','romantica','romanticas','romantico','romanticos'],pop:['pop'],rock:['rock'],jazz:['jazz'],electronic:['electronic','electronica','dance','house','techno','trance'],classical:['classical'], 'hip-hop':['hip hop','hiphop','rap'],rnb:['rnb','r&b','rhythm and blues'],folk:['folk','traditional'],turkish:['turkish','turkce'],world:['world','world music'],ambient:['ambient','chillout'],latin:['latin','latino','salsa','reggaeton']};
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[-_]/g,' ').trim();
export function matchesGroupGenre(station:Station,genre:string){
 const tags=[...(station.genres||[]),...(station.tags||'').split(','),...(genre==='turkish'?[station.language||'']:[])].map(normalize);
 return (aliases[genre]||[genre]).map(normalize).some(alias=>tags.some(tag=>tag===alias||tag.startsWith(alias+' ')));
}
/** Round-robin popular genre pools: a broad genre cannot erase the others. */
export function groupRadioDeck(pools:Station[][],genres:string[]):Station[]{
 const buckets=pools.map((pool,i)=>pool.filter(s=>/^[a-f0-9]{24}$/i.test(s._id)&&s.lastCheckOk!==false&&matchesGroupGenre(s,genres[i])).sort((a,b)=>(b.clickCount||0)-(a.clickCount||0)||(b.votes||0)-(a.votes||0)));
 const seen=new Set<string>(),result:Station[]=[];
 for(let index=0;index<Math.max(0,...buckets.map(bucket=>bucket.length));index++)for(const bucket of buckets){const station=bucket[index];if(station&&!seen.has(station._id)){seen.add(station._id);result.push(station);}}
 if(result.length<=54)return result;
 // Reserve every represented country before filling the rest with popular radios.
 const selected:Station[]=[],ids=new Set<string>();
 const keep=(station:Station)=>{if(selected.length<54&&!ids.has(station._id)){selected.push(station);ids.add(station._id);}};
 for(const genre of genres){const station=result.find(s=>matchesGroupGenre(s,genre));if(station)keep(station);}
 const byCountry=new Map<string,Station[]>();
 for(const station of result){const key=worldCountryKey(station);const rows=byCountry.get(key)||[];rows.push(station);byCountry.set(key,rows);}
 // Keep alternatives per country so one unavailable image cannot erase that country.
 for(let depth=0;depth<3;depth++)for(const rows of byCountry.values())if(rows[depth])keep(rows[depth]);
 for(const station of result)keep(station);
 return selected;
}

/** Signed carousel travel lands on an unseen country; negative travel follows a right pull. */
export function groupRadioDiscoveryStep(deck:Station[],current:number,blocked:ReadonlySet<string>,seen:ReadonlySet<string>,genre?:string,direction:1|-1=1){
 if(!deck.length)return null;
 const options=Array.from({length:deck.length},(_,i)=>{const distance=(8+i)*direction;return {distance,index:((current+distance)%deck.length+deck.length)%deck.length};});
 const free=options.filter(option=>!worldCountryKeys(deck[option.index]).some(key=>blocked.has(key)));
 const fresh=options.filter(option=>!seen.has(deck[option.index]._id));
 const freshCountries=free.filter(option=>!seen.has(deck[option.index]._id));
 const pool=freshCountries.length?freshCountries:fresh;
 return pool.find(option=>!!genre&&matchesGroupGenre(deck[option.index],genre))||pool[0]||null;
}
