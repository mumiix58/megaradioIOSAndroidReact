import {MegaLoadingState} from '../src/components/MegaLoadingState';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../src/store/languageStore';
import { useResponsive } from '../src/hooks/useResponsive';

const DESIGN_ORDER = ['en', 'tr', 'es', 'de', 'fr', 'it'];
const DESIGN_NAMES: Record<string, string> = { en: 'English', tr: 'Turkish', es: 'Spanish', de: 'German', fr: 'French', it: 'Italian' };

export default function LanguagesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { currentLanguage, availableLanguages, initialize, setLanguage } = useLanguageStore();
  const responsive = useResponsive();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const savingRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'languages', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  useEffect(() => {
    let active = true;
    void initialize().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialize]);
  const languages = useMemo(() => [...availableLanguages].sort((a, b) => {
    const rank = (code: string) => { const index = DESIGN_ORDER.indexOf(code); return index < 0 ? DESIGN_ORDER.length : index; };
    return rank(a.code) - rank(b.code);
  }), [availableLanguages]);
  const activeLanguage = (i18n.resolvedLanguage || i18n.language || currentLanguage).split('-')[0];
  const selectLanguage = async (code: string) => {
    if (savingRef.current || code === activeLanguage) return;
    savingRef.current = true; setSaving(code);
    try { await setLanguage(code); }
    catch { Alert.alert(t('error', 'Error'), t('error_changing_language', 'Unable to change language. Please try again.')); }
    finally { savingRef.current = false; setSaving(null); }
  };
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={[styles.header, { marginHorizontal: responsive.sidePadding }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} accessibilityRole="button" accessibilityLabel={t('back', 'Back')} testID="language-back">
        <Image source={require('../assets/images/language/back.svg')} style={styles.backIcon} contentFit="contain" />
      </TouchableOpacity>
      <Text style={styles.title}>{t('language', 'Language')}</Text>
      <View style={styles.back} />
    </View>
    {loading ? <MegaLoadingState page variant="settings" count={7}/> :
      <FlatList data={languages} keyExtractor={item => item.code} extraData={{ activeLanguage, saving }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: responsive.sidePadding, paddingTop: 13, paddingBottom: 25 }}
        renderItem={({ item }) => <TouchableOpacity style={styles.row} onPress={() => void selectLanguage(item.code)} disabled={saving !== null}
          accessibilityRole="radio" accessibilityLabel={DESIGN_NAMES[item.code] || item.name} accessibilityState={{ checked: activeLanguage === item.code, disabled: saving !== null }} testID={`language-${item.code}`}>
          <Text style={styles.name}>{DESIGN_NAMES[item.code] || item.name}</Text>
          {saving === item.code ? <ActivityIndicator color="#FF4199" /> : <View style={styles.radio}>{activeLanguage === item.code && <View style={styles.radioFill} />}</View>}
        </TouchableOpacity>} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 78, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backIcon: { width: 24, height: 24 },
  title: { flex: 1, textAlign: 'center', fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 21, color: '#FFFFFF' },
  row: { height: 50, marginBottom: 25, borderBottomWidth: 1, borderBottomColor: '#333436', flexDirection: 'row', alignItems: 'flex-start', paddingTop: 2, justifyContent: 'space-between' },
  name: { flex: 1, marginTop: 2, fontFamily: 'Ubuntu-Medium', fontSize: 18, lineHeight: 21, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
  radio: { width: 25, height: 25, borderRadius: 20, borderWidth: 3, borderColor: '#FF4199', alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#FF4199' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
