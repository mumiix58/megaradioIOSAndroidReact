// APIClient.swift — Thin HTTP wrapper around the public MegaRadio API.

import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case requestFailed(Int)
    case decodingFailed(String)
    case noData

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .requestFailed(let code): return "Request failed (\(code))"
        case .decodingFailed(let detail): return "Decoding failed: \(detail)"
        case .noData: return "No data returned"
        }
    }
}

protocol TVPairingAPI {
    func requestTVCode(deviceId: String) async throws -> TVCodeResponse
    func checkTVCode(_ code: String, deviceId: String) async throws -> TVCodeStatusResponse
}

final class APIClient: TVPairingAPI {
    static let shared = APIClient()
    private init() {}

    /// Override this via `MEGARADIO_API_URL` environment variable for staging/local testing.
    var baseURL: URL {
        if let override = ProcessInfo.processInfo.environment["MEGARADIO_API_URL"],
           let u = URL(string: override) { return u }
        return URL(string: "https://api.themegaradio.com")!
    }

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        cfg.timeoutIntervalForResource = 30
        cfg.requestCachePolicy = .reloadIgnoringLocalCacheData
        cfg.httpShouldSetCookies = false
        cfg.httpCookieStorage = nil
        return URLSession(configuration: cfg)
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()

    // ─────────────────────────────────────────────────────────────────
    // Generic GET / POST
    // ─────────────────────────────────────────────────────────────────

    func get<T: Decodable>(_ path: String, query: [String: String] = [:], token: String? = nil) async throws -> T {
        var comps = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = comps.url else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.timeoutInterval = 15
        if let t = token { req.setValue("Bearer " + t, forHTTPHeaderField: "Authorization") }
        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.requestFailed((resp as? HTTPURLResponse)?.statusCode ?? -1)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingFailed(String(describing: error))
        }
    }

    func post<T: Decodable>(_ path: String, body: [String: Any] = [:], token: String? = nil) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.timeoutInterval = 15
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let t = token { req.setValue("Bearer " + t, forHTTPHeaderField: "Authorization") }
        if !body.isEmpty {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.requestFailed((resp as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try decoder.decode(T.self, from: data)
    }

    // ─────────────────────────────────────────────────────────────────
    // Domain helpers
    // ─────────────────────────────────────────────────────────────────

    func fetchPopularStations(country: String? = nil, limit: Int = 30) async throws -> [Station] {
        var q: [String: String] = ["limit": "\(limit)", "sort": "votes"]
        if let c = country, !c.isEmpty { q["country"] = c }
        let r: StationsResponse = try await get("/api/stations", query: q)
        return r.items
    }

    func fetchStationsByGenre(_ genre: String, limit: Int = 40) async throws -> [Station] {
        let r: StationsResponse = try await get("/api/stations", query: ["genre": genre, "limit": "\(limit)"])
        return r.items
    }

    func fetchGenres(country: String? = nil, limit: Int = 40) async throws -> [Genre] {
        var q: [String: String] = ["limit": "\(limit)"]
        if let c = country { q["country"] = c }
        let r: GenresResponse = try await get("/api/genres/precomputed", query: q)
        return r.items
    }

    func searchStations(_ query: String, limit: Int = 40) async throws -> [Station] {
        let r: StationsResponse = try await get("/api/stations", query: ["search": query, "limit": "\(limit)"])
        return r.items
    }

    // TV login (pairing code)
    func requestTVCode(deviceId: String) async throws -> TVCodeResponse {
        return try await post("/api/auth/tv/code", body: ["deviceId": deviceId, "deviceName": "Apple TV", "platform": "other"])
    }

    func checkTVCode(_ code: String, deviceId: String) async throws -> TVCodeStatusResponse {
        return try await get("/api/auth/tv/code/\(code)/status", query: ["deviceId": deviceId])
    }
}
