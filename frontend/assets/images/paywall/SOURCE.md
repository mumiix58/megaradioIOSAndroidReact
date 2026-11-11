# Premium paywall quality

Reference: Figma `93WU6qa5fB9HBxkXXsc9WV`, premium-paywall `1:2210` (375×812), verified 2026-11-09.

- `hero.svg`: original photo layer `1:2214` inside Frame244 `1:2213`, exported directly as SVG. The 375×415 crop retains the original embedded 1500×1000 photo; the old hero.png flattened it to375×415. No AI replacement or upscaling. Existing layout, fade and cropping behavior are retained.
- Brand icon reuses `../home/premium.svg`, original Figma vector music icon, displayed50×50. Its original texture is220×220, while the music shape and gradients are vector.
- Close and feature checkmarks are vector icon-font glyphs. Plan rings/dots, button fills and fade are rendered in code rather than raster images.

Remove-ads mode and purchase/restore behavior are unchanged.
