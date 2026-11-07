// Settings.swift — Port of `web-preview/src/pages/Settings.tsx` + `Login.tsx`.

import SwiftUI
import CoreImage.CIFilterBuiltins
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Static option data (mirrors KEYBOARD_OPTIONS / LANGUAGE_OPTIONS)

private struct SettingsOpt: Identifiable { let id: String; let label: String; let country: String }

private let kbOptions: [SettingsOpt] = [
    .init(id: "en", label: "English", country: "GB"),
    .init(id: "tr", label: "Türkçe", country: "TR"),
    .init(id: "ar", label: "العربية", country: "SA"),
    .init(id: "ru", label: "Русский", country: "RU"),
    .init(id: "de", label: "Deutsch", country: "DE"),
    .init(id: "fr", label: "Français", country: "FR"),
    .init(id: "es", label: "Español", country: "ES"),
    .init(id: "ja", label: "日本語", country: "JP"),
    .init(id: "zh", label: "中文", country: "CN"),
    .init(id: "ko", label: "한국어", country: "KR"),
    .init(id: "el", label: "Ελληνικά", country: "GR"),
    .init(id: "hi", label: "हिन्दी", country: "IN"),
    .init(id: "th", label: "ไทย", country: "TH"),
]

private let langOptions: [SettingsOpt] = [
    .init(id: "en", label: "English", country: "US"), .init(id: "de", label: "Deutsch", country: "DE"),
    .init(id: "fr", label: "Français", country: "FR"), .init(id: "es", label: "Español", country: "ES"),
    .init(id: "it", label: "Italiano", country: "IT"), .init(id: "pt", label: "Português", country: "PT"),
    .init(id: "ru", label: "Русский", country: "RU"), .init(id: "ja", label: "日本語", country: "JP"),
    .init(id: "zh", label: "中文", country: "CN"), .init(id: "ar", label: "العربية", country: "SA"),
    .init(id: "tr", label: "Türkçe", country: "TR"), .init(id: "pl", label: "Polski", country: "PL"),
    .init(id: "nl", label: "Nederlands", country: "NL"), .init(id: "sv", label: "Svenska", country: "SE"),
    .init(id: "no", label: "Norsk", country: "NO"), .init(id: "da", label: "Dansk", country: "DK"),
    .init(id: "fi", label: "Suomi", country: "FI"), .init(id: "cs", label: "Čeština", country: "CZ"),
    .init(id: "hu", label: "Magyar", country: "HU"), .init(id: "ro", label: "Română", country: "RO"),
    .init(id: "el", label: "Ελληνικά", country: "GR"), .init(id: "th", label: "ไทย", country: "TH"),
    .init(id: "ko", label: "한국어", country: "KR"), .init(id: "vi", label: "Tiếng Việt", country: "VN"),
    .init(id: "id", label: "Bahasa Indonesia", country: "ID"), .init(id: "ms", label: "Bahasa Melayu", country: "MY"),
    .init(id: "hi", label: "हिन्दी", country: "IN"), .init(id: "bn", label: "বাংলা", country: "BD"),
    .init(id: "ta", label: "தமிழ்", country: "IN"), .init(id: "te", label: "తెలుగు", country: "IN"),
    .init(id: "ur", label: "اردو", country: "PK"), .init(id: "fa", label: "فارسی", country: "IR"),
    .init(id: "he", label: "עברית", country: "IL"), .init(id: "uk", label: "Українська", country: "UA"),
    .init(id: "bg", label: "Български", country: "BG"), .init(id: "sr", label: "Српски", country: "RS"),
    .init(id: "hr", label: "Hrvatski", country: "HR"), .init(id: "sk", label: "Slovenčina", country: "SK"),
    .init(id: "sl", label: "Slovenščina", country: "SI"), .init(id: "et", label: "Eesti", country: "EE"),
    .init(id: "lv", label: "Latviešu", country: "LV"), .init(id: "lt", label: "Lietuvių", country: "LT"),
    .init(id: "is", label: "Íslenska", country: "IS"), .init(id: "ga", label: "Gaeilge", country: "IE"),
    .init(id: "sq", label: "Shqip", country: "AL"), .init(id: "mk", label: "Македонски", country: "MK"),
    .init(id: "am", label: "አማርኛ", country: "ET"), .init(id: "sw", label: "Kiswahili", country: "KE"),
]

private enum SettingsCategory: String, CaseIterable {
    case language, keyboard, playback, timer, accessibility, account, cast
    var label: String {
        switch self {
        case .language: return "Language"
        case .keyboard: return "Keyboard"
        case .playback: return "Playback"
        case .timer: return "Sleep Timer"
        case .accessibility: return "Accessibility"
        case .account: return "Account"
        case .cast: return "Cast"
        }
    }
    var symbol: String {
        switch self {
        case .language: return "globe"
        case .keyboard: return "keyboard"
        case .playback: return "play.fill"
        case .timer: return "moon.zzz"
        case .accessibility: return "accessibility"
        case .account: return "person.crop.circle"
        case .cast: return "wave.3.right"
        }
    }
}

private enum SFocus: Hashable {
    case category(Int)
    case option(Int)
    case premium
}

struct SettingsPage: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var router: TVRouter
    @StateObject private var settings = SettingsStore.shared

    @State private var categoryIndex = 0
    @FocusState private var focus: SFocus?

    private let categories = SettingsCategory.allCases
    private let playbackOptions = ["last-played", "random", "favorite", "none"]
    private let playbackLabels = ["last-played": "Last Played", "random": "Random", "favorite": "Favorite", "none": "None"]
    private let sleepOptions: [Int?] = [15, 30, 60, 120, nil]

    private var category: SettingsCategory { categories[categoryIndex] }

    var body: some View {
        Stage1920x1080 {
            MegaRadioLogo(scale: 164.421 / 323.069).offset(x: 31, y: 64)
            AppSidebar(active: .settings)

            Text("Settings").font(.ubuntu(36, .bold)).foregroundColor(.white)
                .offset(x: 236, y: 64)

            HStack(spacing: 0) {
                leftColumn.frame(width: 420).focusSection()
                Rectangle().fill(Color.white.opacity(0.06)).frame(width: 1)
                    .padding(.horizontal, 8)
                rightColumn
            }
            .frame(width: 1650, height: 900, alignment: .topLeading)
            .offset(x: 236, y: 140)
        }
        .onChange(of: focus) { _, newValue in
            if case .category(let i) = newValue { categoryIndex = i }
        }
    }

    // MARK: Left column — categories + premium + version

    private var leftColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(spacing: 4) {
                ForEach(Array(categories.enumerated()), id: \.element) { idx, cat in
                    categoryRow(idx: idx, cat: cat)
                }
            }
            .padding(.trailing, 24)

            VStack(alignment: .leading, spacing: 0) {
                goPremiumButton
                versionBlock
            }
            .padding(.top, 40)
            .padding(.horizontal, 24)
            .overlay(alignment: .top) {
                Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1)
            }
        }
    }

    private func categoryRow(idx: Int, cat: SettingsCategory) -> some View {
        let isFocused = focus == .category(idx)
        let isActive = categoryIndex == idx
        return Button { categoryIndex = idx } label: {
            HStack(spacing: 20) {
                Image(systemName: cat.symbol)
                    .font(.system(size: 22))
                    .foregroundColor(.white)
                    .frame(width: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(cat.label)
                        .font(.ubuntu(22, .medium))
                        .foregroundColor(isFocused || isActive ? .white : .white.opacity(0.7))
                        .lineLimit(1)
                    if !isFocused {
                        Text(categoryDescription(cat))
                            .font(.ubuntu(16)).foregroundColor(.white.opacity(0.35))
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if isActive && !isFocused {
                    RoundedRectangle(cornerRadius: 9999).fill(Theme.accent).frame(width: 4, height: 40)
                }
            }
            .padding(.horizontal, 24)
            .frame(height: 80)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(isFocused ? Theme.accent : (isActive ? Color.white.opacity(0.08) : Color.clear))
            )
            .shadow(color: isFocused ? Theme.accent.opacity(0.25) : .clear, radius: 30)
        }
        .buttonStyle(.tvTransparent)
        .focused($focus, equals: .category(idx))
    }

    private var goPremiumButton: some View {
        Button { router.go(.premium) } label: {
            HStack(spacing: 10) {
                Image(systemName: "star.fill").font(.system(size: 20))
                Text("Subscriptions").font(.ubuntu(20, .bold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 64)
            .background(
                RoundedRectangle(cornerRadius: 32)
                    .fill(LinearGradient(
                        colors: [Theme.accent, Color(red: 0xAD/255, green: 0, blue: 1)],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 32)
                    .stroke(focus == .premium ? .white : .clear, lineWidth: 3)
            )
            .shadow(color: Theme.accent.opacity(focus == .premium ? 0.85 : 0.45), radius: focus == .premium ? 24 : 16)
            .scaleEffect(focus == .premium ? 1.04 : 1)
        }
        .buttonStyle(.tvTransparent)
        .focused($focus, equals: .premium)
        .padding(.bottom, 20)
    }

    private var versionBlock: some View {
        HStack(spacing: 16) {
            BrandImage(name: "path-8").frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 0) {
                (Text("mega").font(.ubuntu(18, .bold)) + Text("radio").font(.ubuntu(18, .light)))
                    .foregroundColor(.white)
                Text("Version \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"))")
                    .font(.ubuntu(14)).foregroundColor(.white.opacity(0.3))
            }
        }
    }

    // MARK: Right column — header + options

    private var rightColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 16) {
                Text(category.label).font(.ubuntu(28, .bold)).foregroundColor(.white)
                Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1)
                Text(categoryDescription(category))
                    .font(.ubuntu(18)).foregroundColor(.white.opacity(0.35)).lineLimit(1)
            }
            .frame(height: 48)
            .padding(.bottom, 24)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 4) { optionsList }
                    .padding(.trailing, 16)
            }
            .frame(height: 800)
            .focusSection()
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .padding(.leading, 32)
    }

    @ViewBuilder private var optionsList: some View {
        switch category {
        case .language:
            ForEach(Array(langOptions.enumerated()), id: \.element.id) { idx, opt in
                flagOptionRow(idx: idx, opt: opt, selected: settings.language == opt.id) {
                    settings.language = opt.id
                }
            }
        case .keyboard:
            ForEach(Array(kbOptions.enumerated()), id: \.element.id) { idx, opt in
                flagOptionRow(idx: idx, opt: opt, selected: settings.keyboardId == opt.id) {
                    settings.keyboardId = opt.id
                }
            }
        case .playback:
            ForEach(Array(playbackOptions.enumerated()), id: \.offset) { idx, opt in
                radioRow(idx: idx, label: playbackLabels[opt] ?? opt, selected: settings.playAtStart == opt) {
                    settings.playAtStart = opt
                }
            }
        case .timer:
            ForEach(Array(sleepOptions.enumerated()), id: \.offset) { idx, opt in
                radioRow(idx: idx, label: sleepLabel(opt), selected: settings.sleepTimerMinutes == opt) {
                    settings.sleepTimerMinutes = opt
                }
            }
        case .accessibility:
            toggleRow(idx: 0, label: "High Contrast", desc: "Increases text and element visibility",
                      value: settings.highContrast) { settings.highContrast.toggle() }
            toggleRow(idx: 1, label: "Large Text", desc: "Makes all text 15% larger",
                      value: settings.largeText) { settings.largeText.toggle() }
        case .account:
            accountSection
        case .cast:
            castSection
        }
    }

    // MARK: Option row variants

    private func flagOptionRow(idx: Int, opt: SettingsOpt, selected: Bool, action: @escaping () -> Void) -> some View {
        let isFoc = focus == .option(idx)
        return Button(action: action) {
            HStack(spacing: 20) {
                FlagThumb(url: URL(string: "https://flagcdn.com/w40/\(opt.country.lowercased()).png"),
                          width: 40, height: 28, cornerRadius: 4)
                Text(opt.label).font(.ubuntu(22, .medium)).foregroundColor(.white).lineLimit(1)
                Spacer(minLength: 0)
                if selected { checkmark }
            }
            .padding(.horizontal, 24).frame(height: 68)
            .background(optionRowBg(isFoc, selected))
            .shadow(color: isFoc ? Theme.accent.opacity(0.3) : .clear, radius: 24)
        }
        .buttonStyle(.tvTransparent)
        .focused($focus, equals: .option(idx))
    }

    private func radioRow(idx: Int, label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        let isFoc = focus == .option(idx)
        return Button(action: action) {
            HStack(spacing: 20) {
                ZStack {
                    Circle().stroke(selected ? Theme.accent : Color.white.opacity(0.3), lineWidth: 3)
                        .frame(width: 28, height: 28)
                    if selected { Circle().fill(Theme.accent).frame(width: 14, height: 14) }
                }
                Text(label).font(.ubuntu(22, .medium)).foregroundColor(.white).lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 24).frame(height: 68)
            .background(optionRowBg(isFoc, selected))
            .shadow(color: isFoc ? Theme.accent.opacity(0.3) : .clear, radius: 24)
        }
        .buttonStyle(.tvTransparent)
        .focused($focus, equals: .option(idx))
    }

    private func toggleRow(idx: Int, label: String, desc: String, value: Bool, action: @escaping () -> Void) -> some View {
        let isFoc = focus == .option(idx)
        return Button(action: action) {
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(.ubuntu(22, .medium)).foregroundColor(.white).lineLimit(1)
                    Text(desc).font(.ubuntu(16)).foregroundColor(.white.opacity(0.45)).lineLimit(1)
                }
                Spacer(minLength: 0)
                ZStack(alignment: value ? .trailing : .leading) {
                    RoundedRectangle(cornerRadius: 9999)
                        .fill(value ? Theme.accent : Color.white.opacity(0.15))
                        .frame(width: 60, height: 34)
                    Circle().fill(.white).frame(width: 26, height: 26).padding(4)
                }
            }
            .padding(.horizontal, 24).frame(height: 88)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(isFoc ? Theme.accent.opacity(0.15) : Color.clear)
            )
            .shadow(color: isFoc ? Theme.accent.opacity(0.15) : .clear, radius: 24)
        }
        .buttonStyle(.tvTransparent)
        .focused($focus, equals: .option(idx))
    }

    @ViewBuilder private var accountSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if auth.isAuthenticated {
                HStack(spacing: 16) {
                    Circle().fill(Theme.accent).frame(width: 48, height: 48)
                        .overlay(Text(String(auth.user?.displayName?.prefix(1) ?? "U"))
                            .font(.ubuntu(22, .bold)).foregroundColor(.white))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(auth.user?.displayName ?? "MegaRadio user")
                            .font(.ubuntu(22, .bold)).foregroundColor(.white)
                        if let email = auth.user?.email {
                            Text(email).font(.ubuntu(16)).foregroundColor(.white.opacity(0.5))
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 24).frame(height: 80)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.05)))
            }

            premiumRow

            Button { auth.isAuthenticated ? auth.signOut() : router.go(.login) } label: {
                HStack(spacing: 20) {
                    Image(systemName: auth.isAuthenticated ? "rectangle.portrait.and.arrow.right" : "person.crop.circle.badge.plus")
                        .font(.system(size: 22))
                        .foregroundColor(auth.isAuthenticated ? Theme.red : .white)
                    Text(auth.isAuthenticated ? "Log Out" : "Log In")
                        .font(.ubuntu(22, .medium))
                        .foregroundColor(auth.isAuthenticated ? Theme.red : .white)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 24).frame(height: 68)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(focus == .option(1) ? (auth.isAuthenticated ? Theme.red.opacity(0.2) : Theme.accent) : Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(auth.isAuthenticated ? Theme.red.opacity(0.3) : Theme.accent.opacity(0.3), lineWidth: 1)
                )
            }
            .buttonStyle(.tvTransparent)
            .focused($focus, equals: .option(1))
        }
    }

    private var premiumRow: some View {
        Button { router.go(.premium) } label: {
            HStack(spacing: 20) {
                Image(systemName: "star.fill").font(.system(size: 22)).foregroundColor(Theme.accent)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Account & Subscriptions").font(.ubuntu(22, .bold)).foregroundColor(Theme.accent)
                    Text("Existing purchases · Privacy & Terms").font(.ubuntu(14)).foregroundColor(.white.opacity(0.55))
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 24).frame(height: 68)
            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.accent.opacity(0.08)))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.accent.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.tvTransparent)
        .focused($focus, equals: .option(0))
    }

    @ViewBuilder private var castSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 12) {
                Circle().fill(auth.isAuthenticated ? Color.yellow : Theme.red).frame(width: 12, height: 12)
                Text(auth.isAuthenticated
                     ? "Cast is active. Play a station from your mobile app."
                     : "Login required for Cast")
                    .font(.ubuntu(22)).foregroundColor(.white.opacity(0.8))
            }
            if auth.isAuthenticated {
                Text("Open megaradio app on your phone, select a station and tap Cast. It will automatically play here.")
                    .font(.ubuntu(18)).foregroundColor(.white.opacity(0.4)).lineSpacing(6)
            } else {
                Button { router.go(.login) } label: {
                    Text("Login").font(.ubuntu(22, .medium))
                        .foregroundColor(focus == .option(0) ? .white : Theme.accent)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 24).frame(height: 68)
                        .background(RoundedRectangle(cornerRadius: 14)
                            .fill(focus == .option(0) ? Theme.accent : Color.clear))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.accent.opacity(0.3), lineWidth: 1))
                }
                .buttonStyle(.tvTransparent)
                .focused($focus, equals: .option(0))
            }
        }
        .padding(.leading, 24)
    }

    // MARK: Helpers

    private var checkmark: some View {
        Circle().fill(Theme.accent).frame(width: 28, height: 28)
            .overlay(Text("✓").font(.system(size: 16)).foregroundColor(.white))
    }

    private func optionRowBg(_ focused: Bool, _ selected: Bool) -> some View {
        RoundedRectangle(cornerRadius: 14)
            .fill(focused ? Theme.accent : (selected ? Theme.accent.opacity(0.12) : Color.clear))
    }

    private func sleepLabel(_ opt: Int?) -> String {
        switch opt {
        case 15: return "15 min"
        case 30: return "30 min"
        case 60: return "1 hour"
        case 120: return "2 hours"
        default: return "Off"
        }
    }

    private func categoryDescription(_ cat: SettingsCategory) -> String {
        switch cat {
        case .language: return langOptions.first { $0.id == settings.language }?.label ?? "English"
        case .keyboard: return kbOptions.first { $0.id == settings.keyboardId }?.label ?? "English"
        case .playback: return playbackLabels[settings.playAtStart] ?? "None"
        case .timer: return sleepLabel(settings.sleepTimerMinutes)
        case .accessibility:
            var a: [String] = []
            if settings.highContrast { a.append("High Contrast") }
            if settings.largeText { a.append("Large Text") }
            return a.isEmpty ? "None" : a.joined(separator: ", ")
        case .account: return auth.isAuthenticated ? (auth.user?.displayName ?? "Logged In") : "Not Logged In"
        case .cast: return auth.isAuthenticated ? "Waiting for mobile..." : "Not Logged In"
        }
    }
}

// ────────────────────────────────────────────────────────────────────
// Login — QR / pairing-code page (web `pages/Login.tsx`).
// ────────────────────────────────────────────────────────────────────

struct LoginPage: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var router: TVRouter
    private enum LoginFocus: Hashable { case retry, skip }
    @FocusState private var focus: LoginFocus?

    private var codeChars: [String] {
        guard let c = auth.pendingCode, !c.isEmpty else { return [] }
        return c.map { String($0) }
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.accent.opacity(0.12), Theme.background],
                startPoint: .topTrailing, endPoint: .bottomLeading
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                MegaRadioLogo(scale: 220 / 323.069).padding(.bottom, 44)

                if let err = auth.lastError {
                    errorState(err)
                } else {
                    Text("To connect your TV, visit:")
                        .font(.ubuntu(28)).foregroundColor(.white.opacity(0.7))
                        .padding(.bottom, 12)
                    Text("themegaradio.com/tv")
                        .font(.ubuntu(42, .bold)).foregroundColor(Theme.accent)
                        .padding(.bottom, 12)
                    Text("Scan the QR code with your phone, or enter this code manually:")
                        .font(.ubuntu(24)).foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 28)

                    HStack(alignment: .center, spacing: 60) {
                        codeBoxes
                        orDivider
                        qrBlock
                    }
                    .padding(.bottom, 28)

                    if auth.pendingCode != nil {
                        waitingIndicator
                        if let deadline = auth.codeExpiresAt {
                            HStack(spacing: 8) {
                                Text("Code expires in")
                                Text(deadline, style: .timer)
                            }
                            .font(.ubuntu(18)).foregroundColor(.white.opacity(0.5))
                            .padding(.top, 10)
                        }
                    } else if auth.isRequestingCode {
                        ProgressView("Requesting a sign-in code…")
                            .font(.ubuntu(22)).tint(Theme.accent)
                            .accessibilityIdentifier("tv-login-loading")
                    } else {
                        Text(auth.isAuthenticated ? "Connected. Opening MegaRadio…" : "Ready to connect")
                            .font(.ubuntu(22)).foregroundColor(.white.opacity(0.5))
                    }
                }

                skipButton.padding(.top, 18)
            }
        }
        .frame(width: 1920, height: 1080)
        .accessibilityIdentifier("tv-login")
        .onAppear { focus = .skip }
        .task {
            if auth.isAuthenticated { router.replace(.discover) }
            else if auth.pendingCode == nil { await auth.startPairing() }
        }
        .onChange(of: auth.isAuthenticated) { _, signedIn in
            if signedIn { router.replace(.discover) }
        }
        .onChange(of: auth.lastError) { _, error in
            if error != nil { focus = .retry }
        }
        .onDisappear { auth.stopPairing() }
        .onExitCommand { router.go(.discover) }
    }

    /// 6 character boxes — always a single row (never wraps).
    private var codeBoxes: some View {
        HStack(spacing: 14) {
            ForEach(0..<6, id: \.self) { idx in
                let filled = idx < codeChars.count
                let ch = filled ? codeChars[idx] : "-"
                Text(ch)
                    .font(.ubuntu(84, .bold))
                    .foregroundColor(filled ? Theme.accent : .white.opacity(0.15))
                    .frame(width: 88, height: 108)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(filled ? Theme.accent.opacity(0.08) : Color.white.opacity(0.03))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(filled ? Theme.accent.opacity(0.5) : .white.opacity(0.15), lineWidth: 3)
                    )
            }
        }
        .fixedSize()
    }

    private var orDivider: some View {
        VStack(spacing: 8) {
            Rectangle().fill(.white.opacity(0.15)).frame(width: 2, height: 40)
            Text("OR").font(.ubuntu(20, .bold)).foregroundColor(.white.opacity(0.5)).tracking(2)
            Rectangle().fill(.white.opacity(0.15)).frame(width: 2, height: 40)
        }
    }

    @ViewBuilder private var qrBlock: some View {
        if let code = auth.pendingCode {
            VStack(spacing: 10) {
                QRCodeView(string: "https://www.themegaradio.com/tv?code=\(code)")
                    .frame(width: 160, height: 160)
                Text("Scan with your phone")
                    .font(.ubuntu(14, .medium)).foregroundColor(.black)
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 14).fill(.white))
            .shadow(color: Theme.accent.opacity(0.2), radius: 30)
        } else {
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(style: StrokeStyle(lineWidth: 3, dash: [8]))
                .foregroundColor(.white.opacity(0.15))
                .frame(width: 192, height: 192)
                .overlay(Text("QR").font(.ubuntu(16)).foregroundColor(.white.opacity(0.3)))
        }
    }

    private var waitingIndicator: some View {
        HStack(spacing: 12) {
            Circle().fill(Theme.accent).frame(width: 12, height: 12)
            Text("Waiting for activation…")
                .font(.ubuntu(22)).foregroundColor(.white.opacity(0.5))
        }
    }

    private var skipButton: some View {
        Button { router.go(.discover) } label: {
            Text("Continue without signing in")
                .font(.ubuntu(24, .medium)).foregroundColor(.white)
                .padding(.horizontal, 40).frame(minWidth: 440).frame(height: 64)
                .background(
                    RoundedRectangle(cornerRadius: 32)
                        .fill(focus == .skip ? Theme.accent.opacity(0.2) : Color.white.opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 32)
                        .stroke(focus == .skip ? Theme.accent : .white.opacity(0.2), lineWidth: 3)
                )
                .shadow(color: focus == .skip ? Theme.accent.opacity(0.4) : .clear, radius: 20)
        }
        .buttonStyle(.tvTransparent)
        .focused($focus, equals: .skip)
        .accessibilityIdentifier("tv-login-continue")
    }

    @ViewBuilder private func errorState(_ msg: String) -> some View {
        VStack(spacing: 20) {
            Text("Connection Error").font(.ubuntu(32, .bold)).foregroundColor(.white)
            Text(msg).font(.ubuntu(22)).foregroundColor(.white.opacity(0.6))
                .multilineTextAlignment(.center).frame(maxWidth: 600)
                .accessibilityIdentifier("tv-login-error")
            Button { Task { await auth.startPairing() } } label: {
                Text("Retry").font(.ubuntu(24, .bold)).foregroundColor(.white)
                    .frame(width: 300, height: 64)
                    .background(RoundedRectangle(cornerRadius: 32).fill(Theme.accent))
                    .overlay(RoundedRectangle(cornerRadius: 32)
                        .stroke(focus == .retry ? .white : .clear, lineWidth: 3))
                    .scaleEffect(focus == .retry ? 1.04 : 1)
            }
            .buttonStyle(.tvTransparent)
            .focused($focus, equals: .retry)
            .accessibilityIdentifier("tv-login-retry")
        }
    }
}

// MARK: - QR code (CoreImage, native — no dependency)

struct QRCodeView: View {
    let string: String
    var body: some View {
        if let img = Self.generate(string) {
            Image(uiImage: img).interpolation(.none).resizable()
        } else {
            Color.gray
        }
    }
    static func generate(_ string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "H"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
