# Chrome Web Store Listing — CookieSmith

> Last Updated: 2026-10-05

## Store Listing

**Extension Name** [REQUIRED]
CookieSmith - Cookie Editor & Inspector

**Short Description** [REQUIRED]
Inspect, edit, create, and delete cookies for the current tab. 100% local, open-source cookie editor with zero telemetry.

**Detailed Description** [REQUIRED]
CookieSmith is an open-source, private, and lightweight cookie manager built for developers, testers, and security professionals who demand complete control and absolute privacy.

TRUST IS THE PRODUCT
Following the deprecation of Manifest V2, the browser extension landscape was plagued by malicious cookie editor clones and untrusted copycats. CookieSmith is built to restore trust. It is 100% open source from day one, contains zero tracking pixels, zero analytics SDKs, and zero telemetry. It makes zero outbound network requests. All cookie inspections, modifications, imports, and exports happen entirely in your local browser on your device.

KEY FEATURES
- View all cookies set by the active website with instant flag indicators (Secure, HttpOnly, SameSite, Session, Expiry).
- Edit any cookie value, domain, path, expiration date, or security flags in place.
- Add new cookies with an intuitive, pre-populated form.
- Delete individual cookies with one click or clear all cookies for the site.
- Real-time search across cookie names, domains, and values with instant matching.
- Filter cookies by Session, Persistent, Secure, HttpOnly, and Third-Party context.
- Sort cookies by name, expiration date, or size.
- Export cookies to standard JSON format (compatible with EditThisCookie and automated testing workflows) via clipboard or file download.
- Import cookies from JSON files or clipboard with error validation and overwrite protection.
- Built strictly for Manifest V3 with an ephemeral service worker lifecycle.

HOW TO USE IT
1. Click the CookieSmith icon in your browser toolbar while on any webpage.
2. View the complete list of cookies for the current site.
3. Click any cookie row to expand its details and edit its value, flags, or expiration date.
4. Click "Add" to forge a new cookie, or use "Import" / "Export" to transfer cookies as JSON.
5. Use "Clear All" whenever you need a clean session reset.

PRIVACY & PERMISSIONS
CookieSmith does not collect, log, store, or transmit your personal data, browsing activity, or cookie contents. We request only the minimal permissions necessary for the chrome.cookies API to inspect cookies on the active tab upon your request.

SUPPORT & SOURCE CODE
CookieSmith is fully open source. You can inspect the source code, verify network silence in Chrome DevTools, report issues, and submit feedback via GitHub.

**Category** [REQUIRED]
Developer Tools

**Single Purpose** [REQUIRED]
Inspect, edit, create, import, export, and delete cookies for the active webpage in a local popup interface.

**Primary Language** [REQUIRED]
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Small Icon | 48×48 PNG | ✅ Ready | `icons/icon-48.png` |
| Action Icon | 16×16 PNG | ✅ Ready | `icons/icon-16.png` |
| Screenshot 1 [REQUIRED] | 1280×800 | 🟡 Dev Ready | `assets/screenshot-1-list-and-search.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 | 🟡 Dev Ready | `assets/screenshot-2-inline-editor.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 | 🟡 Dev Ready | `assets/screenshot-3-import-export.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Optional | `assets/promo-small.png` |
| Marquee Promo Tile | 1400×560 | ⬜ Optional | `assets/promo-marquee.png` |

### Screenshot Notes
- **Screenshot 1:** Clean overview of CookieSmith popup open on a site displaying cookie list, search filter chips (Session, Persistent, Secure, HttpOnly, 3rd Party), and domain count pill.
- **Screenshot 2:** Detailed view of the expanded cookie editor showing value editing, domain/path inputs, expiration date picker, and flag toggles (Secure, HttpOnly, SameSite).
- **Screenshot 3:** Import/Export modal showing clean standard JSON export and one-click copy/download.

---

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `cookies` | permissions | Allows reading, creating, modifying, and deleting cookies when the user opens the CookieSmith popup. Cookie contents never leave the user's local machine. |
| `activeTab` | permissions | Allows detecting the active tab's hostname and protocol when the user clicks the extension action, so CookieSmith displays cookies relevant strictly to that active webpage. |
| `storage` | permissions | Used strictly to store user UI preferences (such as sort order and filter state) locally in `chrome.storage.local`. No data is synced off-device. |
| `<all_urls>` | host_permissions | Required by Chrome's extension security model for the `chrome.cookies` API to inspect and manage cookies on whichever website the user chooses to open CookieSmith on. The extension operates strictly on direct user request for the active tab's domain and never makes background web requests. |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

CookieSmith does not collect, transmit, or share any user data.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|---|---|---|---|---|
| Personally identifiable info | No | No | None | No |
| Health info | No | No | None | No |
| Financial info | No | No | None | No |
| Authentication info | No | No | None | No |
| Personal communications | No | No | None | No |
| Location | No | No | None | No |
| Web history | No | No | None | No |
| User activity | No | No | None | No |
| Website content | No | No | None | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
`https://ckosick.github.io/cookiesmith/privacy.html` (Hosted on GitHub Pages from repository root `/`)

---

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

---

## Developer Info

**Publisher Name** [REQUIRED]
Cliff Kosick (CookieSmith)

**Contact Email** [REQUIRED]
cliff@cookiesmith.dev

**Support URL / Email** [RECOMMENDED]
`https://github.com/CKosick/cookiesmith/issues`

**Homepage URL** [RECOMMENDED]
`https://github.com/CKosick/cookiesmith`

---

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-10-05 | Initial Free MVP release. Full Manifest V3 compliance, zero telemetry, local JSON import/export, real-time cookie inspection, editing, and deletion. | Draft |

---

## Review Notes

### Known Issues / Limitations
- Chrome internal pages (such as `chrome://extensions` or `about:blank`) do not allow cookie inspection by design. CookieSmith detects these pages and displays a clear explanatory message.
- Third-party partitioned cookies are identified based on top-level origin matching and modern CHIPS metadata where exposed.
