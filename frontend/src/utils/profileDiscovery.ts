export const PROFILE_GENDERS = ['female','male','other','undisclosed'] as const;
export type ProfileGender = typeof PROFILE_GENDERS[number];
export interface ProfileDiscoveryPreferences {
  profileGender?: ProfileGender;
  profileCountryCode?: string | null;
}
export function validDiscoveryPatch(patch: ProfileDiscoveryPreferences): boolean {
  return (patch.profileGender === undefined || PROFILE_GENDERS.includes(patch.profileGender)) &&
    (patch.profileCountryCode === undefined || patch.profileCountryCode === null || /^[A-Z]{2}$/.test(patch.profileCountryCode));
}
export function savedDiscoveryMatches(saved: unknown, patch: ProfileDiscoveryPreferences): boolean {
  if (!saved || typeof saved !== 'object') return false;
  const value=saved as ProfileDiscoveryPreferences;
  return Object.entries(patch).every(([key,expected])=>value[key as keyof ProfileDiscoveryPreferences]===expected);
}
const translations:Record<string,readonly string[]>={
 en:['Gender','Country of residence','Female','Male','Other','Prefer not to say','Not specified','Optional · Used for discovery','Profile updated.'],
 tr:['Cinsiyet','Yaşadığın ülke','Kadın','Erkek','Diğer','Belirtmek istemiyorum','Belirtilmedi','İsteğe bağlı · Keşif için kullanılır','Profilin güncellendi.'],
 de:['Geschlecht','Wohnsitzland','Weiblich','Männlich','Divers','Keine Angabe','Nicht angegeben','Optional · Für Entdeckungen','Profil aktualisiert.'],
 fr:['Genre','Pays de résidence','Femme','Homme','Autre','Je préfère ne pas le dire','Non renseigné','Facultatif · Pour les découvertes','Profil mis à jour.'],
 es:['Género','País de residencia','Mujer','Hombre','Otro','Prefiero no decirlo','Sin especificar','Opcional · Para descubrir','Perfil actualizado.'],
 it:['Genere','Paese di residenza','Donna','Uomo','Altro','Preferisco non dirlo','Non specificato','Facoltativo · Per le scoperte','Profilo aggiornato.'],
 pt:['Género','País de residência','Mulher','Homem','Outro','Prefiro não dizer','Não especificado','Opcional · Para descobertas','Perfil atualizado.'],
 nl:['Geslacht','Woonland','Vrouw','Man','Anders','Zeg ik liever niet','Niet opgegeven','Optioneel · Voor ontdekken','Profiel bijgewerkt.'],
 pl:['Płeć','Kraj zamieszkania','Kobieta','Mężczyzna','Inna','Wolę nie podawać','Nie podano','Opcjonalne · Do odkrywania','Profil zaktualizowany.'],
 ru:['Пол','Страна проживания','Женский','Мужской','Другой','Предпочитаю не указывать','Не указано','Необязательно · Для рекомендаций','Профиль обновлён.'],
 ja:['性別','居住国','女性','男性','その他','回答しない','未設定','任意・おすすめに使用','プロフィールを更新しました。'],
 ko:['성별','거주 국가','여성','남성','기타','공개하지 않음','미설정','선택 사항 · 추천에 사용','프로필이 업데이트되었습니다.'],
 zh:['性别','居住国家','女','男','其他','不愿透露','未设置','可选 · 用于发现推荐','个人资料已更新。'],
 ar:['الجنس','بلد الإقامة','أنثى','ذكر','آخر','أفضل عدم الإفصاح','غير محدد','اختياري · للاقتراحات','تم تحديث الملف الشخصي.'],
};
export function profileDiscoveryLabels(language:string){
 const [gender,country,female,male,other,undisclosed,unspecified,optional,updated]=translations[language.split(/[-_]/)[0]]||translations.en;
 return {gender,country,female,male,other,undisclosed,unspecified,optional,updated};
}
