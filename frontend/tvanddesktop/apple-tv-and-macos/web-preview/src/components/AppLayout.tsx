import { useState, useEffect, useRef, RefObject } from "react";
import { useLocation } from "wouter";
import { CountrySelector } from "@/components/CountrySelector";
import { useCountry } from "@/contexts/CountryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { getFocusClasses } from "@/hooks/useFocusManager";
import { assetPath } from "@/lib/assetPath";

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  hideHeaderControls?: boolean; // For Search page - hides country selector and login
  scrollContainerRef?: RefObject<HTMLDivElement>; // For auto-hide header feature
  // Optional focus state forwarded from the page-level useFocusManager.
  // When provided, the sidebar shows the actual focus ring instead of being
  // permanently un-focused. Pages that DO NOT pass this stay backwards
  // compatible (no visual focus, OK still works via their own handlers).
  isFocused?: (index: number) => boolean;
}

export const AppLayout = ({ children, currentPage, hideHeaderControls = false, scrollContainerRef, isFocused }: AppLayoutProps) => {
  const { selectedCountry, selectedCountryFlag, setCountry } = useCountry();
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  // Auto-hide header on scroll down
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentScrollY = scrollContainer.scrollTop;
      
      // Hide header when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setShowHeader(false);
      } 
      else if (currentScrollY < lastScrollY.current) {
        setShowHeader(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  return (
    <div className="absolute inset-0 w-[1920px] h-[1080px] bg-black overflow-hidden">
      {/* Logo - Top Left - EXACT MATCH TO DISCOVERNO USER */}
      <div className="absolute h-[57px] left-[30px] top-[64px] w-[164.421px] z-50 pointer-events-auto">
        <p className="absolute bottom-0 font-['Ubuntu',Helvetica] leading-normal left-[18.67%] not-italic right-0 text-[27.029px] text-white top-[46.16%] whitespace-pre-wrap">
          <span className="font-bold">mega</span>radio
        </p>
        <div className="absolute bottom-[2.84%] left-0 right-[65.2%] top-0">
          <img
            alt=""
            className="block max-w-none w-full h-full"
            src={assetPath("images/path-8.svg")}
          />
        </div>
      </div>

      {/* Header Controls - Hidden for Search page, Auto-hides on scroll */}
      {!hideHeaderControls && (
        <div 
          className="absolute top-0 left-0 w-[1920px] h-[242px] z-50 pointer-events-none transition-transform duration-300 ease-in-out"
          style={{ transform: showHeader ? 'translateY(0)' : 'translateY(-100%)' }}
        >
          {/* Country Selector Button - EXACT FIGMA SPECS */}
          <div 
            className="absolute left-[1453px] top-[67px] flex w-[223px] h-[51px] rounded-[30px] bg-[rgba(255,255,255,0.1)] cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors pointer-events-auto flex-shrink-0"
            style={{ padding: '11px 14.316px 11px 15px', justifyContent: 'center', alignItems: 'center' }}
            onClick={() => setIsCountrySelectorOpen(true)}
            data-testid="button-country-selector"
            data-tv-focusable="true"
          >
            <div className="flex items-center gap-[10.66px]" data-tv-gap-axis="row" data-tv-gap="10.66">
              <div className="w-[28.421px] h-[28.421px] rounded-full overflow-hidden flex-shrink-0">
                <img
                  alt={selectedCountry}
                  className="w-full h-full object-cover"
                  src={selectedCountryFlag || assetPath('images/austria-1.png')}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = assetPath('images/austria-1.png');
                  }}
                />
              </div>
              <p className="font-['Ubuntu',Helvetica] font-bold leading-normal text-[24px] text-white whitespace-nowrap">
                {selectedCountry || 'Austria'}
              </p>
              <div className="flex items-center justify-center ml-auto">
                <div className="rotate-[270deg]">
                  <div className="relative w-[23.684px] h-[23.684px]">
                    <img
                      alt=""
                      className="block max-w-none w-full h-full"
                      src={assetPath("images/arrow.svg")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login/Profile Button - Right of Country Selector */}
          <div
            className="absolute top-[67px] flex h-[51px] rounded-[30px] cursor-pointer transition-colors pointer-events-auto flex-shrink-0"
            style={{
              left: '1694px',
              backgroundColor: isAuthenticated ? 'rgba(255,255,255,0.1)' : '#ff4199',
              padding: '8px 20px 8px 12px',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
            }}
            onClick={function() { setLocation(isAuthenticated ? '/settings' : '/login'); }}
            data-testid="button-header-login"
            data-tv-focusable="true"
           data-tv-gap-axis="row" data-tv-gap="10">
            {isAuthenticated && user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} data-tv-gap-axis="row" data-tv-gap="10">
                {user.avatar ? (
                  <img src={user.avatar} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#ff4199', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700, fontFamily: "'Ubuntu', Helvetica" }}>{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <p className="font-['Ubuntu',Helvetica] font-bold text-[20px] text-white whitespace-nowrap">{user.name}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} data-tv-gap-axis="row" data-tv-gap="8">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#ffffff" strokeWidth="1.5" fill="none" />
                  <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
                <p className="font-['Ubuntu',Helvetica] font-bold text-[20px] text-white whitespace-nowrap">Login</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Global Sidebar */}
      <Sidebar 
        activePage={(currentPage || 'discover') as 'discover' | 'genres' | 'search' | 'favorites' | 'settings' | 'country'}
        isFocused={isFocused || (() => false)}
        getFocusClasses={getFocusClasses}
      />

      {/* Page Content */}
      {children}

      {/* Country Selector Modal */}
      <CountrySelector
        isOpen={isCountrySelectorOpen}
        onClose={() => setIsCountrySelectorOpen(false)}
        selectedCountry={selectedCountry}
        onSelectCountry={(country) => {
          setCountry(country.name, country.code, country.flag);
        }}
      />
    </div>
  );
};
