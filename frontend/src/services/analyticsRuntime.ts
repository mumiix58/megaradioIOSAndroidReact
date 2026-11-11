import analyticsService from './analyticsService';
import {AnalyticsSession} from './analyticsSession';
let lastContext='';
export const analyticsSession=new AnalyticsSession((name,params)=>{
 const properties={current_screen:String(params.screen_name||'home').slice(0,36),current_station:String(params.station_id||'none').slice(0,36),playback_state:String(params.playback_state||'idle').slice(0,36)};
 const key=JSON.stringify(properties);
 if(key!==lastContext){lastContext=key;for(const [name,value] of Object.entries(properties))void analyticsService.setUserProperty(name,value);}
 void analyticsService.logEvent(name,params);
});
