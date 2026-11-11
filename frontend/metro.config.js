// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Enable package.json exports field resolution (for flowalive-analytics/expo etc.)
config.resolver.unstable_enablePackageExports = true;

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Localhost-only development relay for catalog/account reads and explicit
// signup/login/logout, avatar uploads and station votes. Opt-in only; native and production builds ignore it.
if (process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
  const https = require('node:https');
  config.server = {
    ...config.server,
    enhanceMiddleware: (metroMiddleware) => (req, res, next) => {
      // Canvas color sampling needs a same-origin image in the browser preview.
      // Only public station-logo assets on our exact hosts are accepted; no credentials.
      if (req.url.startsWith('/__preview-logo?')) {
        const invalid = () => { res.writeHead(400); res.end(); };
        let image;
        try { image = new URL(new URL(req.url, 'http://localhost:8081').searchParams.get('url')); } catch { return invalid(); }
        const allowed = image.protocol === 'https:' && !image.port && !image.username && !image.password &&
          ((image.hostname === 'megaradio-station-logos.s3.eu-north-1.amazonaws.com' && /^\/station-logos\/[a-zA-Z0-9_/-]+\.(?:webp|png|jpe?g)$/.test(image.pathname)) ||
          (image.hostname === 'themegaradio.com' && /^\/(?:station-images|station-logos)\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g)$/.test(image.pathname)));
        if (req.method !== 'GET' || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') || !allowed) return invalid();
        const upstream = https.get(image, { timeout: 8000 }, response => {
          if (response.statusCode !== 200 || !/^image\//.test(response.headers['content-type'] || '')) { response.resume(); return invalid(); }
          res.writeHead(200, { 'Content-Type': response.headers['content-type'], 'Cache-Control': 'public, max-age=86400' });
          let size = 0;
          response.on('data', chunk => { size += chunk.length; if (size > 524288) { response.destroy(); res.destroy(); } });
          response.pipe(res);
        });
        upstream.on('timeout', () => upstream.destroy());
        upstream.on('error', () => { if (!res.headersSent) invalid(); else res.destroy(); });
        return;
      }
      if (!req.url.startsWith('/__preview-api/')) return metroMiddleware(req, res, next);
      const route = new URL(req.url.replace('/__preview-api', ''), 'https://api.themegaradio.com');
      const publicRoute = /^\/api\/(?:stations(?:\/|$)|station\/|now-playing\/[a-zA-Z0-9_-]+$|genres(?:\/|$)|filters\/|countries$|translations\/|app\/(?:info|pages)$|tv\/init$|location$|public-profiles$|community-favorites$|users\/[^/]+\/favorites$|user-profile\/)/;
      const accountRead = /^\/api\/(?:auth\/(?:me|mobile\/me)|user\/(?:favorites(?:\/check\/[^/]+)?|notifications|followers\/[^/]+|following\/[^/]+|is-following\/[^/]+)|user-engagement\/connections\/(?:followers|following)|recently-played)$/.test(route.pathname);
      const accountWrite = (req.method === 'POST' && /^\/api\/auth\/(?:signup|mobile\/login|mobile\/logout)$/.test(route.pathname) || req.method === 'PUT' && route.pathname === '/api/auth/profile') && req.headers.origin === 'http://localhost:8081';
      const favoriteWrite = req.headers.origin === 'http://localhost:8081' && ((req.method === 'POST' && route.pathname === '/api/user/favorites') || (req.method === 'DELETE' && /^\/api\/user\/favorites\/[a-zA-Z0-9_-]+$/.test(route.pathname)));
      const connectionWrite = req.headers.origin === 'http://localhost:8081' && ((req.method === 'POST' && /^\/api\/user\/follow\/[a-zA-Z0-9_-]+$/.test(route.pathname)) || (req.method === 'DELETE' && /^\/api\/user\/unfollow\/[a-zA-Z0-9_-]+$/.test(route.pathname)) || (req.method === 'POST' && /^\/api\/user-engagement\/remove-follower\/[a-zA-Z0-9_-]+$/.test(route.pathname)));
      const chatRead = /^\/api\/messages\/(?:conversations|contacts|unread-count|ws-ticket|conversation\/[a-f0-9]{24}|groups(?:\/[a-f0-9]{24}(?:\/messages)?)?)$/.test(route.pathname);
      const chatWrite = req.headers.origin === 'http://localhost:8081' && req.method === 'POST' && /^\/api\/messages\/(?:send|upload-image|upload-audio|listening|delete|pin|groups(?:\/[a-f0-9]{24}\/(?:respond|messages|leave|role|photo))?)$/.test(route.pathname);
      const preferencesWrite = req.headers.origin === 'http://localhost:8081' && req.method === 'PATCH' && route.pathname === '/api/user/notification-settings';
      const avatarWrite = req.method === 'POST' && route.pathname === '/api/user/avatar' && req.headers.origin === 'http://localhost:8081' && /^multipart\/form-data;.*boundary=/i.test(req.headers['content-type'] || '');
      const voteWrite = req.method === 'POST' && /^\/api\/stations\/[a-zA-Z0-9_-]+\/(?:vote|rate)$/.test(route.pathname) && req.headers.origin === 'http://localhost:8081';
      if (!(req.method === 'GET' && (publicRoute.test(route.pathname) || accountRead || chatRead || route.pathname === '/api/user/notification-settings') || accountWrite || avatarWrite || voteWrite || connectionWrite || favoriteWrite || chatWrite || preferencesWrite) || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'This operation is not available in the preview' }));
      }
      const headers = { Accept: 'application/json' };
      if (req.headers['x-api-key']) headers['X-API-Key'] = req.headers['x-api-key'];
      if (req.headers.authorization) headers.Authorization = req.headers.authorization;
      if (accountWrite || voteWrite || connectionWrite || favoriteWrite || chatWrite || preferencesWrite) headers['Content-Type'] = 'application/json';
      if (avatarWrite || chatWrite && /multipart/i.test(req.headers['content-type'] || '')) headers['Content-Type'] = req.headers['content-type'];
      const upstream = https.request(route, { method: req.method, headers, timeout: 15000 }, (response) => {
        res.writeHead(response.statusCode, {
          'Content-Type': response.headers['content-type'] || 'application/json',
          'Cache-Control': 'no-store',
        });
        response.pipe(res);
      });
      upstream.on('timeout', () => upstream.destroy(new Error('Preview request timed out')));
      upstream.on('error', () => {
        if (res.writableEnded) return;
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Catalog unavailable' }));
      });
      req.on('aborted', () => upstream.destroy());
      if (accountWrite || avatarWrite || voteWrite || connectionWrite || favoriteWrite || chatWrite || preferencesWrite) {
        let size = 0;
        let tooLarge = false;
        const maxSize = (avatarWrite || chatWrite) ? 8 * 1024 * 1024 + 65536 : 65536;
        req.on('data', chunk => {
          if (tooLarge) return;
          size += chunk.length;
          if (size > maxSize) { tooLarge = true; upstream.destroy(); if (!res.headersSent) res.writeHead(413); res.end(); return; }
          upstream.write(chunk);
        });
        req.on('end', () => { if (!tooLarge) upstream.end(); });
      } else upstream.end();
    },
  };
}

module.exports = config;
