import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

/** The existing All Stations navigator, shared by catalog lists. */
export function CatalogPagination({ page, pageCount, summary, busy = false, onChange, testID, idPrefix = 'page', integrated = false }: {
  page: number; pageCount: number; summary: string; busy?: boolean;
  onChange: (page: number) => void; testID: string; idPrefix?: string; integrated?: boolean;
}) {
  const { t } = useTranslation();
  const items = useMemo(() => {
    const count = Math.min(pageCount, 4);
    const start = Math.max(1, Math.min(page - 1, pageCount - count + 1));
    const values = Array.from({ length: count }, (_, index) => start + index);
    if (values.length && values[values.length - 1] < pageCount) values[values.length - 1] = pageCount;
    return values;
  }, [page, pageCount]);
  return <View style={[s.pagination, integrated && s.integrated]} testID={testID}>
    {pageCount > 1 && <View style={[s.pageButtons, integrated && s.integratedButtons]}>
      <TouchableOpacity hitSlop={{ top: 3, bottom: 3, left: 2, right: 2 }} style={[s.pageButton, integrated && s.integratedButton]} disabled={page === 1 || busy} accessibilityRole="button" accessibilityLabel={t('pagination_previous', 'Previous page')} testID={`${idPrefix}-previous`} onPress={() => onChange(page - 1)}>
        <Image source={require('../../assets/images/all-stations/page-previous.svg')} style={[s.pageArrow, { opacity: page === 1 ? 0.3 : 1 }]} tintColor="#FFFFFF" contentFit="contain" />
      </TouchableOpacity>
      {items.map((item, index) => <React.Fragment key={item}>
        {index > 0 && item > items[index - 1] + 1 && <View style={[s.pageButton, integrated && s.integratedButton, s.pageEllipsis]} accessible={false}><View style={s.pageDots}>{[0, 1, 2].map(dot => <View key={dot} style={s.pageDot} />)}</View></View>}
        <TouchableOpacity hitSlop={{ top: 3, bottom: 3, left: 2, right: 2 }} style={[s.pageButton, integrated && s.integratedButton, item === page && (integrated ? s.integratedSelected : s.pageSelected)]} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: item === page }} accessibilityLabel={t('pagination_page', { defaultValue: 'Page {{page}}', page: item })} testID={`${idPrefix}-${item}`} onPress={() => onChange(item)}>
          <Text style={s.pageText}>{item}</Text>
        </TouchableOpacity>
      </React.Fragment>)}
      <TouchableOpacity hitSlop={{ top: 3, bottom: 3, left: 2, right: 2 }} style={[s.pageButton, integrated && s.integratedButton]} disabled={page === pageCount || busy} accessibilityRole="button" accessibilityLabel={t('pagination_next', 'Next page')} testID={`${idPrefix}-next`} onPress={() => onChange(page + 1)}>
        <Image source={require('../../assets/images/all-stations/page-next.svg')} style={[s.pageArrow, { opacity: page === pageCount ? 0.3 : 1 }]} tintColor="#FFFFFF" contentFit="contain" />
      </TouchableOpacity>
    </View>}
    <Text style={s.pageSummary} accessibilityLiveRegion="polite">{summary}</Text>
    {busy && <ActivityIndicator color="#FF4199" style={{ marginTop: 8 }} />}
  </View>;
}
const s = StyleSheet.create({
  pagination: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
  pageButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pageArrow: { width: 26, height: 26 },
  pageButton: { width: 40, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2F2F2F' },
  pageSelected: { backgroundColor: '#FF4199' },
  pageText: { fontFamily: 'Ubuntu-Bold', fontSize: 16, lineHeight: 20, includeFontPadding: false, color: '#FFFFFF' },
  pageEllipsis: { flexShrink: 0 },
  integrated: { borderTopWidth: 1, borderTopColor: '#292929', paddingTop: 16, paddingBottom: 12 },
  integratedButtons: { justifyContent: 'center', gap: 4 },
  integratedButton: { width: 36, height: 40, borderRadius: 6, backgroundColor: 'transparent' },
  integratedSelected: { backgroundColor: '#303135' },
  pageDots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pageDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
  pageSummary: { fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 16, color: '#A6A6A6', marginTop: 12 },
});
