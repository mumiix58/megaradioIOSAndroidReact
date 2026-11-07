// Package the existing brand artwork into Apple's required tvOS asset catalog.
// This is deterministic sizing/metadata only; the source artwork stays unchanged.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const zlib = require('zlib');
const root = path.resolve(__dirname, '../tvanddesktop/apple-tv-and-macos/ios-tvos');
const catalog = path.join(root, 'Assets.xcassets');
const brand = path.join(catalog, 'AppIcon.brandassets');
const info = { author: 'xcode', version: 1 };
function json(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify({ ...data, info }, null, 2) + '\n');
}
function resize(source, target, width, height) {
  execFileSync('sips', ['-z', String(height), String(width), path.join(root, 'Brand', source), '--out', target], { stdio: 'pipe' });
}
// Opaque background is required beneath transparent logo artwork on tvOS.
function solidPNG(width, height) {
  function crc(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) { c ^= b; for (let j=0;j<8;j++) c=(c>>>1)^((c&1)?0xedb88320:0); }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type), n=Buffer.alloc(4), c=Buffer.alloc(4);
    n.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t,data])));
    return Buffer.concat([n,t,data,c]);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  const pixels=Buffer.alloc((width*3+1)*height,14);
  for (let row=0;row<height;row++) pixels[row*(width*3+1)]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
json(catalog, {});
const assets = [];
for (const [name, width, height, source] of [
  ['Small', 400, 240, 'AppIcon-Small-400x240.png'],
  ['Large', 1280, 768, 'AppIcon-Large-2400x1440.png'],
]) {
  const stack = `${name}.imagestack`;
  const layer = path.join(brand, stack, 'Artwork.imagestacklayer');
  const imageset = path.join(layer, 'Content.imageset');
  json(path.join(brand, stack), { layers: [{ filename: 'Artwork.imagestacklayer' }, { filename: 'Background.imagestacklayer' }] });
  json(layer, {});
  const images = [];
  for (const scale of [1, 2]) {
    json(imageset, {});
    const filename = `artwork-${scale}x.png`;
    resize(source, path.join(imageset, filename), width * scale, height * scale);
    images.push({ idiom: 'tv', filename, scale: `${scale}x` });
  }
  json(imageset, { images });
  const background = path.join(brand, stack, 'Background.imagestacklayer');
  const backgroundSet = path.join(background, 'Content.imageset');
  json(background, {}); json(backgroundSet, {});
  for (const scale of [1, 2]) fs.writeFileSync(path.join(backgroundSet, `artwork-${scale}x.png`), solidPNG(width*scale,height*scale));
  json(backgroundSet, { images });
  assets.push({ idiom: 'tv', size: `${width}x${height}`, filename: stack, role: 'primary-app-icon' });
}
const topShelfImages = [];
for (const [name, width, source, role] of [
  ['TopShelf', 1920, 'TopShelf-1920x720.png', 'top-shelf-image'],
  ['TopShelfWide', 2320, 'TopShelfWide-2320x720.png', 'top-shelf-image-wide'],
]) {
  const filename = `${name}.imageset`;
  const dir = path.join(brand, filename);
  json(dir, {});
  const images = [1, 2].map(scale => {
    const image = `artwork-${scale}x.png`;
    resize(source, path.join(dir, image), width * scale, 720 * scale);
    topShelfImages.push(path.join(dir, image));
    return { idiom: 'tv', filename: image, scale: `${scale}x` };
  });
  json(dir, { images });
  assets.push({ idiom: 'tv', size: `${width}x720`, filename, role });
}
execFileSync('xcrun', ['swift', path.join(__dirname, 'flatten-tvos-images.swift'), ...topShelfImages], { stdio: 'pipe' });
json(brand, { assets });
console.log('Prepared tvOS brand asset catalog.');
