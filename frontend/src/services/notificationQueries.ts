import api from './api';
import {API_ENDPOINTS} from '../constants/api';
import type {NotificationsResponse} from '../types/notifications';

/** Shared bell warm-up + screen read. Private in-memory cache is scoped to the signed-in account. */
export function notificationQueryOptions(owner?:string) {
 return {
  queryKey:['notifications',owner] as const,
  queryFn:async({signal}:{signal:AbortSignal}):Promise<NotificationsResponse>=>{
    const {data}=await api.get(API_ENDPOINTS.user.notifications,{signal,timeout:8000});
    return data;
  },
  staleTime:30000,
  gcTime:15*60*1000,
  retry:(count:number,error:any)=>count<1&&![401,403].includes(error?.response?.status),
  retryDelay:500,
 };
}
