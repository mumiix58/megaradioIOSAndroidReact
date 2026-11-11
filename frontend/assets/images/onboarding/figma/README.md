# Figma exports
Source file Jf3ZOklsARouzh5Mop0rRz, App page, 10 November 2026.

- splash.svg / splash-native.png: 2:2, 375×812, native launch composition. PNG rendered at 3x from exported SVG using sharp.
- splash-background.svg / .png: 1771:5779 Group 4, visual export bounds 375×681 at splash y131 (includes blur bounds).
- splash-rings.png: 46:544 waves, 252×252 at x62/y280, 3x.
- splash-wordmark.png: 2:11 logo, 201.9236×70 at x87/y374, 3x.
- next.png: onboard-1 btn, 58×58 at x159/y680, 3x.
- photo-1.png: 40:20 visible young-woman layer, parent-clipped export 375×752, 3x.
- photo-2.png: onboard-2 image group, 375×812, 3x.
- photo-3.png: onboard-3 image group, 375×812, 3x.

Onboarding screen reference exports are not implementation assets. Native text, controls, gradient and pagination are implemented in app/onboarding.tsx.

2026-11-10: splash-pattern.svg/png and splash-ambient.svg/png split the original splash-background.svg groups without redrawing paths. Pattern is rendered beneath the original fixed ambient glow, preserving compositing order. Only the pattern sways ±1.8px horizontally, ±2.4px vertically and ±0.3° over 8.4s. Native-driver animation respects Reduce Motion.

Superseded rigid sway: dot motion now lives in SplashClothPattern.tsx with original 266 path strings in src/constants/splashPatternDots.json. Left and bottom edges are pinned, and each dot receives a spatially phased deformation. Static source SVGs remain unchanged.

2026-11-10: next-arrow.svg exported unchanged from onboard-1's34×34 Frame40:8 (inside58×58 btn, x12/y12). Used separately so the arrow can fly without scaling the button.
