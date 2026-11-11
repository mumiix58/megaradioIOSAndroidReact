import {usePlayerStore} from '../store/playerStore';
import type {Station} from '../types';

/** A resolved play() request is not proof of native playback: require the actual player's event. */
export function startDiscoveryPlayback(station:Station,start:()=>Promise<void>,signal?:AbortSignal,stopPending?:()=>Promise<void>){
 return new Promise<void>((resolve,reject)=>{
  let done=false,seenTarget=false,startSettled=false,unsubscribe=()=>{};
  const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);unsubscribe();signal?.removeEventListener('abort',abort);if(error){const state=usePlayerStore.getState();if(stopPending&&state.currentStation?._id===station._id&&['loading','buffering'].includes(state.playbackState)){try{void stopPending().catch(()=>{});}catch{}}reject(error);}else resolve();};
  const canceled=()=>{const error=new Error('Discovery canceled');error.name='AbortError';return error;};
  const abort=()=>finish(canceled());
  const timer=setTimeout(()=>finish(new Error('Discovery stream did not start')),5500);
  const check=()=>{const state=usePlayerStore.getState();if(state.currentStation?._id!==station._id){if(seenTarget)finish(canceled());return;}if(state.playbackState==='playing'){finish();return;}if(['loading','buffering'].includes(state.playbackState))seenTarget=true;else if(state.playbackState==='error'&&(seenTarget||startSettled))finish(new Error('Discovery stream failed'));else if(seenTarget&&['paused','idle'].includes(state.playbackState))finish(canceled());};
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  unsubscribe=usePlayerStore.subscribe(check);
  const current=usePlayerStore.getState();if(current.currentStation?._id===station._id&&current.playbackState==='playing'){finish();return;}
  // Subscribe before starting so fast cached streams cannot lose their playing event.
  try{void Promise.resolve(start()).then(()=>{startSettled=true;check();},error=>finish(error instanceof Error?error:new Error('Discovery stream failed')));}catch(error){finish(error instanceof Error?error:new Error('Discovery stream failed'));}
 });
}
