// Guides.swift — 1:1 port of `web-preview/src/pages/Guide{1..4}.tsx`.
//
// Onboarding walkthrough overlay. Pressing OK / clicking anywhere advances
// to the next step. After step 4 the user lands on /discover-no-user, and
// the `onboardingCompleted` flag is set so the splash never shows again.

import SwiftUI

struct GuidePage: View {
    @EnvironmentObject var router: TVRouter
    @FocusState private var ctaFocused: Bool
    let step: Int

    var body: some View {
        Stage1920x1080 {
            // ── Background: discover-background.png with dark overlay.
            ZStack {
                BrandImage(name: "discover-background", contentMode: .fill)
                    .frame(width: 1920, height: 1080)
                Color.black.opacity(0.20)
            }
            .frame(width: 1920, height: 1080)
            .opacity(0.70)

            // ── Highlighted sidebar button (white-on-translucent square).
            sidebarTarget
                .frame(width: 98, height: 98)
                .background(RoundedRectangle(cornerRadius: 10)
                    .fill(Color.white.opacity(0.20)))
                .offset(x: highlightX, y: highlightY)

            // ── Arrow pointing right (rotated 1.292°).
            BrandImage(name: "arrow")
                .frame(width: 130.979, height: 31.65)
                .rotationEffect(.degrees(1.292))
                .offset(x: 188, y: arrowY)

            // ── Tooltip box (black pill with colored bullet).
            tooltipBox
                .offset(x: 340, y: tooltipY)

            // ── Invisible full-screen "tap to continue" button.
            Button { advance() } label: {
                Color.clear.frame(width: 1920, height: 1080)
            }
            .buttonStyle(.tvTransparent)
            .focused($ctaFocused)
        }
        .onAppear { ctaFocused = true }
    }

    private func advance() {
        if step < 4 {
            router.replace(.guide(step + 1))
        } else {
            // Finish onboarding.
            UserDefaults.standard.set(true, forKey: "megaradio.tv.onboardingCompleted")
            router.replace(.discover)
        }
    }

    // MARK: - Step-specific layout values (taken verbatim from web)

    private var highlightY: CGFloat {
        switch step {
        case 1: return 242
        case 2: return 346
        case 3: return 457
        case 4: return 565
        default: return 242
        }
    }
    private var arrowY: CGFloat {
        switch step {
        case 1: return 274
        case 2: return 381
        case 3: return 490
        case 4: return 596
        default: return 274
        }
    }
    private var tooltipY: CGFloat {
        switch step {
        case 1: return 233
        case 2: return 338
        case 3: return 449
        case 4: return 555
        default: return 233
        }
    }

    // ── Sidebar button highlighted in each step.
    @ViewBuilder
    private var sidebarTarget: some View {
        VStack(spacing: 4) {
            BrandImage(name: iconName).frame(width: 32, height: 32)
            Text(label)
                .font(.ubuntu(18, .medium))
                .foregroundColor(.white)
        }
    }
    private var iconName: String {
        switch step {
        case 1: return "radio-icon"
        case 2: return "music-icon"
        case 3: return "search-icon"
        case 4: return "heart-icon"
        default: return "radio-icon"
        }
    }
    private var label: String {
        switch step {
        case 1: return "Discover"
        case 2: return "Genres"
        case 3: return "Search"
        case 4: return "Favorites"
        default: return ""
        }
    }
    private var highlightX: CGFloat {
        switch step {
        case 1: return 64
        case 2: return 63
        case 3: return 63
        case 4: return 62
        default: return 63
        }
    }

    // ── Tooltip content (color + lines).
    @ViewBuilder
    private var tooltipBox: some View {
        let (color, lines, width) = tooltipInfo
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 10).fill(Color.black)
            Circle()
                .fill(color)
                .frame(width: 18.667, height: 18.667)
                .offset(x: 24, y: 48)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(lines, id: \.self) { line in
                    Text(line)
                        .font(.ubuntu(24, .medium))
                        .foregroundColor(.white)
                }
            }
            .offset(x: 67, y: 29)
        }
        .frame(width: width, height: 115)
    }

    private var tooltipInfo: (Color, [String], CGFloat) {
        switch step {
        case 1: return (
            Theme.red,
            ["Discover radio stations from around the world.",
             "Select Discover in the sidebar with your Siri Remote."],
            720)
        case 2: return (
            Color(red: 0x55/255, green: 0xE9/255, blue: 0x52/255),
            ["Select Genres in the sidebar to browse by music style."],
            509)
        case 3: return (
            Color(red: 0x2D/255, green: 0x41/255, blue: 0xF4/255),
            ["Find a radio station by name.",
             "Select Search in the sidebar to begin."],
            597)
        case 4: return (
            Color(red: 0xF4/255, green: 0xEC/255, blue: 0x2D/255),
            ["Save stations with the heart button while listening.",
             "Select Favorites in the sidebar to find them again."],
            597)
        default: return (Theme.red, [], 0)
        }
    }
}
