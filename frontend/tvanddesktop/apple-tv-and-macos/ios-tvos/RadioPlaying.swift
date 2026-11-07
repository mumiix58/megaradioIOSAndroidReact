// RadioPlaying.swift — 1:1 port of `web-preview/src/pages/RadioPlaying.tsx`.
//
// Web layout reference (1920 × 1080 absolute coords):
//   • Background: radial-gradient(181.15% 96.19% at 5.26% 9.31%,
//                                  #0E0E0E 0%, #3F1660 29.6%, #0E0E0E 100%)
//   • Logo block at (30, 64)            size 164.421 × 57
//   • Equalizer indicator (1383, 67)    size 51 × 51 — pink when playing
//   • Country trigger pill (1453, 67)
//   • Sidebar (48, 170)
//
//   • Station artwork (236, 242)        size 296 × 296 (white card, r=16.692)
//   • Pink equalizer bars (596, 242)    size 33.25 × 35
//   • Station name (596, 293)           48 px medium
//   • Now playing meta (596, 357)       32 px medium
//   • "Station Info" label (596, 425)   24 px medium
//   • Station tag row (596, 476)        — flag + bitrate + codec + country + genres
//
//   • Player controls row (1372, 356)   90.192 × 90.192 each, gap 36.07
//        prev / play / next / favorite
//
//   • Scroll area (236, 559)            1610 × 521
//        – Similar Radios row (200 × 264 cards, gap 24)
//        – Popular Radios row (200 × 264 cards, gap 24)

import SwiftUI

struct RadioPlayingPage: View {
    @EnvironmentObject var player: AudioPlayer
    @EnvironmentObject var router: TVRouter
    @EnvironmentObject var favorites: FavoritesStore
    @EnvironmentObject var country: CountryStore

    @State private var similar: [Station] = []
    @State private var popular: [Station] = []
    @State private var contentFocusRequest = 0

    var body: some View {
        Stage1920x1080 {
            // ── Radial gradient bg.
            RadialGradient(
                colors: [
                    Color(red: 0x0E/255, green: 0x0E/255, blue: 0x0E/255),
                    Color(red: 0x3F/255, green: 0x16/255, blue: 0x60/255),
                    Color(red: 0x0E/255, green: 0x0E/255, blue: 0x0E/255)
                ],
                center: UnitPoint(x: 0.0526, y: 0.0931),
                startRadius: 0,
                endRadius: 1450
            )
            .frame(width: 1920, height: 1080)

            // ── Logo (30, 64).
            MegaRadioLogo(scale: 164.421 / 323.069).offset(x: 30, y: 64)

            // ── Mini equalizer indicator (1383, 67) — 51 × 51 pink chip when playing.
            HStack(spacing: 19) {
                MiniEqIndicator(isPlaying: player.isPlaying)
                CountryTriggerHeader()
            }
            .frame(width: 469, alignment: .trailing)
            .offset(x: 1372, y: 67)

            // ── Sidebar.
            AppSidebar(active: .discover, onMoveRight: { contentFocusRequest += 1 })

            // ── Station artwork (236, 242) 296×296 white card.
            stationArtwork
                .offset(x: 236, y: 242)

            // ── Pink equalizer bars (596, 242).
            PinkEqBars(isPlaying: player.isPlaying)
                .offset(x: 596, y: 242)

            // ── Station name (596, 293).
            Text(player.currentStation?.name ?? "Unknown Station")
                .font(.ubuntu(48, .medium))
                .foregroundColor(.white)
                .lineLimit(1)
                .frame(width: 700, alignment: .leading)
                .offset(x: 596, y: 293)

            // ── Now playing meta (596, 357).
            Text([player.nowPlayingArtist, player.nowPlayingTitle].compactMap { $0 }.joined(separator: " – ").isEmpty
                 ? "Live radio" : [player.nowPlayingArtist, player.nowPlayingTitle].compactMap { $0 }.joined(separator: " – "))
                .font(.ubuntu(32, .medium))
                .foregroundColor(.white)
                .lineLimit(1)
                .frame(width: 750, alignment: .leading)
                .offset(x: 596, y: 357)

            // ── "Station Info" label (596, 425).
            Text("Station Info")
                .font(.ubuntu(24, .medium))
                .foregroundColor(.white)
                .offset(x: 596, y: 425)

            // ── Tag row (596, 476).
            stationTagRow
                .offset(x: 596, y: 476)

            // ── Player controls (1372, 356).
            controlsRow
                    .focusSection()
                .offset(x: 1372, y: 356)

            // ── Similar + popular scroll area (236, 559) 1610 × 521.
            scrollArea
                .frame(width: 1610, height: 521)
                .focusSection()
                .offset(x: 236, y: 559)
        }
        .task(id: player.currentStation?.id) { await loadRelated() }
    }

    // MARK: - Station artwork
    @ViewBuilder
    private var stationArtwork: some View {
        StationArtwork(url: player.currentStation?.artworkURL, size: 296, cornerRadius: 16.692)
    }

    // MARK: - Tag row
    @ViewBuilder
    private var stationTagRow: some View {
        let s = player.currentStation
        let codec = (s?.codec ?? "MP3").uppercased()
        let bitrate = s.flatMap { $0.bitrate }.map { "\($0)kb" } ?? "128kb"
        let countryCode = (s?.countryCode ?? s?.country ?? "XX").uppercased()
        let tags = s?.tags?.split(separator: ",").prefix(2)
            .map { $0.trimmingCharacters(in: .whitespaces) } ?? []

        HStack(spacing: 11.3) {
            // Flag — only if country present.
            if countryCode != "XX", countryCode.count == 2 {
                AsyncImage(
                    url: URL(string: "https://flagcdn.com/w40/\(countryCode.lowercased()).png")
                ) { phase in
                    if let img = phase.image { img.resizable().scaledToFill() }
                    else { Color.clear }
                }
                .frame(width: 34.783, height: 34.783)
                .clipShape(Circle())
            }
            tagChip(bitrate)
            tagChip(codec)
            tagChip(countryCode)
            ForEach(tags, id: \.self) { t in tagChip(t.uppercased()) }
        }
    }

    private func tagChip(_ text: String) -> some View {
        Text(text)
            .font(.ubuntu(24.348, .medium))
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .frame(height: 40)
            .background(
                RoundedRectangle(cornerRadius: 5.217)
                    .fill(Color(red: 0x24/255, green: 0x24/255, blue: 0x24/255))
            )
    }

    // MARK: - Controls row (prev / play / next / fav)
    @ViewBuilder
    private var controlsRow: some View {
        let station = player.currentStation
        ZStack(alignment: .topLeading) {
            playerCircle(
                id: "prev",
                primary: false,
                isFilled: false,
                pinkBorderOnly: false
            ) {
                Image(systemName: "backward.end.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(.white)
            } action: {
                // No previous-station logic yet — placeholder.
            }
            .offset(x: 0, y: 0)

            playerCircle(
                id: "play",
                primary: false,
                isFilled: false,
                pinkBorderOnly: false
            ) {
                Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 38, weight: .bold))
                    .foregroundColor(.white)
            } action: { player.togglePlayPause() }
            .offset(x: 126.27, y: 0)

            playerCircle(
                id: "next",
                primary: false,
                isFilled: false,
                pinkBorderOnly: false
            ) {
                Image(systemName: "forward.end.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(.white)
            } action: { /* placeholder */ }
            .offset(x: 252.54, y: 0)

            // Favorite — pink fill when active.
            favoriteCircle(station: station)
                .offset(x: 378.81, y: 0)
        }
        .frame(width: 469, height: 90.192, alignment: .topLeading)
    }

    /// 90.192 × 90.192 black circle button matching the web design.
    @ViewBuilder
    private func playerCircle<L: View>(
        id: String,
        primary: Bool,
        isFilled: Bool,
        pinkBorderOnly: Bool,
        @ViewBuilder label: @escaping () -> L,
        action: @escaping () -> Void
    ) -> some View {
        FocusableCircle(size: 90.192, focusRequest: id == "play" ? contentFocusRequest : 0, action: action) { isFocused in
            ZStack {
                Circle().fill(Color.black)
                label()
            }
            .overlay(
                Circle().stroke(isFocused ? Theme.accent : .clear, lineWidth: 4)
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.8) : .clear, radius: 30)
        }
    }

    @ViewBuilder
    private func favoriteCircle(station: Station?) -> some View {
        let isFav = station.map { favorites.isFavorite($0) } ?? false
        FocusableCircle(size: 90.192, action: {
            if let s = station { favorites.toggle(s) }
        }) { isFocused in
            ZStack {
                Circle().fill(isFav ? Theme.accent : Color.clear)
                Image(systemName: "heart.fill")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)
            }
            .overlay(
                Circle().stroke(
                    isFocused ? Theme.accent : (isFav ? Theme.accent : Color.black),
                    lineWidth: isFocused ? 4 : 3.608
                )
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.8) : .clear, radius: 30)
        }
    }

    // MARK: - Similar + popular scroll area
    @ViewBuilder
    private var scrollArea: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Similar Radios")
                    .font(.ubuntu(32, .bold))
                    .foregroundColor(.white)
                horizontalRow(stations: similar)
                    .padding(.bottom, 44)

                Text("Popular Radios")
                    .font(.ubuntu(32, .bold))
                    .foregroundColor(.white)
                horizontalRow(stations: popular)
            }
            .padding(.bottom, 40)
        }
    }

    @ViewBuilder
    private func horizontalRow(stations: [Station]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 24) {
                ForEach(stations.prefix(20)) { s in
                    RadioPlayingMiniCard(station: s) {
                        player.play(s)
                    }
                }
            }
        }
    }

    private func loadRelated() async {
        guard let s = player.currentStation else { return }
        let cc = country.selectedCountryCode == "GLOBAL" ? nil : country.selectedCountryCode
        let firstTag = s.tags?.split(separator: ",").first.map(String.init)
        do {
            if let tag = firstTag {
                similar = try await APIClient.shared.fetchStationsByGenre(
                    tag.trimmingCharacters(in: .whitespaces), limit: 20
                )
            } else {
                similar = []
            }
        } catch {
            similar = []
        }
        do {
            popular = try await APIClient.shared.fetchPopularStations(country: cc, limit: 20)
        } catch {
            popular = []
        }
    }
}

// ────────────────────────────────────────────────────────────────────
// Supporting components
// ────────────────────────────────────────────────────────────────────

/// 200×264 card used in the bottom scroll lists.
private struct RadioPlayingMiniCard: View {
    let station: Station
    let onTap: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                Spacer().frame(height: 34)
                ZStack {
                    RoundedRectangle(cornerRadius: 6.6).fill(Color.white)
                    StationArtwork(url: station.artworkURL, size: 124, cornerRadius: 5)
                }
                .frame(width: 132, height: 132)
                Spacer().frame(height: 21)
                Text(station.name)
                    .font(.ubuntu(22, .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                Spacer().frame(height: 6.2)
                Text(station.tags?.split(separator: ",").first.map(String.init).map { $0.trimmingCharacters(in: .whitespaces) } ?? station.country ?? "Radio")
                    .font(.ubuntu(18, .light))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .padding(.horizontal, 6)
            }
            .frame(width: 200, height: 264)
            .background(
                RoundedRectangle(cornerRadius: 11)
                    .fill(Color.white.opacity(0.14))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(isFocused ? Theme.accent : .clear, lineWidth: 4)
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.8) : .clear, radius: 30)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
    }
}

/// Reusable focusable circle button that exposes its focus state to the
/// label closure so callers can draw their own border (avoids tvOS's white
/// default halo).
struct FocusableCircle<Label: View>: View {
    let size: CGFloat
    var focusRequest: Int = 0
    let action: () -> Void
    @ViewBuilder let label: (Bool) -> Label
    @FocusState private var isFocused: Bool

    var body: some View {
        Button(action: action) {
            label(isFocused)
                .frame(width: size, height: size)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
        .onChange(of: focusRequest) { _, _ in isFocused = true }
    }
}

/// Mini equalizer pill shown next to the country pill (1383, 67).
private struct MiniEqIndicator: View {
    let isPlaying: Bool

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 30)
                .fill(isPlaying ? Theme.accent : Color.white.opacity(0.10))
            HStack(alignment: .bottom, spacing: 2.5) {
                bar(height: isPlaying ? nil : 25)
                bar(height: isPlaying ? nil : 17.5)
                bar(height: isPlaying ? nil : 21.25)
            }
            .frame(width: 23.75, height: 25)
        }
        .frame(width: 51, height: 51)
    }

    @ViewBuilder
    private func bar(height: CGFloat?) -> some View {
        if let height {
            RoundedRectangle(cornerRadius: 10).fill(Color.white)
                .frame(width: 6.25, height: height)
        } else {
            EQAnimatedBar(width: 6.25)
        }
    }
}

/// Pink equalizer bars rendered to the right of the station artwork (596, 242).
private struct PinkEqBars: View {
    let isPlaying: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 3.5) {
            bar(default: 35, mid: 35)
            bar(default: 24.5, mid: 35)
            bar(default: 29.75, mid: 35)
        }
        .frame(width: 33.25, height: 35, alignment: .bottomLeading)
    }

    @ViewBuilder
    private func bar(default defaultHeight: CGFloat, mid: CGFloat) -> some View {
        if isPlaying {
            EQAnimatedBar(width: 8.75, color: Theme.accent, maxHeight: 35)
        } else {
            RoundedRectangle(cornerRadius: 10)
                .fill(Theme.accent)
                .frame(width: 8.75, height: defaultHeight)
        }
    }
}

/// Simple animated equalizer bar (1.2 s ease-in-out, alternating heights).
struct EQAnimatedBar: View {
    var width: CGFloat = 4
    var color: Color = .white
    var maxHeight: CGFloat = 25
    @State private var phase: CGFloat = 0.3

    var body: some View {
        RoundedRectangle(cornerRadius: width / 2)
            .fill(color)
            .frame(width: width, height: maxHeight * phase)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true)) {
                    phase = 1.0
                }
            }
    }
}
