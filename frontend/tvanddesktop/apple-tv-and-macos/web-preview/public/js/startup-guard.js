(function () {
    // No network required; a syntax/runtime failure must not leave an endless splash.
    var timer;
    function ready() {
        if (timer) clearTimeout(timer);
        window.__MR_APP_READY__ = true;
    }
    document.addEventListener('megaradio-ready', ready);
    function failed() {
        if (window.__MR_APP_READY__) return;
        try { if (window.MRTVTelemetry) window.MRTVTelemetry.emit('startup_error','startup_timeout',{module:'startup'}); } catch (_) {}
        if (typeof window.__MR_BOOT_FALLBACK__ === 'function') { window.__MR_BOOT_FALLBACK__(); return; }
        var root = document.getElementById('root');
        if (!root) return;
        root.innerHTML = '<div data-testid="tv-startup-error" style="padding:160px 120px;color:#fff;font:28px Arial;text-align:center">' +
            '<h1>MegaRadio could not start</h1><p data-testid="tv-startup-error-code">TV_STARTUP_TIMEOUT</p>' +
            '<p>Please retry. If the issue continues, report this code with your TV model.</p>' +
            '<button data-testid="tv-startup-retry" style="padding:22px 48px;background:#ff4199;color:white;border:3px solid white;font-size:26px">Try again</button></div>';
        var retry = root.querySelector('[data-testid="tv-startup-retry"]');
        retry.onclick = function () { window.location.reload(); };
        retry.focus();
        document.addEventListener('keydown', function (event) {
            if (event.keyCode === 13) { event.preventDefault(); event.stopImmediatePropagation(); retry.click(); }
        }, true);
    }
    if (!window.__MR_APP_READY__) timer = setTimeout(failed, 25000);
})();