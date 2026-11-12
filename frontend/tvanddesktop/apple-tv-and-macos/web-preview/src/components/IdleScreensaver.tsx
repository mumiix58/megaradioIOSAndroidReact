import { useEffect, useState } from 'react';
import { resolveStationImageUrl, handleStationImageError } from '@/lib/imageUtils';
import { useGlobalPlayer } from '@/contexts/GlobalPlayerContext';
import { assetPath } from '@/lib/assetPath';

interface IdleScreensaverProps {
  isVisible: boolean;
  onInteraction?: () => void;
}

export const IdleScreensaver = ({ isVisible, onInteraction }: IdleScreensaverProps): JSX.Element | null => {
  const { currentStation, isPlaying, nowPlayingMetadata } = useGlobalPlayer();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [fadeIn, setFadeIn] = useState(false);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fade in animation when becoming visible
  useEffect(() => {
    if (isVisible) {
      // Small delay before fading in
      const timeout = setTimeout(() => setFadeIn(true), 100);
      return () => clearTimeout(timeout);
    } else {
      setFadeIn(false);
    }
  }, [isVisible]);

  // Handle key events - prevent propagation so first press only wakes screen
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onInteraction?.();
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  const FALLBACK_IMAGE = assetPath('images/fallback-station.png');

  const getStationImage = (station: typeof currentStation) => {
    if (!station) return FALLBACK_IMAGE;
    return resolveStationImageUrl(station.favicon) || FALLBACK_IMAGE;
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div 
      className={`fixed inset-0 w-[1920px] h-[1080px] bg-black z-[150] flex flex-col items-center justify-center transition-opacity duration-1000 ${
        fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onInteraction}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="idle-screensaver"
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#1a0a1a] to-black opacity-80" />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center gap-16" data-tv-gap-axis="column" data-tv-gap="64">
        
        {/* Large Animated Equalizer */}
        <div className="relative">
          <div className="flex items-end justify-center gap-8 h-[300px]" data-tv-gap-axis="row" data-tv-gap="32">
            {/* Bar 1 */}
            <div 
              className="bg-gradient-to-t from-[#ff4199] to-[#ff6bb3] w-[60px] rounded-[20px] animate-screensaver-equalizer-1"
            />
            {/* Bar 2 */}
            <div 
              className="bg-gradient-to-t from-[#ff4199] to-[#ff6bb3] w-[60px] rounded-[20px] animate-screensaver-equalizer-2"
            />
            {/* Bar 3 */}
            <div 
              className="bg-gradient-to-t from-[#ff4199] to-[#ff6bb3] w-[60px] rounded-[20px] animate-screensaver-equalizer-3"
            />
            {/* Bar 4 */}
            <div 
              className="bg-gradient-to-t from-[#ff4199] to-[#ff6bb3] w-[60px] rounded-[20px] animate-screensaver-equalizer-2"
            />
            {/* Bar 5 */}
            <div 
              className="bg-gradient-to-t from-[#ff4199] to-[#ff6bb3] w-[60px] rounded-[20px] animate-screensaver-equalizer-1"
            />
          </div>
        </div>

        {/* Clock - positioned between equalizer and text */}
        <div className="mt-12" data-tv-gap-extra="48">
          <p className="font-['Ubuntu',Helvetica] font-light text-[72px] text-white/50 tracking-wider">
            {formatTime(currentTime)}
          </p>
        </div>

        {/* Station Info or Branding Fallback */}
        {currentStation ? (
          <div className="flex flex-col items-center gap-8" data-tv-gap-axis="column" data-tv-gap="32">
            {/* Station Logo */}
            <div className="bg-white rounded-[12px] w-[200px] h-[200px] overflow-clip shadow-2xl">
              <img 
                src={getStationImage(currentStation)}
                alt={currentStation.name}
                className="w-full h-full object-cover"
                onError={(e) => handleStationImageError(e, currentStation.faviconFallback, FALLBACK_IMAGE)}
              />
            </div>

            {/* Station Name */}
            <h1 className="font-['Ubuntu',Helvetica] font-bold text-[56px] text-white text-center max-w-[1200px] truncate">
              {currentStation.name}
            </h1>

            {/* Now Playing */}
            {nowPlayingMetadata && (
              <div className="flex items-center gap-4" data-tv-gap-axis="row" data-tv-gap="16">
                <div className="w-[60px] h-[3px] bg-[#ff4199]" />
                <p className="font-['Ubuntu',Helvetica] font-light text-[36px] text-[#ff4199] text-center max-w-[1000px] truncate">
                  {nowPlayingMetadata}
                </p>
                <div className="w-[60px] h-[3px] bg-[#ff4199]" />
              </div>
            )}

            {/* Country */}
            <p className="font-['Ubuntu',Helvetica] font-light text-[28px] text-white/70">
              {currentStation.country}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8" data-tv-gap-axis="column" data-tv-gap="32">
            {/* App Logo */}
            <img 
              src={assetPath('images/path-8.svg')}
              alt="MegaRadio Logo"
              className="w-[120px] h-[120px]"
            />
            
            {/* App Branding */}
            <h1 className="font-['Ubuntu',Helvetica] text-[80px] text-white text-center">
              <span className="font-bold">Mega</span>Radio
            </h1>
            <p className="font-['Ubuntu',Helvetica] font-light text-[32px] text-[#ff4199] text-center">
              Your Global Radio Experience
            </p>
          </div>
        )}
      </div>

      {/* Press any button hint - positioned at bottom */}
      <div className="absolute bottom-[40px] left-1/2 -translate-x-1/2 z-20">
        <p className="font-['Ubuntu',Helvetica] font-light text-[24px] text-white/40 text-center animate-pulse">
          Press any button to continue
        </p>
      </div>
    </div>
  );
};
