/** Shared presentation for docked, floating and compact mini players. */
export function miniPlayerGlowGeometry(compact = false) {
  const logoSize = compact ? 36 : 50;
  const width = compact ? 54 : 76;
  const height = compact ? 18 : 24;
  return { logoSize, width, height, left: (logoSize - width) / 2, top: logoSize - height * 2 / 3 };
}
const failureLabels: Record<string, string> = {
  en: 'Station unavailable', tr: 'Yayın açılamadı', de: 'Sender nicht verfügbar',
  fr: 'Station indisponible', es: 'Emisora no disponible', it: 'Stazione non disponibile',
  pt: 'Estação indisponível', nl: 'Zender niet beschikbaar', pl: 'Stacja niedostępna',
  ru: 'Станция недоступна', ja: '放送を再生できません', ko: '방송을 재생할 수 없습니다',
  zh: '电台暂不可用', ar: 'المحطة غير متاحة',
};
export function miniPlayerFailureLabel(language: string) {
  return failureLabels[language.split(/[-_]/)[0]] || failureLabels.en;
}

const offlineLabels: Record<string,string> = {
 en:'No internet connection',tr:'İnternet bağlantısı yok',de:'Keine Internetverbindung',fr:'Aucune connexion Internet',es:'Sin conexión a Internet',it:'Connessione Internet assente',pt:'Sem conexão à Internet',nl:'Geen internetverbinding',pl:'Brak połączenia z internetem',ru:'Нет подключения к интернету',ja:'インターネット接続がありません',ko:'인터넷 연결 없음',zh:'无网络连接',ar:'لا يوجد اتصال بالإنترنت',
};
export function miniPlayerOfflineLabel(language:string){return offlineLabels[language.split(/[-_]/)[0]]||offlineLabels.en;}
/** A lost connection is never a station report, including the stale error after reconnection. */
export function miniPlayerFailureKind(state:string,offline:boolean,errorDuringOffline=false){
 if(offline)return 'offline';
 if(state==='error')return errorDuringOffline?'reconnect':'station';
 return null;
}
