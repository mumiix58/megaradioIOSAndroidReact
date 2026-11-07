import SwiftUI

/// Apple TV currently has no paid feature or app-ad SDK. Do not sell an
/// entitlement here that cannot change this platform's listening experience.
struct PremiumPage: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var router: TVRouter
    @State private var busy = false
    @State private var notice = ""
    @State private var failure = ""
    @State private var legalDocument: TVLegalDocument?
    @State private var restoreTask: Task<Void, Never>?
    @State private var restoreID: UUID?

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            Text("Account & Subscriptions").font(.ubuntu(46, .bold))

            VStack(alignment: .leading, spacing: 14) {
                Text("Apple TV listening is included").font(.ubuntu(30, .bold))
                Text("Discover stations, listen live and save favorites without a subscription. This Apple TV app does not display app ads or offer new purchases.")
                Text("Radio stations may include their own advertisements in a broadcast. A MegaRadio subscription cannot remove those advertisements.")
                    .foregroundColor(Theme.textSecondary)
            }
            .padding(28)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface)
            .cornerRadius(20)
            .accessibilityIdentifier("tv-subscriptions-included")

            Text("Existing purchases").font(.ubuntu(30, .bold))
            Text("Restore an existing Apple purchase to verify it with your signed-in MegaRadio account. Its benefits apply in supported MegaRadio apps; restoring does not unlock additional Apple TV features.")
                .foregroundColor(Theme.textSecondary)

            if auth.isAuthenticated {
                Button("Restore Purchases") { restorePurchases() }
                    .disabled(busy)
                    .accessibilityIdentifier("tv-premium-restore")
            } else {
                Button("Sign in to restore an existing purchase") { router.go(.login) }
                    .accessibilityIdentifier("tv-premium-login")
            }

            Group {
                if busy {
                    ProgressView("Verifying your existing purchase…")
                } else if !failure.isEmpty {
                    Text(failure).foregroundColor(Theme.red)
                        .accessibilityIdentifier("tv-premium-error")
                } else if !notice.isEmpty {
                    Text(notice).foregroundColor(Theme.accent)
                        .accessibilityIdentifier("tv-premium-result")
                }
            }
            .font(.ubuntu(22))

            Text("Manage or cancel an Apple subscription in Apple TV Settings → Users and Accounts → your account → Subscriptions. Removing this app does not cancel a subscription.")
                .font(.ubuntu(22)).foregroundColor(Theme.textSecondary)
                .accessibilityIdentifier("tv-subscriptions-manage")

            HStack(spacing: 32) {
                Button("Privacy Policy") { legalDocument = .privacy }
                    .accessibilityIdentifier("tv-privacy-policy")
                Button("Terms of Use (EULA)") { legalDocument = .terms }
                    .accessibilityIdentifier("tv-terms-of-use")
                Button("Back") { leavePage() }
                    .accessibilityIdentifier("tv-premium-back")
            }
            .padding(.top, 10)
            Spacer(minLength: 0)
        }
        .font(.ubuntu(25)).foregroundColor(Theme.textPrimary)
        .padding(.horizontal, 100).padding(.vertical, 70)
        .frame(width: 1920, height: 1080, alignment: .topLeading)
        .background(Theme.background.ignoresSafeArea())
        .fullScreenCover(item: $legalDocument) { document in
            TVLegalDocumentPage(document: document)
        }
        .onDisappear { cancelRestore() }
        .onExitCommand { leavePage() }
    }

    private func restorePurchases() {
        guard !busy else { return }
        busy = true; failure = ""; notice = ""
        let operation = UUID()
        restoreID = operation
        restoreTask = Task { @MainActor in
            defer {
                if restoreID == operation {
                    busy = false
                    restoreID = nil
                    restoreTask = nil
                }
            }
            do {
                try await auth.refreshSession()
                try Task.checkCancellation()
                let result = try await StoreKitIapService.shared.restore()
                guard restoreID == operation, !Task.isCancelled else { return }
                if result["ok"] as? Bool == true {
                    try await auth.refreshSession()
                    guard restoreID == operation, !Task.isCancelled else { return }
                    notice = "Your existing purchase was verified with your MegaRadio account. Apple TV listening remains included."
                } else {
                    failure = result["error"] as? String ?? "The purchase could not be restored."
                }
            } catch {
                guard restoreID == operation, !Task.isCancelled else { return }
                failure = error.localizedDescription
            }
        }
    }

    private func cancelRestore() {
        restoreID = nil
        restoreTask?.cancel()
        restoreTask = nil
        busy = false
    }

    private func leavePage() {
        cancelRestore()
        router.back()
    }
}
