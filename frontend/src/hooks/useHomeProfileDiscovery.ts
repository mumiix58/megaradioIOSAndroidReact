import { useCallback,useEffect,useRef,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { homeProfileDiscoveryReady,nextHomeProfiles } from '../services/homeProfileDiscovery';
import { eligibleHomeProfiles,type HomeDiscoveryProfile } from '../utils/homeProfileDiscovery';

export function useHomeProfileDiscovery(profiles: HomeDiscoveryProfile[] | undefined,owner:string,count:number) {
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{let active=true;void homeProfileDiscoveryReady.then(()=>{if(active)setHydrated(true)});return()=>{active=false}},[]);
  const latest=useRef(profiles);latest.current=profiles;
  const focused=useRef(false),pending=useRef(false);
  const [batch,setBatch]=useState<{owner:string;ids:string[]}>({owner:'',ids:[]});
  const select=useCallback(()=>{
    if(!focused.current||!pending.current||!hydrated||latest.current===undefined)return;
    // An empty stale placeholder must not consume the visit before fresh data arrives.
    pending.current=eligibleHomeProfiles(latest.current,owner).length===0;
    setBatch({owner,ids:nextHomeProfiles(owner,latest.current,count)});
  },[owner,count,hydrated]);
  useFocusEffect(useCallback(()=>{focused.current=true;pending.current=true;select();return()=>{focused.current=false}},[select]));
  useEffect(()=>{select()},[profiles,select]);
  const rotate=useCallback(()=>{pending.current=true;select()},[select]);
  // Revalidate current eligibility on every response, without reshuffling visible cards.
  const byId=new Map(eligibleHomeProfiles(profiles||[],owner).map(profile=>[profile._id,profile]));
  const selected=batch.owner===owner?batch.ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]):[];
  return { profiles:selected,rotate,loading:!hydrated || (batch.owner!==owner&&profiles===undefined) };
}
