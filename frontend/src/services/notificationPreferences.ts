import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const memory=new Map<string,boolean>();
const key=(owner:string)=>`@megaradio/push-preference/${encodeURIComponent(owner)}`;
/** No legacy device-wide value is copied between accounts. */
export async function readCachedPushPreference(owner:string):Promise<boolean|undefined>{
 if(!owner)return undefined;
 if(memory.has(owner))return memory.get(owner);
 try{const value=await AsyncStorage.getItem(key(owner));if(value==='true'||value==='false'){const enabled=value==='true';memory.set(owner,enabled);return enabled;}}catch{}
 return undefined;
}
export async function cachePushPreference(owner:string,enabled:boolean):Promise<void>{
 memory.set(owner,enabled);
 // Server acknowledgement must not be undone because an optional disk cache failed.
 try{await AsyncStorage.setItem(key(owner),String(enabled));}catch{}
}
function valueFrom(data:any):boolean{
 const value=data?.notificationSettings?.pushEnabled;
 if(typeof value!=='boolean')throw Error('invalid-push-preference');
 return value;
}
export async function getPushPreference(owner:string):Promise<boolean>{
 if(!owner)throw Error('missing-push-owner');
 const value=valueFrom((await api.get('/api/user/notification-settings',{timeout:6000})).data);
 await cachePushPreference(owner,value);return value;
}
export async function savePushPreference(owner:string,enabled:boolean):Promise<void>{
 if(!owner)throw Error('missing-push-owner');
 const previous=await readCachedPushPreference(owner);
 // Stop foreground banners immediately while the server commits the opt-out.
 if(!enabled)await cachePushPreference(owner,false);
 try{
  const value=valueFrom((await api.patch('/api/user/notification-settings',{pushEnabled:enabled},{timeout:6000})).data);
  if(value!==enabled)throw Error('push-preference-not-saved');
  await cachePushPreference(owner,value);
 }catch(error){if(!enabled)await cachePushPreference(owner,previous??false);throw error;}
}
