// Dual Audio Player for LG webOS and Samsung Tizen TVs
(function() {
    'use strict';
    
    window.TVAudioPlayer = function(containerId) {
        this.containerId = containerId;
        this.platform = window.platform || 'web';
        this.audioElement = null;
        this.isPlaying = false;
        this.currentUrl = '';
        this.volume = 1.0;
        
        // Initialize platform-specific player
        if (this.platform === 'samsung') {
            this.initSamsungPlayer();
        } else if (this.platform === 'lg') {
            this.initLGPlayer();
        } else {
            this.initWebPlayer();
        }
    };
    
    TVAudioPlayer.prototype = {
        // Samsung Tizen AVPlay implementation
        initSamsungPlayer: function() {
            var self = this;
            var generation = 0;
            var paused = false;
            
            this.play = function(url) {
                var attempt = ++generation;
                var settled = false;
                var failed = false;
                paused = false;
                function active() { return attempt === generation; }
                function fail(error) {
                    if (!active() || paused || failed) return;
                    failed = true;
                    settled = true;
                    if (self._watchdog) { clearTimeout(self._watchdog); self._watchdog = null; }
                    self.isPlaying = false;
                    self.onError && self.onError(error);
                }
                self.currentUrl = url;
                
                // Cancel any watchdog left over from a PREVIOUS play() call.
                // avplay is a SINGLETON: a stale watchdog firing stop()/close()
                // would kill THIS (newly started) stream. This happens when the
                // app fires play() twice in quick succession (auto-play re-trigger).
                if (self._watchdog) {
                    clearTimeout(self._watchdog);
                    self._watchdog = null;
                }

                try {
                    // Always close player before opening new stream to reset state
                    try {
                        var state = webapis.avplay.getState();
                        console.log('[Samsung Player] Current state:', state);
                        
                        // Close player if it's in any state except NONE or IDLE
                        if (state !== 'NONE' && state !== 'IDLE') {
                            console.log('[Samsung Player] Closing player to reset state');
                            webapis.avplay.stop();
                            webapis.avplay.close();
                        }
                    } catch (stateError) {
                        // If we can't get state, try to close anyway
                        console.log('[Samsung Player] State check failed, attempting close:', stateError);
                        try {
                            webapis.avplay.close();
                        } catch (e) {
                            // Ignore close errors
                        }
                    }
                    
                    // Open new stream
                    console.log('[Samsung Player] Opening stream');
                    webapis.avplay.open(url);
                    
                    // Set up event listeners
                    var listener = {
                        onbufferingstart: function() {
                            if (!active() || paused || failed) return;
                            console.log('Buffering started');
                            self.onBuffering && self.onBuffering();
                        },
                        onbufferingcomplete: function() {
                            if (!active() || paused || failed) return;
                            console.log('Buffering complete');
                            self.onReady && self.onReady();
                        },
                        onstreamcompleted: function() {
                            if (!active() || paused || failed) return;
                            console.log('Stream completed');
                            self.onEnded && self.onEnded();
                        },
                        oncurrentplaytime: function(currentTime) {
                            if (!active() || paused || failed) return;
                            self.onTimeUpdate && self.onTimeUpdate(currentTime / 1000);
                        },
                        onerror: function(eventType) {
                            console.error('AVPlay error:', eventType);
                            fail(eventType);
                        }
                    };
                    
                    webapis.avplay.setListener(listener);
                    
                    // Prepare and play — with a WATCHDOG. On some slow/dead HTTP
                    // streams (e.g. raw-IP Turkish stations) prepareAsync() neither
                    // resolves nor errors, leaving the player hung (no onPlay AND no
                    // onError) so it looks like "nothing plays". The 15s watchdog turns
                    // that silent hang into an onError, so the app's existing retry
                    // chain (3 attempts) kicks in instead of stalling forever.
                    self._watchdog = setTimeout(function() {
                        if (!active() || paused || settled || failed) return;
                        // Before declaring a timeout, verify the player isn't
                        // actually PLAYING. Samsung sometimes starts playback
                        // without firing the prepareAsync success callback; killing
                        // a stream that is in fact playing was the real cause of
                        // "Super Fm cuts out after 15s and retries".
                        var liveState = 'UNKNOWN';
                        try { liveState = webapis.avplay.getState(); } catch (e) {}
                        if (liveState === 'PLAYING' || liveState === 'READY') {
                            console.log('[Samsung Player] Watchdog: state is ' + liveState + ' — stream is fine, NOT erroring');
                            settled = true;
                            self._watchdog = null;
                            self.isPlaying = (liveState === 'PLAYING');
                            self.onPlay && self.onPlay();
                            return;
                        }
                        settled = true;
                        self._watchdog = null;
                        console.error('[Samsung Player] prepareAsync timeout (15s) — treating as error');
                        try { webapis.avplay.stop(); webapis.avplay.close(); } catch (e) {}
                        fail('PREPARE_TIMEOUT');
                    }, 15000);

                    webapis.avplay.prepareAsync(function() {
                        if (!active() || paused || settled || failed) return;
                        settled = true;
                        if (self._watchdog) { clearTimeout(self._watchdog); self._watchdog = null; }
                        webapis.avplay.play();
                        self.isPlaying = true;
                        self.onPlay && self.onPlay();
                    }, function(error) {
                        if (!active() || paused || settled || failed) return;
                        settled = true;
                        if (self._watchdog) { clearTimeout(self._watchdog); self._watchdog = null; }
                        console.error('Prepare failed');
                        fail(error);
                    });
                    
                } catch (e) {
                    console.error('Samsung player failed');
                    fail(e);
                }
            };
            
            this.pause = function() {
                paused = true;
                if (self._watchdog) { clearTimeout(self._watchdog); self._watchdog = null; }
                try {
                    var state = webapis.avplay.getState();
                    console.log('[Samsung Player] Pause requested, current state:', state);
                    
                    // Only pause if currently playing
                    if (state === 'PLAYING') {
                        webapis.avplay.pause();
                        self.isPlaying = false;
                        self.onPause && self.onPause();
                        console.log('[Samsung Player] Paused successfully');
                    } else {
                        console.log('[Samsung Player] Cannot pause - not in PLAYING state, current state:', state);
                        // Still update our internal state
                        self.isPlaying = false;
                        self.onPause && self.onPause();
                    }
                } catch (e) {
                    console.error('Pause failed');
                    // Still update internal state even on error
                    self.isPlaying = false;
                    self.onPause && self.onPause();
                }
            };
            
            this.resume = function() {
                paused = false;
                try {
                    var state = webapis.avplay.getState();
                    console.log('[Samsung Player] Resume requested, current state:', state);
                    
                    // Only resume if paused
                    if (state === 'PAUSED') {
                        webapis.avplay.play();
                        self.isPlaying = true;
                        self.onPlay && self.onPlay();
                        console.log('[Samsung Player] Resumed successfully');
                    } else if (state === 'PLAYING') {
                        console.log('[Samsung Player] Already playing, no need to resume');
                        self.isPlaying = true;
                    } else {
                        console.log('[Samsung Player] Cannot resume - invalid state:', state);
                    }
                } catch (e) {
                    console.error('Resume failed');
                }
            };
            
            this.stop = function() {
                generation++;
                paused = true;
                if (self._watchdog) { clearTimeout(self._watchdog); self._watchdog = null; }
                try {
                    webapis.avplay.stop();
                    webapis.avplay.close();
                    self.isPlaying = false;
                    self.onStop && self.onStop();
                } catch (e) {
                    console.error('Stop failed');
                }
            };
            
            this.setVolume = function(vol) {
                try {
                    webapis.avplay.setStreamingProperty('SET_MODE_4K', 'false');
                    self.volume = Math.max(0, Math.min(1, vol));
                } catch (e) {
                    console.error('Volume update failed');
                }
            };
        },
        
        // LG webOS HTML5 Audio implementation
        initLGPlayer: function() {
            var self = this;
            var container = document.getElementById(this.containerId);
            
            // Create audio element
            this.audioElement = document.createElement('audio');
            this.audioElement.setAttribute('preload', 'auto');
            
            if (container) {
                container.appendChild(this.audioElement);
            }
            
            // Event listeners
            this.audioElement.addEventListener('canplay', function() {
                self.onReady && self.onReady();
            });
            
            this.audioElement.addEventListener('play', function() {
                self.isPlaying = true;
                self.onPlay && self.onPlay();
            });
            
            this.audioElement.addEventListener('pause', function() {
                self.isPlaying = false;
                self.onPause && self.onPause();
            });
            
            this.audioElement.addEventListener('ended', function() {
                self.isPlaying = false;
                self.onEnded && self.onEnded();
            });
            
            this.audioElement.addEventListener('error', function(e) {
                if (self.isStopping || !self.currentUrl) return;
                console.error('LG audio failed');
                self.onError && self.onError(e);
            });
            
            this.audioElement.addEventListener('timeupdate', function() {
                self.onTimeUpdate && self.onTimeUpdate(self.audioElement.currentTime);
            });
            
            this.audioElement.addEventListener('waiting', function() {
                self.onBuffering && self.onBuffering();
            });
            
            this.play = function(url) {
                self.currentUrl = url;
                self.audioElement.src = url;
                self.audioElement.load();
                
                var playPromise = self.audioElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(function(error) {
                        console.error('Play failed');
                        self.onError && self.onError(error);
                    });
                }
            };
            
            this.pause = function() {
                self.audioElement.pause();
            };
            
            this.resume = function() {
                var playPromise = self.audioElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(function(error) {
                        console.error('Resume failed');
                        self.onError && self.onError(error);
                    });
                }
            };
            
            this.stop = function() {
                self.isStopping = true;
                self.audioElement.pause();
                self.audioElement.removeAttribute('src');
                self.audioElement.load();
                self.isPlaying = false;
                self.currentUrl = '';
                setTimeout(function() { self.isStopping = false; }, 100);
                self.onStop && self.onStop();
            };
            
            this.setVolume = function(vol) {
                self.volume = Math.max(0, Math.min(1, vol));
                self.audioElement.volume = self.volume;
            };
        },
        
        // Web Browser HTML5 Audio implementation
        initWebPlayer: function() {
            var self = this;
            var container = document.getElementById(this.containerId);
            
            console.log('[WebPlayer] Initializing HTML5 audio player');
            
            // Create audio element
            this.audioElement = document.createElement('audio');
            this.audioElement.setAttribute('preload', 'auto');
            this.audioElement.setAttribute('controls', 'true');
            this.audioElement.crossOrigin = 'anonymous';
            
            if (container) {
                container.appendChild(this.audioElement);
            }
            
            // Event listeners
            this.audioElement.addEventListener('canplay', function() {
                console.log('[WebPlayer] ✅ canplay - ready to play');
                self.onReady && self.onReady();
            });
            
            this.audioElement.addEventListener('play', function() {
                console.log('[WebPlayer] ▶️ play event fired');
                self.isPlaying = true;
                self.onPlay && self.onPlay();
            });
            
            this.audioElement.addEventListener('pause', function() {
                console.log('[WebPlayer] ⏸️ pause event fired');
                self.isPlaying = false;
                self.onPause && self.onPause();
            });
            
            this.audioElement.addEventListener('ended', function() {
                console.log('[WebPlayer] ⏹️ ended event fired');
                self.isPlaying = false;
                self.onEnded && self.onEnded();
            });
            
            this.audioElement.addEventListener('error', function(e) {
                if (self.isStopping || !self.currentUrl) return;
                var mediaErr = self.audioElement.error;
                var errorInfo = {
                    code: mediaErr ? mediaErr.code : 'N/A',
                    message: mediaErr ? mediaErr.message : 'unknown',
                    networkState: self.audioElement.networkState,
                    readyState: self.audioElement.readyState,
                    src: (self.currentUrl || '').substring(0, 120)
                };
                var codeNames = {1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED'};
                var codeName = codeNames[errorInfo.code] || 'UNKNOWN';
                console.error('[WebPlayer] Media failure:', codeName);
                console.error('[WebPlayer] 🔴 Network state:', errorInfo.networkState, '| Ready state:', errorInfo.readyState);
                console.error('[WebPlayer] Stream unavailable');
                self.onError && self.onError(e);
            });
            
            this.audioElement.addEventListener('timeupdate', function() {
                self.onTimeUpdate && self.onTimeUpdate(self.audioElement.currentTime);
            });
            
            this.audioElement.addEventListener('waiting', function() {
                console.log('[WebPlayer] ⏳ waiting/buffering...');
                self.onBuffering && self.onBuffering();
            });

            this.audioElement.addEventListener('stalled', function() {
                console.warn('[WebPlayer] ⚠️ stalled - data transfer interrupted');
            });

            this.audioElement.addEventListener('abort', function() {
                console.warn('[WebPlayer] ⚠️ abort - loading aborted');
            });

            this.audioElement.addEventListener('loadstart', function() {
                console.log('[WebPlayer] Load started');
            });
            
            this.play = function(url) {
                self.currentUrl = url;
                console.log('[WebPlayer] Play requested');
                self.audioElement.src = url;
                self.audioElement.load();
                
                var playPromise = self.audioElement.play();
                if (playPromise !== undefined) {
                    playPromise.then(function() {
                        console.log('[WebPlayer] ✅ play() promise resolved');
                    }).catch(function(error) {
                        console.error('[WebPlayer] Play request rejected');
                        self.onError && self.onError(error);
                    });
                }
            };
            
            this.pause = function() {
                self.audioElement.pause();
            };
            
            this.resume = function() {
                var playPromise = self.audioElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(function(error) {
                        console.error('Resume failed');
                        self.onError && self.onError(error);
                    });
                }
            };
            
            this.stop = function() {
                self.isStopping = true;
                self.audioElement.pause();
                self.audioElement.removeAttribute('src');
                self.audioElement.load();
                self.isPlaying = false;
                self.currentUrl = '';
                setTimeout(function() { self.isStopping = false; }, 100);
                self.onStop && self.onStop();
            };
            
            this.setVolume = function(vol) {
                self.volume = Math.max(0, Math.min(1, vol));
                self.audioElement.volume = self.volume;
            };
        },
        
        // Common methods
        getState: function() {
            return {
                isPlaying: this.isPlaying,
                url: this.currentUrl,
                volume: this.volume,
                platform: this.platform
            };
        }
    };
})();
