const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview/public');
const originals={
 300:['Ubuntu-L.ttf','b7ec9b9f7cf293ecbc832e998ca4a802adeceb77c661c43ebd23eba1adc3e584'],
 400:['Ubuntu-R.ttf','52c1afa489ae7bfd893af6cdd9f1af258005703600449e70d338caabcff507e5'],
 500:['Ubuntu-M.ttf','e801a0867295367000c6dd3c337622ae4aaff85786ddbfbdb985ce774fe3cd62'],
 700:['Ubuntu-B.ttf','c90e629e932f768909bdce1481ccd259d8aff1490a4bc1cf94d5413492317336'],
};
test('every Ubuntu subset keeps WOFF2 preferred and supplies the correct original TrueType weight',()=>{
 const css=fs.readFileSync(path.join(root,'css/tv-styles.css'),'utf8');
 const faces=css.match(/@font-face\{[^}]+\}/g);assert.equal(faces.length,12);
 const subsets=faces.filter(face=>face.includes('format("woff2")'));assert.equal(subsets.length,8);
 for(const face of subsets){
  const weight=face.match(/font-weight:(\d+)/)[1];
  const urls=[...face.matchAll(/url\("([^"]+)"\) format\("([^"]+)"\)/g)];
  assert.equal(urls.length,2);assert.equal(urls[0][2],'woff2');assert.equal(urls[1][2],'truetype');
  assert.ok(urls[0][1].includes('ubuntu-'+weight+'-latin'));
  assert.equal(urls[1][1],'../fonts/'+originals[weight][0]);
  assert.match(face,/font-family:"Ubuntu";font-style:normal/);assert.match(face,/unicode-range:/);
  for(const u of urls)assert.ok(fs.statSync(path.resolve(root,'css',u[1])).size>0,'resolvable package-relative font');
 }
});
test('fallback font bytes are unmodified Canonical originals and retain bundled notices',()=>{
 for(const [name,sha]of Object.values(originals)){
  const bytes=fs.readFileSync(path.join(root,'fonts',name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha,name+' must remain original, not a same-name format conversion');
  assert.equal(bytes.readUInt32BE(0),0x00010000);
 }
 assert.match(fs.readFileSync(path.join(root,'fonts/Ubuntu-LICENCE.txt'),'utf8'),/UBUNTU FONT LICENCE Version 1.0/);
 assert.match(fs.readFileSync(path.join(root,'fonts/Ubuntu-COPYRIGHT.txt'),'utf8'),/Canonical/);
});

test('Greek and Cyrillic use already licensed unmodified TrueType faces without overriding Latin WOFF2 priority',()=>{
 const faces=fs.readFileSync(path.join(root,'css/tv-styles.css'),'utf8').match(/@font-face\{[^}]+\}/g).filter(face=>!face.includes('format("woff2")'));
 assert.equal(faces.length,4);for(const face of faces){const weight=face.match(/font-weight:(\d+)/)[1];assert.ok(originals[weight]);assert.match(face,/unicode-range:U\+0370-03FF, ?U\+0400-052F/);assert.ok(face.includes('../fonts/'+originals[weight][0]));assert.match(face,/format\("truetype"\)/)}
});
