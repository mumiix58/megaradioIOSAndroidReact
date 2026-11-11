import React, { useEffect, useRef, useState } from 'react';
import { SharedLinkState } from '../src/components/SharedLinkState';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { usePlayerStore } from '../src/store/playerStore';
import stationService from '../src/services/stationService';
import userService from '../src/services/userService';

export default function OpenLink() {
  const { type, identifier } = useLocalSearchParams<{ type: string; identifier: string }>();
  const router = useRouter();
  const { playStation } = useAudioPlayer();
  const playRef = useRef(playStation);
  playRef.current = playStation;
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    (async () => {
      if (!identifier || !['station', 'user'].includes(type)) throw new Error('Geçersiz paylaşım bağlantısı.');
      if (type === 'station') {
        const station = await stationService.getStation(identifier);
        if (!station?._id) throw new Error('Radyo bulunamadı.');
        if (!active) return;
        const state = usePlayerStore.getState();
        // Opening a link to the already-playing radio must not toggle it OFF.
        if (state.currentStation?._id !== station._id || state.playbackState !== 'playing') {
          void playRef.current(station).catch(() => {});
        }
        router.replace('/player');
      } else {
        const profile = await userService.getProfile(identifier);
        if (!profile?._id || profile.isPublicProfile !== true) throw new Error('Bu profil herkese açık değil veya bulunamadı.');
        if (!active) return;
        router.replace({ pathname: '/user-profile', params: {
          userId: profile._id, userName: profile.name || profile.fullName || 'User',
          userAvatar: profile.profilePhoto || profile.avatar || '', userSlug: identifier,
        } });
      }
    })().catch(reason => { if (active) setError(reason?.response ? 'Paylaşılan içeriğe şu anda ulaşılamıyor. Bağlantını kontrol edip yeniden deneyebilirsin.' : reason?.message || 'Bağlantı açılamadı.'); });
    return () => { active = false; };
  }, [type, identifier, router]);
  return <SharedLinkState testID="open-shared-link" loading={!error} message={error} />;
}
