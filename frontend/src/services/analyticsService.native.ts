import {Platform} from 'react-native';
import {createAnalyticsClient} from './analyticsClient';
let instance:any;
const enabled=!__DEV__||process.env.EXPO_PUBLIC_ANALYTICS_DEBUG==='1';
function sdk(){if(instance)return instance;try{const mod=require('@react-native-firebase/analytics');instance=(mod.default||mod)();return instance;}catch{return null;}}
export const analyticsService=createAnalyticsClient({
 initialize:async()=>{await sdk()?.setAnalyticsCollectionEnabled(enabled);},
 event:async(name,params)=>{if(!enabled)return;const a=sdk();if(!a)return;const data={...params,platform:Platform.OS,...(__DEV__?{debug_mode:1}:{})};if(name==='screen_view')await a.logScreenView(data);else await a.logEvent(name,data);},
 user:async(id)=>{if(enabled)await sdk()?.setUserId(id);},
 property:async(name,value)=>{if(enabled)await sdk()?.setUserProperty(name,value);}
});
export default analyticsService;
