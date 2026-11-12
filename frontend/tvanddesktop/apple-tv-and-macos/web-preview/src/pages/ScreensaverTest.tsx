import { useState } from 'react';
import { IdleScreensaver } from '@/components/IdleScreensaver';

export function ScreensaverTest() {
  const [showScreensaver, setShowScreensaver] = useState(false);

  return (
    <div className="fixed inset-0 w-[1920px] h-[1080px] bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center gap-12" data-tv-gap-axis="column" data-tv-gap="48">
      <h1 className="font-['Ubuntu',Helvetica] font-bold text-[80px] text-white text-center">
        Idle Screensaver Test Page
      </h1>
      
      <p className="font-['Ubuntu',Helvetica] font-normal text-[32px] text-white/70 text-center max-w-[1200px]">
        Click the button below to preview the idle screensaver that appears after 3 minutes of inactivity.
      </p>

      <button
        onClick={() => setShowScreensaver(true)}
        className="px-20 py-6 bg-[#ff4199] text-white rounded-[30px] font-['Ubuntu',Helvetica] font-bold text-[40px] transition-all hover:bg-[#ff5aa8] hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#ff4199]/50"
        data-testid="button-show-screensaver"
      >
        🌙 Show Screensaver Preview
      </button>

      <div className="flex flex-col items-center gap-4 mt-8" data-tv-gap-axis="column" data-tv-gap="16" data-tv-gap-extra="32">
        <p className="font-['Ubuntu',Helvetica] font-light text-[24px] text-white/50 text-center">
          Features:
        </p>
        <ul className="font-['Ubuntu',Helvetica] font-light text-[20px] text-white/60 text-left list-disc pl-8">
          <li>Animated pink equalizer bars</li>
          <li>Station info (or "MegaRadio" branding if no station active)</li>
          <li>Live clock</li>
          <li>Prevents OLED burn-in</li>
          <li>Press any key to dismiss</li>
        </ul>
      </div>

      <IdleScreensaver 
        isVisible={showScreensaver} 
        onInteraction={() => setShowScreensaver(false)} 
      />
    </div>
  );
}
