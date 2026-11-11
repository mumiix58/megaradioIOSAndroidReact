import {Platform} from 'react-native';
import {usePremiumStore} from '../store/premiumStore';
import {verifyWorldRadio} from './worldRadioValidation';
import {worldRadioKeys} from '../utils/worldRadioHistory';
import type {Station} from '../types';

// Device-local, temporary quarantine. An outage never permanently removes a station.
const failures=new Map<string,number>();
const FAILURE_TTL=120000,READY_TTL=15000;
function prune(now:number){for(const [key,until] of failures)if(until<=now)failures.delete(key);while(failures.size>512)failures.delete(failures.keys().next().value!);}
export function blockDiscoveryRadio(station:Station,now=Date.now()){prune(now);for(const key of worldRadioKeys(station))failures.set(key,now+FAILURE_TTL);}
export function blockedDiscoveryRadio(station:Station,now=Date.now()){prune(now);return worldRadioKeys(station).some(key=>(failures.get(key)||0)>now);}

type Job={controller:AbortController;promise:Promise<Station|null>};
/** Two short-lived muted checks, never a probe of the whole carousel or an open stream reserve. */
export class DiscoveryRadioVerifier{
 private jobs=new Map<string,Job>();
 private ready=new Map<string,{at:number;station:Station}>();
 private active=true;
 constructor(private verify=verifyWorldRadio,private now=Date.now){}
 private key(station:Station){return JSON.stringify([Platform.OS,usePremiumStore.getState().hasFeature('hd_stream'),station._id,station.url,station.urlResolved,station.url_resolved,(station as Station&{urlHigh?:string}).urlHigh,(station as Station&{urlLow?:string}).urlLow,(station as Station&{url_high?:string}).url_high,(station as Station&{url_low?:string}).url_low,station.favicon,station.logo,(station as Station&{localImagePath?:string}).localImagePath,station.logoAssets]);}
 peek(station:Station){const value=this.ready.get(this.key(station));return value&&this.now()-value.at<READY_TTL&&!blockedDiscoveryRadio(station,this.now())?value.station:null;}
 blocked(station:Station){return blockedDiscoveryRadio(station,this.now());}
 reject(station:Station){this.ready.delete(this.key(station));blockDiscoveryRadio(station,this.now());}
 setActive(active:boolean){this.active=active;if(!active){for(const job of this.jobs.values())job.controller.abort();this.ready.clear();}}
 private start(station:Station):Promise<Station|null>{
  const key=this.key(station),cached=this.peek(station),pending=this.jobs.get(key);
  if(!this.active||this.blocked(station))return Promise.resolve(null);
  if(cached)return Promise.resolve(cached);if(pending)return pending.promise;
  const controller=new AbortController();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},5000);
  const job={} as Job;job.controller=controller;
  let cancel=()=>{};const canceled=new Promise<null>(resolve=>{cancel=()=>resolve(null);controller.signal.addEventListener('abort',cancel,{once:true});});
  const work=Promise.resolve().then(()=>this.verify(station,controller.signal)).catch(()=>null);
  job.promise=Promise.race([work,canceled]).then(result=>{
   if(controller.signal.aborted&&!timedOut||!this.active)return null;
   if(result){this.ready.set(key,{station:result,at:this.now()});while(this.ready.size>8)this.ready.delete(this.ready.keys().next().value!);}
   else this.reject(station);
   return result;
  }).finally(()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);if(this.jobs.get(key)===job)this.jobs.delete(key);});
  this.jobs.set(key,job);return job.promise;
 }
 warm(candidates:Station[]){
  if(!this.active)return;
  for(const station of candidates){if(this.jobs.size>=2)break;if(!this.peek(station)&&!this.blocked(station))void this.start(station);}
 }
 async resolve(station:Station,signal:AbortSignal):Promise<Station|null>{
  if(signal.aborted||!this.active||this.blocked(station))return null;
  const cached=this.peek(station);if(cached)return cached;
  const key=this.key(station);
  // A selected station takes priority over speculative work, without adding a third decoder.
  while(!this.jobs.has(key)&&this.jobs.size>=2){const old=this.jobs.values().next().value!;old.controller.abort();await old.promise;if(signal.aborted||!this.active)return null;}
  if(signal.aborted||!this.active)return null;
  const promise=this.start(station),job=this.jobs.get(key);
  if(!job)return promise;
  return new Promise(resolve=>{
   let done=false;const finish=(value:Station|null)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);resolve(value);};
   const abort=()=>{job.controller.abort();finish(null);};signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted)abort();else void promise.then(finish);
  });
 }
}
