// Models.swift — Data models matching the MegaRadio backend API
//
// API base: https://api.themegaradio.com

import Foundation

/// The live endpoint returns a flat payload; older deployments wrap it in `metadata`.
struct NowPlayingMetadata: Decodable {
    let title: String?
    let artist: String?
    private enum CodingKeys: String, CodingKey { case title, artist, metadata }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let values = try container.decodeIfPresent(NowPlayingMetadata.self, forKey: .metadata)
        func clean(_ text: String?) -> String? {
            guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
            return text
        }
        title = clean(try values?.title ?? container.decodeIfPresent(String.self, forKey: .title))
        artist = clean(try values?.artist ?? container.decodeIfPresent(String.self, forKey: .artist))
    }
}

struct Station: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let url: String?
    let urlResolved: String?
    let favicon: String?
    let country: String?
    private let apiCountryCode: String?
    private let legacyCountryCode: String?
    var countryCode: String? { apiCountryCode ?? legacyCountryCode }
    let tags: String?
    let bitrate: Int?
    let codec: String?
    let votes: Int?
    let homepage: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name, url, urlResolved, favicon, country, tags
        case apiCountryCode = "countryCode"
        case legacyCountryCode = "countrycode"
        case bitrate, codec, votes, homepage
    }

    var streamURL: URL? {
        for value in [urlResolved, url] {
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty, let u = URL(string: value),
                  let scheme = u.scheme?.lowercased(), ["http", "https"].contains(scheme),
                  u.host != nil else { continue }
            return u
        }
        return nil
    }

    var artworkURL: URL? {
        guard let fav = favicon, !fav.isEmpty else { return nil }
        return URL(string: fav)
    }

    var genreList: [String] {
        (tags ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
}

struct Genre: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let stationCount: Int?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case stationCount
    }
}

struct Country: Codable, Identifiable, Hashable {
    var id: String { code }
    let name: String
    let code: String
    let flag: String?
    let stationCount: Int?
}

// API envelope for paginated lists
struct StationsResponse: Codable {
    let stations: [Station]?
    let data: [Station]?
    var items: [Station] { stations ?? data ?? [] }
}

struct GenresResponse: Codable {
    let genres: [Genre]?
    let data: [Genre]?
    var items: [Genre] { genres ?? data ?? [] }
}

// TV Login (pairing-code) responses
struct TVCodeResponse: Codable {
    let code: String
    let expiresAt: String?
    let expiresIn: Double?
    let success: Bool?
}

struct TVCodeStatusResponse: Codable {
    let status: String?
    let activated: Bool?
    let expired: Bool?
    let token: String?
    let user: TVUser?

    enum State { case pending, activated, expired, invalid }
    var state: State {
        let value = status?.lowercased()
        if expired == true || value == "expired" { return .expired }
        if activated == true || value == "activated" || value == "verified" { return .activated }
        if value == "pending" || (value == nil && activated == false) { return .pending }
        return .invalid
    }
}

struct TVUser: Codable {
    let id: String?
    let displayName: String?
    let email: String?

    private enum CodingKeys: String, CodingKey { case id, _id, displayName, name, fullName, email }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decodeIfPresent(String.self, forKey: .id)
            ?? values.decodeIfPresent(String.self, forKey: ._id)
        displayName = try values.decodeIfPresent(String.self, forKey: .displayName)
            ?? values.decodeIfPresent(String.self, forKey: .name)
            ?? values.decodeIfPresent(String.self, forKey: .fullName)
        email = try values.decodeIfPresent(String.self, forKey: .email)
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encodeIfPresent(id, forKey: .id)
        try values.encodeIfPresent(displayName, forKey: .displayName)
        try values.encodeIfPresent(email, forKey: .email)
    }
}
