import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { usePageKeyHandler } from "@/contexts/FocusRouterContext";
import { assetPath } from "@/lib/assetPath";

export function Login(): JSX.Element {
  var { login, deviceCode, codeExpiresAt, isAuthenticated, isPolling, loginError } = useAuth();
  var { t } = useLocalization();
  var [, setLocation] = useLocation();
  var [countdown, setCountdown] = useState('');
  var loginCalledRef = useRef(false);
  var [focusIndex, setFocusIndex] = useState(0);

  var totalItems = loginError ? 2 : 1;

  usePageKeyHandler('/login', function(e: KeyboardEvent) {
    var keyCode = e.keyCode || 0;
    switch (keyCode) {
      case 38: // UP
        if (focusIndex > 0) setFocusIndex(focusIndex - 1);
        break;
      case 40: // DOWN
        if (focusIndex < totalItems - 1) setFocusIndex(focusIndex + 1);
        break;
      case 13: // ENTER
        if (loginError && focusIndex === 0) {
          loginCalledRef.current = false;
          login();
        } else {
          setLocation('/discover-no-user');
        }
        break;
      case 10009: // Samsung BACK
      case 461: // LG BACK
      case 8: // Backspace
        setLocation('/');
        break;
    }
  });

  useEffect(function() {
    if (!loginCalledRef.current) {
      loginCalledRef.current = true;
      login();
    }
  }, []);

  useEffect(function() {
    if (isAuthenticated) {
      setLocation('/discover-no-user');
    }
  }, [isAuthenticated]);

  useEffect(function() {
    if (!codeExpiresAt) {
      setCountdown('');
      return;
    }

    function updateCountdown() {
      var now = Date.now();
      var expires = new Date(codeExpiresAt as string).getTime();
      var diff = expires - now;

      if (diff <= 0) {
        setCountdown('00:00');
        return;
      }

      var minutes = Math.floor(diff / 60000);
      var seconds = Math.floor((diff % 60000) / 1000);
      var mm = minutes < 10 ? '0' + minutes : '' + minutes;
      var ss = seconds < 10 ? '0' + seconds : '' + seconds;
      setCountdown(mm + ':' + ss);
    }

    updateCountdown();
    var intervalId = setInterval(updateCountdown, 1000);
    return function() {
      clearInterval(intervalId);
    };
  }, [codeExpiresAt]);

  useEffect(function() {
    if (loginError) {
      setFocusIndex(0);
    }
  }, [loginError]);

  var codeChars: string[] = [];
  if (deviceCode) {
    for (var i = 0; i < deviceCode.length; i++) {
      codeChars.push(deviceCode.charAt(i));
    }
  }

  var retryFocused = loginError && focusIndex === 0;
  var skipFocused = loginError ? focusIndex === 1 : focusIndex === 0;

  function getFocusStyle(isFocused: boolean): Record<string, string> {
    if (!isFocused) {
      return {
        border: '3px solid rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        boxShadow: 'none',
      };
    }
    return {
      border: '3px solid #ff4199',
      backgroundColor: 'rgba(255,65,153,0.2)',
      boxShadow: '0 0 20px rgba(255,65,153,0.4)',
    };
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '1920px',
        height: '1080px',
        backgroundColor: '#0e0e0e',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      data-testid="page-login"
    >
      {/* Logo */}
      <div style={{ position: 'relative', width: '195px', height: '68px', marginBottom: '50px' }}>
        <p
          style={{
            position: 'absolute',
            bottom: 0,
            left: '18.67%',
            right: 0,
            top: '46.16%',
            fontFamily: "'Ubuntu', Helvetica",
            fontSize: '32.055px',
            color: '#ffffff',
            lineHeight: 'normal',
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}
        >
          <span style={{ fontWeight: 'bold' }}>mega</span>radio
        </p>
        <img
          style={{
            position: 'absolute',
            left: 0,
            bottom: '2.84%',
            width: '34.8%',
            height: '97.16%',
          }}
          alt="Path"
          src={assetPath("images/path-8.svg")}
        />
      </div>

      {loginError ? (
        <>
          {/* Error State */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,65,153,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ff4199" strokeWidth="1.5" fill="none" />
              <path d="M12 8v4" stroke="#ff4199" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="#ff4199" />
            </svg>
          </div>

          <p
            style={{
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            {t('connection_error') || 'Connection Error'}
          </p>

          <p
            style={{
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '22px',
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
              marginBottom: '40px',
              maxWidth: '600px',
            }}
          >
            {t('login_error_message') || 'Could not connect to the server. Please check your internet connection and try again.'}
          </p>

          {/* Retry Button */}
          <button
            onClick={function() { loginCalledRef.current = false; login(); }}
            style={{
              width: '300px',
              height: '64px',
              borderRadius: '32px',
              border: retryFocused ? '3px solid #ff4199' : '3px solid rgba(255,255,255,0.2)',
              backgroundColor: retryFocused ? '#ff4199' : 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '24px',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: retryFocused ? '0 0 20px rgba(255,65,153,0.4)' : 'none',
              transition: 'all 0.2s',
              marginBottom: '16px',
            }}
            data-testid="button-retry-login"
            data-tv-focusable="true"
          >
            {t('retry') || 'Retry'}
          </button>

          {/* Skip Button */}
          <button
            onClick={function() { setLocation('/discover-no-user'); }}
            style={{
              minWidth: '300px',
              paddingLeft: '40px',
              paddingRight: '40px',
              height: '64px',
              borderRadius: '32px',
              ...getFocusStyle(skipFocused),
              color: '#ffffff',
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '24px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            data-testid="button-skip-login"
            data-tv-focusable="true"
          >
            {t('continue_without_login') || 'Skip'}
          </button>
        </>
      ) : (
        <>
          {/* Instructions */}
          <p
            style={{
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '28px',
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            {t('tv_login_visit') || 'To connect your TV, visit:'}
          </p>

          {/* URL */}
          <p
            style={{
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '42px',
              fontWeight: 'bold',
              color: '#ff4199',
              textAlign: 'center',
              marginBottom: '12px',
            }}
            data-testid="text-tv-url"
          >
            themegaradio.com/tv
          </p>

          {/* Enter code instruction */}
          <p
            style={{
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '24px',
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            {t('tv_login_qr_or_code') || 'Scan the QR code with your phone, or enter this code manually:'}
          </p>

          {/* Code + QR side-by-side */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '60px',
              marginBottom: '30px',
            }}
           data-tv-gap-axis="row" data-tv-gap="60">
            {/* Code display */}
            <div
              style={{
                display: 'flex',
                gap: '14px',
              }}
              data-testid="text-device-code"
             data-tv-gap-axis="row" data-tv-gap="14">
              {codeChars.length > 0 ? (
                codeChars.map(function(char, idx) {
                  return (
                    <div
                      key={idx}
                      style={{
                        width: '88px',
                        height: '108px',
                        borderRadius: '14px',
                        border: '3px solid rgba(255,65,153,0.5)',
                        backgroundColor: 'rgba(255,65,153,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Ubuntu', Helvetica",
                          fontSize: '84px',
                          fontWeight: 'bold',
                          color: '#ff4199',
                          lineHeight: '1',
                        }}
                      >
                        {char}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', gap: '14px' }} data-tv-gap-axis="row" data-tv-gap="14">
                  {[0, 1, 2, 3, 4, 5].map(function(idx) {
                    return (
                      <div
                        key={idx}
                        style={{
                          width: '88px',
                          height: '108px',
                          borderRadius: '14px',
                          border: '3px solid rgba(255,255,255,0.15)',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Ubuntu', Helvetica",
                            fontSize: '84px',
                            fontWeight: 'bold',
                            color: 'rgba(255,255,255,0.15)',
                            lineHeight: '1',
                          }}
                        >
                          -
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* "OR" Divider */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
             data-tv-gap-axis="column" data-tv-gap="8">
              <div style={{ width: '2px', height: '40px', background: 'rgba(255,255,255,0.15)' }} />
              <span
                style={{
                  fontFamily: "'Ubuntu', Helvetica",
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '2px',
                }}
              >
                {t('or') || 'OR'}
              </span>
              <div style={{ width: '2px', height: '40px', background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* QR Code (shown when a code is available) */}
            {deviceCode ? (
              <div
                style={{
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 0 30px rgba(255,65,153,0.2)',
                }}
                data-testid="qrcode-tv-login"
               data-tv-gap-axis="column" data-tv-gap="10">
                <QRCodeSVG
                  value={'https://www.themegaradio.com/tv?code=' + deviceCode}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: assetPath('images/logo.png'),
                    height: 36,
                    width: 36,
                    excavate: true,
                  }}
                />
                <p
                  style={{
                    fontFamily: "'Ubuntu', Helvetica",
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#000000',
                    margin: 0,
                  }}
                >
                  {t('tv_login_scan_qr') || 'Scan with your phone'}
                </p>
              </div>
            ) : (
              <div
                style={{
                  width: '192px',
                  height: '192px',
                  border: '3px dashed rgba(255,255,255,0.15)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{
                  fontFamily: "'Ubuntu', Helvetica",
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.3)',
                }}>QR</span>
              </div>
            )}
          </div>

          {/* Countdown timer */}
          {countdown && (
            <p
              style={{
                fontFamily: "'Ubuntu', Helvetica",
                fontSize: '22px',
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
                marginBottom: '20px',
              }}
              data-testid="text-countdown"
            >
              {t('tv_login_code_expires') || 'Code expires in:'} {countdown}
            </p>
          )}

          {/* Waiting indicator */}
          {isPolling && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }} data-tv-gap-axis="row" data-tv-gap="12">
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ff4199',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <p
                style={{
                  fontFamily: "'Ubuntu', Helvetica",
                  fontSize: '22px',
                  color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center',
                }}
              >
                {t('tv_login_waiting') || 'Waiting for activation...'}
              </p>
            </div>
          )}

          {/* Loading indicator when no code yet and no error */}
          {!deviceCode && !loginError && !isPolling && (
            <p
              style={{
                fontFamily: "'Ubuntu', Helvetica",
                fontSize: '22px',
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
                marginBottom: '20px',
              }}
            >
              {t('loading') || 'Loading...'}
            </p>
          )}

          {/* Skip button */}
          <button
            onClick={function() { setLocation('/discover-no-user'); }}
            style={{
              minWidth: '300px',
              paddingLeft: '40px',
              paddingRight: '40px',
              height: '64px',
              borderRadius: '32px',
              ...getFocusStyle(skipFocused),
              color: '#ffffff',
              fontFamily: "'Ubuntu', Helvetica",
              fontSize: '24px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              marginTop: '10px',
            }}
            data-testid="button-skip-login"
            data-tv-focusable="true"
          >
            {t('continue_without_login') || 'Skip'}
          </button>
        </>
      )}

      {/* Pulse animation keyframes */}
      <style>{'\
        @keyframes pulse {\
          0%, 100% { opacity: 1; transform: scale(1); }\
          50% { opacity: 0.4; transform: scale(0.8); }\
        }\
      '}</style>
    </div>
  );
}

export { Login as default };
