import {createAnalyticsClient} from './analyticsClient';
const measurementId=process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID||'G-3X2WGQC0J3';
let initialized=false;
const allowed=()=>typeof window!=='undefined'&&!__DEV__&&!['localhost','127.0.0.1'].includes(window.location.hostname)&&navigator.doNotTrack!=='1'&&!(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl;
function gtag(..._args:unknown[]){const w=window as any;(w.dataLayer||(w.dataLayer=[])).push(arguments);}
export const analyticsService=createAnalyticsClient({
 initialize:async()=>{if(initialized||!allowed())return;initialized=true;gtag('js',new Date());gtag('config',measurementId,{send_page_view:false,allow_google_signals:false,page_location:window.location.origin+window.location.pathname,page_title:'MegaRadio'});const script=document.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;document.head.appendChild(script);},
 event:async(name,params)=>{if(allowed())gtag('event',name,{...params,send_to:measurementId,client_surface:'mobile_web',page_location:window.location.origin+window.location.pathname});},
 user:async(user_id)=>{if(allowed())gtag('config',measurementId,{user_id,send_page_view:false});},
 property:async(name,value)=>{if(allowed())gtag('set','user_properties',{[name]:value});}
});
export default analyticsService;
