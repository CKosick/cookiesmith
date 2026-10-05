# Privacy Policy for CookieSmith

**Last Updated:** October 5, 2026

## The Short Version: We Collect Nothing

CookieSmith is built on a single core principle: **Trust is the product.**

- **Zero Data Collection:** We do not collect, track, log, or transmit any personal data, cookie data, browsing history, or analytics.
- **100% Local Execution:** CookieSmith operates entirely inside your local browser. All cookie reading, editing, import, and export operations happen in memory on your device.
- **Zero Telemetry / Zero Analytics:** CookieSmith contains no analytics SDKs, no tracking pixels, no telemetry pings, and no third-party scripts.
- **Zero Network Traffic:** DevTools network inspection will confirm that CookieSmith makes zero outbound network requests—ever.
- **Open Source & Auditable:** CookieSmith's source code is 100% open source. Anyone can inspect, build, and verify the extension.

---

## 1. What Data We Collect
**None.** CookieSmith does not collect any personally identifiable information (PII), browsing history, keystrokes, IP addresses, or cookie values.

## 2. What Permissions We Request & Why
CookieSmith requests only the minimal permissions necessary to inspect and manage cookies on the pages you choose to visit:

| Permission | Purpose |
| :--- | :--- |
| `cookies` | Required to read, add, edit, and delete cookies when you open the popup. Cookie values never leave your device. |
| `activeTab` | Used strictly to identify the current tab's hostname and protocol so the popup displays only cookies relevant to your active page. |
| `storage` | Used solely to save local user preferences (such as your search/filter UI state) inside `chrome.storage.local`. This data is never synced to external servers. |
| Host Permissions (`<all_urls>`) | Required by the Chrome Extension architecture to read and modify cookies on whichever site you choose to open CookieSmith on. The extension only interacts with the active tab when you explicitly click the extension icon. |

## 3. How Data Is Stored
Any data processed by CookieSmith (cookie values, exported JSON, search filters) resides in temporary memory or local browser storage on your personal machine. No data is ever transmitted to remote servers, cloud databases, or third parties.

## 4. Third-Party Services
CookieSmith does not integrate with any third-party APIs, CDNs, crash-reporters, or advertising networks.

## 5. Contact & Audits
If you have any questions, feedback, or security audit inquiries, please contact:
- **Project Lead:** Cliff
- **Repository:** [https://github.com/CKosick/cookiesmith](https://github.com/CKosick/cookiesmith)
- **Support / Inquiries:** cliff@cookiesmith.dev
