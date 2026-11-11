import { createSubmissionLock } from '../src/utils/submissionLock';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform} from 'react-native';
import { AuthErrorNotice } from '../src/components/AuthErrorNotice';
import { AuthNavigation } from '../src/components/AuthNavigation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, typography } from '../src/constants/theme';
import authService from '../src/services/authService';

// Input icons
const EMAIL_ICON = require('../assets/images/auth/figma/email-input.svg');

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [submissionLock] = useState(createSubmissionLock);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    if (!submissionLock.tryAcquire()) return;
    setError('');
    if (!validateEmail()) { submissionLock.release(); return; }

    setIsLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSuccess(true);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to send reset email. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      submissionLock.release();
    }
  };


  const handleGoToSignup = () => {
    router.push('/signup');
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.safeArea}>


          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Email Sent!</Text>
            <Text style={styles.successText}>
              We've sent a password reset link to {email}. Please check your inbox.
            </Text>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.sendButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
        <AuthNavigation fallback="/login" testID="forgot-password-back-button" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <AuthErrorNotice message={error} testID="forgot-password-error-toast" />

          {/* Content */}
          <View style={styles.content}>
            {/* Title - Ubuntu Bold 24px */}
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.subtitle}>
              Enter your email we will send you verification mail.
            </Text>

            {/* Email Input */}
            <View style={[styles.inputContainer, focusedField === 'email' && styles.inputFocused, error && styles.inputError]}>
              <View style={styles.inputIconContainer}>
                <Image source={EMAIL_ICON} style={styles.inputIcon} contentFit="contain" />
              </View>
              <TextInput
                style={[styles.input, Platform.OS === 'web' && { outlineWidth: 0, outlineStyle: 'solid' }]}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                placeholder={t('email', 'Email')}
                placeholderTextColor={colors.inputPlaceholder}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="forgot-password-email-input"
              />
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
              onPress={handleSend}
              accessibilityRole="button" accessibilityState={{disabled:isLoading,busy:isLoading}} disabled={isLoading}
              testID="forgot-password-send-button"
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleGoToSignup}>
              <Text style={styles.footerText}>Don't you have an account?</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
      <AuthNavigation fallback="/login" testID="forgot-password-back-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1C1E',
  },
  safeArea: {
    flex: 1,
    paddingTop: 108,
    paddingBottom: 24,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: -80,
  },
  title: {
    fontFamily: 'Ubuntu-Bold',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: 'Ubuntu-Medium',
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: spacing.xl,
    lineHeight: 17,
  },
  inputContainer: {
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  inputFocused: { borderColor: '#FF3494' },
  inputError: {
    borderWidth: 2,
    borderColor: colors.errorBorder,
    backgroundColor: '#FFF5F5',
  },
  inputIconContainer: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputIcon: {
    width: 24,
    height: 24,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: typography.sizes.lg,
    fontFamily: 'Ubuntu-Regular',
    color: '#1A1A1D',
  },
  sendButton: {
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accentPinkButton,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    fontSize: typography.sizes.lg,
    fontFamily: 'Ubuntu-Medium',
    color: colors.text,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  footerText: {
    fontSize: typography.sizes.md,
    fontFamily: 'Ubuntu-Medium',
    color: colors.text,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontFamily: 'Ubuntu-Bold',
    fontSize: 28,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 17,
  },
});
