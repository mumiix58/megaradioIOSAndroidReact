import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

/** Shared login-flow error box; keep login, signup and recovery consistent. */
export function AuthErrorNotice({ message, testID }: { message: string; testID: string }) {
  if (!message) return null;
  return <View style={styles.box} testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Text style={styles.text}>{message}</Text>
  </View>;
}
const styles = StyleSheet.create({
  box: {
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    paddingVertical: 14, paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full, backgroundColor: colors.errorToast,
    alignItems: 'center',
  },
  text: { fontFamily: 'Ubuntu-Medium', fontSize: typography.sizes.md, color: colors.text },
});
