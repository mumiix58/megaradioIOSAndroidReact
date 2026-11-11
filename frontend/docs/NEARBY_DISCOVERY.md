# Nearby station discovery

The mobile Home section uses `useNearbyStations`. Its See More button opens the existing `/all-stations` route with the physically detected country and ISO code. The separate nearby-stations screen has been removed.

- Valid GPS coordinates: query `/api/stations/nearby` with lat/lng, radius, limit and a country preference. Only the station API's returned `distance` is shown.
- No GPS but a physically detected country: query the same endpoint with `country` only. The API returns that country's popular stations with `distance: null`.
- Neither coordinates nor country (Global): do not query a made-up location. Offer location permission.
- Country hydration launches a nonblocking `/api/location` request for all users, independently of their manual browsing-country choice. Its approximate IP coordinates never become GPS coordinates. A manual selection is preserved for browsing while the IP country fills separate nearbyCountry fields. An intervening GPS result wins over a late IP response.
- Requests use `slim=1` to avoid downloading long station descriptions. Country and coordinate requests use separate query cache keys.

## Local preview

Only in development web builds with `EXPO_PUBLIC_WEB_PREVIEW_PROXY=1`:

- `http://localhost:8081/?previewNearby=AT`: simulate an Austria country detection for this section only, without changing the stored user country or IP.
- `http://localhost:8081/?previewNearby=vienna`: simulate Vienna GPS (48.2082, 16.3738).
- The local phone wrapper provides `http://localhost:8082/?screen=nearbyAustria` and `?screen=nearbyVienna`.
- `?previewNearby=DE` (wrapper `?screen=nearbyGermany`) simulates Germany while retaining the stored browsing selection, e.g. Turkey.
- See More passes the actual nearby country to All Stations without changing the stored browsing country.

These use actual API station responses, not fabricated station fixtures. A VPN or real Austrian IP is not required. Remove the query parameter to return to normal behavior.

## Validation

`node scripts/tests/nearby-discovery.test.cjs`: 13 cases for country/GPS scope, zero and invalid coordinates, late IP races, manual-country priority, failed/undetected IP lookup and nonblocking startup.

API checks: country-only Austria returns 12 stations without distances. Vienna returns Radio VM1 - Wien (0.1 km), AUSTRIA FIRST (0.1 km) and Kronehit Hardstyle (0.2 km), followed by other nearby stations. Catalog content and distances can change.
