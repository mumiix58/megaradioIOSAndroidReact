const SUPPORTED_RESOLUTIONS = ['1280x720', '1920x1080'];
function createWebosManifest(source, resolution = source.resolution || '1920x1080') {
  if (!SUPPORTED_RESOLUTIONS.includes(resolution)) throw new Error('webOS resolution must be 1280x720 or 1920x1080');
  if (!source.id || !source.version) throw new Error('Missing webOS app identity/version');
  if (source.appDescription !== undefined && (typeof source.appDescription !== 'string' || Array.from(source.appDescription).length > 60)) throw new Error('webOS appDescription must be a tagline of at most 60 characters');
  return { ...source, resolution };
}
module.exports = { createWebosManifest, SUPPORTED_RESOLUTIONS };
