// StoreKit 2 purchases are verified by the shared backend using the base64
// App Store app receipt. Transaction JWS is not accepted by verifyReceipt.

import Foundation
import StoreKit
#if canImport(UIKit)
import UIKit
#endif

#if os(tvOS) || os(iOS) || os(macOS)

@MainActor
final class StoreKitIapService: NSObject, SKRequestDelegate {
    static let shared = StoreKitIapService()

    // Match the App Store Connect product IDs already used by the mobile app.
    private let productIds = [
        "megaradio_premium_yearly",
        "megaradio_premium_monthly1",
        "megaradio_premium_lifetime",
        "megaradio_remove_ads_yearly1",
    ]

    private var products: [Product] = []
    private var busy = false
    private let receiptRefresh = StoreKitReceiptRefreshWaiter<SKRequest>()
    private let verifiedPlans: Set<String> = ["premium_monthly", "premium_yearly", "premium_lifetime", "remove_ads"]

    /// API base URL. Production = api.themegaradio.com. Override in build
    /// settings if you point tvOS at a staging server.
    var apiBaseUrl: String = "https://api.themegaradio.com"

    /// Auth token from the web view (Account-Linking JWT). Set this from the
    /// JS bridge whenever the user logs in / out so backend receipt posts
    /// carry the correct Bearer header.
    var authToken: String? { AuthStore.shared.token }

    private override init() { super.init() }

    // Unsolicited/unfinished StoreKit transactions must not be assigned to the
    // next signed-in account. Explicit Restore Purchases retries them for the
    // account chosen by the user. Server notifications handle renewals.

    private func appReceipt() async throws -> String {
        func read() -> Data? {
            guard let url = Bundle.main.appStoreReceiptURL,
                  let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
            return data
        }
        if let data = read() { return data.base64EncodedString() }
        let request = SKReceiptRefreshRequest()
        try await receiptRefresh.wait(for: request, start: {
            request.delegate = self
            request.start()
        }, cancel: {
            request.delegate = nil
            request.cancel()
        })
        try Task.checkCancellation()
        guard let data = read() else { throw APIError.decodingFailed("App Store receipt is unavailable. Please restore purchases.") }
        return data.base64EncodedString()
    }

    nonisolated func requestDidFinish(_ request: SKRequest) {
        Task { @MainActor in
            receiptRefresh.complete(for: request, result: .success(()))
        }
    }

    nonisolated func request(_ request: SKRequest, didFailWithError error: Error) {
        Task { @MainActor in
            receiptRefresh.complete(for: request, result: .failure(error))
        }
    }

    // MARK: - Product catalog

    func getProducts() async throws -> [[String: Any]] {
        #if os(tvOS)
        // This client has no paid feature or app advertising to remove.
        // Existing purchases remain restorable without marketing new ones.
        return []
        #else
        let fetched = try await Product.products(for: productIds)
        self.products = fetched
        return fetched.map { p in
            let isSub = (p.type == .autoRenewable)
            return [
                "productId": p.id,
                "title": p.displayName,
                "description": p.description,
                "localizedPrice": p.displayPrice,
                "currency": p.priceFormatStyle.currencyCode ?? "USD",
                "type": isSub ? "subscription" : "one-time",
                "billingPeriod": (p.subscription?.subscriptionPeriod.unit == .year) ? "P1Y"
                              : (p.subscription?.subscriptionPeriod.unit == .month) ? "P1M"
                              : "",
            ]
        }
        #endif
    }

    // MARK: - Purchase

    func purchase(productId: String) async throws -> [String: Any] {
        #if os(tvOS)
        return ["ok": false, "error": "Apple TV listening is included. New purchases are not offered in this app."]
        #else
        guard !busy else { throw APIError.decodingFailed("A purchase is already in progress") }
        guard productIds.contains(productId) else { throw APIError.decodingFailed("Unknown product") }
        busy = true
        defer { busy = false }
        guard let token = authToken, !token.isEmpty else {
            throw NSError(domain: "MegaRadio.StoreKit", code: 401,
                          userInfo: [NSLocalizedDescriptionKey: "Sign in before purchasing"])
        }
        let product: Product
        if let cached = products.first(where: { $0.id == productId }) {
            product = cached
        } else if let fetched = try await Product.products(for: [productId]).first {
            product = fetched
        } else {
            return ["ok": false, "error": "Product not found"]
        }

        guard authToken == token else { throw APIError.requestFailed(401) }
        let result = try await product.purchase()
        guard authToken == token else { throw APIError.requestFailed(401) }
        switch result {
        case .success(let verification):
            switch verification {
            case .verified(let txn):
                let plan = try await reportToBackend(transaction: txn, productId: productId,
                                                     owner: token)
                await txn.finish()
                return [
                    "ok": true,
                    "productId": productId,
                    "plan": plan,
                ]
            case .unverified(_, let error):
                return ["ok": false, "error": "Receipt unverified: \(error.localizedDescription)"]
            }
        case .userCancelled:
            return ["ok": false, "error": "User cancelled"]
        case .pending:
            return ["ok": false, "error": "Purchase pending approval"]
        @unknown default:
            return ["ok": false, "error": "Unknown StoreKit result"]
        }
        #endif
    }

    // MARK: - Restore

    func restore() async throws -> [String: Any] {
        guard !busy else { throw APIError.decodingFailed("A purchase is already in progress") }
        busy = true
        defer { busy = false }
        guard let owner = authToken, !owner.isEmpty else { throw APIError.requestFailed(401) }
        try Task.checkCancellation()
        try await AppStore.sync()
        try Task.checkCancellation()
        guard authToken == owner else { throw APIError.requestFailed(401) }

        for await result in StoreKit.Transaction.currentEntitlements {
            try Task.checkCancellation()
            if case .verified(let txn) = result {
                guard authToken == owner else { throw APIError.requestFailed(401) }
                guard productIds.contains(txn.productID), txn.revocationDate == nil,
                      txn.expirationDate.map({ $0 > Date() }) ?? true else { continue }
                let plan = try await reportToBackend(transaction: txn, productId: txn.productID,
                                                     owner: owner)
                await txn.finish()
                return [
                    "ok": true,
                    "productId": txn.productID,
                    "plan": plan,
                ]
            }
        }
        try Task.checkCancellation()
        return ["ok": false, "error": "No purchases found"]
    }

    // MARK: - Manage subscriptions (deep-link to tvOS Settings)

    func openManageSubscriptions() async throws {
        #if os(tvOS)
        throw NSError(domain: "MegaRadio.StoreKit", code: 501,
                      userInfo: [NSLocalizedDescriptionKey: "Manage subscriptions in Apple TV Settings > Users and Accounts > your account > Subscriptions."])
        #elseif os(iOS)
        if #available(iOS 15.0, *) {
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                try await AppStore.showManageSubscriptions(in: scene)
            }
        }
        #elseif os(macOS)
        throw NSError(domain: "MegaRadio.StoreKit", code: 501,
                      userInfo: [NSLocalizedDescriptionKey: "Manage subscriptions in App Store account settings"])
        #endif
    }

    // MARK: - Backend receipt validation

    private func reportToBackend(transaction txn: StoreKit.Transaction, productId: String, owner: String) async throws -> String {
        try Task.checkCancellation()
        guard let token = authToken, !token.isEmpty else {
            throw NSError(domain: "MegaRadio.StoreKit", code: 401,
                          userInfo: [NSLocalizedDescriptionKey: "Sign in to verify your purchase"])
        }

        guard token == owner else { throw APIError.requestFailed(401) }
        let receipt = try await appReceipt()
        try Task.checkCancellation()
        guard authToken == owner else { throw APIError.requestFailed(401) }
        var body: [String: Any] = [
            "platform": "tvos",
            "productId": productId,
            "transactionId": String(txn.id),
            "originalTransactionId": String(txn.originalID),
            "isTrial": false,
        ]
        // The backend calls Apple's verifyReceipt with this base64 app receipt.
        body["receipt"] = receipt

        guard let url = URL(string: apiBaseUrl + "/api/user/subscription") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.timeoutInterval = 15
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpShouldHandleCookies = false
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        try Task.checkCancellation()
        // Once a receipt POST begins, allow its result to finish even if the
        // user leaves this screen. Cancelling a restore must not interrupt a
        // server-side entitlement update that may already have committed.
        let (data, response) = try await Task {
            try await URLSession.shared.data(for: req)
        }.value
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.requestFailed((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        guard authToken == token,
              let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              (obj["success"] as? Bool) == true,
              (obj["isActive"] as? Bool) == true,
              obj["error"] == nil || obj["error"] is NSNull || (obj["error"] as? String) == "",
              let plan = obj["plan"] as? String,
              verifiedPlans.contains(plan) else {
            throw APIError.decodingFailed("No verified subscription returned")
        }
        return plan
    }
}

#endif

/// Exactly one pending receipt request; stale StoreKit delegate callbacks can
/// never complete a newer restore. A watchdog also bounds a missing callback.
@MainActor
final class StoreKitReceiptRefreshWaiter<Request: AnyObject> {
    private struct Pending {
        let request: Request
        let continuation: CheckedContinuation<Void, Error>
        let cancel: () -> Void
    }
    private var pending: Pending?
    private var timeoutTask: Task<Void, Never>?

    func wait(for request: Request, timeout: TimeInterval = 30,
              start: () -> Void, cancel: @escaping () -> Void) async throws {
        guard pending == nil else {
            throw NSError(domain: "MegaRadio.StoreKit", code: 409,
                          userInfo: [NSLocalizedDescriptionKey: "Receipt verification is already in progress."])
        }
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                pending = Pending(request: request, continuation: continuation, cancel: cancel)
                timeoutTask = Task { [weak self] in
                    do { try await Task.sleep(nanoseconds: UInt64(max(0.001, min(timeout, 60)) * 1_000_000_000)) }
                    catch { return }
                    let error = NSError(domain: "MegaRadio.StoreKit", code: 408,
                        userInfo: [NSLocalizedDescriptionKey: "Apple could not refresh your purchase receipt in time. Please try Restore Purchases again."])
                    self?.finish(for: request, result: .failure(error), cancelUnderlying: true)
                }
                start()
            }
        } onCancel: {
            Task { @MainActor [weak self] in
                self?.finish(for: request, result: .failure(CancellationError()), cancelUnderlying: true)
            }
        }
    }

    func complete(for request: Request, result: Result<Void, Error>) {
        finish(for: request, result: result, cancelUnderlying: false)
    }

    private func finish(for request: Request, result: Result<Void, Error>, cancelUnderlying: Bool) {
        guard let current = pending, current.request === request else { return }
        pending = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        if cancelUnderlying { current.cancel() }
        current.continuation.resume(with: result)
    }
}
