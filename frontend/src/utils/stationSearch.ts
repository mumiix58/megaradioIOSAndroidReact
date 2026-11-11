import type { Station } from '../types';
import { hasStationLogoMetadata } from './stationLogoState';

export const stationSearchKey = (value:string) => value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'')
  .replace(/ı/g,'i').replace(/ß/g,'ss').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/ø/g,'o').replace(/ł/g,'l').replace(/đ/g,'d').replace(/[^\p{L}\p{N}]/gu,'');

// Exact category intent only: “Pop FM” remains a station-name query.
const genreAliases: Record<string,string[]> = {
 pop:['pop'], rock:['rock'], jazz:['jazz','caz'], classical:['classical','klasik','classic music'],
 news:['news','haber','nachrichten'], talk:['talk','sohbet'], folk:['folk','folk music','halk müziği'],
 electronic:['electronic','elektronik'], ambient:['ambient'], latin:['latin'],
 'hip-hop':['hip-hop','hip hop'], 'r&b':['r&b','rnb'], country:['country music'],
};
const genreKeys=new Map<string,string>();
for(const [slug,names] of Object.entries(genreAliases))for(const name of names)genreKeys.set(stationSearchKey(name),slug);
export function registerStationSearchGenres(rows:{slug?:string;name?:string}[]):void {
 for(const row of rows)if(row.slug)for(const name of [row.slug,row.name])if(name&&!genreKeys.has(stationSearchKey(name)))genreKeys.set(stationSearchKey(name),row.slug);
}
export function stationSearchGenre(query:string):string|undefined {return genreKeys.get(stationSearchKey(query));}
export function rankGenreStations(stations:Station[],slug:string,limit:number,verified=false):Station[] {
 const genreKey=stationSearchKey(slug);
 return [...new Map(stations.map(row=>[row._id,row])).values()].filter(row=>verified||[...(row.genres||[]),...(row.tags||'').split(/[,;|]/)].some(value=>stationSearchKey(stationSearchGenre(value)||value)===genreKey))
 .sort((a,b)=>(Number(b.votes)||0)-(Number(a.votes)||0)||Number(hasStationLogoMetadata(b))-Number(hasStationLogoMetadata(a))||a._id.localeCompare(b._id)).slice(0,limit);
}

const CITY_SYNONYMS: Record<string, string> = {
  // Turkish city names
  viyana: 'vienna', münih: 'munich', londra: 'london', roma: 'rome',
  venedik: 'venice', floransa: 'florence', napoli: 'naples',
  barselona: 'barcelona', brüksel: 'brussels', moskova: 'moscow',
  varşova: 'warsaw', prag: 'prague', budapeşte: 'budapest',
  bükreş: 'bucharest', sofya: 'sofia', atina: 'athens',
  lizbon: 'lisbon', kopenhag: 'copenhagen', stokholm: 'stockholm',
  lahey: 'hague', zürih: 'zurich', cenevre: 'geneva',
  // German city names
  münchen: 'munich', köln: 'cologne', nürnberg: 'nuremberg',
  zürich: 'zurich',
};
const COUNTRY_SYNONYMS: Record<string, string> = {
  // Turkish country names
  almanya: 'germany', avusturya: 'austria', ingiltere: 'england',
  fransa: 'france', italya: 'italy', ispanya: 'spain',
  hollanda: 'netherlands', belçika: 'belgium', portekiz: 'portugal',
  lehistan: 'poland', rusya: 'russia', japonya: 'japan',
  çin: 'china', hindistan: 'india', brezilya: 'brazil',
  avustralya: 'australia', kanada: 'canada', meksika: 'mexico',
};
const SEARCH_SYNONYMS={...CITY_SYNONYMS,...COUNTRY_SYNONYMS};
export const STATION_SEARCH_VERSION = 'smart-v8-genre-placeholder';
const cityNames=new Set(Object.values(CITY_SYNONYMS).map(stationSearchKey));
const groups=new Map<string,Set<string>>();
for(const [from,to] of Object.entries({...SEARCH_SYNONYMS,wien:'vienna',radyo:'radio',turkiye:'turkey',türkiye:'turkey'})){
 const canonical=stationSearchKey(to),group=groups.get(canonical)||new Set([to]);group.add(from);groups.set(canonical,group);
}
const aliases=new Map<string,string[]>();
for(const group of groups.values())for(const word of group)aliases.set(stationSearchKey(word),[...group]);

/** At most three bounded reads: literal, joined spelling, and a city alias. */
export function stationSearchRequests(query:string):string[] {
  const text=query.trim().replace(/\s+/g,' ').slice(0,100);
  if(text.length<2)return [];
  const compact=stationSearchKey(text);
  const literal=/[%_\\]/.test(text);
  // Legacy readers treat 'fm' as an OR term and return thousands of unrelated rows.
  // Fetch by the meaningful name, then enforce every original token in rankStationSearch.
  const readerText=literal?text:text.split(' ').filter(word=>!/^fm$|^am$/i.test(word)).join(' ')||text;
  const variants=[readerText,...(!literal&&compact.length>=2&&compact!==readerText.toLowerCase()?[compact]:[])];
  if(!literal){
    const words=text.split(' ');
    for(const word of words){
      const alternative=(aliases.get(stationSearchKey(word))||[]).find(value=>stationSearchKey(value)!==stationSearchKey(word));
      if(alternative){variants.push(words.map(value=>value===word?alternative:value).filter(value=>!/^fm$|^am$/i.test(value)).join(' '));break;}
    }
  }
  return [...new Set(variants)].slice(0,3);
}

/** A separate indexed state read finds stations whose city is absent from their name. */
export function stationSearchLocation(query:string):string | undefined {
  const text=query.trim().replace(/\s+/g,' ').slice(0,100);
  if(text.length<2 || /[%_\\]/.test(text))return undefined;
  for(const word of text.split(' ')){
    const city=(aliases.get(stationSearchKey(word))||[word]).find(value=>cityNames.has(stationSearchKey(value)));
    if(city)return city;
  }
  return text;
}

function stationSearchFields(station:Station):string[] {
  return [station.name,station.country,station.state,station.city,station.countryCode,station.countrycode,station.tags,...(station.genres||[])].filter((value):value is string=>typeof value==='string');
}

export function rankStationSearch(stations:Station[],query:string,limit:number):Station[] {
  const genre=stationSearchGenre(query);
  if(genre)return rankGenreStations(stations,genre,limit);
  const text=query.trim().replace(/\s+/g,' ').slice(0,100),key=stationSearchKey(text);
  const literal=/[%_\\]/.test(text);
  const words=text.toLowerCase().split(/\s+/).slice(0,8);
  const terms=words.map(word=>[...new Set([word,...(aliases.get(stationSearchKey(word))||[])])]);
  const contains=(field:string,term:string)=>literal?field.toLowerCase().includes(term):stationSearchKey(field).includes(stationSearchKey(term));
  const unique=[...new Map(stations.map(station=>[station._id,station])).values()];
  return unique.map(station=>{
    const name=station.name || '';
    const fields=stationSearchFields(station);
    const allName=words.every(word=>contains(name,word));
    const expandedName=terms.every(aliases=>aliases.some(word=>contains(name,word)));
    if(!terms.every(aliases=>aliases.some(word=>fields.some(field=>contains(field,word))))) return {station,score:0};
    const score=name.trim().toLowerCase()===text.toLowerCase()?1000:!literal&&stationSearchKey(name)===key?900:
      allName&&words.length>1&&contains(name,text)?750:allName?700:expandedName?500:100;
    return {station,score};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score || (Number(b.station.votes)||0)-(Number(a.station.votes)||0) || a.station._id.localeCompare(b.station._id))
    .slice(0,limit).map(item=>item.station);
}
