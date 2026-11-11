import {groupDiscoveryHistory} from './groupDiscoveryHistory';
import {blockedDiscoveryRadio} from './discoveryRadioVerifier';
import {loadGroupRadioDeck} from './groupRadioDiscovery';

/** Selection warmup and the discovery screen share one request and cache key. */
export function radioDiscoveryQuery(owner:string,genres:readonly string[],refill=0){
 const selected=[...new Set(genres)].sort();
 return {queryKey:['group-radio-discovery-fresh',owner,refill,...selected],queryFn:async({signal}:{signal:AbortSignal})=>{
  const history=groupDiscoveryHistory(owner);await history.ready;
  if(signal.aborted)throw new Error('Discovery canceled');
  return loadGroupRadioDeck(selected,signal,station=>history.history.has(station)||blockedDiscoveryRadio(station));
 },staleTime:60000,retry:false as const};
}
