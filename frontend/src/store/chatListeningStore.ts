import {create} from 'zustand';
export interface SharedRadioListening {messageId:string;groupId?:string;stationId:string;partnerId:string;preview:boolean;owner:string}
export const useChatListeningStore=create<{active:SharedRadioListening|null;setActive:(active:SharedRadioListening|null)=>void}>(set=>({active:null,setActive:active=>set({active})}));
