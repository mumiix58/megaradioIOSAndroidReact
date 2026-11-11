# Connections design preview

Figma file `93WU6qa5fB9HBxkXXsc9WV`, Followers `1:2790`, Follows `1:3403`.
Avatar frames `1:2796`, `1:2797`, `1:2799`, `1:2798`, `1:2800` exported as 4x PNG through Figma.
Follows avatar `1:3410` uses the same Figma image fill as `1:2796`. These images illustrate explicitly enabled development preview records, never real follows.

Verified in Figma Properties: background #1B1C1E, names Ubuntu Medium 13 px; frame metadata supplies 32 px avatars, 27 px action pills and 15 px side spacing. Shared current navigation is preserved.

Enable only on the local web preview: `/profile?previewConnections=1`; optional `connections=followers` or `connections=following`. Profile counters and demo removal stay in that screen's local state. No accounts, follows or notifications are created remotely. Release builds ignore this preview flag.
