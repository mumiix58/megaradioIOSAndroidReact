import AsyncStorage from '@react-native-async-storage/async-storage';
import {WorldRadioHistory} from '../utils/worldRadioHistory';
import {WorldCountryRotation} from '../utils/worldCountryRotation';
import type {Station} from '../types';
// Account-scoped history survives closing the discovery overlay and app restarts.
const sessions=new Map<string,ReturnType<typeof create>>();
function create(owner:string){
 const history=new WorldRadioHistory(20000),countries=new WorldCountryRotation();
 const key='@mega_group_discovery_v1:'+encodeURIComponent(owner);
 let writes=Promise.resolve();
 const ready=AsyncStorage.getItem(key).then(raw=>{if(raw)history.restore(JSON.parse(raw));}).catch(()=>{});
 return {history,countries,ready,remember(station:Station){
  history.remember(station);countries.remember(station);
  writes=writes.then(()=>ready).then(()=>AsyncStorage.setItem(key,JSON.stringify(history.snapshot()))).catch(()=>{});
 }};
}
export function groupDiscoveryHistory(owner:string){
 let session=sessions.get(owner);if(!session){session=create(owner);sessions.set(owner,session);}return session;
}
