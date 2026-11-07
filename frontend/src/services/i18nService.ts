import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import api from './api';
import { API_ENDPOINTS } from '../constants/api';
import { subscriptionTranslations } from './subscriptionTranslations';
import { adPrivacyTranslations } from './adPrivacyTranslations';

// Storage key for language preference
const LANGUAGE_KEY = '@megaradio_language';

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar'];

// Language change listeners for forcing re-renders
type LanguageChangeListener = (lang: string) => void;
const languageChangeListeners: Set<LanguageChangeListener> = new Set();

export const addLanguageChangeListener = (listener: LanguageChangeListener) => {
  languageChangeListeners.add(listener);
  return () => languageChangeListeners.delete(listener);
};

const notifyLanguageChange = (lang: string) => {
  languageChangeListeners.forEach(listener => listener(lang));
};

// Default fallback translations (English) - includes missing keys from API
const defaultTranslations: Record<string, string> = {
  rate_us_invite: 'Share your experience',
  // Tab bar navigation
  tab_discover: 'Discover',
  tab_favorites: 'Favorites',
  tab_profile: 'Profile',
  tab_records: 'Records',
  
  // Navigation
  nav_home: 'Home',
  nav_for_you: 'For You',
  nav_genres: 'Genres',
  nav_about: 'About',
  nav_contact: 'Contact',
  nav_apps: 'Applications',
  nav_feedback: 'Feedback',
  nav_discover: 'Discover',
  nav_favorites: 'Favorites',
  nav_settings: 'Settings',
  
  // Homepage
  homepage_see_all: 'See All',
  homepage_community_favorites: 'Community Favorites',
  homepage_genres: 'Genres',
  homepage_popular_stations: 'Popular Stations',
  homepage_stations_near_you: 'Stations Near You',
  homepage_favorites_from_users: 'Favorites From Users',
  homepage_all_stations: 'All Stations',
  homepage_recently_played: 'Recently Played',
  welcome_back: 'Welcome Back',
  
  // Common
  loading: 'Loading...',
  search: 'Search',
  search_placeholder: 'Search...',
  search_stations: 'Search stations...',
  search_radio_user: 'Search radio, user',
  all: 'All',
  see_more: 'See More',
  cancel: 'Cancel',
  done: 'Done',
  save: 'Save',
  ok: 'OK',
  back: 'Back',
  
  // CarPlay
  carplay_favorites: 'Favorites',
  carplay_recently_played: 'Recently Played',
  carplay_discover: 'Discover',
  carplay_genres: 'Genres',
  carplay_search: 'Search',
  carplay_loading: 'Loading...',
  carplay_music_genres: 'Music Genres',
  carplay_popular_stations: 'Popular Stations',
  carplay_favorite_stations: 'Favorite Stations',
  carplay_recent_stations: 'Recent Stations',
  carplay_stations: 'stations',
  carplay_no_stations: 'No stations found',
  carplay_try_another_genre: 'Try another genre',
  
  // Offline mode
  offline_mode: 'Offline - Showing cached data',
  offline_no_connection: 'No internet connection',
  offline_reconnecting: 'Reconnecting...',
  
  // Auth
  login: 'Login',
  log_in: 'Log in',
  sign_up: 'Sign Up',
  signup: 'Signup',
  forgot_password: 'Forgot your password?',
  email: 'E-Mail',
  email_placeholder: 'Email',
  password: 'Password',
  password_placeholder: 'Password',
  your_name: 'Your name',
  logging_in: 'Logging in...',
  auth_create_account: 'Create Account',
  auth_continue_with_google: 'Continue with Google',
  auth_continue_with_apple: 'Continue with Apple',
  auth_continue_with_facebook: 'Continue with Facebook',
  auth_or_with_email: 'Or continue with email',
  dont_have_account: "Don't you have an account?",
  already_have_account: 'Already have an account?',
  password_hint: 'Password must be at least 8 characters.',
  password_min_length: 'Password must be at least {{count}} characters.',
  wrong_credentials: 'Wrong email or password! Try again',
  please_enter_email: 'Please enter your email',
  please_enter_password: 'Please enter your password',
  please_enter_name: 'Please enter your name',
  invalid_email: 'Please enter a valid email address',
  
  // Profile
  profile_followers: 'Followers',
  profile_following: 'Following',
  profile_favorites: 'Favorites',
  profile_login_required: 'Please log in to view this profile',
  followers: 'Followers',
  follows: 'Follows',
  guest: 'Guest',
  sign_in_prompt: 'Sign in to access your profile, favorites, and more',
  sign_in_sign_up: 'Sign In / Sign Up',
  
  // Profile Settings
  settings: 'Settings',
  play_at_login: 'Play at Login',
  last_played: 'Last Played',
  country: 'Country',
  language: 'Language',
  statistics: 'Statistics',
  account: 'Account',
  notifications_setting: 'Notifications',
  private_profile: 'Private Profile',
  about: 'About',
  mega_radio: 'Mega Radio',
  privacy_policy: 'Privacy Policy',
  terms_conditions: 'Terms and Conditions',
  social_media: 'Social Media',
  log_out: 'Log Out',
  name: 'Name',
  change_name: 'Change your name',
  change_email: 'Change your email',
  change_password: 'Change your password',
  current_password: 'Current password',
  new_password: 'New password',
  confirm_password: 'Confirm new password',
  verification_sent: 'We sent you a verification mail!',
  check_mail: 'Please check your mail',
  password_changed: 'Your password was changed!',
  
  // Stations
  stations: 'Stations',
  search_genre: 'Search genre',
  search_following: 'Search following...',
  search_followers: 'Search followers...',
  car_mode: 'Car Mode',
  popular_stations: 'Popular Stations',
  stations_near_you: 'Stations Near You',
  no_stations_found: 'No stations found.',
  all_stations: 'All Stations',
  
  // Genres
  genres: 'Genres',
  genres_description: 'Discover stations by music genre',
  
  // Player
  now_playing: 'Now Playing',
  recently_played: 'Recently Played',
  similar_stations: 'Similar Stations',
  similar_radios: 'Similar Radios',
  live_radio: 'Live Radio',
  
  // Notifications
  notifications: 'Notifications',
  no_notifications: 'No notifications',
  notifications_empty_text: "You'll see notifications about new followers and stations here.",
  
  // Users
  users: 'Users',
  follow: 'Follow',
  unfollow: 'Unfollow',
  login_required: 'Login Required',
  login_required_follow: 'Please login to manage who you follow.',
  login_required_followers: 'Please login to manage your followers.',
  unfollow_confirm: 'Are you sure you want to unfollow this user?',
  unfollow_failed: 'Failed to unfollow. Please try again.',
  remove_follower: 'Remove Follower',
  remove_follower_confirm: 'Are you sure you want to remove this follower?',
  remove_follower_failed: 'Failed to remove follower. Please try again.',
  remove: 'Remove',
  error: 'Error',
  following: 'Following',
  radios: 'Radios',
  no_users: 'No users found',
  no_public_profiles: 'No public profiles available',
  try_different_search: 'Try a different search term',
  
  // Discover
  discover: 'Discover',
  discover_subtitle: 'Explore the world of radio',
  browse_genres: 'Browse Genres',
  top_stations: 'Top Stations',
  discover_all_stations: 'Discover all the stations',
  
  // Favorites
  favorites: 'Favorites',
  add_to_favorites: 'Add to Favorites',
  remove_from_favorites: 'Remove from Favorites',
  no_favorites_yet: "You don't have any favorites yet",
  discover_stations_link: 'Discover stations near to you!',
  search_favorites: 'Search favorites...',
  no_stations_found_search: 'No stations found',
  
  // Records
  records: 'Records',
  
  // Sort
  sort_az: 'A to Z',
  sort_za: 'Z to A',
  sort_newest_first: 'Newest first',
  sort_oldest_first: 'Oldest first',
  sort_popular: 'Popular',
  popular: 'Popular',
  custom_order: 'Custom order',
  grid: 'Grid',
  
  // Countries
  countries: 'Countries',
  all_countries: 'All Countries',
  search_country: 'Search Country',
  
  // Languages
  languages: 'Languages',
  select_language: 'Select Language',
  language_changed: 'Language changed',
  no_results: 'No languages found',
  
  // Errors
  general_error: 'Error',
  general_error_message: 'An error occurred. Please try again.',
  
  // Share
  share: 'Share',
  copy_link: 'Copy Link',
  
  // Empty states
  no_favorites: 'No favorites yet',
  no_recently_played: 'No recently played stations',
  enable_location: 'Enable location to see nearby stations',
  
  // Search filters
  filter_all: 'All',
  filter_radios: 'Radios',
  filter_genres: 'Genres',
  filter_profiles: 'Profiles',
  searching: 'Searching...',
  no_results_found: "We couldn't find any result!",
  try_different_search_term: 'Try searching for something else',
  search_stations_title: 'Search Stations',
  find_favorites: 'Find your favorite radio stations, genres, and users',
  
  // Statistics Page
  total_listening: 'Total Listening',
  unique_stations: 'Unique Stations',
  songs_played: 'Songs Played',
  
  // Play at Login Page
  last_played_option: 'Last Played',
  random_option: 'Random',
  favorite_option: 'Favorite',
  off_option: 'Off',
  
  // Forgot Password Page
  email_sent: 'Email Sent!',
  check_email_reset: 'Check your email for the password reset link',
  back_to_login: 'Back to Login',
  forgot_password_title: 'Forgot your password?',
  forgot_password_subtitle: 'Enter your email address and we will send you a link to reset your password',
  send: 'Send',
  
  // Player Page
  no_station_playing: 'No station playing',
  select_station_to_listen: 'Select a station to start listening',
  go_back: 'Go Back',
  timer_on: 'ON',
  hd_quality: 'HD',
  
  // Nearby Stations
  enable_location_nearby: 'Enable location services to discover radio stations near you',
  no_nearby_stations: 'No stations found nearby',
  try_different_location: 'Try moving to a different location',
  
  // Followers/Following
  no_followers: 'No followers yet',
  no_following: 'Not following anyone yet',
  
  // Empty States
  search_radio_stations: 'Search for radio stations, genres, and users',
  
  // Notifications
  started_following_you: 'started following you',
  new_station_added: 'New station added',
  system_notification: 'System notification',
};

// Translation cache
let translationsCache: Record<string, Record<string, string>> = {
  en: defaultTranslations,
};

// Turkish translations for fast startup (most requested language)
const turkishTranslations: Record<string, string> = {
  rate_us_invite: 'Deneyiminizi paylaşın',
  // Tab bar navigation
  tab_discover: 'Keşfet',
  tab_favorites: 'Favoriler',
  tab_profile: 'Profil',
  tab_records: 'Kayıtlar',
  
  // Navigation
  nav_home: 'Ana Sayfa',
  nav_for_you: 'Sizin İçin',
  nav_genres: 'Türler',
  nav_about: 'Hakkında',
  nav_contact: 'İletişim',
  nav_apps: 'Uygulamalar',
  nav_feedback: 'Geri Bildirim',
  nav_discover: 'Keşfet',
  nav_favorites: 'Favoriler',
  nav_settings: 'Ayarlar',
  
  // Homepage
  homepage_see_all: 'Tümünü Gör',
  homepage_community_favorites: 'Topluluk Favorileri',
  homepage_genres: 'Türler',
  homepage_popular_stations: 'Popüler İstasyonlar',
  homepage_stations_near_you: 'Yakınınızdaki İstasyonlar',
  homepage_favorites_from_users: 'Kullanıcı Favorileri',
  homepage_all_stations: 'Tüm İstasyonlar',
  homepage_recently_played: 'Son Çalınanlar',
  welcome_back: 'Tekrar Hoş Geldiniz',
  
  // Common
  loading: 'Yükleniyor...',
  search: 'Ara',
  search_placeholder: 'Ara...',
  search_stations: 'İstasyonları ara...',
  search_radio_user: 'Radyo, kullanıcı ara',
  all: 'Tümü',
  see_more: 'Daha Fazla',
  cancel: 'İptal',
  done: 'Tamam',
  save: 'Kaydet',
  ok: 'Tamam',
  back: 'Geri',
  
  // CarPlay
  carplay_favorites: 'Favoriler',
  carplay_recently_played: 'Son Çalınanlar',
  carplay_discover: 'Keşfet',
  carplay_genres: 'Türler',
  carplay_search: 'Ara',
  carplay_loading: 'Yükleniyor...',
  carplay_music_genres: 'Müzik Türleri',
  carplay_popular_stations: 'Popüler İstasyonlar',
  carplay_favorite_stations: 'Favori İstasyonlar',
  carplay_recent_stations: 'Son Dinlenen İstasyonlar',
  carplay_stations: 'istasyon',
  
  // Auth
  login: 'Giriş Yap',
  log_in: 'Giriş Yap',
  sign_up: 'Kaydol',
  signup: 'Kaydol',
  forgot_password: 'Şifrenizi mi unuttunuz?',
  email: 'E-Posta',
  email_placeholder: 'E-Posta',
  password: 'Şifre',
  password_placeholder: 'Şifre',
  your_name: 'Adınız',
  logging_in: 'Giriş yapılıyor...',
  auth_create_account: 'Hesap Oluştur',
  auth_continue_with_google: 'Google ile Devam Et',
  auth_continue_with_apple: 'Apple ile Devam Et',
  auth_continue_with_facebook: 'Facebook ile Devam Et',
  auth_or_with_email: 'Veya e-posta ile devam et',
  dont_have_account: 'Hesabınız yok mu?',
  already_have_account: 'Zaten hesabınız var mı?',
  password_hint: 'Şifre en az 8 karakter olmalıdır.',
  password_min_length: 'Şifre en az {{count}} karakter olmalıdır.',
  wrong_credentials: 'E-posta veya şifre yanlış! Tekrar deneyin',
  please_enter_email: 'Lütfen e-postanızı girin',
  please_enter_password: 'Lütfen şifrenizi girin',
  please_enter_name: 'Lütfen adınızı girin',
  invalid_email: 'Lütfen geçerli bir e-posta adresi girin',
  network_error: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
  login_error: 'Giriş başarısız. Lütfen tekrar deneyin.',
  continue_without_login: 'Giriş yapmadan devam et',
  login_with_apple: 'Apple ile Giriş Yap',
  login_with_facebook: 'Facebook ile Giriş Yap',
  login_with_google: 'Google ile Giriş Yap',
  login_with_mail: 'E-posta ile Giriş Yap',
  
  // Profile
  profile_followers: 'Takipçiler',
  profile_following: 'Takip Edilenler',
  profile_favorites: 'Favoriler',
  profile_login_required: 'Bu profili görüntülemek için giriş yapın',
  followers: 'Takipçiler',
  follows: 'Takip Edilenler',
  guest: 'Misafir',
  sign_in_prompt: 'Profilinize, favorilerinize ve daha fazlasına erişmek için giriş yapın',
  sign_in_sign_up: 'Giriş Yap / Kaydol',
  
  // Profile Settings
  settings: 'Ayarlar',
  play_at_login: 'Girişte Çal',
  last_played: 'Son Çalınan',
  country: 'Ülke',
  language: 'Dil',
  statistics: 'İstatistikler',
  account: 'Hesap',
  notifications_setting: 'Bildirimler',
  private_profile: 'Gizli Profil',
  about: 'Hakkında',
  mega_radio: 'Mega Radio',
  privacy_policy: 'Gizlilik Politikası',
  terms_conditions: 'Şartlar ve Koşullar',
  social_media: 'Sosyal Medya',
  log_out: 'Çıkış Yap',
  name: 'İsim',
  change_name: 'İsminizi değiştirin',
  change_email: 'E-postanızı değiştirin',
  change_password: 'Şifrenizi değiştirin',
  current_password: 'Mevcut şifre',
  new_password: 'Yeni şifre',
  confirm_password: 'Yeni şifreyi onayla',
  verification_sent: 'Doğrulama e-postası gönderdik!',
  check_mail: 'Lütfen e-postanızı kontrol edin',
  password_changed: 'Şifreniz değiştirildi!',
  
  // Stations
  stations: 'İstasyonlar',
  popular_stations: 'Popüler İstasyonlar',
  stations_near_you: 'Yakınınızdaki İstasyonlar',
  no_stations_found: 'İstasyon bulunamadı.',
  all_stations: 'Tüm İstasyonlar',
  
  // Genres
  genres: 'Türler',
  genres_description: 'Müzik türüne göre istasyonları keşfedin',
  
  // Player
  now_playing: 'Şu An Çalıyor',
  recently_played: 'Son Çalınanlar',
  similar_stations: 'Benzer İstasyonlar',
  similar_radios: 'Benzer Radyolar',
  live_radio: 'Canlı Radyo',
  
  // Notifications
  notifications: 'Bildirimler',
  no_notifications: 'Bildirim yok',
  notifications_empty_text: 'Yeni takipçiler ve istasyonlar hakkında bildirimleri burada göreceksiniz.',
  
  // Users
  users: 'Kullanıcılar',
  follow: 'Takip Et',
  unfollow: 'Takibi Bırak',
  following: 'Takip Ediliyor',
  radios: 'Radyolar',
  no_users: 'Kullanıcı bulunamadı',
  no_public_profiles: 'Herkese açık profil yok',
  try_different_search: 'Farklı bir arama terimi deneyin',
  favorites_from_users: 'Kullanıcılardan Favoriler',
  discover_what_others_love: 'Başkalarının neleri sevdiğini keşfedin',
  load_more: 'Daha Fazla Yükle',
  
  // Discover
  discover: 'Keşfet',
  discover_subtitle: 'Radyo dünyasını keşfedin',
  browse_genres: 'Türlere Göz At',
  top_stations: 'En İyi İstasyonlar',
  discover_all_stations: 'Tüm istasyonları keşfet',
  
  // Favorites
  favorites: 'Favoriler',
  add_to_favorites: 'Favorilere Ekle',
  remove_from_favorites: 'Favorilerden Kaldır',
  no_favorites_yet: 'Henüz favoriniz yok',
  discover_stations_link: 'Yakınınızdaki istasyonları keşfedin!',
  search_favorites: 'Favorilerde ara...',
  no_stations_found_search: 'İstasyon bulunamadı',
  
  // Records
  records: 'Kayıtlar',
  
  // Sort
  sort_az: 'A\'dan Z\'ye',
  sort_za: 'Z\'den A\'ya',
  sort_newest_first: 'Yeniden Eskiye',
  sort_oldest_first: 'Eskiden Yeniye',
  sort_popular: 'Popüler',
  popular: 'Popüler',
  custom_order: 'Özel sıra',
  grid: 'Izgara',
  
  // Countries
  countries: 'Ülkeler',
  all_countries: 'Tüm Ülkeler',
  search_country: 'Ülke Ara',
  
  // Languages
  languages: 'Diller',
  select_language: 'Dil Seç',
  language_changed: 'Dil değiştirildi',
  no_results: 'Sonuç bulunamadı',
  
  // Errors
  general_error: 'Hata',
  general_error_message: 'Bir hata oluştu. Lütfen tekrar deneyin.',
  
  // Share
  share: 'Paylaş',
  copy_link: 'Bağlantıyı Kopyala',
  
  // Empty states
  no_favorites: 'Henüz favori yok',
  no_recently_played: 'Son çalınan istasyon yok',
  enable_location: 'Yakındaki istasyonları görmek için konumu etkinleştirin',
  
  // Search filters
  filter_all: 'Tümü',
  filter_radios: 'Radyolar',
  filter_genres: 'Türler',
  filter_profiles: 'Profiller',
  searching: 'Aranıyor...',
  no_results_found: 'Sonuç bulunamadı!',
  try_different_search_term: 'Farklı bir şey aramayı deneyin',
  search_stations_title: 'İstasyonları Ara',
  find_favorites: 'Favori radyo istasyonlarınızı, türleri ve kullanıcıları bulun',
  
  // Statistics Page
  total_listening: 'Toplam Dinleme',
  unique_stations: 'Benzersiz İstasyonlar',
  songs_played: 'Çalınan Şarkılar',
  
  // Play at Login Page
  last_played_option: 'Son Çalınan',
  random_option: 'Rastgele',
  favorite_option: 'Favori',
  off_option: 'Kapalı',
  
  // Forgot Password Page
  email_sent: 'E-posta Gönderildi!',
  check_email_reset: 'Şifre sıfırlama bağlantısı için e-postanızı kontrol edin',
  back_to_login: 'Girişe Dön',
  forgot_password_title: 'Şifrenizi mi unuttunuz?',
  forgot_password_subtitle: 'E-posta adresinizi girin, size şifrenizi sıfırlamak için bir bağlantı gönderelim',
  send: 'Gönder',
  
  // Player Page
  no_station_playing: 'Çalan istasyon yok',
  select_station_to_listen: 'Dinlemeye başlamak için bir istasyon seçin',
  go_back: 'Geri Dön',
  timer_on: 'AÇIK',
  hd_quality: 'HD',
  
  // Nearby Stations
  enable_location_nearby: 'Yakınınızdaki radyo istasyonlarını keşfetmek için konum hizmetlerini etkinleştirin',
  no_nearby_stations: 'Yakında istasyon bulunamadı',
  try_different_location: 'Farklı bir konuma taşınmayı deneyin',
  
  // Followers/Following
  remove: 'Kaldır',
  no_followers: 'Henüz takipçi yok',
  no_following: 'Henüz kimseyi takip etmiyor',
  
  // Empty States
  search_radio_stations: 'Radyo istasyonları, türler ve kullanıcıları arayın',
  
  // Notifications
  started_following_you: 'sizi takip etmeye başladı',
  new_station_added: 'Yeni istasyon eklendi',
  system_notification: 'Sistem bildirimi',
};

// German translations
const germanTranslations: Record<string, string> = {
  rate_us_invite: 'Teile deine Erfahrungen',
  // Tab bar navigation
  tab_discover: 'Entdecken',
  tab_favorites: 'Favoriten',
  tab_profile: 'Profil',
  tab_records: 'Aufnahmen',
  
  // Navigation
  nav_home: 'Startseite',
  nav_for_you: 'Für Sie',
  nav_genres: 'Genres',
  nav_about: 'Über uns',
  nav_contact: 'Kontakt',
  nav_apps: 'Apps',
  nav_feedback: 'Feedback',
  nav_discover: 'Entdecken',
  nav_favorites: 'Favoriten',
  nav_settings: 'Einstellungen',
  
  // Homepage
  homepage_see_all: 'Alle anzeigen',
  homepage_community_favorites: 'Community-Favoriten',
  homepage_genres: 'Genres',
  homepage_popular_stations: 'Beliebte Sender',
  homepage_stations_near_you: 'Sender in Ihrer Nähe',
  homepage_favorites_from_users: 'Benutzer-Favoriten',
  homepage_all_stations: 'Alle Sender',
  homepage_recently_played: 'Zuletzt gespielt',
  welcome_back: 'Willkommen zurück',
  
  // Common
  loading: 'Wird geladen...',
  search: 'Suche',
  search_placeholder: 'Suchen...',
  search_stations: 'Sender suchen...',
  search_genre: 'Genre suchen',
  search_following: 'Folgende suchen...',
  search_followers: 'Follower suchen...',
  search_radio_user: 'Radio, Benutzer suchen',
  all: 'Alle',
  see_more: 'Mehr anzeigen',
  cancel: 'Abbrechen',
  save: 'Speichern',
  delete: 'Löschen',
  edit: 'Bearbeiten',
  done: 'Fertig',
  ok: 'OK',
  back: 'Zurück',
  error: 'Fehler',
  remove: 'Entfernen',
  
  // User Management
  login_required: 'Anmeldung erforderlich',
  login_required_follow: 'Bitte melden Sie sich an, um Ihre Followings zu verwalten.',
  login_required_followers: 'Bitte melden Sie sich an, um Ihre Follower zu verwalten.',
  unfollow_confirm: 'Möchten Sie wirklich entfolgen?',
  unfollow_failed: 'Entfolgen fehlgeschlagen. Bitte versuchen Sie es erneut.',
  remove_follower: 'Follower entfernen',
  remove_follower_confirm: 'Möchten Sie diesen Follower wirklich entfernen?',
  remove_follower_failed: 'Entfernen des Followers fehlgeschlagen. Bitte versuchen Sie es erneut.',
  
  // CarPlay
  car_mode: 'Auto-Modus',
  carplay_favorites: 'Favoriten',
  carplay_recently_played: 'Zuletzt gespielt',
  carplay_discover: 'Entdecken',
  carplay_genres: 'Genres',
  carplay_loading: 'Wird geladen...',
  carplay_music_genres: 'Musik-Genres',
  carplay_popular_stations: 'Beliebte Sender',
  carplay_favorite_stations: 'Favoriten-Sender',
  carplay_recent_stations: 'Zuletzt gehörte Sender',
  carplay_stations: 'Sender',
  
  // Auth
  login: 'Anmelden',
  logout: 'Abmelden',
  register: 'Registrieren',
  email: 'E-Mail',
  password: 'Passwort',
  forgot_password: 'Passwort vergessen?',
  
  // Player
  now_playing: 'Wird gespielt',
  previous_station: 'Vorheriger Sender',
  next_station: 'Nächster Sender',
  play: 'Abspielen',
  pause: 'Pause',
  stop: 'Stopp',
  
  // Settings
  settings_title: 'Einstellungen',
  settings_language: 'Sprache',
  settings_country: 'Land',
  settings_notifications: 'Benachrichtigungen',
  settings_dark_mode: 'Dunkelmodus',
  settings_about: 'Über die App',
  settings_version: 'Version',
  
  // Profile
  profile_title: 'Profil',
  profile_edit: 'Profil bearbeiten',
  profile_favorites_count: 'Favoriten',
  profile_listening_time: 'Hörzeit',
  
  // Errors
  error_generic: 'Ein Fehler ist aufgetreten',
  error_network: 'Netzwerkfehler',
  error_login: 'Anmeldung fehlgeschlagen',
  no_stations: 'Keine Sender gefunden',
  no_favorites: 'Noch keine Favoriten',
  
  // Language changed
  language_changed: 'Sprache geändert',
};

// Pre-populate Turkish and German cache
Object.assign(defaultTranslations, subscriptionTranslations.en, adPrivacyTranslations.en);
Object.assign(turkishTranslations, subscriptionTranslations.tr, adPrivacyTranslations.tr);
Object.assign(germanTranslations, subscriptionTranslations.de, adPrivacyTranslations.de);
translationsCache['tr'] = turkishTranslations;
translationsCache['de'] = germanTranslations;

// Fetch translations from API
export const fetchTranslations = async (lang: string): Promise<Record<string, string>> => {
  // Return from cache if available
  if (translationsCache[lang]) {
    return translationsCache[lang];
  }

  try {
    const response = await api.get(API_ENDPOINTS.translations(lang));
    const apiTranslations = response.data || {};
    
    // Get local fallback translations for this language
    let localFallback: Record<string, string> = {};
    if (lang === 'tr') {
      localFallback = turkishTranslations;
    } else if (lang === 'de') {
      localFallback = germanTranslations;
    }
    
    // Merge: defaults -> local fallback -> API translations
    // This ensures all keys exist even if API doesn't have them
    const mergedTranslations = { 
      ...defaultTranslations,  // English as base
      ...localFallback,        // Local translations for known languages
      ...subscriptionTranslations[lang],
      ...adPrivacyTranslations[lang],
      ...apiTranslations       // API translations override
    };
    
    // Cache the translations
    translationsCache[lang] = mergedTranslations;
    
    console.log(`[i18n] Loaded ${Object.keys(apiTranslations).length} translations from API for ${lang}`);
    
    return mergedTranslations;
  } catch (error) {
    console.error(`[i18n] Failed to fetch translations for ${lang}:`, error);
    
    // Return local fallback if available, otherwise defaults
    if (lang === 'tr' && turkishTranslations) {
      return { ...defaultTranslations, ...turkishTranslations };
    }
    if (lang === 'de' && germanTranslations) {
      return { ...defaultTranslations, ...germanTranslations };
    }
    
    return { ...defaultTranslations, ...subscriptionTranslations[lang], ...adPrivacyTranslations[lang] };
  }
};

// Get stored language preference or detect device language
export const getStoredLanguage = async (): Promise<string> => {
  try {
    const storedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
    
    // If user has explicitly set a language, use it
    if (storedLang) {
      console.log('[i18n] Using stored language preference:', storedLang);
      return storedLang;
    }
    
    // No stored preference - detect device language
    const deviceLocale = Localization.getLocales()[0];
    const deviceLangCode = deviceLocale?.languageCode || 'en';
    
    console.log('[i18n] No stored language, device language:', deviceLangCode);
    
    // Check if device language is supported
    if (SUPPORTED_LANGUAGES.includes(deviceLangCode)) {
      console.log('[i18n] Device language is supported, using:', deviceLangCode);
      // Store this as initial preference
      await AsyncStorage.setItem(LANGUAGE_KEY, deviceLangCode);
      return deviceLangCode;
    }
    
    // Device language not supported, fall back to English
    console.log('[i18n] Device language not supported, falling back to English');
    return 'en';
  } catch (error) {
    console.error('[i18n] Error getting language:', error);
    return 'en';
  }
};

// Store language preference
export const setStoredLanguage = async (lang: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch (error) {
    console.error('[i18n] Failed to store language:', error);
  }
};

// Initialize i18next - Optimized for fast startup
export const initI18n = async (): Promise<void> => {
  const storedLang = await getStoredLanguage();
  console.log('[i18n] Initializing with stored language:', storedLang);
  
  // Use cached translations for fast startup (tr and en are pre-cached)
  const initialTranslations = translationsCache[storedLang] || { ...defaultTranslations, ...subscriptionTranslations[storedLang], ...adPrivacyTranslations[storedLang] };

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        [storedLang]: {
          translation: initialTranslations,
        },
        en: {
          translation: defaultTranslations,
        },
        tr: {
          translation: turkishTranslations,
        },
        de: {
          translation: germanTranslations,
        },
      },
      lng: storedLang,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
  
  console.log('[i18n] Initialized, current language:', i18n.language);
  
  // Fetch latest translations from API in background (non-blocking)
  // This will update with any new keys from backend
  fetchTranslations(storedLang).then(translations => {
    if (Object.keys(translations).length > Object.keys(initialTranslations).length) {
      i18n.addResourceBundle(storedLang, 'translation', translations, true, true);
      console.log('[i18n] Updated translations from API');
    }
  }).catch(err => {
    console.log('[i18n] Background translation fetch error:', err);
  });
};

// Change language
export const changeLanguage = async (lang: string): Promise<void> => {
  try {
    console.log('[i18n] Changing language to:', lang);
    
    // Clear cache for this language to get fresh translations
    delete translationsCache[lang];
    
    // Fetch translations for the new language
    const translations = await fetchTranslations(lang);
    
    // Add translations to i18n
    i18n.addResourceBundle(lang, 'translation', translations, true, true);
    
    // Change language
    await i18n.changeLanguage(lang);
    
    // Store preference
    await setStoredLanguage(lang);
    
    // Notify all listeners about the language change
    notifyLanguageChange(lang);
    
    console.log('[i18n] Language changed successfully to:', lang);
  } catch (error) {
    console.error('[i18n] Failed to change language:', error);
  }
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || 'en';
};

// Get available languages from API
export const getAvailableLanguages = async (): Promise<{ code: string; name: string }[]> => {
  // Common languages supported by the API
  return [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'pl', name: 'Polski' },
    { code: 'ru', name: 'Русский' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
    { code: 'ar', name: 'العربية' },
  ];
};

export default i18n;
