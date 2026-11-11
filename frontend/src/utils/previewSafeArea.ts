import {Platform} from 'react-native';

type PreviewMetrics={top:number;bottom:number;width:number;height:number};
const KEY='@mega_preview_metrics_v1';
function parse(value:string):PreviewMetrics|null{
 try{
  const m=JSON.parse(value);
  if(![m.top,m.bottom,m.width,m.height].every(Number.isFinite)||m.top<0||m.top>100||m.bottom<0||m.bottom>100||m.width<240||m.width>2000||m.height<320||m.height>3000)return null;
  return {top:m.top,bottom:m.bottom,width:m.width,height:m.height};
 }catch{return null;}
}
/** Native insets stay OS-owned. The host supplies synthetic metrics only in local web previews. */
export function previewSafeArea():PreviewMetrics{
 const none={top:0,bottom:0,width:0,height:0};
 if(!__DEV__||Platform.OS!=='web'||process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY!=='1'||typeof window==='undefined'||window.parent===window)return none;
 const legacy={top:59,bottom:34,width:430,height:932};
 // window.name can be cleared by cross-origin navigation. A validated URL bootstrap
 // plus tab-scoped sessionStorage survives Expo Router navigation without mixing devices.
 const boot=new URLSearchParams(window.location.search).get('__megaPreview');
 const metrics=(boot&&parse(boot))||(window.name?.startsWith('mega-preview:')&&parse(window.name.slice(13)));
 if(metrics){try{window.sessionStorage.setItem(KEY,JSON.stringify(metrics));}catch{}return metrics;}
 try{const saved=window.sessionStorage.getItem(KEY);if(saved)return parse(saved)||legacy;}catch{}
 return legacy;
}
