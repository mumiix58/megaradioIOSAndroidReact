import type { MetadataStatus } from './nowPlaying';

// Local fallback copy also covers languages whose remote dictionary predates these keys.
const copy:Record<string,[string,string,string]>={
 en:['This station does not share song information.','Loading song information…','Song information is temporarily unavailable. Please try again later.'],
 tr:['Bu istasyon şarkı bilgisi paylaşmıyor.','Şarkı bilgisi yükleniyor…','Şarkı bilgisi şu an alınamıyor. Biraz sonra tekrar dene.'],
 de:['Dieser Sender teilt keine Titelinformationen.','Titelinformationen werden geladen…','Titelinformationen sind vorübergehend nicht verfügbar. Bitte versuche es später erneut.'],
 fr:['Cette station ne partage pas les informations des titres.','Chargement des informations du titre…','Les informations du titre sont temporairement indisponibles. Réessayez plus tard.'],
 es:['Esta emisora no comparte información de las canciones.','Cargando información de la canción…','La información de la canción no está disponible temporalmente. Inténtalo más tarde.'],
 it:['Questa stazione non condivide informazioni sui brani.','Caricamento delle informazioni sul brano…','Le informazioni sul brano non sono temporaneamente disponibili. Riprova più tardi.'],
 pt:['Esta estação não partilha informações das músicas.','A carregar informações da música…','As informações da música estão temporariamente indisponíveis. Tente novamente mais tarde.'],
 nl:['Deze zender deelt geen nummerinformatie.','Nummerinformatie wordt geladen…','Nummerinformatie is tijdelijk niet beschikbaar. Probeer het later opnieuw.'],
 pl:['Ta stacja nie udostępnia informacji o utworach.','Wczytywanie informacji o utworze…','Informacje o utworze są chwilowo niedostępne. Spróbuj ponownie później.'],
 ru:['Эта станция не передаёт информацию о песнях.','Загрузка информации о песне…','Информация о песне временно недоступна. Попробуйте позже.'],
 ja:['この放送局は曲情報を配信していません。','曲情報を読み込み中…','曲情報を現在取得できません。しばらくしてからもう一度お試しください。'],
 ko:['이 방송국은 곡 정보를 제공하지 않습니다.','곡 정보를 불러오는 중…','현재 곡 정보를 가져올 수 없습니다. 잠시 후 다시 시도해 주세요.'],
 zh:['此电台不提供歌曲信息。','正在加载歌曲信息…','暂时无法获取歌曲信息，请稍后重试。'],
 ar:['هذه المحطة لا تشارك معلومات الأغاني.','جارٍ تحميل معلومات الأغنية…','معلومات الأغنية غير متاحة مؤقتًا. يُرجى المحاولة لاحقًا.'],
};
export function metadataNotice(status:MetadataStatus,language:string) {
 const strings=copy[language.toLowerCase().split(/[-_]/)[0]]||copy.en;
 const kind=status==='loading'?'loading':status==='error'?'error':'unavailable';
 return {key:`station_metadata_${kind}`,message:strings[kind==='loading'?1:kind==='error'?2:0]};
}
