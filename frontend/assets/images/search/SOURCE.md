# Search result playback controls

Verified against App → search in Figma `Jf3ZOklsARouzh5Mop0rRz` on 2026-11-09 (frame `2312:9638`). Result action frame: 40×40, radius20, fill #1E1E1E, top20 / left290 inside the radio row.

The design uses a heart in this slot. The user explicitly requested direct playback here, so retain play/pause behavior and use the existing original Figma playback vectors:
- `../all-stations/play.svg`, native26×26, source documented in its SOURCE.md.
- `../mini-player/pause.svg`, native24×24, displayed in the same centered26×26 icon slot.

No PNG playback glyphs or font-library pause substitutes remain in the search results. Loading spinner and stopPropagation behavior are preserved.

## No results

Original Figma App → `noting-found` → `vuesax/bold/microscope`, exported directly as SVG on 2026-11-09 into `telescope.svg` (102×102, genuine vector). Its text is Ubuntu Medium20/23, white, with18px between the102px icon slot and text. Reused by genre list and genre station searches; an empty unsearched catalog keeps its existing message. The existing search telescope component now uses this original asset instead of a font approximation.
