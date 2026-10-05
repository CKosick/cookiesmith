# CookieSmith 🍪🔨

> The private, open-source, Manifest V3 cookie editor for Google Chrome.
> **Zero telemetry. Zero analytics. Zero external requests. 100% Local.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Privacy: Zero Telemetry](https://img.shields.io/badge/Telemetry-0%25-brightgreen.svg)](#trust-is-the-product)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Why CookieSmith?

When Google deprecated Manifest V2, trusted legacy cookie managers like *EditThisCookie* ceased functioning. In the vacuum that followed, the Chrome Web Store was flooded with unvetted clones and malicious copycats—one of which amassed over 50,000 installs before Google removed it for harvesting user credentials.

**CookieSmith is built to rebuild trust:**
1. **100% Open Source:** Every single line of code is public and auditable.
2. **Zero Telemetry:** No Google Analytics, no Mixpanel, no tracking pixels, no telemetry pings.
3. **Zero Network Traffic:** CookieSmith makes **zero outbound HTTP/HTTPS requests**—ever. Verify this in DevTools Network tab.
4. **Manifest V3 Native:** Built from the ground up for modern Chrome with an ephemeral service worker lifecycle.
5. **No Paywalls or Accounts:** No sign-ups, no license keys, no monetization code in the MVP.

---

## Features

- **Inspect All Tab Cookies:** See cookie Name, Value, Domain, Path, Expiration, and Security flags (`Secure`, `HttpOnly`, `SameSite`).
- **Inline Cookie Editor:** Edit any cookie value, expiration date/time, domain, path, or flags with instantaneous local saving.
- **Add Cookies:** Forge new session or persistent cookies with pre-populated domain and path defaults.
- **Delete Single or All:** Delete individual cookies with one click or clear all cookies for the site to quickly reset login state.
- **Real-Time Search & Filtering:** Filter cookies by Name, Domain, or Value, and narrow down via filter chips:
  - `Session` vs `Persistent`
  - `Secure`
  - `HttpOnly`
  - `3rd Party` (identifies cross-origin/third-party tracker cookies)
- **Lossless Import / Export:** Export cookies to standard JSON (clipboard or `.json` file download) and import cookies with validation.
- **Tab Scope Toggle:** Switch between cookies for the exact tab URL or all cookies across the entire domain (`*.example.com`).

---

## Architecture & Code Structure

```
cookiesmith/
├── manifest.json              # Manifest V3 specification & minimal permissions
├── icons/                     # Real PNG icons (16x16, 48x48, 128x128)
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── popup/                     # User interface (zero remote assets)
│   ├── popup.html             # Clean semantic HTML popup
│   ├── popup.css              # Modern dark forge design system
│   └── popup.js               # Reactive UI controller & event handlers
├── src/
│   ├── cookie-manager.js      # Core chrome.cookies abstraction (CRUD, search, filter)
│   └── feature-flags.js       # Architectural seam for future Pro capabilities
├── background/
│   └── service-worker.js      # Ephemeral service worker updating tab cookie count badge
├── test/
│   ├── test-cookie-manager.mjs # Automated unit test suite (26 passing tests)
│   └── test-page.html         # Interactive local testbed site
├── privacy.html               # Self-hosted Privacy Policy
├── PRIVACY.md                 # Plain-language Privacy Policy
├── CHROMEWEBSTORE.md          # Chrome Web Store submission specification
└── README.md
```

### Pro Features Seam (`src/feature-flags.js`)
Per the development work order, CookieSmith MVP has zero monetization, no license servers, and no paywalls. Future capabilities (such as multi-environment profile switching, encrypted team sharing, or tracker audit reports) are architected cleanly behind `feature-flags.js` without complicating the free MVP core.

---

## Installation & Development

### Load Unpacked Extension in Chrome

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked**.
5. Select the `cookiesmith` project folder.
6. The CookieSmith anvil icon will appear in your Chrome toolbar. Pin it for quick access!

### Run Comprehensive Automated Test Suites

```bash
# Run all test suites (Unit, Security Audit, Import/Export Stress)
node test/run-all-tests.mjs
```

Or run individual suites:
```bash
# 1. Unit & Edge Case Suite (ccTLD, URL normalization, 500-cookie scale benchmark)
node test/test-cookie-manager.mjs

# 2. Security & Zero-Telemetry Audit (Static AST scan for zero network calls, zero trackers)
node test/test-security-audit.mjs

# 3. Import/Export Stress & Compatibility Suite (EditThisCookie compatibility & 100-cookie round trip)
node test/test-import-export-stress.mjs
```

### Performance & Accessibility Optimizations
- **DocumentFragment Batching:** Renders cards in batched DOM operations to eliminate layout thrashing.
- **Micro-Debounced Search:** 60ms non-blocking debounce preserves instant 60fps input typing even on sites with hundreds of cookies.
- **Lazy Editor Injection:** Cookie edit forms are dynamically constructed only when expanded, minimizing memory footprints.
- **ARIA & Keyboard Navigation:** Complete `role="listitem"`, `aria-expanded`, keyboard shortcuts (`Enter`/`Space` to expand cards, `Esc` to close), and modal focus trapping.

### Test Bed Page

Open `test/test-page.html` in your browser (or serve it locally) to test setting sample session/persistent cookies, batch cookies, and verifying real-time synchronization.

---

## Verifying Network Silence (Zero Data Collection)

We invite all users and security researchers to audit CookieSmith:
1. Open any webpage in Chrome.
2. Right-click the CookieSmith toolbar icon and choose **Inspect popup**.
3. In DevTools, click the **Network** tab.
4. Interact with the extension: inspect cookies, edit a value, export JSON, filter, and add a cookie.
5. Notice: **0 requests made.** Zero packets leave your machine.

---

## License

MIT License. Free and open source.
