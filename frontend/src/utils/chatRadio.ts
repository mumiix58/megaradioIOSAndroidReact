import {getStationLogoUrl} from './stationLogoHelper';
import type { Station } from '../types';
export interface RadioGift { version:1; stationId:string; name:string; country:string; genre?:string; logo?:string; intent:'gift'|'together'|'custom'; caption?:string }
export function radioGift(station:Station,intent:RadioGift['intent'],caption=''):RadioGift {
 return {version:1,stationId:station._id,name:station.name.slice(0,140),country:(station.country||'').slice(0,80),genre:(station.genres?.[0]||station.tags?.split(',')[0]||'').trim().slice(0,80)||undefined,logo:(getStationLogoUrl(station,'large')||'').slice(0,600)||undefined,intent,caption:caption.trim().slice(0,300)||undefined};
}
export function parseRadioGift(content:string):RadioGift|null {
 try{const value=JSON.parse(content);if(value?.version!==1||!/^([a-f0-9]{24})$/i.test(value.stationId)||typeof value.name!=='string'||!value.name.trim()||value.name.length>140||!['gift','together','custom'].includes(value.intent))return null;return {version:1,stationId:value.stationId,name:value.name,country:typeof value.country==='string'?value.country.slice(0,80):'',genre:typeof value.genre==='string'?value.genre.slice(0,80):undefined,logo:typeof value.logo==='string'&&/^https?:\/\//i.test(value.logo)?value.logo.slice(0,600):undefined,intent:value.intent,caption:typeof value.caption==='string'?value.caption.slice(0,300):undefined};}catch{return null;}
}
