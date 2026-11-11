import type {AnalyticsParams} from './analyticsSession';
export type AnalyticsTransport={initialize:()=>Promise<void>;event:(name:string,params:AnalyticsParams)=>Promise<void>;user:(id:string|null)=>Promise<void>;property:(name:string,value:string)=>Promise<void>};
/** One ordered queue keeps account changes ahead of their events; failures never interrupt UI. */
export function createAnalyticsClient(transport:AnalyticsTransport){
 let queue=Promise.resolve();let ready:Promise<void>|undefined;
 const initialize=()=>ready||(ready=transport.initialize().catch(()=>{ready=undefined;}));
 const run=(task:()=>Promise<void>)=>{queue=queue.then(async()=>{await initialize();await task();}).catch(()=>{});return queue;};
 const event=(name:string,params:AnalyticsParams={})=>run(()=>transport.event(name,params));
 return {initialize,logEvent:event,
  logScreenView:(screen_name:string,screen_class=screen_name)=>event('screen_view',{screen_name,screen_class}),
  logAppOpen:()=>event('app_open'), logAppLaunch:(launch_source:string)=>event('app_launch',{launch_source}),
  logStartupTime:(duration_ms:number)=>event('app_startup_time',{duration_ms:Math.round(duration_ms)}),
  logStationPlay:(station_id:string,station_name:string,genre='unknown')=>event('station_play',{station_id,station_name:station_name.slice(0,100),genre}),
  logStationFavorite:(station_id:string,station_name:string,isFavorite:boolean)=>event('station_favorite',{station_id,station_name:station_name.slice(0,100),action:isFavorite?'add':'remove'}),
  logPremiumPurchase:(product_id:string,price?:string)=>event('premium_purchase',{product_id,price:price||'unknown'}),
  logPaywallView:(source:string)=>event('paywall_view',{source}),
  logAdWatched:(ad_type:string,station_id='none')=>event('ad_watched',{ad_type,station_id}),
  // Search queries can contain names/emails; record volume/results, never free text.
  logSearch:(_query:string,results_count:number)=>event('search',{results_count}),
  logGenreBrowse:(genre_name:string)=>event('genre_browse',{genre_name:genre_name.slice(0,100)}),
  logCarConnect:(car_platform:'carplay'|'android_auto')=>event('car_connect',{car_platform}),
  logLogin:(method:string)=>event('login',{method}),logSignUp:(method:string)=>event('sign_up',{method}),
  setUserId:(id:string|null)=>run(async()=>{await transport.user(id);await transport.property('auth_status',id?'signed_in':'guest');}),
  setUserProperty:(name:string,value:string)=>run(()=>transport.property(name,value)),
  setIsPremium:(value:boolean)=>run(()=>transport.property('is_premium',String(value)))
 };
}
