import {CountryFlag} from './CountryFlag';
import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { useMegaSearchFocus } from '../hooks/useMegaSearchFocus';
import {MegaLoadingState} from './MegaLoadingState';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList,
  Animated, AccessibilityInfo, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { stationService } from '../services/stationService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { API_ENDPOINTS } from '../constants/api';
import { useLocationStore } from '../store/locationStore';
import { isGlobalCountry } from '../utils/countryScope';
import { filterCountries, localizedCountryName, uniqueCountries } from '../utils/countryLocalization';
import { useResponsive } from '../hooks/useResponsive';

export interface CountryData {
  name: string; nativeName: string; code: string; flag: string; flagUrl: string; stationCount: number;
}
interface Props { visible: boolean; onClose: () => void; embedded?: boolean; onSelect?: (country: CountryData) => void | boolean | Promise<void | boolean>; selectionOnly?: boolean; selectedCountryCode?: string|null; selectionTitle?: string; unspecifiedLabel?: string }

export const CountrySelectorModal: React.FC<Props> = ({ visible, onClose, embedded = false, onSelect, selectionOnly = false, selectedCountryCode, selectionTitle, unspecifiedLabel }) => {
  useAnalyticsOverlay('countries',visible);
  const { t, i18n } = useTranslation();
  const { country, countryCode, setCountryManual } = useLocationStore();
  const responsive = useResponsive();
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const searchInput = useRef<TextInput>(null);
  const searchFocus = useMegaSearchFocus();
  const compactProgress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { reduceMotion.current = value; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotion.current = value; });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!visible) compactProgress.setValue(0);
  }, [visible, compactProgress]);
  const { data: globalTotal } = useQuery({
    queryKey: ['global-station-count'],
    queryFn: async () => (await stationService.getStations({ limit: 1 })).totalCount,
    enabled: visible && !selectionOnly,
    staleTime: 5 * 60 * 1000,
  });

  const loadCountries = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(API_ENDPOINTS.countries, { params: { format: 'rich' }, signal });
      const data = Array.isArray(res.data) ? res.data : res.data?.countries || res.data?.data;
      if (!Array.isArray(data)) throw new Error('Invalid countries response');
      if (!signal?.aborted) setCountries(uniqueCountries(data.filter((item: CountryData) => !isGlobalCountry(item.name) && !isGlobalCountry(item.code))));
    } catch {
      if (!signal?.aborted) setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || countries.length) return;
    const controller = new AbortController();
    void loadCountries(controller.signal);
    return () => controller.abort();
  }, [visible, countries.length, loadCountries]);

  const filtered = useMemo(() => filterCountries(countries, search), [countries, search]);
  const language = i18n.language || 'en';

  const close = () => { Keyboard.dismiss(); setSearch(''); onClose(); };
  const select = async (item: CountryData) => {
    if (saving) return;
    setSaving(item.code);
    try {
      if (!selectionOnly) await setCountryManual(item.name, { code: isGlobalCountry(item.name) ? null : item.code, englishName: item.name, nativeName: item.nativeName });
      const accepted = await onSelect?.(item);
      if (accepted === false) return;
      close();
    } finally { setSaving(null); }
  };

  const screen = (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
        <View style={[styles.header, { marginHorizontal: responsive.sidePadding }]}>
          <TouchableOpacity style={styles.back} onPress={close} accessibilityRole="button"
            accessibilityLabel={t('back', 'Back')} testID="country-modal-close">
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title} testID="country-modal-title">{selectionTitle || t('country', 'Country')}</Text>
          <View style={styles.back} />
        </View>
        <View testID="country-modal-search-field" style={[styles.searchBar,searchFocus.fieldStyle, { marginHorizontal: responsive.sidePadding }]}>
          <TextInput ref={searchInput} style={[styles.searchInput,searchFocus.inputStyle]} onFocus={searchFocus.onFocus} onBlur={searchFocus.onBlur} selectionColor={searchFocus.selectionColor} placeholder={t('search_country', 'Search Country')}
            placeholderTextColor="#5B5B5B" value={search} onChangeText={setSearch} autoCorrect={false}
            autoCapitalize="none" keyboardAppearance="dark" returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()} accessibilityLabel={t('search_country', 'Search Country')}
            testID="country-modal-search-input" />
          <TouchableOpacity style={styles.searchAction} onPress={() => { if (search) { setSearch(''); searchInput.current?.focus(); } else Keyboard.dismiss(); }}
            accessibilityRole="button" accessibilityLabel={search ? t('clear', 'Clear') : t('search', 'Search')}
            testID="country-modal-search-action"><Image testID="country-modal-search-icon" source={search ? require('../../assets/images/favorites/clear.svg') : require('../../assets/images/home/search.svg')} style={styles.searchIcon} tintColor={search ? undefined : '#616161'} contentFit="contain" /></TouchableOpacity>
        </View>
        {!selectionOnly && <Animated.View style={[styles.globalRow, { marginHorizontal: responsive.sidePadding,
          height: compactProgress.interpolate({ inputRange: [0, 1], outputRange: [70, 44] }) }]}>
        <TouchableOpacity hitSlop={{ top: 5, bottom: 5 }} style={[styles.row, styles.globalTouch]} onPress={() => void select({ name: 'Global', nativeName: 'Global', code: 'GLOBAL', flag: '', flagUrl: '', stationCount: 0 })} disabled={!!saving}
          accessibilityRole="radio" accessibilityLabel={t('nav_global', 'Global')} accessibilityState={{ checked: isGlobalCountry(country), disabled: !!saving }} testID="country-row-GLOBAL">
          <Animated.View style={[styles.globalIcon, { transform: [{ scale: compactProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.87] }) }] }]}><Ionicons name="earth" size={30} color="#FFFFFF" /></Animated.View>
          <View style={styles.identity}><Text style={[styles.countryName, styles.globalTitle]}>{t('nav_global', 'Global')}</Text><Animated.Text style={[styles.count, styles.globalDescription, {
            height: compactProgress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            marginTop: compactProgress.interpolate({ inputRange: [0, 1], outputRange: [2, 0] }),
            opacity: compactProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }),
          }]}>{globalTotal != null ? t('global_radios_count', { count: globalTotal, total: new Intl.NumberFormat(i18n.language).format(globalTotal), defaultValue: 'All countries · {{total}} radios' }) : t('global_all_countries', 'All countries')}</Animated.Text>
            {globalTotal != null && <Animated.Text numberOfLines={1} style={[styles.count, {
              position: 'absolute', right: 0, top: 0, marginTop: 2,
              opacity: compactProgress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
              transform: [{ translateY: compactProgress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
            }]}>{new Intl.NumberFormat(i18n.language).format(globalTotal)} {t('radios', 'Radios')}</Animated.Text>}
          </View>
          {saving === 'GLOBAL' ? <ActivityIndicator color="#FF4199" /> : <View style={styles.radio}>{isGlobalCountry(country) && <View style={styles.radioFill} />}</View>}
        </TouchableOpacity>
        </Animated.View>}
        {selectionOnly && <TouchableOpacity style={[styles.row,{marginHorizontal:responsive.sidePadding}]} accessibilityRole="radio" accessibilityLabel={unspecifiedLabel} accessibilityState={{checked:!selectedCountryCode,disabled:!!saving}} disabled={!!saving} onPress={()=>void select({name:'',nativeName:'',code:'',flag:'',flagUrl:'',stationCount:0})} testID="country-row-unspecified">
          <Text style={[styles.countryName,{flex:1}]}>{unspecifiedLabel}</Text><View style={styles.radio}>{!selectedCountryCode&&<View style={styles.radioFill}/>}</View>
        </TouchableOpacity>}
        {loading ? <MegaLoadingState page variant="countries"/> : error ?
          <View style={styles.state}><Text style={styles.stateText}>{t('error_loading_countries', 'Unable to load countries')}</Text>
            <TouchableOpacity style={styles.retry} onPress={() => void loadCountries()} accessibilityRole="button">
              <Text style={styles.retryText}>{t('retry', 'Retry')}</Text></TouchableOpacity></View> :
          <FlatList scrollEventThrottle={16} onScroll={event => {
            const y = event.nativeEvent.contentOffset.y;
            // Follow the gesture instead of starting a second animation at the top.
            compactProgress.setValue(reduceMotion.current ? (y > 8 ? 1 : 0) : Math.min(1, Math.max(0, y / 52)));
          }} data={filtered} extraData={language} keyExtractor={item => item.code} showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingHorizontal: responsive.sidePadding, paddingBottom: 20, gap: 15 }}
            ListEmptyComponent={<View style={styles.state}><Ionicons name="search-outline" size={42} color="#5B5B5B" />
              <Text style={styles.stateText}>{t('no_countries_found', 'No countries found')}</Text></View>}
            renderItem={({ item }) => {
              const selected = selectionOnly ? item.code.toUpperCase() === selectedCountryCode?.toUpperCase() : countryCode ? item.code.toUpperCase() === countryCode.toUpperCase() : item.name === country || item.nativeName === country;
              return <TouchableOpacity style={styles.row} onPress={() => void select(item)} disabled={!!saving}
                accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !!saving }}
                accessibilityLabel={selectionOnly ? localizedCountryName(item, language) : `${localizedCountryName(item, language)}, ${item.stationCount} ${t('radios', 'Radios')}`}
                testID={`country-row-${item.code}`}>
                <CountryFlag code={item.code} testID={`country-flag-${item.code}`} />
                <View style={styles.identity}>
                  <Text style={styles.countryName} numberOfLines={1}>{localizedCountryName(item, language)}</Text>
                  {!selectionOnly && <Text style={styles.count} numberOfLines={1}>{Number(item.stationCount || 0).toLocaleString(i18n.language)} {t('radios', 'Radios')}</Text>}
                </View>
                {saving === item.code ? <ActivityIndicator color="#FF4199" /> :
                  <View style={styles.radio}>{selected && <View style={styles.radioFill} />}</View>}
              </TouchableOpacity>;
            }} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
  return embedded ? screen : <Modal visible={visible} animationType="slide" presentationStyle="fullScreen"
    transparent={false} onRequestClose={close} statusBarTranslucent navigationBarTranslucent>{screen}</Modal>;
};

export const countryCodeToFlag = (code?: string | null): string => {
  if (!code || code.length !== 2) return '🌐';
  const upper = code.toUpperCase();
  return String.fromCodePoint(upper.charCodeAt(0) + 127397, upper.charCodeAt(1) + 127397);
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' }, fill: { flex: 1 },
  header: { height: 44, marginTop: 10, marginBottom: 34, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, textAlign: 'center', fontFamily: 'Ubuntu-Bold', fontSize: 18, color: '#FFFFFF' },
  searchBar: { height: 45, borderRadius: 10, marginBottom: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingLeft: 15, paddingRight: 6 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Ubuntu-Medium', fontSize: 15, color: '#000000', padding: 0, outlineWidth: 0, outlineStyle: 'solid' },
  searchIcon: { width:24, height:24 },
  searchAction: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { height: 70, backgroundColor: '#272727', borderRadius: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 15 },
  globalTouch: { flex: 1, height: undefined, backgroundColor: 'transparent' },
  globalRow: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#303034', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 15 },
  globalIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  globalTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 16, lineHeight: 20 },
  globalDescription: { fontFamily: 'Ubuntu-Regular', color: '#AEAEB2', marginTop: 2 },
  flag: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#353535', overflow: 'hidden' },
  flagFallback: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  flagEmoji: { fontSize: 35 }, identity: { flex: 1, minWidth: 0 },
  countryName: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  count: { fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 16, color: '#8F8F8F', marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#FF4199', alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FF4199' },
  state: { flex: 1, minHeight: 180, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 20 },
  stateText: { fontFamily: 'Ubuntu-Regular', fontSize: 14, color: '#AEAEB2', textAlign: 'center' },
  retry: { padding: 14, borderRadius: 22, backgroundColor: '#353535' },
  retryText: { fontFamily: 'Ubuntu-Medium', fontSize: 14, color: '#FFFFFF' },
});

export default CountrySelectorModal;
