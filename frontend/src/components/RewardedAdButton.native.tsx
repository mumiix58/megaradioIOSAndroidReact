import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
// RewardedAdButton.tsx
// Button component to watch rewarded ad and get ad-free time

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

// Native için adMobService'i import et
const adMobService = Platform.OS !== 'web' 
  ? require('../services/adMobService').adMobService 
  : null;

interface RewardedAdButtonProps {
  onRewardEarned?: () => void;
}

export const RewardedAdButton: React.FC<RewardedAdButtonProps> = ({ onRewardEarned }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [adFreeMinutes, setAdFreeMinutes] = useState(0);
  const [isAdReady, setIsAdReady] = useState(false);

  // Check ad-free status and ad readiness
  useEffect(() => {
    const checkStatus = async () => {
      const minutes = await adMobService.getAdFreeMinutesRemaining();
      setAdFreeMinutes(minutes);
      setIsAdReady(adMobService.isRewardedAdReady());
    };

    checkStatus();
    
    // Refresh every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleWatchAd = async () => {
    if (Platform.OS === 'web') {
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
      }
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
            <Text style={styles.adFreeTitle}>Reklamsız Mod Aktif</Text>
            <Text style={styles.adFreeTime}>{adFreeMinutes} dakika kaldı</Text>
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
              <Text style={styles.extendButtonText}>+30 dk</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Show watch ad button
  return (
    <TouchableOpacity
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
            <Text style={styles.buttonTitle}>30 Dakika Reklamsız Dinle</Text>
            <Text style={styles.buttonSubtitle}>Video izle, reklamsız keyfini çıkar</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
