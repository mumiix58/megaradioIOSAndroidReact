import {mergeChatMessage} from '../utils/chatMessageState';
import type { ChatMessage, ChatConversation } from '../services/chatService';
export const CHAT_PREVIEW_OWNER = 'preview-me';
const examples = [
  {name:'Deniz',initials:'D',color:'#6D5192',online:true,topic:'Geceye biraz jazz bıraktım 🎷',texts:['Selam! Favorilerindeki jazz radyosunu keşfettim 🎷','O radyo geceleri çok iyi oluyor. Hoş geldin!','Az önce çalan parçayı kaçırdım, biliyor musun?','Şarkı adını player’dan Spotify’da aratabilirsin 🎧','Buldum! Bu akşamın favorisi oldu.','Geceye biraz jazz bıraktım 🎷']},
  {name:'Ece',initials:'E',color:'#407B75',online:true,topic:'Bu parça tam yolculukluk ✨',texts:['Yolculuk için bir radyo önerin var mı?','Indie istasyonlarına bak, ben bugün onları dinliyorum.','Harika, favorilerinden birini açtım.','Bu parça tam yolculukluk ✨']},
  {name:'Mert',initials:'M',color:'#9A664A',online:false,topic:'Rock listene bayıldım 🤘',texts:['Rock listene bayıldım 🤘','Teşekkürler! Senin blues radyonu da ekledim.','Müzik zevkimiz bayağı benziyor.','Yeni bir şey bulursam buradan paylaşırım 📻']},
  {name:'Lina',initials:'L',color:'#6B729C',online:false,topic:'Bir sonraki keşfi sen seç 🌍',texts:['Bugün hangi ülkenin radyolarındayız?','Car Mode ger-bırak beni Brezilya’ya götürdü 🌍','Ben de Portekiz’deyim. Çok tatlı bir yayın buldum.','Bir sonraki keşfi sen seç 🌍']},
  {name:'Arda',initials:'A',color:'#93607B',online:true,topic:'Akşam yine aynı frekanstayız 📻',texts:['Elektronik müzik önerisi lazım 🎶','Favorilerime yeni bir istasyon ekledim, bakabilirsin.','Tam aradığım enerjiymiş, teşekkürler!','Akşam yine aynı frekanstayız 📻']},
  {name:'Selin',initials:'S',color:'#787546',online:false,topic:'Kahve + bu radyo = güzel sabah ☕',texts:['Günaydın! Bugün sakin bir şeyler dinliyorum.','Ben de kahvemi aldım. Hangi radyo?','Favorilerimdeki lounge istasyonu.','Kahve + bu radyo = güzel sabah ☕']},
];
export const previewConversations: ChatConversation[] = examples.map((person,index)=>({partnerId:`demo-${index}`,partner:{_id:`demo-${index}`,fullName:person.name,online:person.online,lastSeenAt:person.online?undefined:new Date(Date.now()-(index===2?7:index===3?45:180)*60000).toISOString(),...{initials:person.initials,color:person.color}},lastMessage:person.topic,lastMessageAt:new Date(Date.UTC(2026,10,9,12,30-index*5)).toISOString(),unreadCount:index===0?2:index===3?1:0,online:person.online}));
export function initialPreviewThreads(): Record<string,ChatMessage[]> {
 return Object.fromEntries(examples.map((person,index)=>[`demo-${index}`,person.texts.map((content,n)=>({_id:`demo-${index}-${n}`,fromUserId:n%2===0?`demo-${index}`:CHAT_PREVIEW_OWNER,toUserId:n%2===0?CHAT_PREVIEW_OWNER:`demo-${index}`,content,messageType:'text' as const,read:true,createdAt:new Date(Date.UTC(2026,10,9,12,30-index*5+n)).toISOString()}))]));
}
export const previewReplies=['Bunu deneyeceğim 🎧 Sen şu an ne dinliyorsun?','Aynı frekanstayız! 📻','Güzel bir keşif oldu, favorilere ekledim ✨','Bir sonraki radyo keşfini bana da anlat 🌍'];

/** Keep separate preview tabs from overwriting each other's test messages. */
export function mergePreviewThreads(...sources:Record<string,ChatMessage[]>[]):Record<string,ChatMessage[]>{
 return Object.fromEntries(previewConversations.map(({partnerId})=>{const merged=new Map<string,ChatMessage>();for(const message of sources.flatMap(source=>Array.isArray(source?.[partnerId])?source[partnerId]:[])){if(message&&typeof message._id==='string'&&typeof message.content==='string'&&Number.isFinite(Date.parse(message.createdAt)))merged.set(message._id,mergeChatMessage(merged.get(message._id),message));}return [partnerId,[...merged.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a._id.localeCompare(b._id)).slice(-200)];}));
}
