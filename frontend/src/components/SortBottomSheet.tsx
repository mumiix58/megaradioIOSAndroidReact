import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type SortOption = 'popular' | 'az' | 'za';
export type ViewMode = 'grid' | 'list';
interface SortBottomSheetProps<T extends string = SortOption> {
  visible: boolean;
  onClose: () => void;
  sortOption: T;
  onSortChange: (option: T) => void | boolean;
  options?: { key: T; label: string }[];
  variant?: 'stations' | 'favorites';
  content?: React.ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}
// Final Figma see-more-more / action-sheet: 415px incl. 34px safe area.
// The two omitted date rows are each 52px, giving 277px plus the device safe area.
const SortPanel = <T extends string,>({ onClose, sortOption, onSortChange, viewMode, onViewModeChange, options: suppliedOptions, variant }: SortBottomSheetProps<T>) => {
  const isFavorites = variant === 'favorites';
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Capture the opening distance once: modal safe-area updates must not restart it.
  const openingDistance = useRef((isFavorites ? 392 : 277) + insets.bottom).current;
  const translateY = useRef(new Animated.Value(openingDistance)).current;
  useLayoutEffect(() => {
    translateY.setValue(openingDistance);
    const animation = Animated.timing(translateY, { toValue: 0, duration: isFavorites ? 280 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [translateY, openingDistance, isFavorites]);
  const options = suppliedOptions ?? [
    { key: 'popular', label: t('popular', 'Popular') },
    { key: 'az', label: t('sort_az', 'A-Z') },
    { key: 'za', label: t('sort_za', 'Z-A') },
  ] as { key: T; label: string }[];
  return <View style={styles.overlay}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: translateY.interpolate({ inputRange: [0, openingDistance], outputRange: [1, 0], extrapolate: 'clamp' }) }]} />
    <Pressable style={[StyleSheet.absoluteFill, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close', 'Close')} testID="sort-sheet-dismiss" />
    <Animated.View testID="sort-sheet-panel" style={[styles.sheet, { paddingBottom: (isFavorites ? 12 : 10) + insets.bottom, transform: [{ translateY }] }]}>
      <View style={[styles.handleArea, isFavorites && { height: 43 }]}><View style={styles.handle} /></View>
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map(option => <TouchableOpacity key={option.key} style={[styles.row, isFavorites && { height: 51 }]} testID={`sort-option-${option.key}`} accessibilityRole="radio" accessibilityState={{ checked: sortOption === option.key }} aria-checked={sortOption === option.key} onPress={() => { if (onSortChange(option.key) !== false) onClose(); }}>
          <Text style={styles.label}>{option.label}</Text><View style={styles.radio}>{sortOption === option.key && <View style={styles.radioDot} />}</View>
        </TouchableOpacity>)}
      </View>
      <View style={[styles.divider, isFavorites && { marginTop: 15, marginBottom: 12 }]} />
      <View style={[styles.viewRow, isFavorites && { height: 54 }]}>
        <Text style={styles.label}>{isFavorites || viewMode === 'grid' ? t('grid', 'Grid') : t('list', 'List')}</Text>
        <View style={styles.viewButtons}>
          {(['grid', 'list'] as const).map(mode => <TouchableOpacity key={mode} style={styles.viewButton} testID={`view-mode-${mode}`} accessibilityRole="button" accessibilityLabel={t(mode, mode === 'grid' ? 'Grid' : 'List')} accessibilityState={{ selected: viewMode === mode }} aria-pressed={viewMode === mode} onPress={() => onViewModeChange(mode)}>
            <Image source={mode === 'grid' ? require('../../assets/images/sort/grid.svg') : require('../../assets/images/sort/list.svg')} style={styles.icon} tintColor={isFavorites ? (viewMode === mode ? '#FFFFFF' : '#616161') : (viewMode === mode ? '#FF4199' : '#FFFFFF')} contentFit="contain" />
          </TouchableOpacity>)}
        </View>
      </View>
    </Animated.View>
  </View>;
};
export const SortBottomSheet = <T extends string = SortOption,>(props: SortBottomSheetProps<T>) => {
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'sort', visible: props.visible }, 'http://localhost:8082');
  }, [props.visible]);
  return <Modal visible={props.visible} transparent animationType="none" onRequestClose={props.onClose} statusBarTranslucent navigationBarTranslucent>
    {props.visible && (props.content ?? <SortPanel {...props} />)}
  </Modal>;
};
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#000000', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handleArea: { height: 40, paddingTop: 18, alignItems: 'center' },
  handle: { width: 50, height: 6, borderRadius: 3, backgroundColor: '#676767' },
  options: { paddingHorizontal: 15 },
  row: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: 'Ubuntu-Bold', fontSize: 14, lineHeight: 20, letterSpacing: -0.5, color: '#FFFFFF' },
  radio: { width: 25, height: 25, borderRadius: 12.5, borderWidth: 3, borderColor: '#FF4199', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: '#FF4199' },
  divider: { height: 1, backgroundColor: '#1A1A1A', marginHorizontal: 15, marginTop: 10, marginBottom: 16 },
  viewRow: { height: 44, paddingLeft: 15, paddingRight: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewButtons: { flexDirection: 'row', gap: 3 },
  viewButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 24, height: 24 },
});
export default SortBottomSheet;
