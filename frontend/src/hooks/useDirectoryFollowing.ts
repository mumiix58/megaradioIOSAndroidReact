import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

type StatusState={owner:string;values:Record<string,boolean>};
type CachedStatuses={values:Record<string,boolean>;times:Record<string,number>};
const FRESH_FOR=60_000;
const relationshipListeners=new Set<(owner:string,id:string,value:boolean)=>void>();
function freshCachedStatuses(raw:string|null):CachedStatuses {
  try {
    const cache=raw?JSON.parse(raw):null;
    if(cache?.version!==2)return{values:{},times:{}};
    const values:Record<string,boolean>={},times:Record<string,number>={};
    for(const [id,value] of Object.entries(cache.values||{})){
      const checked=cache.times?.[id];
      if(typeof value==='boolean'&&typeof checked==='number'&&Number.isFinite(checked)&&checked<=Date.now()&&Date.now()-checked<FRESH_FOR){values[id]=value;times[id]=checked;}
    }
    return{values,times};
  }catch{return{values:{},times:{}};}
}

export function useDirectoryFollowing(ids: string[], enabled: boolean) {
  const { user, token, isAuthenticated } = useAuthStore();
  const owner = isAuthenticated ? user?._id || (user as any)?.id || '' : '';
  const current = useRef(owner); current.current = owner;
  const [state, setState] = useState<StatusState>({ owner: '', values: {} });
  const known=useRef<StatusState>({owner:'',values:{}});
  const fresh=useRef<{owner:string;times:Record<string,number>}>({owner:'',times:{}});
  const disk=useRef<{owner:string;promise:Promise<CachedStatuses>}|null>(null);
  const [busyState,setBusy]=useState<{owner:string;values:Record<string,boolean>}>({owner:'',values:{}});
  const [errorState,setErrors]=useState<{owner:string;values:Record<string,boolean>}>({owner:'',values:{}});
  const [retry,setRetry]=useState(0);
  const mutations=useRef(new Set<string>());
  const revisions = useRef<Record<string, number>>({});
  const mutationVersion = useRef(0);
  const signature = [...new Set(ids)].sort().join('|');
  useEffect(()=>{
    const receive=(changedOwner:string,id:string,value:boolean)=>{
      if(changedOwner!==owner||current.current!==owner||known.current.owner!==owner)return;
      const key=`${owner}:${id}`;
      revisions.current[key]=(revisions.current[key]||0)+1;mutationVersion.current++;
      known.current={owner,values:{...known.current.values,[id]:value}};
      fresh.current.times[id]=Date.now();setState(known.current);
    };
    relationshipListeners.add(receive);
    return()=>{relationshipListeners.delete(receive);};
  },[owner]);
  useEffect(() => {
    let active = true;
    const controller=new AbortController();
    const storageKey = `megaradio_follow_status:user:${owner}`;
    const loadVersion = mutationVersion.current;
    if(known.current.owner!==owner){
      known.current={owner,values:{}};fresh.current={owner,times:{}};
      setState(known.current);setBusy({owner,values:{}});setErrors({owner,values:{}});
    }
    if (!enabled || !owner || !token) return;
    if(disk.current?.owner!==owner)disk.current={owner,promise:AsyncStorage.getItem(storageKey)
      .then(freshCachedStatuses).catch(()=>({values:{},times:{}}))};
    const cachedValues=disk.current!.promise;
    void (async () => {
      const cached=await cachedValues;
      if(!active||current.current!==owner)return;
      // Existing visible rows and mutations win over older disk snapshots.
      known.current={owner,values:{...cached.values,...known.current.values}};
      fresh.current.times={...cached.times,...fresh.current.times};
      setState(known.current);
      const pending=signature.split('|').filter(id=>id&&id!==owner&&
        (known.current.values[id]===undefined||Date.now()-(fresh.current.times[id]||0)>FRESH_FOR));
      if(pending.length)setErrors(previous=>({owner,values:{...(previous.owner===owner?previous.values:{}),...Object.fromEntries(pending.map(id=>[id,false]))}}));
      await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
        while(active&&pending.length){
          const id=pending.shift()!,key=`${owner}:${id}`,revision=revisions.current[key]||0;
          try{
            const {data}=await api.get(`/api/user/is-following/${id}`,{signal:controller.signal,timeout:6000,headers:{Authorization:`Bearer ${token}`}});
            if(typeof data?.isFollowing!=='boolean')throw Error('Invalid follow status');
            if(!active||current.current!==owner||revision!==(revisions.current[key]||0))continue;
            known.current={owner,values:{...known.current.values,[id]:data.isFollowing}};
            fresh.current.times[id]=Date.now();setState(known.current);
            setErrors(previous=>({owner,values:{...(previous.owner===owner?previous.values:{}),[id]:false}}));
          }catch{
            // A failed read is not evidence that the user is unfollowed.
            if(active&&!controller.signal.aborted&&current.current===owner)
              setErrors(previous=>({owner,values:{...(previous.owner===owner?previous.values:{}),[id]:true}}));
          }
        }
      }));
      if(active&&current.current===owner&&loadVersion===mutationVersion.current)
        await AsyncStorage.setItem(storageKey,JSON.stringify({version:2,values:known.current.values,times:fresh.current.times})).catch(()=>{});
    })();
    return()=>{active=false;controller.abort();};
  },[owner,token,signature,enabled,retry]);

  const values = state.owner === owner ? state.values : {};
  const busy=busyState.owner===owner?busyState.values:{};
  const errors=errorState.owner===owner?errorState.values:{};
  const toggle = async (id: string) => {
    const key=`${owner}:${id}`;
    if (!owner || !token || mutations.current.has(key)) return;
    if(values[id]===undefined){setRetry(value=>value+1);return;}
    const before=values[id];
    revisions.current[key]=(revisions.current[key]||0)+1;mutationVersion.current++;
    mutations.current.add(key);
    setBusy(previous=>({owner,values:{...(previous.owner===owner?previous.values:{}),[id]:true}}));
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (before) await api.delete(`/api/user/unfollow/${id}`, config);
      else await api.post(`/api/user/follow/${id}`, {}, config);
      if (current.current !== owner) return;
      known.current={owner,values:{...known.current.values,[id]:!before}};
      fresh.current.times[id]=Date.now();setState(known.current);
      relationshipListeners.forEach(notify=>notify(owner,id,!before));
      await AsyncStorage.setItem(`megaradio_follow_status:user:${owner}`,JSON.stringify({version:2,values:known.current.values,times:fresh.current.times})).catch(()=>{});
    } finally {
      mutations.current.delete(key);
      if(current.current===owner)setBusy(previous=>({owner,values:{...(previous.owner===owner?previous.values:{}),[id]:false}}));
    }
  };
  return { owner, values, busy, errors, toggle };
}
