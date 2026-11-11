import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocalizationProvider } from "@/contexts/LocalizationContext";
import { CountryProvider } from "@/contexts/CountryContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { GlobalPlayerProvider } from "@/contexts/GlobalPlayerContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CastProvider } from "@/contexts/CastContext";
import { SleepTimerProvider } from "@/contexts/SleepTimerContext";
import { NetworkStatusProvider, useNetworkStatus } from "@/contexts/NetworkStatusContext";
import { AppLifecycleProvider } from "@/contexts/AppLifecycleContext";
import { FocusRouterProvider } from "@/contexts/FocusRouterContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { HelpProvider, useHelp } from "@/contexts/HelpContext";
import { GlobalPlayer } from "@/components/GlobalPlayer";
import { UpdateBanner } from "@/components/UpdateBanner";
import { FocusDebugOverlay } from "@/components/FocusDebugOverlay";
import { PastDueBanner } from "@/components/PastDueBanner";
import { PremiumUpgrade } from "@/pages/PremiumUpgrade";
import { OnboardingPremium } from "@/pages/OnboardingPremium";
import { ManageSubscription } from "@/pages/ManageSubscription";
import { useLocalization } from "@/contexts/LocalizationContext";
import NotFound from "@/pages/not-found";
import { useAnalytics } from "@/hooks/use-analytics";

import { Splash } from "@/pages/Splash";
import { Login } from "@/pages/Login";
import { Guide1 } from "@/pages/Guide1";
import { Guide2 } from "@/pages/Guide2";
import { Guide3 } from "@/pages/Guide3";
import { Guide4 } from "@/pages/Guide4";
import { DiscoverNoUser } from "@/pages/DiscoverNoUser";
import { RadioPlaying } from "@/pages/RadioPlaying";
import { Genres } from "@/pages/Genres";
import { GenreList } from "@/pages/GenreList";
import { Search } from "@/pages/Search";
import { Favorites } from "@/pages/Favorites";
import { Settings } from "@/pages/Settings";
import { ScreensaverTest } from "@/pages/ScreensaverTest";
import { CountrySelectPage } from "@/pages/CountrySelectPage";
import { Equalizer } from "@/pages/Equalizer";
import { PaywallProvider, usePaywall } from "@/contexts/PaywallContext";
import { useEffect } from "react";
import { DesktopLegalPage } from "@/pages/DesktopLegalPage";
import { recentlyPlayedStore } from "@/components/ContinueListeningSection";

function PremiumRoute() {
  const { showPaywall, hidePaywall } = usePaywall();
  const [, setLocation] = useLocation();
  useEffect(() => {
    // Navigate to Discover first so the paywall overlays real content,
    // then open the paywall modal on top.
    setLocation('/discover-no-user');
    const t = setTimeout(() => showPaywall('premium'), 60);
    return () => { clearTimeout(t); hidePaywall(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
function RemoveAdsRoute() {
  const { showPaywall, hidePaywall } = usePaywall();
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/discover-no-user');
    const t = setTimeout(() => showPaywall('remove_ads'), 60);
    return () => { clearTimeout(t); hidePaywall(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function NetworkDisconnectModal() {
  const { isNetworkModalOpen, closeNetworkModal } = useNetworkStatus();
  const { t } = useLocalization();

  if (!isNetworkModalOpen) return null;

  return (
    <div className="absolute top-0 left-0 w-[1920px] h-[1080px] z-[200]">
      {/* Backdrop */}
      <div className="absolute top-0 left-0 w-[1920px] h-[1080px] bg-black/80 backdrop-blur-[7px]" />
      
      {/* Modal Container - Centered, matching exit modal style */}
      <div 
        className="absolute bg-[#1a1a1a] rounded-[20px] border-2 border-[rgba(255,255,255,0.1)]"
        style={{ left: '660px', top: '340px', width: '600px', height: '400px' }}
        data-testid="modal-network-disconnect"
      >
        {/* Icon */}
        <div className="absolute top-[40px] left-[50px] right-[50px] flex justify-center">
          <div className="w-[80px] h-[80px] rounded-full bg-[rgba(255,65,153,0.2)] flex items-center justify-center">
            <svg className="w-[40px] h-[40px] text-[#ff4199]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
          </div>
        </div>
        
        {/* Title */}
        <div className="absolute top-[150px] left-[50px] right-[50px]">
          <h2 className="font-['Ubuntu',Helvetica] font-bold text-[36px] text-white text-center">
            {t('network_disconnected') || 'Network Disconnected'}
          </h2>
        </div>
        
        {/* Message */}
        <div className="absolute top-[210px] left-[50px] right-[50px]">
          <p className="font-['Ubuntu',Helvetica] font-normal text-[22px] text-white/70 text-center">
            {t('network_disconnected_message') || 'Please check your internet connection. The app will resume when connection is restored.'}
          </p>
        </div>
        
        {/* OK Button */}
        <div className="absolute bottom-[40px] left-[50px] right-[50px] flex justify-center">
          <button
            className="px-16 py-4 rounded-[30px] bg-[#ff4199] text-white border-4 border-[#ff4199] font-['Ubuntu',Helvetica] font-bold text-[24px] transition-all hover:bg-[#ff5aa8]"
            onClick={closeNetworkModal}
            data-testid="button-network-ok"
          >
            {t('ok') || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

var HELP_REMOTE_COLORS = [
  { color: '#e74c3c', label: 'Red', key: 'help_red', fallback: 'Add to Favorites' },
  { color: '#27ae60', label: 'Green', key: 'help_green', fallback: 'Play / Pause' },
  { color: '#f1c40f', label: 'Yellow', key: 'help_yellow', fallback: 'Open Search' },
  { color: '#3498db', label: 'Blue', key: 'help_blue', fallback: 'Change Country' },
];

function HelpModal() {
  const { helpOpen, closeHelp } = useHelp();
  const { t } = useLocalization();
  if (!helpOpen) return null;
  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '1920px', height: '1080px', backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={closeHelp}
      data-testid="modal-help"
    >
      <div
        style={{ backgroundColor: '#1a1a2e', borderRadius: '20px', padding: '48px 56px', minWidth: '520px', maxWidth: '640px', border: '2px solid rgba(255,65,153,0.3)', boxShadow: '0 0 40px rgba(255,65,153,0.15)' }}
        onClick={function(e: any) { e.stopPropagation(); }}
      >
        <h2 style={{ fontFamily: "'Ubuntu', Helvetica, sans-serif", fontSize: '32px', fontWeight: 700, color: '#ffffff', marginBottom: '32px', textAlign: 'center' }}>
          {t('help_title') || 'Remote Control Colors'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {HELP_REMOTE_COLORS.map(function(item) {
            return (
              <div key={item.color} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: item.color, boxShadow: '0 0 12px ' + item.color + '80', flexShrink: 0 }} />
                <span style={{ fontFamily: "'Ubuntu', Helvetica, sans-serif", fontSize: '24px', fontWeight: 500, color: '#e0e0e0' }}>
                  {t(item.key) || item.fallback}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: '36px', textAlign: 'center' }}>
          <button
            tabIndex={-1}
            onClick={closeHelp}
            style={{ fontFamily: "'Ubuntu', Helvetica, sans-serif", fontSize: '22px', fontWeight: 600, color: '#ffffff', backgroundColor: 'rgba(255,65,153,0.3)', border: '2px solid rgba(255,65,153,0.5)', borderRadius: '12px', padding: '12px 48px', cursor: 'pointer', outline: 'none' }}
            data-testid="button-help-close"
          >
            {t('btn_close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Router() {
  useAnalytics();
  
  return (
    <WouterRouter hook={useHashLocation}>
      <Switch>
        {/* Splash & Onboarding */}
        <Route path="/" component={Splash} />
        <Route path="/login" component={Login} />
        <Route path="/premium-upgrade" component={PremiumUpgrade} />
        <Route path="/manage-subscription" component={ManageSubscription} />
      
      {/* Onboarding Guide Pages */}
      <Route path="/guide-1" component={Guide1} />
      <Route path="/guide-2" component={Guide2} />
      <Route path="/guide-3" component={Guide3} />
      <Route path="/guide-4" component={Guide4} />
      <Route path="/onboarding-premium" component={OnboardingPremium} />
      
      {/* Main Application Pages */}
      <Route path="/discover-no-user" component={DiscoverNoUser} />
      <Route path="/radio-playing" component={RadioPlaying} />
      <Route path="/genres" component={Genres} />
      <Route path="/genre-list/:genre?" component={GenreList} />
      <Route path="/search" component={Search} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/settings" component={Settings} />
      <Route path="/privacy"><DesktopLegalPage document="privacy" /></Route>
      <Route path="/terms"><DesktopLegalPage document="terms" /></Route>
      <Route path="/country-select" component={CountrySelectPage} />
      <Route path="/equalizer" component={Equalizer} />
      <Route path="/premium" component={PremiumRoute} />
      <Route path="/remove-ads" component={RemoveAdsRoute} />
      <Route path="/screensaver-test" component={ScreensaverTest} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
    {/* GlobalPlayer must be INSIDE Router to detect route changes */}
    <GlobalPlayer />
    {/* Update banner — global, top z-index. Polls /api/tv/version once on mount. */}
    <UpdateBanner />
    {/* Past-due banner — global, top center. Polls /api/subscription/status. */}
    <PastDueBanner />
    {/* Focus debug overlay (top-right). Enable via ?debug=1 in URL. */}
    <FocusDebugOverlay />
    {/* Network Disconnect Modal - Global, highest z-index */}
    <NetworkDisconnectModal />
    {/* Help Modal - Global, rendered at root level to avoid overflow:hidden clipping */}
    <HelpModal />
    </WouterRouter>
  );
}

function App() {
  // On boot — push the current "Continue Listening" list to the surrounding
  // native shell (Apple TV Top Shelf / Android TV Recommendations Channel).
  // No-op on web preview where no native bridge exists.
  useEffect(() => { recentlyPlayedStore.syncToNative(); }, []);

  return (
    <AccessibilityProvider>
      <HelpProvider>
      <QueryClientProvider client={queryClient}>
        <LocalizationProvider>
          <NetworkStatusProvider>
            <CountryProvider>
              <AuthProvider>
                <FavoritesProvider>
                  <NavigationProvider>
                    <GlobalPlayerProvider>
                      <CastProvider>
                      <SleepTimerProvider>
                      <AppLifecycleProvider>
                        <FocusRouterProvider>
                          <TooltipProvider>
                            <PaywallProvider>
                              <Toaster />
                              <Router />
                            </PaywallProvider>
                          </TooltipProvider>
                        </FocusRouterProvider>
                      </AppLifecycleProvider>
                      </SleepTimerProvider>
                      </CastProvider>
                    </GlobalPlayerProvider>
                  </NavigationProvider>
                </FavoritesProvider>
              </AuthProvider>
            </CountryProvider>
          </NetworkStatusProvider>
        </LocalizationProvider>
      </QueryClientProvider>
      </HelpProvider>
    </AccessibilityProvider>
  );
}

export default App;
