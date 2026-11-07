import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import adMobService from '../services/adMobService.native';

// UMP decides whether this region/message requires a persistent choices entry.
export function AdPrivacyOptions() {
  const { t } = useTranslation();
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    adMobService.requiresPrivacyOptions().then(value => {
      if (active) setRequired(value);
    }).catch(() => {});
    return () => { active = false; };
  }, []));
  if (!required) return null;
  const open = async () => {
    if (busy) return;
    setBusy(true);
    try { await adMobService.showPrivacyOptions(); }
    catch { Alert.alert(t('ad_privacy_choices', 'Ad privacy choices'), t('try_again', 'Please try again.')); }
    finally { setBusy(false); }
  };
  return (
    <TouchableOpacity style={styles.row} onPress={open} disabled={busy}
      accessibilityRole="button" testID="ad-privacy-choices">
      <Ionicons name="shield-outline" size={22} color="#FFF" />
      <Text style={styles.label}>{t('ad_privacy_choices', 'Ad privacy choices')}</Text>
      {busy ? <ActivityIndicator color="#FF4199" /> : <Ionicons name="chevron-forward" size={20} color="#666" />}
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 16 },
  label: { flex: 1, color: '#FFF', fontSize: 16 },
});
