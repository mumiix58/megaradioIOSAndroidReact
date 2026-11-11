import api from './api';
import { useAuthStore } from '../store/authStore';
import { savedDiscoveryMatches,validDiscoveryPatch,type ProfileDiscoveryPreferences } from '../utils/profileDiscovery';
/** Save only these optional fields; never copy or change the browsing country. */
export async function saveProfileDiscoveryPreferences(patch:ProfileDiscoveryPreferences) {
  if(!validDiscoveryPatch(patch))throw new Error('Invalid discovery preference');
  const owner=useAuthStore.getState().user?._id;
  if(!owner||!useAuthStore.getState().isAuthenticated)throw new Error('Sign in required');
  const {data}=await api.put('/api/auth/profile',{preferences:patch});
  if(!data?.user||String(data.user._id)!==owner||!savedDiscoveryMatches(data.user.preferences,patch))throw new Error('Profile save was not confirmed');
  const current=useAuthStore.getState();
  if(current.user?._id!==owner||!current.isAuthenticated)throw new Error('Account changed');
  await current.updateUser({...current.user,...data.user,name:data.user.fullName||current.user.name});
}
