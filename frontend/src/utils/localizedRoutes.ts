// Public route segments from RadioHub 2ed71a411. Slugs are never translated.
export const LOCALIZED_ROUTES: Record<string, Record<string, string>> = {
  "en": {
    "station": "station",
    "stations": "stations",
    "genre": "genre",
    "genres": "genres",
    "user": "user",
    "users": "users",
    "profile": "profile"
  },
  "es": {
    "station": "estacion",
    "stations": "estaciones",
    "genre": "genre",
    "genres": "generos",
    "user": "user",
    "users": "usuarios",
    "profile": "perfil"
  },
  "fr": {
    "station": "station",
    "stations": "stations",
    "genre": "genre",
    "genres": "genres",
    "user": "user",
    "users": "utilisateurs",
    "profile": "profil"
  },
  "de": {
    "station": "sender",
    "stations": "sender",
    "genre": "genre",
    "genres": "genres",
    "user": "user",
    "users": "benutzer",
    "profile": "profil"
  },
  "pt": {
    "station": "estacao",
    "stations": "estacoes",
    "genre": "genre",
    "genres": "generos",
    "user": "user",
    "users": "usuarios",
    "profile": "perfil"
  },
  "it": {
    "station": "stazione",
    "stations": "stazioni",
    "genre": "genre",
    "genres": "generi",
    "user": "user",
    "users": "utenti",
    "profile": "profilo"
  },
  "ru": {
    "station": "stantsiya",
    "stations": "stantsii",
    "genre": "genre",
    "genres": "zhanry",
    "user": "user",
    "users": "polzovateli",
    "profile": "profil"
  },
  "ar": {
    "station": "mahta",
    "stations": "mahtat",
    "genre": "genre",
    "genres": "anwaa",
    "user": "user",
    "users": "mustakhdimin",
    "profile": "malaf-shakhsi"
  },
  "zh": {
    "station": "电台",
    "stations": "电台",
    "genre": "genre",
    "genres": "类型",
    "user": "user",
    "users": "用户",
    "profile": "个人资料"
  },
  "tr": {
    "station": "istasyon",
    "stations": "istasyonlar",
    "genre": "genre",
    "genres": "turler",
    "user": "user",
    "users": "kullanicilar",
    "profile": "profil"
  },
  "ja": {
    "station": "ステーション",
    "stations": "ステーション",
    "genre": "genre",
    "genres": "ジャンル",
    "user": "user",
    "users": "ユーザー",
    "profile": "プロフィール"
  },
  "ko": {
    "station": "스테이션",
    "stations": "스테이션",
    "genre": "genre",
    "genres": "장르",
    "user": "user",
    "users": "사용자",
    "profile": "프로필"
  },
  "hi": {
    "station": "station",
    "stations": "stations",
    "genre": "genre",
    "genres": "shailiyan",
    "user": "user",
    "users": "upyogkarta",
    "profile": "profile"
  },
  "he": {
    "station": "tachana",
    "stations": "tachanot",
    "genre": "genre",
    "genres": "zhanrim",
    "user": "user",
    "users": "mishtamshim",
    "profile": "profil"
  }
};

export function localizedRouteKind(segment: string, language: string): 'station' | 'genre' | 'user' | null {
  const aliases: Record<string, 'station' | 'genre' | 'user'> = {
    station: 'station', stations: 'station', genre: 'genre', genres: 'genre', user: 'user', users: 'user', profile: 'user',
  };
  if (aliases[segment]) return aliases[segment];
  const translated = LOCALIZED_ROUTES[language] || {};
  for (const [english, localized] of Object.entries(translated)) if (localized === segment) return aliases[english] || null;
  return null;
}
export function localizedSharePath(kind: 'stations' | 'users', identifier: string, locale: string): string {
  const candidate = locale.toLowerCase().split(/[-_]/)[0];
  const language = LOCALIZED_ROUTES[candidate] ? candidate : 'en';
  return `/${language}/${encodeURIComponent(LOCALIZED_ROUTES[language][kind])}/${encodeURIComponent(identifier)}`;
}
