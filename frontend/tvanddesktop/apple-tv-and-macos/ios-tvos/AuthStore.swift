// AuthStore.swift — Pairing-code login flow + JWT persistence

import Foundation
import Combine

@MainActor
final class AuthStore: ObservableObject {
    static let shared = AuthStore()

    @Published private(set) var token: String?
    @Published private(set) var user: TVUser?
    @Published private(set) var pendingCode: String?
    @Published private(set) var lastError: String?
    @Published private(set) var isRequestingCode = false
    @Published private(set) var codeExpiresAt: Date?

    private let tokenKey = "megaradio.tv.token"
    private let userKey = "megaradio.tv.user"
    private let deviceIdKey = "megaradio.tv.deviceId"
    private let api: TVPairingAPI
    private let defaults: UserDefaults
    private let pollInterval: TimeInterval
    private let requestTimeout: TimeInterval
    private let now: () -> Date
    private var codeRequestTask: Task<TVCodeResponse, Error>?
    private var requestTimeoutTask: Task<Void, Never>?
    private var pollingTask: Task<Void, Never>?
    private var expirationTask: Task<Void, Never>?
    private var generation = 0
    private var checking = false
    private var consecutivePollFailures = 0

    var isAuthenticated: Bool { token?.isEmpty == false }
    var deviceId: String {
        if let d = defaults.string(forKey: deviceIdKey) { return d }
        let new = UUID().uuidString
        defaults.set(new, forKey: deviceIdKey)
        return new
    }

    init(api: TVPairingAPI = APIClient.shared, defaults: UserDefaults = .standard,
         pollInterval: TimeInterval = 3, requestTimeout: TimeInterval = 20,
         now: @escaping () -> Date = Date.init) {
        self.api = api
        self.defaults = defaults
        self.pollInterval = pollInterval
        self.requestTimeout = requestTimeout
        self.now = now
        if let t = defaults.string(forKey: tokenKey), !t.isEmpty { self.token = t }
        if let data = defaults.data(forKey: userKey),
           let u = try? JSONDecoder().decode(TVUser.self, from: data) { self.user = u }
    }

    func startPairing() async {
        stopPairing()
        guard !isAuthenticated else { return }
        let request = generation
        lastError = nil
        isRequestingCode = true
        let task = Task { try await api.requestTVCode(deviceId: deviceId) }
        codeRequestTask = task
        requestTimeoutTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: Self.nanoseconds(self?.requestTimeout ?? 20)) }
            catch { return }
            guard let self, request == self.generation, self.isRequestingCode else { return }
            self.failPairing("The sign-in service took too long. Please try again.")
        }
        defer {
            if request == generation {
                isRequestingCode = false
                codeRequestTask = nil
                requestTimeoutTask?.cancel()
                requestTimeoutTask = nil
            }
        }
        do {
            let resp = try await task.value
            guard request == generation else { return }
            let code = resp.code.trimmingCharacters(in: .whitespacesAndNewlines)
            guard resp.success != false, code.count == 6,
                  code.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.contains($0) }) else {
                failPairing("The sign-in service returned an invalid code. Please try again.")
                return
            }
            // Relative TTL prevents an incorrect TV clock from expiring a fresh code.
            let lifetime = min(resp.expiresIn ?? 600, 900)
            guard lifetime.isFinite, lifetime > 0 else {
                failPairing("This sign-in code has expired. Please request a new code.")
                return
            }
            pendingCode = code
            codeExpiresAt = now().addingTimeInterval(lifetime)
            beginPolling(request: request, lifetime: lifetime)
        } catch {
            guard request == generation else { return }
            failPairing("Could not get a sign-in code. Check your connection and try again.")
        }
    }

    func stopPairing() {
        generation += 1
        codeRequestTask?.cancel()
        codeRequestTask = nil
        requestTimeoutTask?.cancel()
        requestTimeoutTask = nil
        pollingTask?.cancel()
        pollingTask = nil
        expirationTask?.cancel()
        expirationTask = nil
        pendingCode = nil
        codeExpiresAt = nil
        isRequestingCode = false
        checking = false
        consecutivePollFailures = 0
    }

    private func beginPolling(request: Int, lifetime: TimeInterval) {
        expirationTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: Self.nanoseconds(lifetime)) }
            catch { return }
            guard let self, request == self.generation else { return }
            self.failPairing("This sign-in code has expired. Please request a new code.")
        }
        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                do { try await Task.sleep(nanoseconds: Self.nanoseconds(self?.pollInterval ?? 3)) }
                catch { return }
                guard let self, request == self.generation else { return }
                await self.pollOnce()
            }
        }
    }

    func pollOnce() async {
        guard let code = pendingCode, !checking else { return }
        guard let deadline = codeExpiresAt, now() < deadline else {
            failPairing("This sign-in code has expired. Please request a new code.")
            return
        }
        let request = generation
        checking = true
        defer { if request == generation { checking = false } }
        do {
            let resp = try await api.checkTVCode(code, deviceId: deviceId)
            guard request == generation, code == pendingCode else { return }
            consecutivePollFailures = 0
            switch resp.state {
            case .activated:
                guard let t = resp.token, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                      let u = resp.user, let id = u.id, !id.isEmpty,
                      let data = try? JSONEncoder().encode(u) else {
                    failPairing("Sign-in could not be verified. Please request a new code.")
                    return
                }
                user = u
                defaults.set(data, forKey: userKey)
                defaults.set(t, forKey: tokenKey)
                token = t
                stopPairing()
            case .expired:
                failPairing("This sign-in code has expired. Please request a new code.")
            case .pending:
                break
            case .invalid:
                failPairing("The sign-in service returned an invalid response. Please try again.")
            }
        } catch {
            guard request == generation, code == pendingCode else { return }
            if case APIError.requestFailed(let status) = error, [404, 410].contains(status) {
                failPairing("This sign-in code has expired. Please request a new code.")
                return
            }
            consecutivePollFailures += 1
            if consecutivePollFailures >= 3 {
                failPairing("Connection to the sign-in service was lost. Please try again.")
            }
        }
    }

    private func failPairing(_ message: String) {
        stopPairing()
        lastError = message
    }

    private static func nanoseconds(_ seconds: TimeInterval) -> UInt64 {
        UInt64(max(0.001, min(seconds, 3600)) * 1_000_000_000)
    }

    func signOut() {
        stopPairing()
        token = nil
        user = nil
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: userKey)
    }

    func refreshSession() async throws {
        struct Verified: Decodable { let valid: Bool?; let user: TVUser? }
        guard let token = token else { throw APIError.requestFailed(401) }
        let request = generation
        let response: Verified
        do { response = try await APIClient.shared.get("/api/auth/tv/verify", token: token) }
        catch APIError.requestFailed(let code) {
            if code == 401 && self.token == token && generation == request { signOut() }
            throw APIError.requestFailed(code)
        }
        guard self.token == token, generation == request else { throw APIError.requestFailed(401) }
        if response.valid == false { signOut(); throw APIError.requestFailed(401) }
        if let nextUser = response.user {
            user = nextUser
            if let data = try? JSONEncoder().encode(nextUser) { defaults.set(data, forKey: userKey) }
        }
    }
}
