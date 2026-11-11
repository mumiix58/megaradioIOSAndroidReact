Figma Jf3ZOklsARouzh5Mop0rRz / App / alt 209:643 / player 152:182.
Height 71; logo50 radius5; name Ubuntu Medium15, subtitle Ubuntu Light14; controls40, icons24.
expand 152:218, heart152:213, pause152:190, play273:870, selected-heart139:658.
Station artwork remains API-driven; selected-heart tint preserves existing favorite state color.

Others reference reviewed: Jf3ZOklsARouzh5Mop0rRz / alt 417:2470. Player 71px, top corners 10px, logo50/radius5 at48,11; controls40/icons24 retained. Figma logo shadow is fixed #9779F8 (0,14,29,-17). Runtime accent is sampled from the current logo, then rendered as a faint color-only radial shadow; no artwork is duplicated. Menu surface #171717, inactive #7E7E7E, labels12. Existing current tab order and Genres icon remain.

The logo accent is sampled once and cached; a color-only elliptical radial gradient fades to zero at every edge. Figma shadow reference remains 0,14,29,-17; runtime glow is intentionally faint and bounded beneath the logo. Neutral logos have no colored halo.

Failure variation: Web alt-player-failed /930:3361 (connection text930:3368) inspected via Figma browser; MCP quota unavailable. All-page searches "failed" found Web only; "Opss" found the full App player failure1750:5795, not a mini variant. Adapted by request to existing71px App dock: original broadcast.png tinted brand pink, Opss, compact connection/retry message, play-to-retry and close. No Report action. Loading artwork uses a progress indicator until stream confirmation.

2026-11-11: Others `alt`417:2470 rechecked in Figma browser (MCP Starter quota blocked design-context call). Original dock71px/logo50px/radius5 retained. Faint dynamic glow keeps16%/7%/0% stops but is now anchored to the logo wrapper, so compact36px and floating controls cannot shift it. Error adaptation revised by user request: retain station name, single localized failure subtitle,24px existing broadcast SVG in the same square logo slot; no enlarged Opss/paragraph. Retry and close handlers remain the shared engine controls. Dev-only Home `?previewMini=error|paused` provides isolated visual QA without starting audio or writing selection/history.
