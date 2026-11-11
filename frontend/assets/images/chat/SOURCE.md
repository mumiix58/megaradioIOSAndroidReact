`message.svg`: original vector exported from Mega Radio Figma, file `Jf3ZOklsARouzh5Mop0rRz`, node `1339:6118`, Web/messages `vuesax/bold/message` (24 × 24). Other chat controls use vector paths matching the existing web icon set.

Radio sharing reuses `MegaMarkIcon` from `src/components/BrandIcons.tsx`, the existing original vector from `designs/radio-logo.svg`. Its standalone note/M mark was visually checked against the Mega Radio Logo page, Figma node `1226:2980`. The Figma MCP read quota was exhausted, so the frame was checked in the open Figma browser tab.

`send.svg`: reused exact existing web asset `artifacts/megaradio/public/icons/profile/feedback.svg`, with the same 45° rotation as the web chat send control. Composer style compared with the user’s Figma reference `93WU6qa5fB9HBxkXXsc9WV`, node `16:10105`; MCP context unavailable due to plan read quota.

Chat picker, emoji panel, and radio draft close controls reuse the original App Share `share/close.svg` (Figma 417:1852), rendered at its native 40×40 size. Radio favorite buttons reuse the player’s original `player/heart.svg` and `player/heart-filled.svg` paths, with the existing Mega pink selected state. No replacement glyphs are drawn.

Local preview-only portraits: `people/deniz.jpg` (randomuser.me/api/portraits/men/32.jpg), `ece.jpg` (women/44.jpg), `mert.jpg` (men/46.jpg), `lina.jpg` (women/68.jpg), `arda.jpg` (men/75.jpg), `selin.jpg` (women/65.jpg). Downloaded as static local assets for the six fictional test conversations; real members continue to use their own API avatar. Preview last-seen times are sample data, never used for real profiles.

Radio-card playback uses the same original 24×24 `mini-player/play.svg` and `mini-player/pause.svg` assets as Home, the public profile, and mini player. The generic chat triangle was removed. The native 24×24 heart is vertically aligned with playback in a shared control row; the 40×40 play disc is black.

Scrollbar reference found by searching all pages for `scroll` in Figma `93WU6qa5fB9HBxkXXsc9WV`: Page 2 / home / scroll-bar `16:4314`, 10×263. Its fixed white web track is not suitable for the requested transparent mobile treatment; the app preview uses a dynamic 3px translucent overlay that fades after scrolling, with the browser gutter hidden. Native devices retain the system indicator.

Chat radio-card invitation marks now use the original Mega vector in white. Composer emoji glyph is sized to the 44px input height. Chat avatar/name uses the existing `/user-profile` screen; local demo profiles derive sample stations from that demo conversation’s shared radio messages and never call real profile/follow APIs with demo IDs.

Jump-to-latest reuses the original `all-stations/back.svg` from the existing Figma arrow family, rotated -90° downward. Delete actions reuse Car Mode’s country tooltip: #030507 surface, 6px corners and triangular pointer, anchored to the long-pressed message with compact 44px rows. No new arrow paths were invented.

Message actions now use a 232px dark Mega contextual menu with Reply, Copy, Pin/Unpin and Delete. Delete opens participant-appropriate scope choices. Reply displays a cancellable quote above the composer and stores a validated replyToId; pins appear in a compact conversation header and can be removed. Text balloons reserve trailing inline space for the bottom-right time/read state. MaterialCommunityIcons supplies consistent outline action icons; the menu follows the supplied WhatsApp interaction reference, not a new Figma export. API migration 0045 adds reply references and shared pins; production migration/deployment has not been performed.
