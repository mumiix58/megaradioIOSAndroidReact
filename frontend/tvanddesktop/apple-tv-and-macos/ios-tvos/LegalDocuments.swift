import SwiftUI

/// Bundled copies keep both legal destinations readable on Apple TV, including
/// when offline. tvOS has no general-purpose Safari browser to open a web link.
/// The QR code links to the original document on a phone without sign-in.
enum TVLegalDocument: String, Identifiable {
    case privacy, terms
    var id: String { rawValue }
    var title: String { self == .privacy ? "Privacy Policy" : "Terms of Use (EULA)" }
    var url: String {
        switch self {
        case .privacy: return "https://themegaradio.com/en/pages/privacy-policy"
        case .terms: return "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
        }
    }
    var text: String {
        switch self {
        case .privacy: return Self.appleTVPrivacy + "\n\nGeneral MegaRadio service privacy policy\n\n" + Self.publishedPrivacy
        case .terms: return Self.standardEULA
        }
    }

    // Split at word boundaries so Siri Remote Next/Previous controls expose
    // every word without relying on a nonfocusable Text inside a ScrollView.
    var pages: [String] { TVLegalPagination.pages(text) }

    private static let appleTVPrivacy = #"""
    Apple TV application — platform-specific privacy information

    This section describes the native MegaRadio application for Apple TV. Other MegaRadio platforms, including the iPhone/iPad application and website, have different features and data practices. The general service privacy policy follows this section.

    Advertising and analytics
    The native Apple TV application does not include a third-party advertising or analytics SDK, access the advertising identifier (IDFA), or implement cross-app advertising tracking. It does not request GPS location. Country selection uses your device region or the country you choose. These statements describe the Apple TV client; they do not mean that no data leaves your device.

    Radio and network requests
    The app contacts MegaRadio's API to load the station catalog, search results and information about the station currently playing. It also requests station artwork and country-flag images from their hosting providers. When you play a station, Apple's AVPlayer connects to that station's stream provider. These network services receive your IP address and information needed to handle the requests. Independent broadcasters and image/stream providers may process connection information under their own privacy policies. Advertisements within a station's broadcast are controlled by that broadcaster.

    Optional account pairing
    You can listen without signing in. If you choose to pair an account, the Apple TV app creates a random installation identifier and sends it to MegaRadio's API to create and check the pairing request. This identifier is not IDFA. The returned session token and account profile are stored on the device to keep you signed in. Signing out removes that local session and profile.

    Local settings and favorites
    Your country selection, app settings and favorite stations are stored locally on Apple TV. The current Apple TV app does not upload or synchronize its local favorites with your account.

    Restoring an existing purchase
    This Apple TV app does not offer new purchases. Apple processes restores of existing StoreKit purchases. For account entitlement verification, the app sends the purchase receipt, product identifier and transaction identifiers to MegaRadio's subscription API using your authenticated session. The app does not receive your payment-card details.

    Contact
    For questions about MegaRadio's data practices or to exercise your data rights, contact privacy@themegaradio.com. See the general privacy policy below for service-level information.
    """#

    private static let publishedPrivacy = #"""
    Privacy Policy

    Your privacy and data protection information

    Introduction

    At Mega Radio ("we," "our," or "us"), we respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our radio streaming service.

    Information We Collect

    Personal Information

    When you create an account or contact us, we may collect:
    - Name and email address
    - Username and password
    - Profile information and preferences
    - Communication history with our support team

    Usage Information

    We automatically collect information about how you use our service:
    - Listening history and preferences
    - Device information and IP address
    - Browser type and operating system
    - Time and duration of your sessions

    How We Use Your Information
    - To provide and improve our radio streaming service
    - To personalize your listening experience
    - To communicate with you about service updates
    - To provide customer support
    - To analyze usage patterns and improve our platform
    - To comply with legal obligations

    Information Sharing

    We do not sell, trade, or rent your personal information. We may share your information only in these circumstances:
    - With your explicit consent
    - To comply with legal requirements
    - To protect our rights and property
    - With trusted service providers who assist in our operations
    - In connection with a business transfer or merger

    Data Security

    We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.

    Your Rights

    You have the right to:
    - Access your personal data
    - Correct inaccurate information
    - Delete your account and data
    - Export your data
    - Opt out of certain communications
    - Restrict processing of your data

    Cookies and Tracking

    We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. You can control cookie settings through your browser preferences.

    Third-Party Links

    Our service may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.

    Changes to This Policy

    We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "last updated" date.

    Contact Us

    If you have any questions about this privacy policy or our data practices, please contact us at:

    Email: privacy@themegaradio.com
    """#

    private static let standardEULA = #"""
    Apps made available through the App Store are licensed, not sold, to you. Your license to each App is subject to your prior acceptance of either this Licensed Application End User License Agreement (“Standard EULA”), or a custom end user license agreement between you and the Application Provider (“Custom EULA”), if one is provided. Your license to any Apple App under this Standard EULA or Custom EULA is granted by Apple, and your license to any Third Party App under this Standard EULA or Custom EULA is granted by the Application Provider of that Third Party App. Any App that is subject to this Standard EULA is referred to herein as the “Licensed Application.” The Application Provider or Apple as applicable (“Licensor”) reserves all rights in and to the Licensed Application not expressly granted to you under this Standard EULA.

    a. Scope of License: Licensor grants to you a nontransferable license to use the Licensed Application on any Apple-branded products that you own or control and as permitted by the Usage Rules. The terms of this Standard EULA will govern any content, materials, or services accessible from or purchased within the Licensed Application as well as upgrades provided by Licensor that replace or supplement the original Licensed Application, unless such upgrade is accompanied by a Custom EULA. Except as provided in the Usage Rules, you may not distribute or make the Licensed Application available over a network where it could be used by multiple devices at the same time. You may not transfer, redistribute or sublicense the Licensed Application and, if you sell your Apple Device to a third party, you must remove the Licensed Application from the Apple Device before doing so. You may not copy (except as permitted by this license and the Usage Rules), reverse-engineer, disassemble, attempt to derive the source code of, modify, or create derivative works of the Licensed Application, any updates, or any part thereof (except as and only to the extent that any foregoing restriction is prohibited by applicable law or to the extent as may be permitted by the licensing terms governing use of any open-sourced components included with the Licensed Application).

    b. Consent to Use of Data: You agree that Licensor may collect and use technical data and related information—including but not limited to technical information about your device, system and application software, and peripherals—that is gathered periodically to facilitate the provision of software updates, product support, and other services to you (if any) related to the Licensed Application. Licensor may use this information, as long as it is in a form that does not personally identify you, to improve its products or to provide services or technologies to you.

    c. Termination. This Standard EULA is effective until terminated by you or Licensor. Your rights under this Standard EULA will terminate automatically if you fail to comply with any of its terms. 

    d. External Services. The Licensed Application may enable access to Licensor’s and/or third-party services and websites (collectively and individually, "External Services"). You agree to use the External Services at your sole risk. Licensor is not responsible for examining or evaluating the content or accuracy of any third-party External Services, and shall not be liable for any such third-party External Services. Data displayed by any Licensed Application or External Service, including but not limited to financial, medical and location information, is for general informational purposes only and is not guaranteed by Licensor or its agents. You will not use the External Services in any manner that is inconsistent with the terms of this Standard EULA or that infringes the intellectual property rights of Licensor or any third party. You agree not to use the External Services to harass, abuse, stalk, threaten or defame any person or entity, and that Licensor is not responsible for any such use. External Services may not be available in all languages or in your Home Country, and may not be appropriate or available for use in any particular location. To the extent you choose to use such External Services, you are solely responsible for compliance with any applicable laws. Licensor reserves the right to change, suspend, remove, disable or impose access restrictions or limits on any External Services at any time without notice or liability to you. 

    e. NO WARRANTY: YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT USE OF THE LICENSED APPLICATION IS AT YOUR SOLE RISK. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED APPLICATION AND ANY SERVICES PERFORMED OR PROVIDED BY THE LICENSED APPLICATION ARE PROVIDED "AS IS" AND “AS AVAILABLE,” WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND, AND LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS WITH RESPECT TO THE LICENSED APPLICATION AND ANY SERVICES, EITHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES AND/OR CONDITIONS OF MERCHANTABILITY, OF SATISFACTORY QUALITY, OF FITNESS FOR A PARTICULAR PURPOSE, OF ACCURACY, OF QUIET ENJOYMENT, AND OF NONINFRINGEMENT OF THIRD-PARTY RIGHTS. NO ORAL OR WRITTEN INFORMATION OR ADVICE GIVEN BY LICENSOR OR ITS AUTHORIZED REPRESENTATIVE SHALL CREATE A WARRANTY. SHOULD THE LICENSED APPLICATION OR SERVICES PROVE DEFECTIVE, YOU ASSUME THE ENTIRE COST OF ALL NECESSARY SERVICING, REPAIR, OR CORRECTION. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES OR LIMITATIONS ON APPLICABLE STATUTORY RIGHTS OF A CONSUMER, SO THE ABOVE EXCLUSION AND LIMITATIONS MAY NOT APPLY TO YOU.

    f. Limitation of Liability. TO THE EXTENT NOT PROHIBITED BY LAW, IN NO EVENT SHALL LICENSOR BE LIABLE FOR PERSONAL INJURY OR ANY INCIDENTAL, SPECIAL, INDIRECT, OR CONSEQUENTIAL DAMAGES WHATSOEVER, INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF PROFITS, LOSS OF DATA, BUSINESS INTERRUPTION, OR ANY OTHER COMMERCIAL DAMAGES OR LOSSES, ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE LICENSED APPLICATION, HOWEVER CAUSED, REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT, OR OTHERWISE) AND EVEN IF LICENSOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. SOME JURISDICTIONS DO NOT ALLOW THE LIMITATION OF LIABILITY FOR PERSONAL INJURY, OR OF INCIDENTAL OR CONSEQUENTIAL DAMAGES, SO THIS LIMITATION MAY NOT APPLY TO YOU. In no event shall Licensor’s total liability to you for all damages (other than as may be required by applicable law in cases involving personal injury) exceed the amount of fifty dollars ($50.00). The foregoing limitations will apply even if the above stated remedy fails of its essential purpose.

    g. You may not use or otherwise export or re-export the Licensed Application except as authorized by United States law and the laws of the jurisdiction in which the Licensed Application was obtained. In particular, but without limitation, the Licensed Application may not be exported or re-exported (a) into any U.S.-embargoed countries or (b) to anyone on the U.S. Treasury Department's Specially Designated Nationals List or the U.S. Department of Commerce Denied Persons List or Entity List. By using the Licensed Application, you represent and warrant that you are not located in any such country or on any such list. You also agree that you will not use these products for any purposes prohibited by United States law, including, without limitation, the development, design, manufacture, or production of nuclear, missile, or chemical or biological weapons.

    h. The Licensed Application and related documentation are "Commercial Items", as that term is defined at 48 C.F.R. §2.101, consisting of "Commercial Computer Software" and "Commercial Computer Software Documentation", as such terms are used in 48 C.F.R. §12.212 or 48 C.F.R. §227.7202, as applicable. Consistent with 48 C.F.R. §12.212 or 48 C.F.R. §227.7202-1 through 227.7202-4, as applicable, the Commercial Computer Software and Commercial Computer Software Documentation are being licensed to U.S. Government end users (a) only as Commercial Items and (b) with only those rights as are granted to all other end users pursuant to the terms and conditions herein. Unpublished-rights reserved under the copyright laws of the United States.

    i. Except to the extent expressly provided in the following paragraph, this Agreement and the relationship between you and Apple shall be governed by the laws of the State of California, excluding its conflicts of law provisions. You and Apple agree to submit to the personal and exclusive jurisdiction of the courts located within the county of Santa Clara, California, to resolve any dispute or claim arising from this Agreement. If (a) you are not a U.S. citizen; (b) you do not reside in the U.S.; (c) you are not accessing the Service from the U.S.; and (d) you are a citizen of one of the countries identified below, you hereby agree that any dispute or claim arising from this Agreement shall be governed by the applicable law set forth below, without regard to any conflict of law provisions, and you hereby irrevocably submit to the non-exclusive jurisdiction of the courts located in the state, province or country identified below whose law governs:

    If you are a citizen of any European Union country or Switzerland, Norway or Iceland, the governing law and forum shall be the laws and courts of your usual place of residence.

    Specifically excluded from application to this Agreement is that law known as the United Nations Convention on the International Sale of Goods.
    """#
}

/// Pure text pagination also allows coverage checks without a TV simulator.
enum TVLegalPagination {
    static func pages(_ text: String, maxCharacters: Int = 1050) -> [String] {
        precondition(maxCharacters > 0)
        var pages: [String] = []
        var current = ""
        var lineLength = 0
        var lineCount = 1
        // Conservative line bounds keep short headings and paragraph breaks
        // from overflowing even when the character count is modest.
        let charactersPerLine = 70
        let maximumLines = 15
        for paragraph in text.components(separatedBy: "\n\n") {
            let words = paragraph.split(whereSeparator: { $0.isWhitespace })
            for (index, word) in words.enumerated() {
                let separator = current.isEmpty ? "" : (index == 0 ? "\n\n" : " ")
                var nextLength = separator == "\n\n" ? 0 : lineLength
                var nextCount = lineCount + (separator == "\n\n" ? 2 : 0)
                if nextLength > 0 && nextLength + 1 + word.count > charactersPerLine {
                    nextLength = 0
                    nextCount += 1
                }
                nextLength += (nextLength == 0 ? 0 : 1) + word.count
                if !current.isEmpty && (current.count + separator.count + word.count > maxCharacters || nextCount > maximumLines) {
                    pages.append(current)
                    current = String(word)
                    lineLength = word.count
                    lineCount = 1
                } else {
                    current += separator + word
                    lineLength = nextLength
                    lineCount = nextCount
                }
            }
        }
        if !current.isEmpty { pages.append(current) }
        return pages.isEmpty ? [""] : pages
    }
}

struct TVLegalDocumentPage: View {
    let document: TVLegalDocument
    @Environment(\.dismiss) private var dismiss
    @State private var pageIndex = 0

    private var pages: [String] { document.pages }

    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            HStack {
                Text(document.title).font(.ubuntu(44, .bold))
                Spacer()
                Text("Page \(pageIndex + 1) of \(pages.count)")
                    .font(.ubuntu(24)).foregroundColor(Theme.textSecondary)
                    .accessibilityIdentifier("tv-legal-page-count")
            }
            HStack(alignment: .top, spacing: 70) {
                Text(pages[pageIndex])
                    .font(.ubuntu(27)).lineSpacing(10)
                    .frame(width: 1200, height: 700, alignment: .topLeading)
                    .accessibilityIdentifier("tv-legal-document-text")
                VStack(alignment: .center, spacing: 24) {
                    QRCodeView(string: document.url)
                        .frame(width: 250, height: 250)
                        .padding(22).background(Color.white).cornerRadius(16)
                        .accessibilityLabel("QR code for " + document.title)
                    Text("Read the original online")
                        .font(.ubuntu(24, .bold))
                    Text("Scan with your phone. You can also read every page here using the controls below.")
                        .font(.ubuntu(21)).foregroundColor(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                    Text(document.url)
                        .font(.ubuntu(19)).foregroundColor(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }.frame(width: 350)
            }
            HStack(spacing: 32) {
                Button("Previous page") { pageIndex -= 1 }
                    .disabled(pageIndex == 0)
                    .accessibilityIdentifier("tv-legal-previous")
                Button("Next page") { pageIndex += 1 }
                    .disabled(pageIndex >= pages.count - 1)
                    .accessibilityIdentifier("tv-legal-next")
                Spacer()
                Button("Done") { dismiss() }
                    .accessibilityIdentifier("tv-legal-done")
            }
            .font(.ubuntu(25))
        }
        .foregroundColor(Theme.textPrimary)
        .padding(80)
        .frame(width: 1920, height: 1080, alignment: .topLeading)
        .background(Theme.background.ignoresSafeArea())
        .onExitCommand { dismiss() }
    }
}
