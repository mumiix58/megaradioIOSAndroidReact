/** Fixed first-party HTTPS origins. Older LG firmware does not trust ISRG roots. */
export function getProductionApiOrigin(userAgent?: string): string {
  const ua = userAgent === undefined
    ? (typeof navigator === 'undefined' ? '' : navigator.userAgent)
    : userAgent;
  const chrome = /Chrome\/(\d+)/.exec(ua);
  // Official LG generations: webOS 3.x uses Chromium 38; 4.x uses Chromium 53. Modern TVs keep the
  // existing API origin. Never accept an origin from a query, storage or server.
  if (/web[o0]s/i.test(ua) && chrome && (chrome[1] === '38' || chrome[1] === '53')) {
    return 'https://themegaradio.com';
  }
  return 'https://api.themegaradio.com';
}
