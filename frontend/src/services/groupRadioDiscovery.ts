import api from './api';
import {groupRadioDeck,matchesGroupGenre} from '../utils/groupRadioDiscovery';
import {worldCountryKey} from '../utils/worldCountryRotation';
import {eligibleWorldRadio,verifyWorldRadioArtwork} from './worldRadioValidation';
import type {Station} from '../types';

export async function loadGroupRadioDeck(genres:string[],signal?:AbortSignal,excluded?:(station:Station)=>boolean){
 const pools=await Promise.all(genres.flatMap(genre=>genre==='love'?['love','romantic']: [genre]).map(async queryGenre=>{
  const genre=['love','romantic'].includes(queryGenre)?'love':queryGenre;
  const pool:Station[]=[];const countries=new Set<string>();
  for(let page=1;page<=(excluded?24:4)&&!signal?.aborted;page++){
   const {data}=await api.get('/api/stations',{signal,timeout:5000,params:{genre:queryGenre,page,limit:64,sort:'clickCount',order:'desc',excludeBroken:true}});
   const rows=(Array.isArray(data)?data:data.stations||data.data||[]) as Station[];
   for(const station of rows)if(matchesGroupGenre(station,genre)&&eligibleWorldRadio(station)&&worldCountryKey(station)&&!excluded?.(station)){pool.push(station);countries.add(worldCountryKey(station));}
   if(countries.size>=10&&pool.length>=54||rows.length<64)break;
  }
  return pool;
 }));
 if(signal?.aborted)throw new Error('Discovery canceled');
 const candidates=groupRadioDeck(genres.map(genre=>pools.flat().filter(station=>matchesGroupGenre(station,genre))),genres),valid=new Set<string>(),controller=new AbortController();
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,6500);let cursor=0;
 try{
  await Promise.all(Array.from({length:Math.min(6,candidates.length)},async()=>{
   while(cursor<candidates.length&&!controller.signal.aborted){const station=candidates[cursor++];try{if(await verifyWorldRadioArtwork(station,controller.signal))valid.add(station._id);}catch{/* An unavailable logo never becomes a discovery candidate. */}}
  }));
  if(signal?.aborted)throw new Error('Discovery canceled');
  return candidates.filter(station=>valid.has(station._id));
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);controller.abort();}
}
