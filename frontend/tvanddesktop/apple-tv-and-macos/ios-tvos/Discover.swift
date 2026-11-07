// Discover.swift — Port of `web-preview/src/pages/DiscoverNoUser.tsx`.
//
// Layout (1920×1080):
//   • Hand-crowd hero image, full bleed, with gradient overlay fading to bg.
//   • MegaRadio logo top-left (30, 64).
//   • Header (top): CountryTrigger (1453, 67) + Login (1694, 67).
//   • Left sidebar (48, 170, 120×760).
//   • Scrollable content area (162, 170, 1758 × 910).
//     Sections:
//       – Recently Played (when present)
//       – For You         (when present)
//       – Genres pills
//       – Popular Right Now (7-column grid 210×280 cards)
//       – Country Stations (7-column infinite scroll)

import SwiftUI

struct DiscoverPage: View {
    @EnvironmentObject var router: TVRouter
    @EnvironmentObject var country: CountryStore
    @EnvironmentObject var player: AudioPlayer

    @State private var popular: [Station] = []
    @State private var workingStations: [Station] = []
    @State private var genres: [Genre] = []
    @State private var loading = true
    @State private var error: String?
    @State private var contentFocusRequest = 0

    var body: some View {
        Stage1920x1080 {
            // ── Hero background.
            BrandImage(name: "hand-crowd-disco-1", contentMode: .fill)
                .frame(width: 1939, height: 1292)
                .offset(x: -10, y: -523)

            // ── Gradient fade to background.
            LinearGradient(
                colors: [Color.clear, Theme.background],
                startPoint: UnitPoint(x: 0.5, y: 0.009),
                endPoint:   UnitPoint(x: 0.5, y: 0.486)
            )
            .frame(width: 1920, height: 1080)

            // ── Logo.
            MegaRadioLogo(scale: 164.421 / 323.069)
                .offset(x: 30, y: 64)

            // ── Header (Country + Login).
            CountryTriggerHeader().offset(x: 1453, y: 67)
            LoginHeaderButton().offset(x: 1694, y: 67)

            // ── Left sidebar.
            AppSidebar(active: .discover, onMoveRight: { contentFocusRequest += 1 })

            // ── Scrollable content area starts at (162, 170) inside the stage.
            DiscoverScrollArea(
                focusRequest: contentFocusRequest,
                popular: popular,
                stations: workingStations,
                genres: genres,
                loading: loading,
                error: error,
                onPlay: { s in
                    player.play(s)
                    router.go(.radioPlaying)
                },
                onGenre: { g in router.go(.genreList(g.name)) }
            )
            .frame(width: 1758, height: player.currentStation == nil ? 910 : 731)
            .focusSection()
            .offset(x: 162, y: 170)
        }
        .task(id: country.selectedCountryCode) { await load() }
    }

    private func load() async {
        loading = true
        error = nil
        do {
            let c = country.selectedCountryCode == "GLOBAL" ? nil : country.selectedCountryCode
            async let p = APIClient.shared.fetchPopularStations(country: c, limit: 12)
            async let w = APIClient.shared.fetchPopularStations(country: c, limit: 35)
            async let g = APIClient.shared.fetchGenres(country: c, limit: 30)
            popular         = try await p
            workingStations = try await w
            genres          = try await g
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

// ────────────────────────────────────────────────────────────────────
// Scrollable content area
// ────────────────────────────────────────────────────────────────────

private struct DiscoverScrollArea: View {
    let focusRequest: Int
    let popular: [Station]
    let stations: [Station]
    let genres: [Genre]
    let loading: Bool
    let error: String?
    let onPlay: (Station) -> Void
    let onGenre: (Genre) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 40) {
                if loading {
                    HStack { Spacer(); ProgressView().scaleEffect(2); Spacer() }
                        .frame(height: 320)
                        .padding(.top, 200)
                }
                if let error {
                    Text(error)
                        .font(.ubuntu(22))
                        .foregroundColor(Theme.accent)
                        .padding(60)
                }

                // ── Genres pill row.
                if !genres.isEmpty {
                    SectionTitle("Genres")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 20) {
                            ForEach(genres) { g in
                                GenrePill(name: g.name, focusRequest: g.id == genres.first?.id ? focusRequest : 0) { onGenre(g) }
                            }
                        }
                        .padding(.horizontal, 74)
                        .padding(.vertical, 15)
                    }
                    .focusSection()
                }

                // ── Popular Right Now (web: 2×7 grid, NOT a horizontal scroll).
                if !popular.isEmpty {
                    SectionTitle("Popular Right Now")
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.fixed(200), spacing: 24), count: 7),
                        spacing: 30
                    ) {
                        ForEach(popular) { s in
                            StationCardLarge(station: s) { onPlay(s) }
                        }
                    }
                    .padding(.horizontal, 74)
                    .padding(.top, 8)
                    .focusSection()
                }

                // ── Country stations grid (7 per row, 200×264 cards, gap 24).
                if !stations.isEmpty {
                    SectionTitle("Stations")
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.fixed(200), spacing: 24),
                                       count: 7),
                        spacing: 30
                    ) {
                        ForEach(stations) { s in
                            StationCardLarge(station: s) { onPlay(s) }
                        }
                    }
                    .padding(.horizontal, 74)
                    .padding(.top, 8)
                    .padding(.bottom, 120)
                    .focusSection()
                }
            }
            .padding(.top, 20)
        }
        .clipped()
    }
}

private struct SectionTitle: View {
    let text: String
    init(_ t: String) { text = t }
    var body: some View {
        Text(text)
            .font(.ubuntu(32, .bold))
            .foregroundColor(.white)
            .padding(.leading, 74)
    }
}

// ────────────────────────────────────────────────────────────────────
// Cards & pills
// ────────────────────────────────────────────────────────────────────

// MARK: - Cards & pills (1:1 port of `web-preview/src/pages/DiscoverNoUser.tsx`)

/// 200×264 station card matching the popular/stations grid in web.
/// Layout (absolute coords):
///   • Background: rgba(255,255,255,0.14)  ·  radius 11
///   • Inner white box (34, 34) 132×132    ·  radius 6.6
///   • Station name (centered, top 187)    ·  22 px medium
///   • Category (centered, top 218.2)      ·  18 px light
///   • Inset shadow inset 1.1 1.1 12.1 rgba(255,255,255,0.12)
struct StationCardLarge: View {
    let station: Station
    var focusRequest: Int = 0
    let onPlay: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        Button(action: onPlay) {
            ZStack(alignment: .topLeading) {
                // Card background.
                RoundedRectangle(cornerRadius: 11)
                    .fill(Color.white.opacity(isFocused ? 0.20 : 0.14))
                    .frame(width: 200, height: 264)

                // Inner white artwork container.
                ZStack {
                    RoundedRectangle(cornerRadius: 6.6).fill(Color.white)
                    StationArtwork(url: station.artworkURL, size: 132, cornerRadius: 6.6)
                }
                .frame(width: 132, height: 132)
                .offset(x: 34, y: 34)

                // Station name — centered, top: 187.
                Text(station.name)
                    .font(.ubuntu(22, .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .frame(width: 180, alignment: .center)
                    .offset(x: 10, y: 187)

                // Category tag — centered, top: 218.2.
                Text(station.tags?.split(separator: ",").first
                        .map { String($0).trimmingCharacters(in: .whitespaces) }
                     ?? station.country ?? "Radio")
                    .font(.ubuntu(18, .light))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .frame(width: 180, alignment: .center)
                    .offset(x: 10, y: 218.2)
            }
            .frame(width: 200, height: 264)
            // Pink focus ring (only on focus, replaces tvOS default halo).
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isFocused ? Theme.accent : .clear, lineWidth: 4)
            )
            .shadow(
                color: isFocused ? Theme.accent.opacity(0.8) : .clear,
                radius: 30
            )
            .scaleEffect(isFocused ? 1.04 : 1.0)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
        .onChange(of: focusRequest) { _, _ in isFocused = true }
        .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

struct GenrePill: View {
    let name: String
    var focusRequest: Int = 0
    let onTap: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        Button(action: onTap) {
            Text(name)
                .font(.ubuntu(22, .medium))
                .foregroundColor(.white)
                .lineLimit(1)
                .padding(.horizontal, 72)
                .padding(.vertical, 28)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(isFocused ? Theme.accent : Color.white.opacity(0.14))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(isFocused ? .white : .clear, lineWidth: 3)
                )
                .scaleEffect(isFocused ? 1.05 : 1)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
        .onChange(of: focusRequest) { _, _ in isFocused = true }
    }
}

// Compact "recently played" card matches the 180×220 web spec.
struct RecentStationCard: View {
    let station: Station
    var focusRequest: Int = 0
    let onPlay: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        Button(action: onPlay) {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 11)
                    .fill(Color.white.opacity(isFocused ? 0.22 : 0.14))
                    .frame(width: 180, height: 220)

                StationArtwork(url: station.artworkURL, size: 120, cornerRadius: 6.6)
                    .offset(x: 30, y: 20)

                Text(station.name)
                    .font(.ubuntu(18, .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .frame(width: 160, alignment: .center)
                    .offset(x: 10, y: 152)
            }
            .frame(width: 180, height: 220)
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isFocused ? Theme.accent : .clear, lineWidth: 4)
            )
            .scaleEffect(isFocused ? 1.06 : 1)
            .shadow(color: isFocused ? Theme.accent.opacity(0.6) : .clear, radius: 18)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
    }
}
