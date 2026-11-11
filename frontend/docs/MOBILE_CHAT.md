# Mobile member chat

The app reuses the existing web messaging API and PostgreSQL conversation history. No separate production message store or GIF provider was introduced. Voice messages reuse the existing media reference column; web has an audio playback fallback.

## Entry points and policy

- Public member profile: the Figma message bubble replaces the header share action. It is disabled until the viewer follows the public member. Share remains below the station list.
- Profile settings: Messages opens the inbox. Followed contacts and existing conversations are searchable.
- New conversations require following an open profile on the server. Existing conversation participants can reply without following back.
- Text (2,000 characters), emoji, uploaded images (5 MB), voice recordings (90 seconds, 8 MB upload cap), KLIPY GIF selection, timestamps, read receipts, typing and foreground presence use existing server capabilities.
- Drafts survive send failures; no automatic resend. Pending uploads and socket tickets are ignored after account/conversation changes.
- Socket connections stop outside the foreground screen. REST polling is fallback only; read state and presence remain shared with web.

## Configuration

`EXPO_PUBLIC_KLIPY_API_KEY` is the same public client credential used by web. Configure it in the mobile build environment; local `.env.local` is ignored. Never commit its value. Without it the GIF tab shows an unavailable state.

API additions in the web/backend repository must be deployed separately: `canSend` thread flag, public-profile send policy, per-device active conversation tracking, stable follow notification IDs, and notification preferences `pushEnabled`, `messages`, `followers`. Voice upload adds `/api/messages/upload-audio`, with authenticated bounded uploads and container-byte validation; `audio` messages have validated server upload paths. Native microphone permission was enabled in the Expo config and requires a new native build. No microphone access occurs until Start recording is pressed. The global mini-player is hidden on Messages so it cannot cover the composer; radio audio can continue until recording/playback is requested. Recording pauses the radio and is cancelled when leaving the screen/backgrounding; playback also pauses the radio.

Native pushes use existing Expo device registration and EAS project configuration. The app notification switch persists the master preference on the server.

## Verification

Non-sending fixture: development web preview only, `/messages?previewChat=1`, with `EXPO_PUBLIC_WEB_PREVIEW_PROXY=1`. The localhost web build shows six explicitly labelled test conversations in Messages by default. Sending appends locally, produces a simulated reply, and saves text history in AsyncStorage. It never submits messages, uploads attachments, or connects a chat socket. Recordings/photos are device-local; blob media may not survive a page reload. Production builds never use these fixtures. Public profile entry points with real member IDs still use the real API and follow policy. The local device wrapper maps `?screen=chatPreview` to this route.

Run from mobile frontend with Node 24:

```
node scripts/tests/public-profile-actions.test.cjs
node scripts/tests/chat-service.test.cjs
node scripts/tests/chat-socket.test.cjs
node scripts/tests/chat-preview-relay.test.cjs
node scripts/tests/chat-voice.test.cjs
node scripts/tests/chat-send-retry.test.cjs
```

Backend tests from `artifacts/api-server`:

```
pnpm exec tsx --experimental-test-module-mocks --test tests/postgres-messages-routes.test.ts tests/user-profile-account-routes.test.ts tests/chat-device-presence.test.ts tests/chat-push-preferences.test.ts tests/chat-audio.test.ts
pnpm exec tsc --noEmit
```

Browser QA covered 320 px and the 430 px device wrapper, emoji insertion, actual KLIPY results and GIF preview, and non-sending fixture draft retention. No messages or follow requests were sent to real members. Lock-screen delivery, native keyboard and media picker require a physical iOS/Android build after the updated API is deployed. The app's full typecheck currently has unrelated existing errors; changed chat files are clean.

## Radio gifts and shared listening

The composer has a single-line input, a 56 px dimensional send button and a joined upper attachment panel. The original Mega note mark replaces the inline microphone. Voice notes remain in the attachment menu.

The radio picker reads the member's existing favorites or the public Mega catalog with a cancellable, debounced search. Selection stages a card and an optional note (300 characters). `station` messages contain versioned JSON with a station ID and either `gift` or `together` intent. The server resolves the public station and replaces client title/logo/country with canonical catalog data. Stream URLs are never included in chat payloads. Playback always resolves the station ID through the normal station API and uses the existing player.

`POST /api/messages/listening` accepts an authenticated participant's shared message ID, a device identifier, increasing revision and boolean state. The app reports only an explicitly opened shared card while its actual station is playing in the foreground. Pause, buffering, failure, station changes and leaving the foreground clear activity. Heartbeats run every 12 seconds while listening; presence expires after 35 seconds without refresh. A device/account guard prevents test conversations or a previous account from reporting. Out-of-order HTTP requests cannot revive paused activity. Presence is scoped to that conversation, not general listening history, and is not stored as a message. Server reads inspect at most five devices for each participant. Web chat has compatible radio-card playback and listening updates.

Required local backend additions have not been deployed. Playback of public stations and local test-card status were verified in the browser; delivery of radio gifts and peer status between separate production devices requires the updated API. Preview history merges by message ID so multiple test tabs do not overwrite one another.

Additional checks:

```
node scripts/tests/chat-radio.test.cjs
# backend:
pnpm exec tsx --experimental-test-module-mocks --test tests/chat-radio.test.ts tests/postgres-messages-routes.test.ts
```


## History navigation and deletion

History updates at 16ms intervals. The translucent overlay thumb has a 24px drag target, maps a drag to the full loaded history range, and fades after release. The down-chevron above Send returns to the latest message; manual history browsing is preserved during new arrivals and layout changes. It reuses the existing Figma arrow-left vector rotated downward. Delete actions open beside the long-pressed message in the existing Car Mode country-tooltip style (#030507, 6px corners and pointer), with no heading or cancel row; tapping outside dismisses it. Sent balloons now use a dark Mega-pink tone (#B51F69) and Send uses a #FF4199-centered pink gradient; the earlier purple literals were removed.

Holding a message opens Delete for me, and, for the sender's own undeleted message, Delete for everyone. `POST /api/messages/delete` requires a participant and enforces sender ownership for shared deletion. Personal hiding is viewer-specific; shared deletion removes content/media references and retains a timestamped tombstone. Reads, inbox summaries and unread counts honor deletion state. Web/app sockets receive scoped `chat:deleted` events; personal hiding broadcasts only to the initiating account. Local preview tabs merge hiding/tombstones monotonically so stale copies cannot restore content.

Deployment prerequisite: apply `lib/db/migrations/0044_chat_message_deletion.sql` before releasing the updated API/store queries, then release the compatible app/web clients. Neither migration nor production API deployment was performed during this design task. Preview deletion stays local and was tested only with newly created fictional-chat messages.

Message actions now use a 232px dark Mega contextual menu with Reply, Copy, Pin/Unpin and Delete. Delete opens participant-appropriate scope choices. Reply displays a cancellable quote above the composer and stores a validated replyToId; pins appear in a compact conversation header and can be removed. Text balloons reserve trailing inline space for the bottom-right time/read state. MaterialCommunityIcons supplies consistent outline action icons; the menu follows the supplied WhatsApp interaction reference, not a new Figma export. API migration 0045 adds reply references and shared pins; production migration/deployment has not been performed.

Delete now enters a multi-message selection mode. The composer is replaced by a bottom trash/count toolbar; ownership across the complete selection controls the available deletion scopes. Failed requests keep only the failed messages selected for retry. Pin/unpin banner glyphs are 34px. Last-seen uses local calendar today/yesterday/date labels (including year for earlier years).


## Group conversations

The inbox header's people-plus button opens `/group-new`: search followed/follower contacts, select up to 49 invitees, then name the group and optionally upload a photo. Creator + invitees is capped at 50 for this initial Mega release. This is a product limit, not WhatsApp's member limit. Groups appear mixed chronologically with direct chats, using a distinct group avatar and sender-prefixed previews.

`/group-chat` supports participant names, text, emoji, KLIPY GIFs and canonical radio cards using the existing composer/player. Radio playback does not call the direct-message listening endpoint or invent group peer presence. Group info lists active/invited participants and admin status; leaving requires confirmation and transfers admin to the oldest remaining active member. The initial scope does not include public invite links, editing group membership after creation, group calls, or group message reactions.

New recipients are invited rather than silently joined. Pending invitations expose group name/avatar and inviter identity, not messages or the member list. Only active members read/write history, from their join timestamp onward. Recipient selection is independently checked against both directions of user_follows, membership changes and writes are serialized by group row locks, and all API data is private/no-store. Push uses the existing messages preference and group-chat deep link. Group events invalidate foreground app queries; REST polling remains fallback. No end-to-end encryption claim is made.

Deploy migration `0046_chat_groups.sql` and the new group routes before enabling real accounts. The migration and API have NOT been deployed. Preview groups are isolated to development web mode and AsyncStorage, never send invites/messages to actual accounts, and include two existing groups plus an invitation. Group previews use the existing six fictional chat contacts. Screens were checked at 320 and 430px. Backend tests exercise related-user invitations, acceptance gates, participant authorization, media validation and history cutoff.

### Group information and administrators

The creator is returned as `createdBy`, retains the admin role, and cannot be demoted. Active admins can grant or remove admin rights for other active members through each row's separate overflow menu. Invited members cannot receive admin rights before joining. Tapping the avatar/name row opens the member's profile (or the viewer's own Profile tab), without triggering a role change.

The group photo has a camera edit affordance for active admins only. Gallery selection reuses the existing bounded chat image upload and sends a validated upload path to `POST /api/messages/groups/:id/photo`; null removes it. `POST /api/messages/groups/:id/role` checks actor membership/admin status and the target's active membership under the existing group transaction lock. Both changes broadcast group invalidations and refresh the inbox/header/details. Normal members cannot access either mutation even via direct API requests. No new migration is needed beyond the existing, not-yet-deployed 0046 group tables.

## Group music styles

The group details step offers an optional selection of up to three music styles. Canonical IDs are sent as `genres`, validated against the API allow-list, stored in `chat_groups.genres`, returned by group list/details, and shown in the group information panel. Preview groups persist the same field. Migration `0047_chat_group_music_styles` is required together with the API release; no production database migration was run for this UI work. The photo edit affordance reuses the original `profile/edit.svg` Figma asset at 14×14, also used by the profile avatar.

## Group discovery dial

An active member opens the animated Mega orb in the group header. The centered, borderless field now follows the user's corrected Higgsfield reference (Concept 1's three-stage experience, with the requested rounded share action). Opening shows only the live vector `GroupDiscoverySphere`: charcoal glass, a white reflection, pink rim, original Mega mark and original outlined white megaradio wordmark exported from Figma, breathing scale and three side waves. The top `WorldRadioDial` keeps its frequency scale fixed while the pink cursor travels independently along its shallow arc; pull tension also deforms the sphere and its backdrop. Reduced-motion settings suppress looping breath/wave animation and make the reveal immediate. Car Mode retains its original ruler and hit targets.

First pull/release (or accessible sphere action) crossfades and shrinks the sphere into `GroupDiscoveryDeck`, a five-slot/infinite recycled composition with one large station logo and two smaller cards behind it. It reuses `useCarCarousel` and real catalog imagery, with no generated station artwork. Subsequent swipes/arrows audition from the group's genre pool. The top ruler stays above the cards; a separate pink waveform below the country serves as the player toggle. All labels and card metadata are hidden before the initial reveal.

Opening is inert. A carousel selection, arrow action or pull/release auditions the station locally without posting. After a successful playback request, a short 1.8s listening state precedes the vertically stacked actions: a wide round pink “Beğendim, paylaş” button and a quiet “Yeniden keşfet” action. Only the first sends a canonical station gift through the group endpoint. “Yeniden keşfet” pauses the current preview and restores the breathing sphere for the next pull; it never posts. The central play/pause control uses the real player station/state, and stream errors disable confirmation. Sharing does not restart playback. Concurrent auditions/posts are locked; successful confirmations are deduplicated within the overlay session. Playback failure offers listening retry and never posts. A failed confirmation is retryable. Pending radio resolution is invalidated when the discovery closes or group/account changes. No other member's player is changed automatically.

The public catalog is queried separately for up to three group genres, sorted by clickCount, and metadata is checked against genre aliases to reject unrelated cache fallbacks. The deck interleaves genre popularity pools, excluding known broken stations and duplicate IDs. Listener counts are never synthesized. Group admins can update genres in Group Info using the creation validation. Existing API and migration release prerequisites still apply.

The corrected sphere/deck implementation was visually checked at 430×850 and 320×640 using a temporary QA route with no-op audio and in-memory counters; that route was removed after verification. The actual group overlay was also checked against real catalog artwork. No generated station artwork or logo was shipped. Focused discovery tests cover explicit sharing, duplicate prevention, rediscovery, playback toggle and failure/retry paths. Global TypeScript checks still contain pre-existing errors outside these files.

### Soft depth and extracted Higgsfield material

The sphere now uses the actual transparent glass material generated by Higgsfield (`4cf18df6-d7d7-4ced-9ee6-259a7f52da67`), bundled as `assets/images/chat/discovery-glass-orb.png`. Its source record sits beside it. The original Mega mark/text remain live overlays. Breathing is slower and smaller; side waves are shorter, vertically feathered and layered with low-opacity broad strokes. The share question text was removed, leaving the two explicit actions. Country and the station's matching group style are displayed below its name. Rear cards are dimmed to emphasize foreground depth.

`DiscoveryDepthBackdrop` replaces the uniform blur sheet with a mild peripheral blur plus two feathered elliptical blur masks on web, each applied to the same element as its backdrop filter. Native uses three clipped oval blur planes with stepped opacity/intensity; physical-device visual parity has not been verified. The planes respond to pull tension. Existing playback, group genre selection and explicit-sharing tests still apply.

### Integrated Higgsfield materials and verified brand lettering

The additional side-wave, station-card backplate/contact shadow and cohesive oval stage are now actual Higgsfield image layers, recorded in `assets/images/chat/discovery-materials.source.md`. They retain local live interaction and real catalog identity. Header padding, a quiet separator and reduced tuner spacing integrate the title into the same stage.

Figma MCP font inspection was blocked by its Starter quota. The Figma UI was used to inspect Mega Radio Logo → mega-logo-pdf → mega-radio → logo → megaradio. Node `3156:11086` is an outlined Vector, not editable font text. Its original white SVG was exported directly and replaces the incorrectly invented uppercase Ubuntu lettering. The temporary export setting was removed after download.

The group-only elastic cursor now traverses ±110 scaled pixels over stationary ticks and follows the fixed scale arc; it no longer stretches together with the ruler. End stops keep it clear of arrow grips. Dedicated cursor geometry checks and the existing discovery behavior tests pass. Visual checks at 320×640 and 430×850 used no-op audio and in-memory share callbacks, followed by removal of the temporary QA route.

### Visible release slide and CarPlay-style country badge

Pull/release now reveals the card deck in 260ms and advances three physical slots over 1050ms with a smooth accelerate/decelerate curve. The initial zero-step landing was removed. Listening starts after the final card lands; reduced motion still lands immediately. The shared carousel keeps its default 360ms step for existing callers.

The separate country/style subtitle is removed. `GroupDiscoveryCountry` adds the same 28px round flag, 44px target, localized country name and dark 6px-radius anchored tooltip as Car Mode, outside the carousel gesture detector. It appears only after motion settles and closes on station change, blur or a short timeout. Tapping it does not audition a radio. The primary share button now has an 8px corner radius. Visual checks covered 320×640 and 430×850, actual mid-slide and settled logo positions, and localized flag tooltips; audio and chat writes were stubbed.

### Faster spin, CarPlay color and global country rotation

Discovery keeps the same 1050ms landing duration but now traverses at least eight physical card slots, selecting the landing station from an eight-country cooldown with genre rotation and session station history. With enough countries, each ten discoveries span at least nine countries. Small catalogs use their available countries rather than inventing coverage. Sphere-only mode unmounts the card gesture detector; carousel gestures also respect visibility, preventing the hidden card tap from replaying the old station.

The selected logo now drives the original CarPlay `useLogoAccent` and `LogoShadow`, scaled to the group artwork. Neutral or unsampleable logos do not receive an invented color; async logo changes cannot keep a previous station's accent.

Each group style loads up to four popularity pages of 64 stations until ten countries are represented. The bounded deck reserves country alternatives and is capped at 54 entries. CarPlay's existing eligibility and artwork-prefetch validation remove missing, placeholder and unavailable logos without opening streams. Six workers have a 6.5s artwork deadline. The focused group page warms this public query before the orb is opened.

Real-catalog QA returned 50 verified logos across 43 countries. Ten consecutive mock auditions selected BE, BR, AE, PT, AT, GB, EC, JM, JP and RO, with no country repeated. The original CarPlay color sampler produced blue for the Belgian station and yellow for Pro FM. No real audio or chat writes were used. Unit checks cover paginated country breadth, failed/missing artwork, a bounded deck, a thirty-draw country window, and explicit sharing.
