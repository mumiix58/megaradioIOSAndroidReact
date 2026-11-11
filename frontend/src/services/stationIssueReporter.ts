import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import {API_ENDPOINTS} from '../constants/api';
import type {Station} from '../types';
const COOLDOWN=24*60*60*1000;
type Input={station:Station;message?:string|null;platform:string;language:string};
type Result='sent'|'already';
/** Same report endpoint/admin queue as web; local cooldown is a UX guard, not server authority. */
export function createStationIssueReporter({post,storage,now=Date.now}:{post:(body:Record<string,unknown>)=>Promise<{success?:boolean;errorId?:string}>;storage:{getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<unknown>};now?:()=>number}){
 const inflight=new Map<string,Promise<Result>>(),recent=new Map<string,number>();
 return (input:Input):Promise<Result>=>{
  const station={...input.station},id=station._id;
  if(!id||!station.name)return Promise.reject(Error('Missing station'));
  if(inflight.has(id))return inflight.get(id)!;
  // Snapshot the station and error at the tap, before any asynchronous storage/network work.
  const body={stationId:id,stationName:station.name,stationUrl:station.urlResolved||station.url_resolved||station.url,errorType:'USER_REPORT',errorMessage:(input.message||'User reports that this station will not play.').slice(0,1000),errorDetails:{source:'mobile-player',userInitiated:true,playbackState:'error'},browserInfo:{platform:input.platform,language:input.language},stationMeta:{country:station.country||'',genres:[...(station.genres||[])]}};
  const key=`@mega_station_report_v1:${id}`;
  const task=(async():Promise<Result>=>{
   for(const [stationId,at] of recent)if(now()-at>=COOLDOWN)recent.delete(stationId);
   const saved=Number(await storage.getItem(key).catch(()=>null));
   const at=recent.get(id)||saved;
   if(at>0&&at<=now()&&now()-at<COOLDOWN)return 'already';
   const result=await post(body);
   if(result?.success!==true||!result.errorId)throw Error('Report was not acknowledged');
   const sent=now();recent.set(id,sent);while(recent.size>256)recent.delete(recent.keys().next().value!);
   await storage.setItem(key,String(sent)).catch(()=>{});
   return 'sent';
  })().finally(()=>{inflight.delete(id);});
  inflight.set(id,task);return task;
 };
}
export const reportStationIssue=createStationIssueReporter({post:async body=>(await api.post(API_ENDPOINTS.stations.reportError,body,{timeout:10000})).data,storage:AsyncStorage});
