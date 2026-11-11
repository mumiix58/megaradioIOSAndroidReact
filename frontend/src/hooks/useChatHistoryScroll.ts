import {useCallback,useEffect,useRef,useState} from 'react';
import {FlatList,Platform} from 'react-native';
import type {NativeScrollEvent,NativeSyntheticEvent} from 'react-native';
import type {ChatScrollIndicatorHandle} from '../components/chat/ChatScrollIndicator';
/** Shared follow-bottom policy: incoming updates never pull a reader out of history. */
export function useChatHistoryScroll<T>(key:string){
 const list=useRef<FlatList<T>>(null),nearBottom=useRef(true),lastOffset=useRef(0),userScrollUntil=useRef(0),scrollFrame=useRef<number|null>(null),scrollIndicator=useRef<ChatScrollIndicatorHandle>(null);
 const [awayFromBottom,setAwayFromBottom]=useState(false);
 const scrollToLatest=useCallback(()=>{if(!nearBottom.current)return;if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);scrollFrame.current=requestAnimationFrame(()=>{scrollFrame.current=null;if(!nearBottom.current)return;if(Platform.OS==='web'){const node=list.current?.getScrollableNode() as unknown as HTMLElement|undefined;if(node){node.scrollTop=node.scrollHeight;return;}}list.current?.scrollToEnd({animated:false});});},[]);
 useEffect(()=>{nearBottom.current=true;lastOffset.current=0;userScrollUntil.current=0;setAwayFromBottom(false);return()=>{if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);};},[key]);
 const historyProps={onScrollBeginDrag:()=>{userScrollUntil.current=Infinity;},onScrollEndDrag:()=>{userScrollUntil.current=Date.now()+250;},onMomentumScrollEnd:()=>{userScrollUntil.current=0;},onScroll:(event:NativeSyntheticEvent<NativeScrollEvent>)=>{const n=event.nativeEvent;scrollIndicator.current?.update(n.contentOffset.y,n.layoutMeasurement.height,n.contentSize.height);const distance=n.contentSize.height-n.contentOffset.y-n.layoutMeasurement.height;setAwayFromBottom(distance>80);if(distance<100)nearBottom.current=true;else if(Date.now()<userScrollUntil.current)nearBottom.current=false;lastOffset.current=n.contentOffset.y;},...(Platform.OS==='web'?{onWheel:(event:any)=>{userScrollUntil.current=Date.now()+300;if(event.deltaY<0)nearBottom.current=false;},onTouchMove:()=>{userScrollUntil.current=Date.now()+500;}}:{})};
 const jumpLatest=()=>{nearBottom.current=true;userScrollUntil.current=0;setAwayFromBottom(false);scrollToLatest();};
 return {list,nearBottom,lastOffset,userScrollUntil,scrollFrame,scrollIndicator,awayFromBottom,setAwayFromBottom,scrollToLatest,jumpLatest,historyProps};
}
