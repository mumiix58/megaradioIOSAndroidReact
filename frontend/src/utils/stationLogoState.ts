/** Known application placeholders are never evidence of a real station logo. */
export function isDefaultStationLogoUrl(value?: string | null): boolean {
  if (!value) return false;
  const clean=value.trim().split(/[?#]/)[0].replace(/\/$/,'');
  return /^\/?logo\.png$/i.test(clean) || /^https?:\/\/(?:www\.)?themegaradio\.com\/logo\.png$/i.test(clean)
    || /(?:^|\/)(?:default-station-logo(?:-\d+)?|no[-_]?image|no[-_]?logo|station-placeholder|figma-gray)\.(?:png|jpe?g|webp|svg)$/i.test(clean);
}
export function hasStationLogoMetadata(station:any):boolean {
  const assets=station?.logoAssets?.status==='completed'?Object.entries(station.logoAssets).filter(([key])=>/^webp\d+$/.test(key)).map(([,value])=>value):[];
  return [station?.favicon,station?.logo,station?.localImagePath,...assets].some(value=>typeof value==='string'&&value.trim()&&!isDefaultStationLogoUrl(value)&&!['null','undefined'].includes(value));
}
