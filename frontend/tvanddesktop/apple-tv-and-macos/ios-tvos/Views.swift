// Views.swift — Root router + shared components for MegaRadio TV.
//
// Every reusable widget porting a piece of `web-preview/src/components/*.tsx`
// lives here:
//   • MegaRadioLogo       — `web-preview/.../Splash.tsx`+`DiscoverNoUser.tsx`
//   • AppSidebar          — `web-preview/src/components/Sidebar.tsx`
//   • CountryTriggerHeader/ LoginHeaderButton — header pills (1453, 67) / (1694, 67)
//   • GlobalPlayerView    — `web-preview/src/components/GlobalPlayer.tsx`
//
// Plus the root router that swaps pages based on `TVRouter.route`.

import SwiftUI

// ────────────────────────────────────────────────────────────────────
// Custom button style — fully transparent (no default tvOS halo).
// ────────────────────────────────────────────────────────────────────

#if os(tvOS)
/// Removes tvOS's default white focus halo so we can apply our own pink
/// border / glow / scale animations that match the web design exactly.
///
/// We make the label `focusable(true)` so the system still routes
/// arrow-key navigation to it, and we call `focusEffectDisabled()` to
/// suppress the default white halo. The caller is responsible for
/// attaching a `@FocusState` via `.focused($foo)` and rendering its
/// own focus appearance.
struct TVTransparentButtonStyle: PrimitiveButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .focusable(true)
            .focusEffectDisabled()
            .onTapGesture { configuration.trigger() }
    }
}

extension PrimitiveButtonStyle where Self == TVTransparentButtonStyle {
    static var tvTransparent: TVTransparentButtonStyle { TVTransparentButtonStyle() }
}
#endif

// ────────────────────────────────────────────────────────────────────
// Root router
// ────────────────────────────────────────────────────────────────────

struct RootRouterView: View {
    @EnvironmentObject var router: TVRouter
    @EnvironmentObject var player: AudioPlayer

    var body: some View {
        ZStack {
            currentPage
                .id(routeID)
                .transition(.opacity)

            // Persistent global player (matches web `GlobalPlayer`).
            if let _ = player.currentStation, !shouldHideGlobalPlayer {
                GlobalPlayerView()
                    .allowsHitTesting(true)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .transition(.opacity)
            }

            // Global Help popup (sidebar "Help" item). Always on top.
            HelpOverlay()
        }
        .animation(.easeInOut(duration: 0.25), value: router.route)
    }

    private var shouldHideGlobalPlayer: Bool {
        switch router.route {
        case .radioPlaying, .splash, .guide,
             .search, .settings, .countrySelect, .login, .premium:
            return true
        default:
            return false
        }
    }

    @ViewBuilder private var currentPage: some View {
        switch router.route {
        case .splash:                SplashPage()
        case .guide(let n):          GuidePage(step: n)
        case .discover:              DiscoverPage()
        case .radioPlaying:          RadioPlayingPage()
        case .genres:                GenresPage()
        case .genreList(let tag):    GenreListPage(tag: tag)
        case .search:                SearchPage()
        case .favorites:             FavoritesPage()
        case .countrySelect:         CountrySelectPage()
        case .settings:              SettingsPage()
        case .login:                 LoginPage()
        case .premium:               PremiumPage()
        }
    }

    private var routeID: String {
        switch router.route {
        case .splash:                return "splash"
        case .guide(let n):          return "guide-\(n)"
        case .discover:              return "discover"
        case .radioPlaying:          return "radio-playing"
        case .genres:                return "genres"
        case .genreList(let t):      return "genre-list-\(t)"
        case .search:                return "search"
        case .favorites:             return "favorites"
        case .countrySelect:         return "country-select"
        case .settings:              return "settings"
        case .login:                 return "login"
        case .premium:               return "premium"
        }
    }
}

// ────────────────────────────────────────────────────────────────────
// MegaRadioLogo — 1:1 port of the web `images/path-8.svg` + wordmark.
// ────────────────────────────────────────────────────────────────────

/// Splash size: 323.069 × 112. Header size: 164.421 × 57 (scale = 0.5085).
struct MegaRadioLogo: View {
    let scale: CGFloat
    init(scale: CGFloat = 1.0) { self.scale = scale }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Pink swoosh (`images/path-8.svg`), occupies left 34.8% of width.
            BrandImage(name: "path-8")
                .frame(width: 323.069 * 0.348 * scale, height: 112 * scale)

            // Wordmark "mega" Bold + "radio" Regular — 53.108 px font.
            HStack(spacing: 0) {
                Text("mega").font(.ubuntu(53.108 * scale, .bold))
                Text("radio").font(.ubuntu(53.108 * scale, .regular))
            }
            .foregroundColor(.white)
            .offset(x: 323.069 * 0.1867 * scale, y: 112 * 0.4616 * scale)
        }
        .frame(width: 323.069 * scale, height: 112 * scale, alignment: .topLeading)
    }
}

// ────────────────────────────────────────────────────────────────────
// AppSidebar — 1:1 port of `web-preview/src/components/Sidebar.tsx`.
// Position: left:48, top:170, width:120, height:760.
// Item: 120×100 each, 108 px vertical pitch (8 px gap).
// ────────────────────────────────────────────────────────────────────

struct AppSidebar: View {
    let active: Route
    var onMoveRight: (() -> Void)? = nil
    @EnvironmentObject var router: TVRouter

    fileprivate struct Item {
        let id: String
        let label: String
        let icon: String   // PNG asset name in `Assets/Images/`, or SF Symbol if isSymbol
        let route: Route?  // nil = non-navigating (Help)
        var isSymbol: Bool = false
    }

    private let items: [Item] = [
        .init(id: "discover",  label: "Discover",  icon: "radio-icon",    route: .discover),
        .init(id: "genres",    label: "Genres",    icon: "music-icon",    route: .genres),
        .init(id: "search",    label: "Search",    icon: "search-icon",   route: .search),
        .init(id: "favorites", label: "Favorites", icon: "heart-icon",    route: .favorites),
        .init(id: "country",   label: "Country",   icon: "globe-icon",    route: .countrySelect),
        .init(id: "settings",  label: "Settings",  icon: "settings-icon", route: .settings),
        .init(id: "help",      label: "Help",      icon: "questionmark.circle", route: nil, isSymbol: true),
    ]

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                SidebarItemView(
                    item: item,
                    isActive: item.route.map { matches(active, $0) } ?? false
                ) {
                    if item.id == "help" { HelpStore.shared.open() }
                    else if let r = item.route { router.go(r) }
                }
                .offset(x: 0, y: CGFloat(idx) * 108)
            }
        }
        .frame(width: 120, height: 760, alignment: .topLeading)
        .focusSection()
        .onMoveCommand { direction in
            if direction == .right { onMoveRight?() }
        }
        .offset(x: 48, y: 170)
    }

    private func matches(_ r: Route, _ target: Route) -> Bool {
        switch (r, target) {
        case (.discover, .discover),
             (.genres, .genres), (.genreList, .genres),
             (.search, .search),
             (.favorites, .favorites),
             (.countrySelect, .countrySelect),
             (.settings, .settings),
             (.login, .settings):
            return true
        default: return false
        }
    }
}

/// Single sidebar item. Uses `tvTransparent` button style so we control
/// the focus appearance entirely (no white halo, no tilt).
private struct SidebarItemView: View {
    let item: SidebarItem
    let isActive: Bool
    let onTap: () -> Void
    @FocusState private var isFocused: Bool

    typealias SidebarItem = AppSidebar.Item

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 6) {
                Group {
                    if item.isSymbol {
                        Image(systemName: item.icon)
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(.white)
                    } else {
                        BrandImage(name: item.icon)
                    }
                }
                .frame(width: 28, height: 28)
                Text(item.label)
                    .font(.ubuntu(16, .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .frame(width: 104)
            }
            .frame(width: 120, height: 100)
            .background(
                // Focused state has a brighter highlight + visible border so it
                // is unambiguously distinct from the dimmer "active page" state.
                RoundedRectangle(cornerRadius: 10)
                    .fill(
                        isFocused ? Theme.accent.opacity(0.45)
                        : isActive ? Theme.accent.opacity(0.18)
                        : Color.clear
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isFocused ? Theme.accent : .clear, lineWidth: 3)
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.7) : .clear,
                    radius: 22, x: 0, y: 0)
            .scaleEffect(isFocused ? 1.04 : 1.0)
            .opacity(isFocused ? 1 : (isActive ? 0.95 : 0.8))
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
        .animation(.easeInOut(duration: 0.2), value: isFocused)
        .animation(.easeInOut(duration: 0.2), value: isActive)
    }
}

// ────────────────────────────────────────────────────────────────────
// EngineSidebar — non-focusable sidebar for explicit-focus-engine pages.
// Renders highlight from an external focus index (mirrors AppSidebar look)
// so a single-container page can own ALL navigation (Tizen index model).
// ────────────────────────────────────────────────────────────────────

struct EngineSidebarItem {
    let id: String
    let label: String
    let icon: String
    let route: Route?
    var isSymbol: Bool = false
}

let engineSidebarItems: [EngineSidebarItem] = [
    .init(id: "discover",  label: "Discover",  icon: "radio-icon",    route: .discover),
    .init(id: "genres",    label: "Genres",    icon: "music-icon",    route: .genres),
    .init(id: "search",    label: "Search",    icon: "search-icon",   route: .search),
    .init(id: "favorites", label: "Favorites", icon: "heart-icon",    route: .favorites),
    .init(id: "country",   label: "Country",   icon: "globe-icon",    route: .countrySelect),
    .init(id: "settings",  label: "Settings",  icon: "settings-icon", route: .settings),
    .init(id: "help",      label: "Help",      icon: "questionmark.circle", route: nil, isSymbol: true),
]

struct EngineSidebar: View {
    let activeIndex: Int      // page that is active (dim highlight)
    let focusedIndex: Int?    // engine focus (bright highlight); nil if elsewhere

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(engineSidebarItems.enumerated()), id: \.element.id) { idx, item in
                EngineSidebarItemView(item: item,
                                      isActive: idx == activeIndex,
                                      isFocused: focusedIndex == idx)
                    .offset(x: 0, y: CGFloat(idx) * 108)
            }
        }
        .frame(width: 120, height: 760, alignment: .topLeading)
        .offset(x: 48, y: 170)
    }
}

private struct EngineSidebarItemView: View {
    let item: EngineSidebarItem
    let isActive: Bool
    let isFocused: Bool

    var body: some View {
        VStack(spacing: 6) {
            Group {
                if item.isSymbol {
                    Image(systemName: item.icon)
                        .font(.system(size: 24, weight: .regular)).foregroundColor(.white)
                } else {
                    BrandImage(name: item.icon)
                }
            }
            .frame(width: 28, height: 28)
            Text(item.label)
                .font(.ubuntu(16, .medium)).foregroundColor(.white)
                .lineLimit(1).frame(width: 104)
        }
        .frame(width: 120, height: 100)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(isFocused ? Theme.accent.opacity(0.45)
                      : isActive ? Theme.accent.opacity(0.18) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isFocused ? Theme.accent : .clear, lineWidth: 3)
        )
        .shadow(color: isFocused ? Theme.accent.opacity(0.7) : .clear, radius: 22)
        .scaleEffect(isFocused ? 1.04 : 1.0)
        .opacity(isFocused ? 1 : (isActive ? 0.95 : 0.8))
    }
}

// ────────────────────────────────────────────────────────────────────
// Header pills
// ────────────────────────────────────────────────────────────────────

/// Country trigger at (1453, 67).
/// Web: rounded white pill, flag + name + globe icon.
struct CountryTriggerHeader: View {
    @EnvironmentObject var country: CountryStore
    @EnvironmentObject var router: TVRouter
    @FocusState private var isFocused: Bool

    var body: some View {
        Button { router.go(.countrySelect) } label: {
            HStack(spacing: 10) {
                FlagThumb(
                    url: URL(string: "https://flagcdn.com/w40/\(country.selectedCountryCode.lowercased()).png"),
                    width: 30, height: 20, cornerRadius: 3
                )
                Text(country.selectedCountryName)
                    .font(.ubuntu(18, .bold)).foregroundColor(.white).lineLimit(1)
                BrandImage(name: "globe-icon").frame(width: 18, height: 18)
            }
            .padding(.horizontal, 18).padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 30)
                    .fill(isFocused ? Theme.accent.opacity(0.25) : Color.white.opacity(0.10))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 30)
                    .stroke(isFocused ? Theme.accent : .clear, lineWidth: 3)
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.6) : .clear, radius: 16)
            .scaleEffect(isFocused ? 1.05 : 1)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
    }
}

/// Login button at (1694, 67).
struct LoginHeaderButton: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var router: TVRouter
    @FocusState private var isFocused: Bool

    var body: some View {
        Button {
            router.go(auth.isAuthenticated ? .settings : .login)
        } label: {
            HStack(spacing: 6) {
                if auth.isAuthenticated {
                    Circle().fill(Theme.accent).frame(width: 34, height: 34)
                        .overlay(
                            Text(String(auth.user?.displayName?.prefix(1) ?? "U"))
                                .font(.ubuntu(16, .bold)).foregroundColor(.white)
                        )
                } else {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 22)).foregroundColor(.white)
                    Text("Login").font(.ubuntu(18, .bold)).foregroundColor(.white)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            .frame(height: 51)
            .background(
                RoundedRectangle(cornerRadius: 30)
                    .fill(auth.isAuthenticated ? Color.white.opacity(0.10) : Theme.accent)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 30)
                    .stroke(isFocused ? .white : .clear, lineWidth: 4)
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.8) : .clear, radius: 30)
            .scaleEffect(isFocused ? 1.10 : 1)
        }
        .buttonStyle(.tvTransparent)
        .focused($isFocused)
    }
}

// ────────────────────────────────────────────────────────────────────
// GlobalPlayerView — port of `web-preview/src/components/GlobalPlayer.tsx`.
// Bottom-anchored mini player. No white halos — only pink ring on focus.
// ────────────────────────────────────────────────────────────────────

struct GlobalPlayerView: View {
    @EnvironmentObject var player: AudioPlayer
    @EnvironmentObject var router: TVRouter
    @EnvironmentObject var favorites: FavoritesStore

    private let btn: CGFloat = 90.192   // web button diameter
    private let top: CGFloat = 958       // web button/logo top

    var body: some View {
        if let station = player.currentStation {
            ZStack(alignment: .topLeading) {
                // ── Backdrop-blur dark bar: (0,925) 1920×155, black 0.61 @0.82.
                ZStack {
                    Rectangle().fill(.ultraThinMaterial)
                    Rectangle().fill(Color.black.opacity(0.55))
                }
                .frame(width: 1920, height: 155)
                .offset(x: 0, y: 925)

                // ── Station logo (white bg, 89×89, r=4.45) at (235,958).
                ZStack {
                    RoundedRectangle(cornerRadius: 4.45).fill(.white)
                    AsyncImage(url: station.artworkURL) { phase in
                        if let img = phase.image { img.resizable().scaledToFill() }
                        else { BrandImage(name: "fallback-station", contentMode: .fill) }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 4.45))
                }
                .frame(width: 89, height: 89)
                .offset(x: 235, y: top)

                // ── Station name (357,976), 24px medium, max 450.
                Text(station.name)
                    .font(.ubuntu(24, .medium)).foregroundColor(.white).lineLimit(1)
                    .frame(width: 450, alignment: .leading)
                    .offset(x: 357, y: 976)

                // ── Country • metadata row (357,1007).
                HStack(spacing: 12) {
                    Text(station.country ?? "Radio")
                        .font(.ubuntu(20, .light)).foregroundColor(.white).lineLimit(1)
                    if let meta = player.nowPlayingTitle, !meta.isEmpty {
                        Text("•").font(.system(size: 20)).foregroundColor(.white.opacity(0.5))
                        Text(meta).font(.ubuntu(20, .light)).foregroundColor(Theme.accent).lineLimit(1)
                    }
                }
                .frame(width: 750, alignment: .leading)
                .offset(x: 357, y: 1007)

                // ── Play / Pause (black circle) at (1462.54, 958).
                circleButton(filled: false, action: { player.togglePlayPause() }) {
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 40, weight: .bold)).foregroundColor(.white)
                }
                .offset(x: 1462.54, y: top)

                // ── Favorite (pink when active) at (1588.81, 958).
                circleButton(filled: favorites.isFavorite(station),
                             action: { favorites.toggle(station) }) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 34, weight: .bold)).foregroundColor(.white)
                }
                .offset(x: 1588.81, y: top)

                // ── Equalizer / expand (pink when playing) at (1715, 958).
                circleButton(filled: player.isPlaying,
                             action: { router.go(.radioPlaying) }) {
                    HStack(alignment: .bottom, spacing: 2) {
                        eqBar(playing: player.isPlaying, idle: 35.5)
                        eqBar(playing: player.isPlaying, idle: 24.8)
                        eqBar(playing: player.isPlaying, idle: 30.2)
                    }
                    .frame(width: 33.75, height: 35.5, alignment: .bottom)
                }
                .offset(x: 1715, y: top)
            }
            .frame(width: 1920, height: 1080, alignment: .topLeading)
        }
    }

    /// 90.192 circle. Black by default, pink when `filled`. Pink ring on focus.
    @ViewBuilder
    private func circleButton<L: View>(
        filled: Bool, action: @escaping () -> Void, @ViewBuilder label: @escaping () -> L
    ) -> some View {
        FocusableCircle(size: btn, action: action) { isFocused in
            ZStack {
                Circle().fill(filled ? Theme.accent : Color.black)
                label()
            }
            .overlay(
                Circle().stroke(
                    isFocused ? Theme.accent : (filled ? Theme.accent : Color.black),
                    lineWidth: isFocused ? 4 : 3.608
                )
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.8) : .clear, radius: 28)
        }
    }

    @ViewBuilder
    private func eqBar(playing: Bool, idle: CGFloat) -> some View {
        if playing {
            EQAnimatedBar(width: 8.88, color: .white, maxHeight: 35.5)
        } else {
            RoundedRectangle(cornerRadius: 10).fill(.white).frame(width: 8.88, height: idle)
        }
    }
}

// ────────────────────────────────────────────────────────────────────
// HelpStore + HelpOverlay — port of the `HelpModal` in web `App.tsx`.
// Triggered by the sidebar "Help" item.
// ────────────────────────────────────────────────────────────────────

@MainActor
final class HelpStore: ObservableObject {
    static let shared = HelpStore()
    @Published var isOpen = false
    private init() {}
    func open() { isOpen = true }
    func close() { isOpen = false }
}

private struct HelpColorRow: Identifiable {
    let id = UUID()
    let color: Color
    let label: String
}

struct HelpOverlay: View {
    @ObservedObject private var help = HelpStore.shared
    @FocusState private var closeFocused: Bool

    private let rows: [HelpColorRow] = [
        .init(color: Color(red: 0xE7/255, green: 0x4C/255, blue: 0x3C/255), label: "Add to Favorites"),
        .init(color: Color(red: 0x27/255, green: 0xAE/255, blue: 0x60/255), label: "Play / Pause"),
        .init(color: Color(red: 0xF1/255, green: 0xC4/255, blue: 0x0F/255), label: "Open Search"),
        .init(color: Color(red: 0x34/255, green: 0x98/255, blue: 0xDB/255), label: "Change Country"),
    ]

    var body: some View {
        if help.isOpen {
            ZStack {
                Color.black.opacity(0.75).ignoresSafeArea()

                VStack(spacing: 0) {
                    Text("Remote Control Colors")
                        .font(.ubuntu(32, .bold)).foregroundColor(.white)
                        .padding(.bottom, 32)

                    VStack(alignment: .leading, spacing: 20) {
                        ForEach(rows) { row in
                            HStack(spacing: 20) {
                                Circle().fill(row.color).frame(width: 36, height: 36)
                                    .shadow(color: row.color.opacity(0.5), radius: 8)
                                Text(row.label)
                                    .font(.ubuntu(24, .medium)).foregroundColor(Color(white: 0.88))
                            }
                        }
                    }

                    Button { help.close() } label: {
                        Text("Close")
                            .font(.ubuntu(22, .medium)).foregroundColor(.white)
                            .padding(.horizontal, 48).padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 12)
                                .fill(closeFocused ? Theme.accent : Theme.accent.opacity(0.3)))
                            .overlay(RoundedRectangle(cornerRadius: 12)
                                .stroke(Theme.accent.opacity(0.5), lineWidth: 2))
                    }
                    .buttonStyle(.tvTransparent)
                    .focused($closeFocused)
                    .padding(.top, 36)
                }
                .padding(.vertical, 48).padding(.horizontal, 56)
                .frame(minWidth: 520, maxWidth: 640)
                .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surfaceAlt))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.accent.opacity(0.3), lineWidth: 2))
            }
            .onAppear { closeFocused = true }
            .onExitCommand { help.close() }
        }
    }
}
