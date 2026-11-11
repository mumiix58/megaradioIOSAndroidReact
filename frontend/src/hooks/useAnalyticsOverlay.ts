import {useEffect,useRef} from 'react';
import {analyticsSession} from '../services/analyticsRuntime';
let sequence=0;
/** Modal screens share the route observer's screen stack and restore the parent on dismiss. */
export function useAnalyticsOverlay(name:string,visible:boolean){
 const key=useRef<string|null>(null);if(key.current===null)key.current='overlay-'+(++sequence);
 useEffect(()=>{if(!visible)return;return()=>analyticsSession.overlay(key.current!,null);},[visible]);
 useEffect(()=>{if(visible)analyticsSession.overlay(key.current!,name);},[name,visible]);
}
