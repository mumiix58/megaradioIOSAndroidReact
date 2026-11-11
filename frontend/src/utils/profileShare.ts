import { localizedSharePath } from './localizedRoutes';
import Constants from 'expo-constants';
import userService from '../services/userService';
import i18n from '../services/i18nService';

type ShareableProfile = { _id?: string; id?: string; slug?: string; name?: string; fullName?: string };
export async function profileShareContent(profile: ShareableProfile) {
  const identifier = profile.slug || profile._id || profile.id;
  if (!identifier) throw new Error(i18n.t('profile_share_sign_in', 'Sign in to share your profile.'));
  const publicProfile = await userService.getProfile(identifier);
  if (publicProfile.isPublicProfile !== true) throw new Error(i18n.t('profile_share_private', 'Make your profile public to share it.'));
  const website = Constants.expoConfig?.extra?.websiteUrl;
  if (!website) throw new Error('Paylaşım adresi yapılandırılmamış.');
  const url = `${String(website).replace(/\/$/, '')}${localizedSharePath('users', identifier, i18n.language || 'en')}`;
  const name = profile.name || profile.fullName || publicProfile.fullName || publicProfile.name || 'MegaRadio';
  return { title: `${name} - MegaRadio`, message: i18n.t('profile_share_message', { name, url, defaultValue: '{{name}}’s MegaRadio profile:\n{{url}}' }), url };
}