type TimeFormatters={relative?:Intl.RelativeTimeFormat;minute?:Intl.NumberFormat;hour?:Intl.NumberFormat;date?:Intl.DateTimeFormat};
const formatterCache=new Map<string,TimeFormatters>();
function formatters(language:string):TimeFormatters {
 let entry=formatterCache.get(language);
 if(!entry){if(formatterCache.size>=16)formatterCache.delete(formatterCache.keys().next().value!);entry={};formatterCache.set(language,entry);}
 return entry;
}
/** Compact relative time leaves room for the activity and a stable unread marker. */
export function notificationTime(value:string,language:string,now=Date.now()):string {
 const time=Date.parse(value);
 if(!Number.isFinite(time))return '';
 const formats=formatters(language);
 const minutes=Math.max(0,Math.floor((now-time)/60000));
 if(minutes<1)return (formats.relative??=new Intl.RelativeTimeFormat(language,{numeric:'auto',style:'short'})).format(0,'second');
 if(minutes<1440){const unit=minutes<60?'minute':'hour';return (formats[unit]??=new Intl.NumberFormat(language,{style:'unit',unit,unitDisplay:'short',maximumFractionDigits:0})).format(minutes<60?minutes:Math.floor(minutes/60));}
 if(minutes<10080)return (formats.relative??=new Intl.RelativeTimeFormat(language,{numeric:'auto',style:'short'})).format(-Math.floor(minutes/1440),'day');
 return (formats.date??=new Intl.DateTimeFormat(language,{month:'short',day:'numeric'})).format(time);
}
