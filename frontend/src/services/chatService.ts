import api from './api';
import {mergeChatMessage} from '../utils/chatMessageState';
import { Platform } from 'react-native';
export interface ChatUser { _id: string; fullName?: string; username?: string; avatar?: string; profileImageUrl?: string; online?: boolean; lastSeenAt?: string }
export interface ChatReply {_id:string;fromUserId:string;content:string;messageType?:string;deletedAt?:string|null}
export interface ChatMessage { _id: string; fromUserId: string; toUserId: string; content: string; messageType?: 'text' | 'emoji' | 'image' | 'gif' | 'audio' | 'station'; imageUrl?: string; read: boolean; deletedAt?:string|null; hiddenFor?:string[]; replyToId?:string;replyTo?:ChatReply;pinnedAt?:string|null;pinUpdatedAt?:string; createdAt: string }
export interface ChatConversation { partnerId: string; partner: ChatUser | null; lastMessage: string; lastMessageAt: string; unreadCount: number; lastMessageDeleted?:boolean; online?: boolean }
export interface ChatPage { messages: ChatMessage[];pinnedMessages?:ChatMessage[]; partner: ChatUser | null; hasMore: boolean; canSend?: boolean; listening?: {userId:string;messageId:string;stationId?:string;expiresAt:number}[] }
export type OutgoingMessage = { replyToId?:string;toUserId: string; content: string; messageType: 'text' | 'emoji' | 'image' | 'gif' | 'audio' | 'station'; imageUrl?: string };
export const chatService = {
  async conversations(): Promise<ChatConversation[]> { return (await api.get('/api/messages/conversations')).data.conversations || []; },
  async canStart(id: string): Promise<boolean> { const [follow, profile] = await Promise.all([api.get(`/api/user/is-following/${encodeURIComponent(id)}`), api.get(`/api/user-profile/${encodeURIComponent(id)}`)]); return follow.data?.isFollowing === true && profile.data?.isPublicProfile === true; },
  async contacts(): Promise<ChatUser[]> { return (await api.get('/api/messages/contacts')).data.contacts || []; },
  async conversation(id: string, before?: string): Promise<ChatPage> { return (await api.get(`/api/messages/conversation/${encodeURIComponent(id)}`, { params: { before } })).data; },
  async unread(): Promise<number> { return (await api.get('/api/messages/unread-count')).data.count || 0; },
  async send(message: OutgoingMessage): Promise<ChatMessage> { return (await api.post('/api/messages/send', message)).data.message; },
  async delete(messageId:string,scope:'self'|'everyone'):Promise<void>{await api.post('/api/messages/delete',{messageId,scope});},
  async pin(messageId:string,pinned:boolean):Promise<ChatMessage>{return (await api.post('/api/messages/pin',{messageId,pinned})).data.message;},
  async ticket(): Promise<string> { return (await api.get('/api/messages/ws-ticket')).data.ticket; },
  async uploadAudio(asset: {uri:string;mimeType:string;fileName:string}): Promise<string> {
    const form=new FormData();
    if(Platform.OS==='web')form.append('audio',await (await fetch(asset.uri)).blob(),asset.fileName);
    else form.append('audio',{uri:asset.uri,name:asset.fileName,type:asset.mimeType} as any);
    const {data}=await api.post('/api/messages/upload-audio',form,{headers:{'Content-Type':'multipart/form-data'},timeout:30000});
    if(!chatAudioUrl(data.audioUrl))throw new Error('Invalid voice response');return data.audioUrl;
  },
  async upload(asset: { uri: string; mimeType?: string | null; fileName?: string | null; file?: File }): Promise<string> {
    const form = new FormData();
    if (Platform.OS === 'web') form.append('image', asset.file || await (await fetch(asset.uri)).blob(), asset.fileName || 'image.jpg');
    else form.append('image', { uri: asset.uri, name: asset.fileName || 'image.jpg', type: asset.mimeType || 'image/jpeg' } as any);
    const result = (await api.post('/api/messages/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 })).data;
    if (!/^\/uploads\/chat\/[a-z0-9_-]+\.(?:jpe?g|png|gif|webp)$/i.test(result.imageUrl || '')) throw new Error('Invalid image response');
    return result.imageUrl;
  },
};
export function mergeChatMessages(...pages: ChatMessage[][]): ChatMessage[] {
  const merged=new Map<string,ChatMessage>();for(const message of pages.flat())merged.set(message._id,mergeChatMessage(merged.get(message._id),message));
  return [...merged.values()].sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a._id.localeCompare(b._id));
}
export function chatImageUrl(url?: string): string | undefined {
  if (url && /^\/uploads\/chat\/[a-z0-9_-]+\.(?:jpe?g|png|gif|webp)$/i.test(url)) return `https://api.themegaradio.com${url}`;
  return undefined;
}

export function chatAudioUrl(url?: string): string | undefined {
 if(url && /^\/uploads\/chat\/voice-[a-z0-9_-]+\.(?:m4a|webm|ogg)$/i.test(url)) return `https://api.themegaradio.com${url}`;
 return undefined;
}
