import {previewConversations,initialPreviewThreads,mergePreviewThreads} from './chatPreview';
/** Local design preview only; never create notifications or mark remote rows read. */
export function createNotificationPreview(stored:Record<string,any[]>,now=Date.now()) {
 const threads=mergePreviewThreads(initialPreviewThreads(),stored);
 const messages=['demo-2','demo-0','demo-1'].map((id,index)=>{
  const person=previewConversations.find(row=>row.partnerId===id)!.partner!;
  const last=[...(threads[id]||[])].reverse().find(message=>message.fromUserId===id);
  return {_id:`preview-notification-message-${id}`,type:'new_message',fromUserId:person,message:last?.content||'',isRead:false,read:false,createdAt:new Date(now-(index*3+1)*60000).toISOString(),data:{userId:id,userName:person.fullName}};
 });
 const follows=['demo-3','demo-5'].map((id,index)=>{
  const person=previewConversations.find(row=>row.partnerId===id)!.partner!;
  return {_id:`preview-notification-follow-${id}`,type:'follow',fromUserId:person,message:'',isRead:false,read:false,createdAt:new Date(now-(index*5+12)*60000).toISOString(),data:{userId:id,userName:person.fullName}};
 });
 return [...messages,...follows];
}
