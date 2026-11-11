App final Figma: https://www.figma.com/design/93WU6qa5fB9HBxkXXsc9WV/Megaradio?node-id=1-3957

Chromecast: vuesax/outline/mirroring-screen (1:4084), 24 × 24. Matching original Iconsax outline asset: https://github.com/lusaxweb/iconsax/blob/master/static/Iconsax/Svg/All/outline/mirroring-screen.svg
Lock: vuesax/bold/unlock (1:3990), existing original 24 × 24 SVG.
REC omitted for first release.

Player continuous backdrop: original App station-playing 1677:4627 / bg-gradient1677:4632. Export root844×844 positioned(-234,-172); same image covers status and header. Header black15% at90%opacity = alpha0.135.

Error states (Figma inspected in browser, MCP quota unavailable): no-connect 1:4332 (229×201 card, 12.75 radius, black42%; icon102 at64,49; message Ubuntu Medium20/23), radio-is-break-or-dontwork 1:4199 (255×255 card, same fill/radius; icon102 at77,55; message1:4203 Ubuntu Medium14/16 at y177). Existing broadcast.png is the matching original102×102 antenna asset. Final player controls retained.

Scroll behavior verified in current Figma station-playing1:3957 (375×1691): designer annotations "Important!! Approx viewport" and "The redline on the screen is viewport"; header/player are FIXED, bg-gradient1:3958 is under SCROLLS with radio-logo and lists. The original backdrop now tracks content offset1:1 as on Home, leaving the lower catalog on the flat base color. Header remains fixed; browser preview status background follows the same offset.

Playback controls refreshed from current Figma 93WU6qa5fB9HBxkXXsc9WV, station-playing1:3957 (2026-11-09).
MCP design-context quota was exhausted; original SVG files were exported through Figma's Properties panel, with no path edits or raster conversion.
- pause.svg: vuesax/bold/pause1:3963, native42×42.
- previous.svg: vuesax/bold/previous1:3967, native30×30; next.svg: vuesax/bold/next1:3965, native30×30. Used at30px inside existing50px controls.
- timer.svg: vuesax/outline/clock1:3970, native24×24.
- heart.svg: vuesax/outline/heart1:3969, native24×24. Selected state reuses original mini-player heart-filled.svg (Jf3ZOklsARouzh5Mop0rRz /139:658); existing pink favorite tint retained.
- share.svg: Frame2801:3993 (vector1:3994), native24×24.
- play.svg: Frame601:3875, native24×24, original white play vector from the same Figma file; rendered in the existing42px main playback slot with aspect ratio preserved.
All eight SVG files contain vector paths and no embedded raster images. Existing button hit areas and playback/timer/favorite/share callbacks are preserved.

Social/header quality pass (2026-11-09), same Figma file, direct original SVG exports via Properties (MCP quota still exhausted):
spotify.svg: Spotify1:3978 (30×30); youtube.svg: Youtube1:3980 (30×30).
collapse.svg: arrow-circle-up1:4095 (24×24, existing180° rotation in design); car.svg: Frame1:4104 (26×26); more.svg: more1:4099 (24×6); hd.svg: Frame2481:4101 (26×16, original gradient and outlined HD lettering).
PlayerEqualizer.tsx matches equ1:3975: container19×20, Frame123 width5/height20, Frame124 width5/height14/top6/left7, Frame125 width5/height17/top3/left14; gaps2, radius10, fill#FF4199. Dynamic rounded bars are code-native views, with Reanimated UI-thread height animation, cancellation on stop/unmount, exact resting geometry, and reduced-motion support. Removed the old JS-driven Animated timing loop.
Existing premium mark is52×52 rendered30px; station logos and country flags remain API-driven. No changes to playback, metadata or external platform search targets.

Error icon quality pass (2026-11-09): broadcast.svg is the unmodified original Frame1:4200, exported from radio-is-break-or-dontwork in Figma93WU6qa5fB9HBxkXXsc9WV via Properties. Native102×102; visible vector1:4202 is80.76×81.67 at10.62,11.83, fill#CBCBCB. Replaces broadcast.png in radio failure and offline states (102px) and mini-player failure (36px, existing pink tint retained). Contains vector paths only, no embedded raster.

External song search additions (2026-11-09): Apple Music and SoundCloud join Spotify and YouTube in that order (Spotify, Apple Music, YouTube, SoundCloud). Apple Music uses the unchanged official small RGB SVG (native73×73, displayed30×30) from AppleMusic_Icon_2020 / Apple_Music_Icon_RGB_sm_073120.svg, linked by https://marketing.services.apple/apple-music-identity-guidelines to https://apple.co/am-icon-2020. Preserves Apple's original rounded-square artwork. SoundCloud uses the official current7-bar black-on-orange app icon512×512 from https://soundcloud.com/assets/cloudmark-white.png-6a1ed18a045f.png, linked by https://soundcloud.com/company/media-kit, displayed30×30 in a circular slot to match the existing social row. No generated or redrawn logos. HTTPS search links pass only URI-encoded current track text; no platform playback SDK, API token, or catalog requests added. Buttons share metadata gating,44px effective hit areas and EN/TR/DE search labels.

Platform recognition refinement (2026-11-09): Apple Music keeps the unmodified official color SVG; all four platform icons now have10px Ubuntu name captions, with equal58px-wide slots/12px gaps and30px icon slots. SoundCloud replaces the orange favicon with the unmodified official white transparent favicon from https://soundcloud.com/assets/Favicon_Colors_white__transparent__-_download.webp (148×142, linked by the official media kit), rendered42×40 (including the official asset’s transparent inset) in a#121212 circular30px slot so the visible cloud matches the neighboring glyph widths. No orange, no tint, no regenerated logos. Search targets and ordering unchanged.

Final platform row refinement (2026-11-09): removed all visible platform-name captions at the user's request. Apple Music uses its complete native144×27 vector wordmark (Apple symbol + music), taken unchanged from the official music.apple.com/us/new header logo SVG, rendered88×30 with contain and white tint for the dark player. This replaces the ambiguous standalone music-note app icon. Spotify/YouTube/SoundCloud retain30px slots;16px gaps; all search accessibility labels, metadata gating and URLs preserved. SoundCloud remains white on dark.

Compact wordmark adjustment: Apple Music slot reduced from88px to58px, preserving the original vector aspect ratio and30px vertical alignment with the other platform buttons.

Apple symbol simplification at user request: the Apple Music button now displays only Ionicons logo-apple (scalable font glyph,26px white in the same30px slot as its neighbors). The visible music wordmark is removed; the Apple Music search accessibility label and destination remain intact.

Player options menu: added Apple Music and SoundCloud in the same Spotify/Apple/YouTube/SoundCloud order, using the final white Apple glyph and white SoundCloud mark. Menu expanded to515px plus bottom inset (bounded below top safe area) for six actions. Shares track availability gating and existing close-before-action lifecycle; browser clicks verified both correctly encoded platform destinations.

Inline control lock (user-directed variation): inspected the actual Figma screen-looked2293:8640 (375×812) and confirmed it is the former blocking Screen Locked dialog. User requested replacing it with a temporary notice. Original lock component variants exported unchanged: unlock.svg2293:8629 (24×24 white) and locked-pink.svg2293:8634 (24×24,#FF4199). The existing row button toggles between them; a translated Locked/Unlocked notice disappears after1400ms without dimming or covering the player.
All other player actions, station cards and vote submission are disabled while locked, while playback/equalizer/metadata continue. Header drag dismissal and Android back are guarded; scrolling remains available so the unlock control stays reachable after orientation/size changes. Unlock uses the same button and restores normal disabled conditions (loading/favorite request/metadata). Timers are replaced on rapid toggles and cleared on unmount; offline or removed-station states release the lock so the control cannot vanish while locked.
Verified live Virgin Radio playback continuing during lock, play/share/vote disabled, notice disappearing while lock remains active, eight rapid toggles, and normal controls restored after unlock. Existing Figma modal styles/Modal removed from player; preview status bar no longer dims for locked state.

2026-11-10: Figma139:658 (vuesax/bold/heart24px) browser-verified again; MCP quota exhausted. Preserve the exact original vector. Selected player favorite uses expo-image tintColor PROP #FF4199, not style.tintColor (ignored by web). The gray source is the inactive navigation artwork; runtime selected tint is explicit.


2026-11-10: Figma93WU6qa5fB9HBxkXXsc9WV /1:4199 rechecked through design context. Radio-error255px reference geometry now adapts to the exact responsive artwork slot in app/player.tsx, preventing failure transitions from pushing title/controls down. The original102px broadcast.svg canvas is preserved and uniformly transformed; text stays Ubuntu Medium14/16. Offline229×201 variation unchanged.

2026-11-10 logo-size verification: current user reference Jf3ZOklsARouzh5Mop0rRz /App station-playing2294:8820 is375×1691. Browser Properties confirms radio-logo183×183,left96,top127,radius9.15; cropped inner bitmap190.18×190.18,left/top-3.59. The unrelated1677:4627 short812px variant uses larger artwork. App player now preserves183/375 ratio on430px phones (209.84px), removing the shared hook's190px cap. Shared error/loading slot follows exactly.

2026-11-10 sleep timer: current Figma App alarm312:601/action-sheet312:606 and counter1677:4600 browser-verified. Panel375×542,y270,black#000,radius20; button166×50,x105,y429,radius30; Ubuntu Bold36 numbers/clock and Medium14 explanation. Compact upper player reuses unmodified collapse/heart/more vectors and104px API artwork; equalizer accepts a green variant while normal player keeps pink. One modal owns setup/counter; opening no longer moves the underlying full-player layout.

2026-11-10 user-requested lock notice restoration: browser-verified current screen-looked2293:8640 and child dialog (302×170, radius6, black#000, stroke#292929). The centered pink-lock dialog now appears only when locking, auto-dismisses after2200ms, and dismisses immediately on background tap. Dismissing does not unlock; the existing pink lock toggle stays selected and controls remain disabled until explicitly unlocked. Unlock keeps the short existing inline confirmation. No asset changes.
