const SUPPORTED_RESOLUTIONS = ['1280x720', '1920x1080'];
function createWebosManifest(source, resolution = source.resolution || '1920x1080') {
  if (!SUPPORTED_RESOLUTIONS.includes(resolution)) throw new Error('webOS resolution must be 1280x720 or 1920x1080');
  if (!source.id || !source.version) throw new Error('Missing webOS app identity/version');
  return { ...source, resolution };
}
module.exports = { createWebosManifest, SUPPORTED_RESOLUTIONS };
