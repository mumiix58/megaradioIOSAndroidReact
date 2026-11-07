// Genres.swift — Port of `web-preview/src/pages/Genres.tsx` + `GenreList.tsx`.

import SwiftUI

struct GenresPage: View {
    @EnvironmentObject var router: TVRouter
    @EnvironmentObject var country: CountryStore
    @EnvironmentObject var player: AudioPlayer

    @State private var genres: [Genre] = []
    @State private var loading = true
    @State private var contentFocusRequest = 0

    private var popularGenres: [Genre] { Array(genres.prefix(8)) }

    private let cols = Array(repeating: GridItem(.flexible(), spacing: 21), count: 4)

    var body: some View {
        Stage1920x1080 {
            // ── Hero background (matches Discover) + top/left fade overlays.
            BrandImage(name: "hand-crowd-disco-1", contentMode: .fill)
                .frame(width: 1939, height: 1292).offset(x: -10, y: -523)
            LinearGradient(
                stops: [.init(color: Theme.background, location: 0),
                        .init(color: Theme.background.opacity(0.85), location: 0.10),
                        .init(color: Theme.background.opacity(0.6), location: 0.18),
                        .init(color: Theme.background, location: 0.30)],
                startPoint: .top, endPoint: .bottom)
                .frame(width: 1920, height: 1080)
            LinearGradient(
                stops: [.init(color: Theme.background, location: 0),
                        .init(color: Theme.background, location: 0.08),
                        .init(color: .clear, location: 0.20)],
                startPoint: .leading, endPoint: .trailing)
                .frame(width: 1920, height: 1080)

            MegaRadioLogo(scale: 164.421 / 323.069).offset(x: 30, y: 64)
            nowPlayingIndicator.offset(x: 1547, y: 67)
            CountryTriggerHeader().offset(x: 1618, y: 67)
            AppSidebar(active: .genres, onMoveRight: { contentFocusRequest += 1 })

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Popular Genres").font(.ubuntu(32, .bold)).foregroundColor(.white)
                        .padding(.leading, 6).padding(.bottom, 24)

                    LazyVGrid(columns: cols, spacing: 19) {
                        ForEach(popularGenres) { g in
                            GenreCard(name: g.name, count: g.stationCount ?? 0, hPad: 40, focusRequest: g.id == popularGenres.first?.id ? contentFocusRequest : 0) {
                                router.go(.genreList(g.name))
                            }
                        }
                    }
                    .padding(.bottom, 40)

                    Text("All").font(.ubuntu(32, .bold)).foregroundColor(.white)
                        .padding(.leading, 6).padding(.bottom, 24)

                    LazyVGrid(columns: cols, spacing: 19) {
                        ForEach(genres) { g in
                            GenreCard(name: g.name, count: g.stationCount ?? 0, hPad: 30) {
                                router.go(.genreList(g.name))
                            }
                        }
                    }
                    .padding(.bottom, 100)
                }
                .padding(.init(top: 60, leading: 12, bottom: 0, trailing: 12))
            }
            .frame(width: 1628, height: player.currentStation == nil ? 940 : 761, alignment: .topLeading)
            .focusSection()
            .offset(x: 225, y: 140)

            if loading {
                ProgressView().tint(Theme.accent).scaleEffect(2)
                    .frame(width: 1920, height: 1080)
            }
        }
        .task(id: country.selectedCountryCode) { await load() }
    }

    private var nowPlayingIndicator: some View {
        HStack(spacing: 5) {
            ForEach([35.0, 25.0, 30.0], id: \.self) { h in
                RoundedRectangle(cornerRadius: 4).fill(.white).frame(width: 9, height: h)
            }
        }
        .frame(width: 51, height: 51)
        .background(RoundedRectangle(cornerRadius: 15)
            .fill(player.isPlaying ? Theme.accent : Color.white.opacity(0.1)))
    }

    private func load() async {
        loading = true
        let c = country.selectedCountryCode == "GLOBAL" ? nil : country.selectedCountryCode
        do { genres = try await APIClient.shared.fetchGenres(country: c, limit: 60) } catch {}
        loading = false
    }
}

private struct GenreCard: View {
    let name: String
    let count: Int
    let hPad: CGFloat
    var focusRequest: Int = 0
    let onTap: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 4) {
                Text(name).font(.ubuntu(24, .medium)).foregroundColor(.white).lineLimit(1)
                Text("\(count) Stations").font(.ubuntu(22)).foregroundColor(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, hPad)
            .frame(height: 139)
            .background(RoundedRectangle(cornerRadius: 20)
                .fill(Color.white.opacity(isFocused ? 0.20 : 0.14)))
            .overlay(RoundedRectangle(cornerRadius: 20)
                .stroke(isFocused ? Theme.accent : .clear, lineWidth: 3))
            .scaleEffect(isFocused ? 1.03 : 1)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
        .onChange(of: focusRequest) { _, _ in isFocused = true }
    }
}

// ────────────────────────────────────────────────────────────────────
// GenreList — stations filtered by a single genre tag.
// ────────────────────────────────────────────────────────────────────

struct GenreListPage: View {
    let tag: String
    @EnvironmentObject var router: TVRouter
    @EnvironmentObject var player: AudioPlayer
    @State private var stations: [Station] = []
    @State private var contentFocusRequest = 0
    @State private var loading = true

    var body: some View {
        Stage1920x1080 {
            MegaRadioLogo(scale: 164.421 / 323.069).offset(x: 30, y: 64)
            CountryTriggerHeader().offset(x: 1453, y: 67)
            LoginHeaderButton().offset(x: 1694, y: 67)
            AppSidebar(active: .genres, onMoveRight: { contentFocusRequest += 1 })

            VStack(alignment: .leading, spacing: 30) {
                HStack(spacing: 16) {
                    Button { router.back() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 22, weight: .bold))
                            .padding(14)
                            .background(Circle().fill(.white.opacity(0.10)))
                            .foregroundColor(.white)
                    }
                    .buttonStyle(.tvTransparent)
                    Text(tag.capitalized).font(.ubuntu(48, .bold)).foregroundColor(.white)
                }

                if loading {
                    HStack { Spacer(); ProgressView().scaleEffect(2); Spacer() }
                        .frame(height: 600)
                } else {
                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVGrid(
                            columns: Array(repeating: GridItem(.fixed(200), spacing: 24), count: 7),
                            spacing: 30
                        ) {
                            ForEach(stations) { s in
                                StationCardLarge(station: s, focusRequest: s.id == stations.first?.id ? contentFocusRequest : 0) {
                                    player.play(s)
                                    router.go(.radioPlaying)
                                }
                            }
                        }
                        .padding(.top, 16)
                        .padding(.bottom, 100)
                    }
                    .focusSection()
                }
            }
            .frame(width: 1628, height: player.currentStation == nil ? 910 : 731, alignment: .topLeading)
            .offset(x: 237, y: 170)
        }
        .task { await load() }
    }

    private func load() async {
        loading = true
        do { stations = try await APIClient.shared.fetchStationsByGenre(tag, limit: 80) } catch {}
        loading = false
    }
}
