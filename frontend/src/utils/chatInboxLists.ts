export type ChatList={id:string;name:string;chatIds:string[]};
export type InboxFilter='all'|'unread'|'groups'|string;
export function parseChatLists(raw:string|null):ChatList[]{
 try{
  const data=JSON.parse(raw||'[]');
  if(!Array.isArray(data))return [];
  const result:ChatList[]=[],ids=new Set<string>();
  for(const item of data){
   if(!item||typeof item.id!=='string'||['all','unread','groups'].includes(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||!Array.isArray(item.chatIds))continue;
   ids.add(item.id);
   result.push({id:item.id,name:item.name.trim().slice(0,30),chatIds:[...new Set(item.chatIds.filter((id:unknown)=>typeof id==='string'))] as string[]});
   if(result.length===30)break;
  }
  return result;
 }catch{return [];}
}
export function filterInbox<T extends {partnerId:string;unreadCount?:number;group?:unknown}>(rows:T[],filter:InboxFilter,lists:ChatList[]):T[]{
 if(filter==='all')return rows;
 if(filter==='unread')return rows.filter(row=>(row.unreadCount||0)>0);
 if(filter==='groups')return rows.filter(row=>!!row.group);
 const ids=new Set(lists.find(list=>list.id===filter)?.chatIds||[]);
 return rows.filter(row=>ids.has(row.partnerId));
}
