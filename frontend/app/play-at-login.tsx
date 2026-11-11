import {MegaLoadingState} from '../src/components/MegaLoadingState';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useResponsive } from '../src/hooks/useResponsive';
import { PLAY_AT_LOGIN_KEY, DEFAULT_PLAY_AT_LOGIN, normalizePlayAtLogin, type PlayAtLoginOption } from '../src/utils/playAtLogin';

const OPTIONS: { id: PlayAtLoginOption; label: string }[] = [
  { id: 'last_played', label: 'Last Played' },
  { id: 'random', label: 'Random' },
  { id: 'favorite', label: 'Favorite' },
  { id: 'off', label: 'Off' },
];

export default function PlayAtLoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const responsive = useResponsive();
  const [selectedOption, setSelectedOption] = useState<PlayAtLoginOption>(DEFAULT_PLAY_AT_LOGIN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PlayAtLoginOption | null>(null);
  const savingRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'playAtLogin', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PLAY_AT_LOGIN_KEY).then(stored => {
      if (active) setSelectedOption(normalizePlayAtLogin(stored));
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const handleSelect = async (option: PlayAtLoginOption) => {
    if (loading || savingRef.current || option === selectedOption) return;
    savingRef.current = true; setSaving(option);
    try {
      await AsyncStorage.setItem(PLAY_AT_LOGIN_KEY, option);
      setSelectedOption(option);
    } catch {
      Alert.alert(t('error', 'Error'), t('account_save_error', 'Could not save your changes. Please try again.'));
    } finally { savingRef.current = false; setSaving(null); }
  };
  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <View style={[styles.header, { marginHorizontal: responsive.sidePadding }]}>
      <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('back', 'Back')} testID="play-at-login-back-btn">
        <Image source={require('../assets/images/language/back.svg')} style={styles.backIcon} contentFit="contain" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('play_at_login', 'Play at Login')}</Text><View style={styles.backButton} />
    </View>
    {loading?<MegaLoadingState page variant="settings" count={4} inset={responsive.sidePadding}/>:<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.optionsList, { paddingHorizontal: responsive.sidePadding }]}>
      {OPTIONS.map(option => <TouchableOpacity key={option.id} style={styles.optionRow} onPress={() => void handleSelect(option.id)} disabled={loading || saving !== null}
        accessibilityRole="radio" accessibilityLabel={t(option.id, option.label)} accessibilityState={{ checked: selectedOption === option.id, disabled: loading || saving !== null }} testID={`option-${option.id}`}>
        <Text style={styles.optionLabel}>{t(option.id, option.label)}</Text>
        {saving === option.id ? <ActivityIndicator color="#FF4199" /> : <View style={styles.radioOuter}>{selectedOption === option.id && <View style={styles.radioInner} />}</View>}
      </TouchableOpacity>)}
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 78, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, justifyContent: 'center' }, backIcon: { width: 24, height: 24 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, lineHeight: 21, fontFamily: 'Ubuntu-Bold', color: '#FFFFFF' },
  optionsList: { paddingTop: 13, paddingBottom: 25 },
  optionRow: { height: 50, marginBottom: 25, borderBottomWidth: 1, borderBottomColor: '#333436', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 2 },
  optionLabel: { flex: 1, marginTop: 2, fontSize: 18, lineHeight: 21, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
  radioOuter: { width: 25, height: 25, borderRadius: 20, borderWidth: 3, borderColor: '#FF4199', justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#FF4199' },
});
