/* Opt-in TV diagnostics. ES5, no SDK, diagnostic identifiers, URLs, messages or console capture. */
(function () {
    if (window.MRTVTelemetry) return;
    function monotonicNow() {
        try { var value=window.performance && window.performance.now(); return typeof value==='number' && isFinite(value) && value>=0 ? value : null; } catch (_) { return null; }
    }
    function clock(){var value=monotonicNow();return value===null?Date.now():value;}
    var KEY = 'mr_tv_observability_consent_v1';
    var USAGE_KEY = 'mr_tv_usage_analytics_client_v1', usageClient = null, sessionId = null, engagement = 0, lastEngagement = monotonicNow(), wasVisible = document.visibilityState === 'visible';
    var ENDPOINT = 'https://api.themegaradio.com/api/tv/telemetry/events';
    var diagnostics = ['startup_error','startup_ready','js_error','promise_error','react_error','catalog_error','playback_error'];
    var usage = ['app_open','screen_view','playback_start','playback_pause'];
    var codes = ['none','startup_timeout','asset_load','syntax_error','type_error','reference_error','range_error','security_error','unknown_error','promise_rejected','render_error','http_error','network_error','request_timeout','media_aborted','media_network','media_decode','media_unsupported','playback_failed'];
    var modules = ['main','audio','startup','vendor','api','unknown'];
    var consent = { diagnostics: false, analytics: false }, queue = [], seen = {}, diagnosticCount = 0, usageCount = 0, budgetStart = clock(), cooldownUntil = 0, opened = false, timer = null, active = null, pending = null, retries = 0, stopped = false;
    function has(list, value) { return list.indexOf(value) !== -1; }
    function readConsent() {
        try { var value = JSON.parse(localStorage.getItem(KEY) || '{}'); return { diagnostics: value.diagnostics === true, analytics: value.analytics === true }; }
        catch (_) { return { diagnostics: false, analytics: false }; }
    }
    consent = readConsent();
    function clearUsageIdentity() {
        usageClient = null; sessionId = null; opened = false; engagement = 0; lastEngagement = monotonicNow();
        try { localStorage.removeItem(USAGE_KEY); } catch (_) {}
    }
    if (!consent.analytics) clearUsageIdentity();
    function usageIdentity() {
        if (!consent.analytics) return null;
        if (usageClient) return usageClient;
        try {
            var saved = localStorage.getItem(USAGE_KEY);
            if (/^tv-[a-f0-9]{32}$/.test(saved || '')) { usageClient = saved; return usageClient; }
            if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return null;
            var bytes = new Uint8Array(16), hex = ''; window.crypto.getRandomValues(bytes);
            for (var i=0;i<bytes.length;i++) hex += ('0'+bytes[i].toString(16)).slice(-2);
            usageClient = 'tv-'+hex;
            localStorage.setItem(USAGE_KEY,usageClient);
            return usageClient;
        } catch (_) { return usageClient; }
    }
    function measureEngagement() {
        var now = monotonicNow();
        var delta = now === null || lastEngagement === null ? 0 : now-lastEngagement;
        if (consent.analytics && wasVisible && delta>=0 && delta<=600000) engagement += delta;
        lastEngagement = now; wasVisible = document.visibilityState === 'visible';
    }
    function usageMetadata() {
        var client = usageIdentity(); if (!client) return null;
        measureEngagement();
        if (!sessionId) sessionId = String(Math.max(1,Math.floor(Date.now()/1000)));
        var value = {clientId:client,sessionId:sessionId,engagementTimeMsec:Math.min(600000,Math.floor(engagement))};
        engagement = 0; return value;
    }
    document.addEventListener('visibilitychange',measureEngagement);
    function platform() {
        var build = window.__MR_TV_BUILD__ || {};
        var packaged = window.__MR_TV_PACKAGE_PLATFORM__ || build.platform;
        if (packaged === 'tizen' || packaged === 'webos') return packaged;
        var ua = (navigator.userAgent || '').toLowerCase();
        if (ua.indexOf('tizen') !== -1) return 'tizen';
        if (ua.indexOf('web0s') !== -1 || ua.indexOf('webos') !== -1) return 'webos';
        return null;
    }
    function route(value) {
        var p = String(value || window.location.hash || '').replace(/^#/, '').split('?')[0];
        if (/^\/discover/.test(p) || p === '/') return 'discover';
        if (/^\/genre/.test(p)) return 'genres';
        if (/^\/country/.test(p)) return 'countries';
        if (/^\/premium|^\/manage-subscription/.test(p)) return 'premium-upgrade';
        if (/^\/login|^\/account|^\/profile/.test(p)) return 'login';
        var result = p.replace(/^\//, '');
        return has(['search','radio-playing','settings','favorites'], result) ? result : 'other';
    }
    function allowed(item) { return has(diagnostics, item.event) ? consent.diagnostics : consent.analytics; }
    function codeFor(error) {
        var name; try { name = error && error.name; } catch (_) { return 'unknown_error'; }
        return ({TypeError:'type_error',ReferenceError:'reference_error',SyntaxError:'syntax_error',RangeError:'range_error',SecurityError:'security_error'})[name] || 'unknown_error';
    }
    function schedule(delay) { if (!timer && !active && (queue.length || pending) && !stopped && clock() >= cooldownUntil) timer = setTimeout(function () { timer = null; flush(); }, delay); }
    function versions() {
        var build = window.__MR_TV_BUILD__ || {};
        var app = window.__MR_STORE_APP_VERSION__ || build.appVersion || '0.0.0';
        var bundle = build.bundleVersion || 'unknown';
        if (!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(app) || app.length > 20) app = '0.0.0';
        if (!(bundle.length <= 64 && (/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(bundle) || /^gha-\d{1,16}-\d{1,4}-[a-f0-9]{7,40}$/.test(bundle) || /^local-[a-f0-9]{7,40}$/.test(bundle) || /^\d{8,20}$/.test(bundle)))) bundle = 'unknown';
        return { appVersion: app, bundleVersion: bundle };
    }
    function emit(event, code, context) {
        try {
            if (stopped || (!has(diagnostics,event) && !has(usage,event))) return;
            var now = clock(), isDiagnostic = has(diagnostics,event);
            if(isDiagnostic ? !consent.diagnostics : !consent.analytics)return;
            if(now < cooldownUntil)return;
            if(cooldownUntil){cooldownUntil=0;retries=0;}
            if(now-budgetStart>=3600000||now<budgetStart){budgetStart=now;diagnosticCount=0;usageCount=0;seen={};}
            if(isDiagnostic ? diagnosticCount>=50 : usageCount>=200)return;
            if(event==='app_open'&&opened)return;
            var item = { event: event, code: has(codes,code) ? code : 'unknown_error', route: route(context && context.route) };
            if (!allowed(item)) return;
            if (context && has(modules,context.module)) item.module = context.module;
            // Numbers only, never filenames, stack strings or error messages.
            if (context && typeof context.line === 'number' && isFinite(context.line)) item.line = Math.max(0,Math.min(10000000,Math.floor(context.line)));
            if (context && typeof context.column === 'number' && isFinite(context.column)) item.column = Math.max(0,Math.min(10000000,Math.floor(context.column)));
            var key = item.event + ':' + item.code + ':' + item.route + ':' + (item.module||'unknown') + ':' + (item.line||0) + ':' + (item.column||0);
            if (has(diagnostics,event)) {
                if (seen[key] !== undefined && clock() - seen[key] < 60000) return;
                seen[key] = clock();
            }
            if (queue.length >= 10) return;
            if(isDiagnostic)diagnosticCount++;else usageCount++;
            if(event==='app_open')opened=true;
            queue.push(item); schedule(1500);
        } catch (_) {}
    }
    function batchNonce() {
        try {
            if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
                var bytes = new Uint8Array(16), hex = ''; window.crypto.getRandomValues(bytes);
                for(var i=0;i<bytes.length;i++)hex+=('0'+bytes[i].toString(16)).slice(-2);
                return 'b-'+hex;
            }
        } catch (_) {}
        // Request deduplication nonce only: never an identity or auth credential.
        var fallback='';for(var n=0;n<32;n++)fallback+=Math.floor(Math.random()*16).toString(16);
        return 'b-'+fallback;
    }
    function pendingAllowed() { return !pending || (pending.usage ? consent.analytics : consent.diagnostics); }
    function dropRevoked() {
        queue = queue.filter(allowed);
        if (!pendingAllowed()) {
            pending = null;
            if(active){try{active.abort();}catch(_){}active=null;}
            retries = 0;
        }
    }
    function flush() {
        if (active || stopped || clock()<cooldownUntil) return;
        dropRevoked();
        if (!pending) {
            var plat = platform();
            if (!queue.length || !plat) { queue = []; return; }
            var usageBatch = has(usage,queue[0].event), batch = [], remaining = [], version = versions();
            var nonce = batchNonce();
            if (!nonce) { queue = []; return; }
            for (var q=0;q<queue.length;q++) {
                if (has(usage,queue[q].event) === usageBatch && batch.length < 10) batch.push(queue[q]); else remaining.push(queue[q]);
            }
            queue = remaining;
            var payload = {batchId:nonce,platform:plat,appVersion:version.appVersion,bundleVersion:version.bundleVersion,consent:{diagnostics:consent.diagnostics,analytics:consent.analytics},events:batch};
            if(usageBatch){var metadata=usageMetadata();if(metadata)payload.analytics=metadata;}
            pending = {body:JSON.stringify(payload),usage:usageBatch,count:batch.length};
        }
        var request = pending, xhr;
        try {
            xhr = new XMLHttpRequest(); active = xhr;
            xhr.open('POST',ENDPOINT,true);xhr.withCredentials=false;xhr.timeout=5000;
            xhr.setRequestHeader('Content-Type','application/json');
            var finished=false;
            function finish(ok){
                if(finished)return;finished=true;active=null;
                if(ok){pending=null;retries=0;}
                else{retries++;if(retries>=3||stopped){if(!stopped)cooldownUntil=clock()+300000;pending=null;queue=[];}}
                schedule(ok?1500:Math.min(30000,3000*Math.pow(2,retries)));
            }
            xhr.onload=function(){if(xhr.status>=400&&xhr.status<500&&xhr.status!==429){stopped=true;queue=[];}finish(xhr.status>=200&&xhr.status<300);};
            xhr.onerror=xhr.ontimeout=function(){finish(false);};
            xhr.onabort=function(){if(!finished){finished=true;active=null;}};
            // Retry keeps this exact serialized body, including its one-time nonce.
            xhr.send(request.body);
        }catch(_){active=null;retries++;if(retries<3)schedule(6000);else{cooldownUntil=clock()+300000;pending=null;queue=[];}}
    }
    function setConsent(value) {
        var previouslyAnalytics = consent.analytics;
        measureEngagement();
        consent = { diagnostics:value.diagnostics === true, analytics:value.analytics === true };
        if (consent.analytics) usageIdentity(); else clearUsageIdentity();
        try { localStorage.setItem(KEY,JSON.stringify(consent)); } catch (_) {}
        dropRevoked();
        if (timer) { clearTimeout(timer); timer = null; }
        if (!consent.diagnostics && !consent.analytics) { queue = []; seen = {}; }
        if(!pending)retries=0;
        if (consent.analytics && !previouslyAnalytics && window.__MR_APP_READY__) emit('app_open','none',{module:'main'});
        schedule(1500);
        return {diagnostics:consent.diagnostics,analytics:consent.analytics};
    }
    window.MRTVTelemetry = { supported:function(){return platform() !== null;}, emit:emit, flush:flush, codeFor:codeFor, getConsent:function(){return {diagnostics:consent.diagnostics,analytics:consent.analytics};}, setConsent:setConsent };
    window.addEventListener('storage',function(e){ if(e.key === KEY) { consent = readConsent(); if(!consent.analytics)clearUsageIdentity(); dropRevoked(); } });
    window.addEventListener('error',function(e){if(!consent.diagnostics)return;emit('js_error',e.error ? codeFor(e.error) : 'asset_load',{module:e.error?'main':'vendor',line:e.lineno,column:e.colno});},true);
    window.addEventListener('unhandledrejection',function(e){if(!consent.diagnostics)return;emit('promise_error',codeFor(e.reason),{module:'main'});});
    document.addEventListener('megaradio-ready',function(){emit('startup_ready','none',{module:'startup'});emit('app_open','none',{module:'main'});});
})();
