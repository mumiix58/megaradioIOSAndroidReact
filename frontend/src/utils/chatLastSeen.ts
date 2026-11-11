/** Calendar comparisons use local dates, so DST and midnight do not shift today/yesterday. */
export function chatLastSeen(value:string,locale:string,t:(key:string)=>string,now=new Date()):string{
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);
 const day=date.toDateString()===now.toDateString()?t('chat_today'):date.toDateString()===yesterday.toDateString()?t('chat_yesterday'):date.toLocaleDateString(locale,{day:'numeric',month:'long',...(date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})});
 return `${day.toLocaleLowerCase(locale)} ${date.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}`;
}
