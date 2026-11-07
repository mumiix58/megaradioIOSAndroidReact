// RewardedAdButton.tsx
// Button component to watch rewarded ad and get ad-free time

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants/theme';

// Native için adMobService'i import et
const adMobService = Platform.OS !== 'web' 
  ? require('../services/adMobService').adMobService 
  : null;

interface RewardedAdButtonProps {
  onRewardEarned?: () => void;
}

export const RewardedAdButton: React.FC<RewardedAdButtonProps> = ({ onRewardEarned }) => {
  const { i18n } = useTranslation();
  const copy = rewardCopy[i18n.language.split('-')[0]] || rewardCopy.en;
  const [isLoading, setIsLoading] = useState(false);
  const [adFreeMinutes, setAdFreeMinutes] = useState(0);
  const [isAdReady, setIsAdReady] = useState(false);

  // Check ad-free status and ad readiness
  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const minutes = await adMobService.getAdFreeMinutesRemaining();
        if (!mounted) return;
        setAdFreeMinutes(minutes);
        setIsAdReady(adMobService.isRewardedAdReady());
      } catch { if (mounted) setIsAdReady(false); }
    };

    checkStatus();
    
    // Keep loading state responsive without causing any ad request.
    const interval = setInterval(checkStatus, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const handleWatchAd = async () => {
    if (isLoading || Platform.OS === 'web') {
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await adMobService.showRewardedAd();
      
      if (result.success) {
        // Update ad-free time
        const minutes = await adMobService.getAdFreeMinutesRemaining();
        setAdFreeMinutes(minutes);
        onRewardEarned?.();
      } else {
        Alert.alert(copy.unavailable, copy.noReward);
      }
      setIsAdReady(adMobService.isRewardedAdReady());
    } catch (error) {
      console.error('[RewardedAdButton] Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show ad-free status if user has time remaining
  if (adFreeMinutes > 0) {
    return (
      <View style={styles.container}>
        <View style={styles.adFreeStatus}>
          <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
          <View style={styles.textContainer}>
            <Text style={styles.adFreeTitle}>{copy.active}</Text>
            <Text style={styles.adFreeTime}>{copy.remaining.replace('{{minutes}}', String(adFreeMinutes))}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.button, styles.extendButton]}
          onPress={handleWatchAd}
          disabled={isLoading || !isAdReady}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={styles.extendButtonText}>{copy.extend}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Show watch ad button
  return (
    <View>
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={copy.title}
      style={[styles.button, !isAdReady && styles.buttonDisabled]}
      onPress={handleWatchAd}
      disabled={isLoading || !isAdReady}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <>
          <Ionicons name="play-circle" size={22} color="#FFF" />
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTitle}>{copy.title}</Text>
            <Text style={styles.buttonSubtitle}>{isAdReady ? copy.subtitle : copy.loading}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </>
      )}
    </TouchableOpacity>
    <Text style={styles.disclaimer}>{copy.disclaimer}</Text>
    </View>
  );
};

const rewardCopy: Record<string, { active: string; remaining: string; extend: string; title: string; subtitle: string; loading: string; disclaimer: string; unavailable: string; noReward: string }> = {
  en: { active: 'App ads paused', remaining: '{{minutes}} minutes left', extend: '+30 min', title: '30 minutes without app ads', subtitle: 'Watch one video to earn your break', loading: 'Video currently unavailable', disclaimer: 'Advertisements in radio broadcasts are controlled by the station and remain.', unavailable: 'No reward earned', noReward: 'Complete the video to receive 30 minutes without app ads. You can keep listening for free.' },
  tr: { active: 'Uygulama reklamları duraklatıldı', remaining: '{{minutes}} dakika kaldı', extend: '+30 dk', title: '30 dakika uygulama reklamsız', subtitle: 'Bir video izle, 30 dakika kazan', loading: 'Video şu anda kullanılamıyor', disclaimer: 'Radyo yayınlarının içindeki reklamlar istasyon tarafından yönetilir ve devam eder.', unavailable: 'Ödül kazanılmadı', noReward: '30 dakika uygulama reklamsız kullanım için videoyu tamamla. Ücretsiz dinlemeye devam edebilirsin.' },
  de: { active: 'App-Werbung pausiert', remaining: 'Noch {{minutes}} Minuten', extend: '+30 Min.', title: '30 Minuten ohne App-Werbung', subtitle: 'Ein Video ansehen und eine Pause verdienen', loading: 'Video derzeit nicht verfügbar', disclaimer: 'Werbung in Radiosendungen wird vom Sender bestimmt und bleibt bestehen.', unavailable: 'Keine Belohnung erhalten', noReward: 'Sieh das Video vollständig an, um 30 Minuten ohne App-Werbung zu erhalten. Du kannst weiterhin kostenlos zuhören.' },
  fr: { active: 'Publicités de l’app en pause', remaining: '{{minutes}} minutes restantes', extend: '+30 min', title: '30 minutes sans publicité de l’app', subtitle: 'Regardez une vidéo pour obtenir votre pause', loading: 'Vidéo indisponible pour le moment', disclaimer: 'Les publicités diffusées par les radios restent sous le contrôle des stations.', unavailable: 'Aucune récompense obtenue', noReward: 'Terminez la vidéo pour obtenir 30 minutes sans publicité de l’app. L’écoute reste gratuite.' },
  es: { active: 'Anuncios de la app en pausa', remaining: 'Quedan {{minutes}} minutos', extend: '+30 min', title: '30 minutos sin anuncios de la app', subtitle: 'Mira un vídeo para obtener tu pausa', loading: 'Vídeo no disponible ahora', disclaimer: 'Los anuncios de las emisoras siguen bajo su control y permanecen.', unavailable: 'No se obtuvo la recompensa', noReward: 'Completa el vídeo para obtener 30 minutos sin anuncios de la app. Puedes seguir escuchando gratis.' },
};

const styles = StyleSheet.create({
  disclaimer: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginHorizontal: 4, marginBottom: 8 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  adFreeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
  },
  adFreeTitle: {
    fontSize: 14,
    fontFamily: 'Ubuntu-Medium',
    color: '#4CAF50',
  },
  adFreeTime: {
    fontSize: 12,
    fontFamily: 'Ubuntu-Regular',
    color: colors.textMuted,
    marginTop: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  extendButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 0,
  },
  extendButtonText: {
    fontSize: 12,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFF',
    marginLeft: 4,
  },
  buttonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  buttonTitle: {
    fontSize: 14,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFF',
  },
  buttonSubtitle: {
    fontSize: 11,
    fontFamily: 'Ubuntu-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
});

export default RewardedAdButton;
