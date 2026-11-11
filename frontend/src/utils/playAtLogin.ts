export const PLAY_AT_LOGIN_KEY = 'play_at_login_setting';
export const LAST_PLAYED_STATION_KEY = '@megaradio_last_played_station';
export type PlayAtLoginOption = 'last_played' | 'random' | 'favorite' | 'off';
// Preserve the runtime's opt-in behavior when no preference has been saved.
export const DEFAULT_PLAY_AT_LOGIN: PlayAtLoginOption = 'off';
export const normalizePlayAtLogin = (value: string | null | undefined): PlayAtLoginOption =>
  value === 'last_played' || value === 'random' || value === 'favorite' ? value : DEFAULT_PLAY_AT_LOGIN;
