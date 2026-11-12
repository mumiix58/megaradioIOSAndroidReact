const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const images = path.join(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview/public/images');
test('native Chromium38 sidebar and brand vectors have directly parseable visible colors', () => {
  for (const name of ['radio-icon','music-icon','search-icon','heart-icon','globe-icon','path-8']) {
    const svg = fs.readFileSync(path.join(images, name+'.svg'),'utf8');
    // Old SVG engines ignore var() presentation attributes even if they have a
    // fallback; with root fill=none that silently hides every painted path.
    const shapes = [...svg.matchAll(/<path\b[^>]*\bfill="([^"]+)"/g)];
    assert.ok(shapes.length, name+' must retain painted vector paths');
    for (const shape of shapes) {
      assert.equal(shape[1], name==='path-8' ? '#FF4199' : 'white', name+' default appearance');
    }
    assert.doesNotMatch(svg,/\b(?:fill|stroke)="[^"]*var\(/, name+' requires no CSS variable support');
    assert.match(svg,/viewBox="[^"]+"/);
  }
});
