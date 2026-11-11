import {MegaLoadingState} from './MegaLoadingState';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../constants/theme';
import appService, { AppPage, AppPages } from '../services/appService';
import { AboutUsScreen } from './AboutUsScreen';
import { usePlayerStore } from '../store/playerStore';

type PageType = 'about' | 'terms' | 'privacy';

const PAGE_TITLES: Record<PageType, string> = {
  about: 'MegaRadio',
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
};

// Fallback content when API returns empty - required for Apple App Store Review (Guideline 3.1.2c)
const FALLBACK_CONTENT: Record<string, string> = {
  terms: `Terms and Conditions
Last updated: 2026-03-28

1. Acceptance of Terms
By accessing and using Mega Radio's services, you accept and agree to be bound by the terms and provision of this agreement. These Terms of Service govern your use of our radio streaming platform.

2. Description of Service
Mega Radio provides access to a collection of internet radio stations and streaming audio content. Our service allows users to discover, listen to, and enjoy radio stations from around the world.

3. User Accounts
- You must provide accurate and complete information when creating an account
- You are responsible for maintaining the confidentiality of your account credentials
- You must notify us immediately of any unauthorized use of your account
- One person or legal entity may not maintain more than one account

4. Acceptable Use
You agree not to:
- Use the service for any unlawful purposes or activities
- Attempt to gain unauthorized access to our systems or other users' accounts
- Interfere with or disrupt the service or servers connected to the service
- Reproduce, distribute, or create derivative works from our content without permission
- Use automated systems to access the service without our written consent
- Upload or transmit viruses, malware, or other harmful code

5. Intellectual Property
The service and its original content are and will remain the exclusive property of Mega Radio and its licensors. The service is protected by copyright, trademark, and other laws. Our trademarks may not be used without our prior written consent.

6. Content and Radio Stations
We aggregate and provide access to radio stations and content from various sources. We do not own or control the content of these radio stations. Station availability and content quality may vary and are subject to the policies of individual broadcasters.

7. Privacy
Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service, to understand our practices.

8. Disclaimers
The service is provided "as is" without any representations or warranties, express or implied. We make no representations or warranties in relation to this service or the information and materials provided on this service.

9. Limitation of Liability
In no event shall Mega Radio, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the service.

10. Termination
We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.

11. Changes to Terms
We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.

12. Subscriptions & Auto-Renewal

MegaRadio offers the following auto-renewable subscriptions:

MegaRadio Premium (Monthly)
- Price: €3.99/month
- Includes: Ad-free listening, HD audio quality, Spotify/YouTube integration, and all premium features
- Free Trial: 7-day free trial for first-time subscribers
- After the trial period ends, the subscription automatically renews at €3.99/month
- Any unused portion of the free trial period will be forfeited when purchasing a subscription

Remove Ads (Yearly)
- Price: €5.99/year
- Includes: Removes all advertisements from the app
- Auto-renews at €5.99/year

Payment & Cancellation
- Payment will be charged to your Apple ID / Google Play account at the confirmation of purchase
- Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period
- Your account will be charged for renewal within 24 hours prior to the end of the current period
- You can manage and cancel your subscriptions by going to your device's account settings:
  - iOS: Settings > Apple ID > Subscriptions
  - Android: Google Play Store > Subscriptions
- No cancellation of the current subscription is allowed during the active subscription period

13. Contact Information
If you have any questions about these Terms and Conditions, please contact us at legal@themegaradio.com

Links
- Privacy Policy: https://themegaradio.com/en/pages/privacy-policy
- Terms and Conditions: https://themegaradio.com/en/pages/terms-and-conditions`,

  privacy: `Privacy Policy
Last updated: 2026-03-28

1. Introduction
At Mega Radio ("we," "our," or "us"), we respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our radio streaming service.

2. Information We Collect

Personal Information
When you create an account or contact us, we may collect:
- Name and email address
- Username and password
- Profile information and preferences
- Communication history with our support team

Usage Information
We automatically collect information about how you use our service:
- Listening history and preferences
- Device information and IP address
- Browser type and operating system
- Time and duration of your sessions

3. How We Use Your Information
- To provide and improve our radio streaming service
- To personalize your listening experience
- To communicate with you about service updates
- To provide customer support
- To analyze usage patterns and improve our platform
- To comply with legal obligations

4. Information Sharing
We do not sell, trade, or rent your personal information. We may share your information only in these circumstances:
- With your explicit consent
- To comply with legal requirements
- To protect our rights and property
- With trusted service providers who assist in our operations
- In connection with a business transfer or merger

5. Data Security
We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.

6. Your Rights
You have the right to:
- Access your personal data
- Correct inaccurate information
- Delete your account and all associated data (available in app under Profile > Delete Account)
- Export your data
- Opt out of certain communications
- Restrict processing of your data
- Upon account deletion, all personal data is removed within 30 days in compliance with GDPR

7. Cookies and Tracking
We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. You can control cookie settings through your browser preferences.

8. Third-Party Links
Our service may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.

9. Changes to This Policy
We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "last updated" date.

10. Contact Us
If you have any questions about this privacy policy or our data practices, please contact us at privacy@themegaradio.com`
};

export function StaticPageContent({ type, onBack, miniPlayerOverlay = true }: { type: PageType; onBack: () => void; miniPlayerOverlay?: boolean }) {
  const insets = useSafeAreaInsets();
  const hasMiniPlayer = usePlayerStore(state => state.isMiniPlayerVisible && !!state.currentStation);
  const bottomPadding = 24 + insets.bottom + (miniPlayerOverlay && hasMiniPlayer ? 71 : 0);
  const { t } = useTranslation();
  const [page, setPage] = useState<AppPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageType = type as keyof AppPages;

  useFocusEffect(useCallback(() => {
    if (type === 'about' || !(__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1')) return;
    const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'legalPage', visible }, 'http://localhost:8082');
    notify(true);
    return () => notify(false);
  }, [type]));

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[StaticPage] Loading page type:', pageType);
        const pages = await appService.getPages();
        console.log('[StaticPage] Pages response:', pages ? Object.keys(pages) : 'null');

        if (pages && pages[pageType]) {
          console.log('[StaticPage] Found page:', pages[pageType].title);
          setPage(pages[pageType]);
        } else {
          console.log('[StaticPage] Page not found for type:', pageType);
          // Don't set error - we'll show placeholder content
        }
      } catch (e) {
        console.error('[StaticPage] Error loading page:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadPage();
  }, [pageType]);

  const defaultTitle = PAGE_TITLES[pageType] || 'Page';

  if (pageType === 'about') {
    return <AboutUsScreen page={page} loading={isLoading} onBack={onBack} />;
  }

  // Terms and Privacy pages - standard design
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          testID="static-page-back-btn"
          accessibilityRole="button"
          accessibilityLabel={t('back', 'Back')}
        >
          <Image source={require('../../assets/images/language/back.svg')} style={{ width: 24, height: 24 }} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {page?.title || t(pageType, defaultTitle)}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {isLoading ? (
        <MegaLoadingState page variant="text" count={5} inset={20}/>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          testID="legal-page-scroll"
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {page?.content ? (
            <Text style={styles.content}>{page.content}</Text>
          ) : FALLBACK_CONTENT[pageType] ? (
            <Text style={styles.content}>{FALLBACK_CONTENT[pageType]}</Text>
          ) : (
            <View style={styles.emptyContent}>
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {t('content_coming_soon', 'İçerik yakında eklenecek')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 78,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Ubuntu-Medium',
    fontSize: 15,
    lineHeight: 17,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },

  // Standard page styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 15,
  },
  content: {
    fontFamily: 'Ubuntu-Bold',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 25,
    letterSpacing: -0.5,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
