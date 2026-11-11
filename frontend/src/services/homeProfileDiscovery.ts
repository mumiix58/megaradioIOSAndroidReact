import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfileDiscoveryRotation, type HomeDiscoveryProfile, type ProfileDiscoverySnapshot } from '../utils/homeProfileDiscovery';
const KEY='home-profile-discovery:v1';
let next=createProfileDiscoveryRotation();
let write=Promise.resolve();
export const homeProfileDiscoveryReady=AsyncStorage.getItem(KEY).then(raw=>{
  let initial:ProfileDiscoverySnapshot=[];
  try {
    const parsed=raw?JSON.parse(raw):[];
    if(Array.isArray(parsed)) initial=parsed.filter(row=>Array.isArray(row)&&typeof row[0]==='string'&&Array.isArray(row[1])&&row[1].length<=40&&row[1].every((id:unknown)=>typeof id==='string'));
  } catch { /* Start a new discovery deck if local storage is invalid. */ }
  next=createProfileDiscoveryRotation(initial,snapshot=>{
    const value=JSON.stringify(snapshot);
    write=write.then(()=>AsyncStorage.setItem(KEY,value)).catch(()=>{});
  });
}).catch(()=>{});
export const nextHomeProfiles=(owner:string,profiles:readonly HomeDiscoveryProfile[],count:number)=>next(owner,profiles,count);
