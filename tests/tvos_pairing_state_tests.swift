import Foundation

func decoded<T: Decodable>(_ text: String, as: T.Type = T.self) throws -> T {
    try JSONDecoder().decode(T.self, from: Data(text.utf8))
}

actor PairingStub: TVPairingAPI {
    struct Reply<T> {
        let value: Result<T, Error>
        let delay: UInt64
        init(_ value: Result<T, Error>, delay: UInt64 = 0) { self.value = value; self.delay = delay }
    }
    var codes: [Reply<TVCodeResponse>]
    var states: [Reply<TVCodeStatusResponse>]
    var codeCalls = 0
    var pollCalls = 0
    init(codes: [Reply<TVCodeResponse>], states: [Reply<TVCodeStatusResponse>] = []) {
        self.codes = codes; self.states = states
    }
    func requestTVCode(deviceId: String) async throws -> TVCodeResponse {
        codeCalls += 1
        let reply = codes.removeFirst()
        if reply.delay > 0 { try await Task.sleep(nanoseconds: reply.delay) }
        return try reply.value.get()
    }
    func checkTVCode(_ code: String, deviceId: String) async throws -> TVCodeStatusResponse {
        pollCalls += 1
        let reply = states.removeFirst()
        if reply.delay > 0 { try await Task.sleep(nanoseconds: reply.delay) }
        return try reply.value.get()
    }
}

@MainActor
@main
struct PairingTests {
    static var passed = 0
    static var suites: [String] = []
    static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
        guard condition() else { fatalError(message) }
    }
    static func pass(_ name: String) { passed += 1; print("PASS \(name)") }
    static func fresh(_ api: PairingStub, timeout: TimeInterval = 1) -> AuthStore {
        let name = "MegaRadio.PairingTests.\(UUID().uuidString)"
        suites.append(name)
        return AuthStore(api: api, defaults: UserDefaults(suiteName: name)!, pollInterval: 3600, requestTimeout: timeout)
    }
    static func code(_ text: String = "ABC123", ttl: Double = 600) throws -> TVCodeResponse {
        try decoded("{\"success\":true,\"code\":\"\(text)\",\"expiresIn\":\(ttl),\"expiresAt\":\"2001-01-01T00:00:00Z\"}")
    }
    static func state(_ text: String) throws -> TVCodeStatusResponse { try decoded(text) }
    static func sleep(_ milliseconds: UInt64) async { try? await Task.sleep(nanoseconds: milliseconds * 1_000_000) }
    static func main() async throws {
        defer { for suite in suites { UserDefaults.standard.removePersistentDomain(forName: suite) } }
        let pending = try state("{\"status\":\"pending\"}")
        let activated = try state("{\"status\":\"activated\",\"token\":\"fixture-token\",\"user\":{\"_id\":\"fixture-user\",\"name\":\"Fixture\"}}")
        for payload in ["{\"status\":\"verified\"}", "{\"activated\":true}"] {
            let compatibilityState = try state(payload)
            expect(compatibilityState.state == .activated, "Compatibility activation failed")
        }
        let expiredState = try state("{\"expired\":true}")
        expect(expiredState.state == .expired, "Boolean expiry failed")
        expect(activated.user?.id == "fixture-user" && activated.user?.displayName == "Fixture", "Backend user schema lost")
        let roundTrip = try JSONDecoder().decode(TVUser.self, from: JSONEncoder().encode(activated.user!))
        expect(roundTrip.id == "fixture-user", "Persisted user lost its identity")
        pass("backend status aliases and user identity decode/persist")

        let good = PairingStub(codes: [.init(.success(try code()))], states: [.init(.success(pending)), .init(.success(activated))])
        let auth = fresh(good)
        await auth.startPairing()
        expect(auth.pendingCode == "ABC123" && !auth.isRequestingCode, "Code did not become ready")
        expect((auth.codeExpiresAt?.timeIntervalSinceNow ?? 0) > 590, "Device clock incorrectly used server expiresAt")
        await auth.pollOnce()
        expect(!auth.isAuthenticated && auth.pendingCode != nil, "Pending status lost code")
        await auth.pollOnce()
        expect(auth.isAuthenticated && auth.user?.id == "fixture-user", "Activation did not sign in")
        expect(auth.pendingCode == nil && auth.codeExpiresAt == nil && !auth.isRequestingCode && auth.lastError == nil, "Activation left a loading state")
        pass("successful activation clears pairing and publishes authenticated state")

        for http in [404, 410] {
            let stub = PairingStub(codes: [.init(.success(try code()))], states: [.init(.failure(APIError.requestFailed(http)))])
            let a = fresh(stub); await a.startPairing(); await a.pollOnce(); await a.pollOnce()
            expect(a.pendingCode == nil && a.lastError?.contains("expired") == true, "Expired HTTP response still polls")
            let calls = await stub.pollCalls; expect(calls == 1, "Expired code continued polling")
        }
        pass("HTTP 404 and 410 terminate expired pairing")

        let exp = fresh(PairingStub(codes: [.init(.success(try code(ttl: 0.025)))]))
        await exp.startPairing(); await sleep(70)
        expect(exp.pendingCode == nil && exp.lastError?.contains("expired") == true, "Local expiration watchdog did not stop waiting")
        pass("relative server TTL expires without needing another network response")

        let failure = APIError.requestFailed(503)
        let retryStub = PairingStub(codes: [.init(.success(try code())), .init(.success(try code("DEF456")))], states: [.init(.failure(failure)), .init(.failure(failure)), .init(.failure(failure))])
        let retry = fresh(retryStub); await retry.startPairing()
        await retry.pollOnce(); await retry.pollOnce()
        expect(retry.pendingCode != nil && retry.lastError == nil, "Transient errors failed too soon")
        await retry.pollOnce(); expect(retry.pendingCode == nil && retry.lastError != nil, "Repeated errors remained infinite")
        await retry.startPairing(); expect(retry.pendingCode == "DEF456" && retry.lastError == nil, "Retry did not start a clean generation")
        retry.stopPairing(); pass("bounded transient failures and successful retry")

        let slow = fresh(PairingStub(codes: [.init(.success(try code()), delay: 1_000_000_000)]), timeout: 0.025)
        await slow.startPairing()
        expect(!slow.isRequestingCode && slow.pendingCode == nil && slow.lastError?.contains("too long") == true, "Initial code request never timed out")
        pass("initial request has a bounded timeout and visible retry error")

        let cancelled = fresh(PairingStub(codes: [.init(.success(try code()), delay: 1_000_000_000)]))
        let loading = Task { await cancelled.startPairing() }; await sleep(10)
        cancelled.stopPairing(); await loading.value
        expect(cancelled.pendingCode == nil && cancelled.lastError == nil && !cancelled.isRequestingCode, "Cancelled request republished stale state")
        pass("leaving login cancels in-flight code request")

        let stale = fresh(PairingStub(codes: [.init(.success(try code()))], states: [.init(.success(activated), delay: 1_000_000_000)]))
        await stale.startPairing(); let checking = Task { await stale.pollOnce() }; await sleep(10)
        stale.stopPairing(); await checking.value
        expect(!stale.isAuthenticated && stale.lastError == nil && stale.pendingCode == nil, "Stale activation signed in after cancellation")
        pass("late activation cannot authenticate after cancellation")

        let oneStub = PairingStub(codes: [.init(.success(try code()))], states: [.init(.success(pending), delay: 40_000_000)])
        let one = fresh(oneStub); await one.startPairing()
        let check = Task { await one.pollOnce() }; await sleep(5); await one.pollOnce(); await check.value
        let oneCalls = await oneStub.pollCalls; expect(oneCalls == 1, "Polling overlapped")
        one.stopPairing(); pass("only one status request can be in flight")

        for payload in ["{\"status\":\"activated\"}", "{\"status\":\"verified\",\"token\":\"fixture\",\"user\":{}}", "{\"status\":\"unknown\"}"] {
            let malformed = fresh(PairingStub(codes: [.init(.success(try code()))], states: [.init(.success(try state(payload)))]))
            await malformed.startPairing(); await malformed.pollOnce()
            expect(!malformed.isAuthenticated && malformed.pendingCode == nil && malformed.lastError != nil, "Malformed activation left a spinner/session")
        }
        pass("incomplete activation and unknown response fail safely")

        let empty = fresh(PairingStub(codes: [.init(.success(try code("")))])); await empty.startPairing()
        expect(empty.pendingCode == nil && !empty.isRequestingCode && empty.lastError != nil, "Empty code left blank loading boxes")
        pass("invalid or empty device code cannot enter waiting state")

        let offline = fresh(PairingStub(codes: [.init(.failure(URLError(.notConnectedToInternet)))])); await offline.startPairing()
        expect(offline.pendingCode == nil && !offline.isRequestingCode && offline.lastError != nil, "Network failure has no visible error")
        pass("offline initial request ends with a visible error")
        print("PASS \(passed) tvOS pairing behavior groups")
    }
}
