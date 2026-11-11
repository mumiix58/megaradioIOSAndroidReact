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
  Platform} from 'react-native';
import { AuthErrorNotice } from '../src/components/AuthErrorNotice';
import { AuthNavigation } from '../src/components/AuthNavigation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, typography } from '../src/constants/theme';
import authService, { authErrorMessage } from '../src/services/authService';
import { useAuthStore } from '../src/store/authStore';

// Input icons
const EMAIL_ICON = require('../assets/images/auth/figma/email-input.svg');
const PASSWORD_ICON = require('../assets/images/auth/figma/password-input.svg');

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; returnParams?: string }>();
  const { t } = useTranslation();
  const { saveAuth } = useAuthStore();

  // Parse return params for redirect after login
  const returnTo = params.returnTo;
  const returnParams = params.returnParams ? JSON.parse(params.returnParams) : null;

  const navigateAfterLogin = () => {
    if (returnTo && returnParams) {
      router.replace({
        pathname: returnTo as any,
        params: returnParams
      });
    } else {
      router.replace('/(tabs)');
    }
  };

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submissionLock] = useState(createSubmissionLock);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasError, setHasError] = useState(false);

  const validateForm = () => {
    if (!email.trim()) {
      setError(t('please_enter_email', 'Please enter your email'));
      setHasError(true);
      return false;
    }
    if (!password) {
      setError(t('please_enter_password', 'Please enter your password'));
      setHasError(true);
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(t('invalid_email', 'Please enter a valid email address'));
      setHasError(true);
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!submissionLock.tryAcquire()) return;
    setError('');
    setHasError(false);
    if (!validateForm()) { submissionLock.release(); return; }

    setIsLoading(true);
    try {
      const response = await authService.mobileLogin(email.trim(), password);
      // Persist the normalized mobile session.
      if (response && response.token && response.user) {
        const apiUser = response.user;
        
        // Build full avatar URL if relative
        let avatarUrl = apiUser.avatar || null;
        if (avatarUrl && !avatarUrl.startsWith('http')) {
          avatarUrl = `https://themegaradio.com${avatarUrl}`;
        }
        
        // Map API user format to our User type
        const user = {
          _id: apiUser._id,
          id: apiUser._id,
          name: apiUser.fullName || apiUser.name || '',
          fullName: apiUser.fullName,
          email: apiUser.email,
          username: apiUser.username,
          avatar: avatarUrl,
          profilePhoto: avatarUrl,
          followersCount: apiUser.followersCount || 0,
          followingCount: apiUser.followingCount || 0,
          isPublicProfile: apiUser.isPublicProfile,
          favoriteStationsCount: apiUser.favoriteStationsCount || 0,
          totalListeningTime: apiUser.totalListeningTime || 0,
        };
        await saveAuth(user as any, response.token);
        void analyticsService.logLogin('email');
        
        // Use router.replace with dismissAll for clean navigation
        // This ensures the login screen is completely removed from the stack
        setTimeout(() => {
          navigateAfterLogin();
        }, 100);
      } else {
        console.error('Invalid authentication response');
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Login failed:', err.response?.status || err.code);
      setHasError(true);
      
      // Handle specific error cases
      if (err.response?.status === 401 || err.response?.status === 400) {
        setError(t('wrong_credentials', 'Wrong email or password! Try again'));
      } else if (err.response?.data?.error || err.response?.data?.message) {
        setError(err.response.data.error || err.response.data.message);
      } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        setError(t('network_error', 'Network error. Please check your connection.'));
      } else {
        setError(authErrorMessage(err, t('login_error', 'Login failed. Please try again.')));
      }
    } finally {
      setIsLoading(false);
      submissionLock.release();
    }
  };


  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const handleGoToSignup = () => {
    router.push('/signup');
  };

  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Error Toast */}
          <AuthErrorNotice message={hasError ? error : ''} testID="login-error-toast" />

          {/* Content */}
          <View style={styles.content}>
            {/* Title - Ubuntu Bold 24px */}
            <Text style={styles.title}>{t('login', 'Login')}</Text>

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
                testID="login-email-input"
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
                testID="login-password-input"
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              accessibilityRole="button" accessibilityState={{disabled:isLoading,busy:isLoading}} disabled={isLoading}
              testID="login-submit-button"
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.loginButtonText}>{t('login', 'Login')}</Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
              testID="login-forgot-password-button"
            >
              <Text style={styles.forgotPasswordText}>{t('forgot_password', 'Forgot your password?')}</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleGoToSignup}>
              <Text style={styles.footerText}>{t('dont_have_account', "Don't you have an account?")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/')} style={styles.continueWithoutBtn}>
              <Text style={styles.continueWithoutText}>{t('continue_without_login', 'Continue without login')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
      <AuthNavigation fallback="/auth-options" testID="login-back-button" />
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
    marginTop: -40,
  },
  title: {
    fontFamily: 'Ubuntu-Bold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0,
    color: colors.text,
    marginBottom: spacing.lg,
    flexShrink: 1,
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
  loginButton: {
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accentPinkButton,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontFamily: 'Ubuntu-Bold',
    fontSize: typography.sizes.lg,
    color: colors.text,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  forgotPasswordText: {
    fontFamily: 'Ubuntu-Medium',
    fontSize: 15,
    lineHeight: 17,
    color: colors.text,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  continueWithoutBtn: {
    marginTop: spacing.sm,
  },
  continueWithoutText: {
    fontFamily: 'Ubuntu-Medium',
    fontSize: 15,
    lineHeight: 17,
    color: colors.text,
  },
  footerText: {
    fontFamily: 'Ubuntu-Medium',
    fontSize: 15,
    lineHeight: 17,
    color: colors.text,
  },
});
