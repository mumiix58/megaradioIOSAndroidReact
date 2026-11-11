import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SearchTelescope } from './SearchTelescope';

export function SearchNoResults({ message }: { message?: string }) {
  const { t } = useTranslation();
  return <View style={styles.container} testID="genre-search-no-results">
    <SearchTelescope />
    <Text style={styles.message}>{message ?? t('no_results_found', "We couldn't find any result!")}</Text>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 32, paddingHorizontal: 15 },
  message: { fontFamily: 'Ubuntu-Medium', fontSize: 20, lineHeight: 23, textAlign: 'center', color: '#FFFFFF' },
});
