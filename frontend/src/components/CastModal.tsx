import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
// Cast Modal - Apple AirPlay style modern popup
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  Animated} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { castService } from '../services/castService';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { getStationLogoUrl } from '../utils/stationLogoHelper';

const { width, height } = Dimensions.get('window');

interface CastModalProps {
  visible: boolean;
  onClose: () => void;
  currentStation?: any;
}

export const CastModal: React.FC<CastModalProps> = ({
  visible,
  onClose,
  currentStation,
}) => {
  const { token, isAuthenticated } = useAuthStore();
  useAnalyticsOverlay('cast',visible);
  const [isCasting, setIsCasting] = useState(false);
  const [castSuccess, setCastSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      slideAnim.setValue(height);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setError(null);
      setCastSuccess(false);
      onClose();
    });
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // TV'ye cast et
  const handleCastToTV = async () => {
    if (!token || !currentStation) {
      setError('Lütfen önce giriş yapın');
      return;
    }

    setIsCasting(true);
    setError(null);
    setCastSuccess(false);

    try {
      const success = await castService.castStation(token, currentStation);
      
      if (success) {
        setCastSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError('TV bulunamadı. TV açık ve giriş yapılmış olmalı.');
      }
    } catch (err: any) {
      console.error('[CastModal] Cast error:', err);
      setError('Bağlantı hatası');
    } finally {
      setIsCasting(false);
    }
  };

  const handlePauseTV = async () => {
    if (!token) return;
    setIsCasting(true);
    await castService.sendPause(token);
    setIsCasting(false);
  };

  const handleStopTV = async () => {
    if (!token) return;
    setIsCasting(true);
    const success = await castService.sendStop(token);
    setIsCasting(false);
    if (success) handleClose();
  };

  // Get station logo
  const getLogoUrl = () => {
    if (!currentStation) return null;
    return getStationLogoUrl(currentStation, 'large');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
        
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle} />
          
          {/* Success State */}
          {castSuccess ? (
            <View style={styles.successState}>
              <View style={styles.successIconWrapper}>
                <LinearGradient
                  colors={['#4CAF50', '#2E7D32']}
                  style={styles.successIconBg}
                >
                  <Ionicons name="checkmark" size={32} color="#FFF" />
                </LinearGradient>
              </View>
              <Text style={styles.successTitle}>TV'ye Gönderildi</Text>
              <Text style={styles.successSubtitle}>{currentStation?.name}</Text>
            </View>
          ) : (
            <>
              {/* Header with Station Info */}
              <View style={styles.header}>
                <View style={styles.stationPreview}>
                  {getLogoUrl() ? (
                    <Image source={{ uri: getLogoUrl() }} style={styles.stationLogo} />
                  ) : (
                    <View style={styles.stationLogoPlaceholder}>
                      <Ionicons name="radio" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.stationDetails}>
                    <Text style={styles.stationName} numberOfLines={1}>
                      {currentStation?.name || 'Radyo Seçilmedi'}
                    </Text>
                    <Text style={styles.stationMeta}>
                      {currentStation?.country || 'Live Radio'}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* TV Device Option */}
              <TouchableOpacity
                style={styles.deviceOption}
                onPress={handleCastToTV}
                disabled={isCasting}
                activeOpacity={0.7}
              >
                <View style={styles.deviceIconWrapper}>
                  <LinearGradient
                    colors={['#FF4199', '#FF8C42']}
                    style={styles.deviceIcon}
                  >
                    <Ionicons name="tv-outline" size={22} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>TV'de Çal</Text>
                  <Text style={styles.deviceSubtitle}>MegaRadio TV uygulaması</Text>
                </View>
                {isCasting ? (
                  <ActivityIndicator size="small" color={colors.accentPink} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
              
              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              
              {/* Divider */}
              <View style={styles.divider} />
              
              {/* Control Buttons */}
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={handlePauseTV}
                  disabled={isCasting}
                >
                  <Ionicons name="pause" size={20} color={colors.text} />
                  <Text style={styles.controlLabel}>Duraklat</Text>
                </TouchableOpacity>
                
                <View style={styles.controlDivider} />
                
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={handleStopTV}
                  disabled={isCasting}
                >
                  <Ionicons name="stop" size={20} color={colors.text} />
                  <Text style={styles.controlLabel}>Durdur</Text>
                </TouchableOpacity>
              </View>
              
              {/* Footer Info */}
              <View style={styles.footer}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.footerText}>
                  TV'nizde aynı hesapla giriş yapılmış olmalı
                </Text>
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    minHeight: 300,
  },
  dragHandle: {
    width: 36,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  stationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stationLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  stationLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationDetails: {
    flex: 1,
  },
  stationName: {
    fontSize: 17,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFF',
  },
  stationMeta: {
    fontSize: 13,
    fontFamily: 'Ubuntu-Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  
  // Device Option
  deviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  deviceIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
  },
  deviceIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 17,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFF',
  },
  deviceSubtitle: {
    fontSize: 13,
    fontFamily: 'Ubuntu-Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Ubuntu-Regular',
    color: '#FF6B6B',
  },
  
  // Divider
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginVertical: 8,
  },
  
  // Controls
  controlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  controlDivider: {
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  controlLabel: {
    fontSize: 15,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFF',
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Ubuntu-Regular',
    color: 'rgba(255,255,255,0.4)',
  },
  
  // Success State
  successState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  successIconWrapper: {
    marginBottom: 16,
  },
  successIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFF',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 15,
    fontFamily: 'Ubuntu-Regular',
    color: 'rgba(255,255,255,0.6)',
  },
});

export default CastModal;
