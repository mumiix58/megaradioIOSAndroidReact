import { createSubmissionLock } from '../src/utils/submissionLock';
import analyticsService from '../src/services/analyticsService';
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
  Platform,
  ScrollView} from 'react-native';
import { AuthErrorNotice } from '../src/components/AuthErrorNotice';
import { AuthNavigation } from '../src/components/AuthNavigation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, typography } from '../src/constants/theme';
import authService, { authErrorMessage } from '../src/services/authService';
import { useAuthStore } from '../src/store/authStore';

// Input icons
const EMAIL_ICON = require('../assets/images/auth/figma/email-input.svg');
const PASSWORD_ICON = require('../assets/images/auth/figma/password-input.svg');
const PERSON_ICON = require('../assets/images/auth/figma/person-input.svg');

export default function SignupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { saveAuth } = useAuthStore();

  const [name, setName] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submissionLock] = useState(createSubmissionLock);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasError, setHasError] = useState(false);

  const validateForm = () => {
    if (!name.trim()) {
      setError(t('please_enter_name', 'Please enter your name'));
      setHasError(true);
      return false;
    }
    if (!email.trim()) {
      setError(t('please_enter_email', 'Please enter your email'));
      setHasError(true);
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(t('invalid_email', 'Please enter a valid email address'));
      setHasError(true);
      return false;
    }
    if (password.length < 8) {
      setError(t('password_min_length', { count: 8, defaultValue: 'Password must be at least 8 characters' }));
      setHasError(true);
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!submissionLock.tryAcquire()) return;
    setError('');
    setHasError(false);
    if (!validateForm()) { submissionLock.release(); return; }

    setIsLoading(true);
    try {
      const response = await authService.mobileRegister(email.trim(), password, name.trim());

      if (response.success && response.token && response.user) {
        await saveAuth(response.user, response.token);
        void analyticsService.logSignUp('email');
        router.replace('/(tabs)');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Signup failed:', err.response?.status || err.code);
      setHasError(true);
      const errorMessage = authErrorMessage(err, 'Signup failed. Please try again.');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      submissionLock.release();
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back Button */}


            {/* Error Toast */}
            <AuthErrorNotice message={hasError ? error : ''} testID="signup-error-toast" />

            {/* Content */}
            <View style={styles.content}>
              {/* Title - Ubuntu Bold 24px */}
              <Text style={styles.title}>{t('signup', 'Signup')}</Text>

              {/* Name Input */}
              <View style={[styles.inputContainer, focusedField === 'name' && styles.inputFocused, hasError && styles.inputError]}>
                <View style={styles.inputIconContainer}>
                  <Image source={PERSON_ICON} style={styles.inputIcon} contentFit="contain" />
                </View>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineWidth: 0, outlineStyle: 'solid' }]}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder={t('your_name', 'Your name')}
                  placeholderTextColor={colors.inputPlaceholder}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setHasError(false);
                    setError('');
                  }}
                  autoCapitalize="words"
                  testID="signup-name-input"
                />
              </View>

              {/* Email Input */}
              <View style={[styles.inputContainer, focusedField === 'email' && styles.inputFocused, hasError && styles.inputError]}>
                <View style={styles.inputIconContainer}>
                  <Image source={EMAIL_ICON} style={styles.inputIcon} contentFit="contain" />
                </View>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineWidth: 0, outlineStyle: 'solid' }]}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder={t('email_placeholder', 'Email')}
                  placeholderTextColor={colors.inputPlaceholder}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setHasError(false);
                    setError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="signup-email-input"
                />
              </View>

              {/* Password Input */}
              <View style={[styles.inputContainer, focusedField === 'password' && styles.inputFocused, hasError && styles.inputError]}>
                <View style={styles.inputIconContainer}>
                  <Image source={PASSWORD_ICON} style={styles.inputIcon} contentFit="contain" />
                </View>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineWidth: 0, outlineStyle: 'solid' }]}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder={t('password_placeholder', 'Password')}
                  placeholderTextColor={colors.inputPlaceholder}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setHasError(false);
                    setError('');
                  }}
                  secureTextEntry
                  testID="signup-password-input"
                />
              </View>

              {/* Password hint */}
              <Text style={styles.passwordHint}>{t('password_min_length', { count: 8, defaultValue: 'Password must be at least 8 characters.' })}</Text>

              {/* Signup Button */}
              <TouchableOpacity
                style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
                onPress={handleSignup}
                accessibilityRole="button" accessibilityState={{disabled:isLoading,busy:isLoading}} disabled={isLoading}
                testID="signup-submit-button"
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.signupButtonText}>{t('signup', 'Signup')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <AuthNavigation fallback="/login" testID="signup-back-button" />
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: 'Ubuntu-Bold',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0,
    color: colors.text,
    marginBottom: spacing.lg,
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
  passwordHint: {
    fontFamily: 'Ubuntu-Medium',
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  signupButton: {
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accentPinkButton,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  signupButtonDisabled: {
    opacity: 0.7,
  },
  signupButtonText: {
    fontFamily: 'Ubuntu-Bold',
    fontSize: typography.sizes.lg,
    color: colors.text,
  },
});
