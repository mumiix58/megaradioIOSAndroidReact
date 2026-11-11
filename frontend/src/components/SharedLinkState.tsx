import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

/** Persistent link recovery uses the existing Mega account feedback artwork and box. */
export function SharedLinkState({ message, loading = false, testID }: { message?: string; loading?: boolean; testID: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const home = () => router.replace('/(tabs)');
  return <SafeAreaView style={s.page} testID={testID}>
    <View style={s.header}>
      <TouchableOpacity style={s.touch} accessibilityRole="button" accessibilityLabel={t('back', 'Geri')} onPress={() => router.canGoBack() ? router.back() : home()}>
        <Image source={require('../../assets/images/all-stations/back.svg')} style={s.back} contentFit="contain" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{t('shared_link', 'Paylaşım')}</Text><View style={s.touch} />
    </View>
    <View style={s.center}>
      <View style={s.card} accessibilityLiveRegion="polite">
        {loading ? <ActivityIndicator testID={`${testID}-loading`} color="#FF3494" size="large" /> :
          <Image source={require('../../assets/images/account/error.svg')} style={s.icon} contentFit="contain" accessible={false} />}
        <Text style={s.title}>{loading ? t('opening_shared_link', 'Paylaşım açılıyor') : t('shared_link_unavailable', 'Bu paylaşım açılamıyor')}</Text>
        <Text testID={`${testID}-message`} style={s.message}>{loading ? t('opening_shared_link_hint', 'Birazdan seni ilgili sayfaya götüreceğiz.') : message}</Text>
        {!loading && <TouchableOpacity testID={`${testID}-home`} style={s.button} accessibilityRole="button" onPress={home}>
          <Text style={s.buttonText}>{t('go_home', 'Ana sayfaya dön')}</Text>
        </TouchableOpacity>}
      </View>
    </View>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 },
  touch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { width: 24, height: 24 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 78 },
  card: { width: '100%', maxWidth: 344, backgroundColor: '#000000', borderColor: '#292929', borderWidth: 1, borderRadius: 6, paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center' },
  icon: { width: 48, height: 48 },
  title: { color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 20, lineHeight: 25, marginTop: 24, textAlign: 'center' },
  message: { color: '#B7B7BF', fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  button: { minHeight: 44, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 6, backgroundColor: '#FF3494', marginTop: 28 },
  buttonText: { fontFamily: 'Ubuntu-Bold', fontSize: 15, color: '#FFFFFF' },
});
