import i18n from 'i18next';
import { localizedSharePath } from './localizedRoutes';
import Constants from 'expo-constants';
import userService from '../services/userService';

type ShareableProfile = { _id?: string; id?: string; slug?: string; name?: string; fullName?: string };
export async function profileShareContent(profile: ShareableProfile) {
  const identifier = profile.slug || profile._id || profile.id;
  if (!identifier) throw new Error('Profil paylaşmak için giriş yapın.');
  const publicProfile = await userService.getProfile(identifier);
  if (publicProfile.isPublicProfile !== true) throw new Error('Paylaşmak için profilinizi herkese açık yapmalısınız.');
  const website = Constants.expoConfig?.extra?.websiteUrl;
  if (!website) throw new Error('Paylaşım adresi yapılandırılmamış.');
  const url = `${String(website).replace(/\/$/, '')}${localizedSharePath('users', identifier, i18n.language || 'en')}`;
  const name = profile.name || profile.fullName || publicProfile.fullName || publicProfile.name || 'MegaRadio';
  return { title: `${name} - MegaRadio`, message: `${name} adlı kullanıcının MegaRadio profili:\n${url}`, url };
}