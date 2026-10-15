/**
 * CookieSmith First-Run Audit Fixes Verification
 *
 * Static-inspection suite (same pattern as test-security-audit.mjs) for the
 * first-run audit fixes 2-7 implemented on 2026-10-14:
 * - Fix 2: first-open guide strip, dismissed by core actions or manually,
 *   persisted in chrome.storage.local.
 * - Fix 3: empty Tab URL scope names the domain cookie count and offers a
 *   one-click switch to Entire Domain scope.
 * - Fix 4: no 'Forge' vocabulary in the popup; plain-language hints under
 *   SameSite, Secure, and HttpOnly in the modal and the inline editor.
 * - Fix 5: trust sentence inside the guide strip, paired with the privacy
 *   policy link, disappearing with the strip.
 * - Fix 6: single-cookie delete keeps an in-memory snapshot and offers
 *   Undo on the toast for at least 10 seconds.
 * - Fix 7: visible Edit affordance on every card header.
 * Also guards the standing rule: no new manifest permissions.
 *
 * Claude review pass (2026-10-14, at 573ac13) additions:
 * - F1: the trust line must not claim reads happen only while the popup is
 *   open (the service worker reads with it closed); exact replacement
 *   sentence asserted below.
 * - Fix 2 height: guide entries share one line so the strip renders to
 *   about two lines at the 520px popup width.
 * - F6 addition: the toast is a polite live region (role="status",
 *   aria-live="polite") so the delete message and Undo offer are announced.
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✕ FAILED: ${testName}`);
    failed++;
  }
}

console.log('====================================================');
console.log('🧭 CookieSmith First-Run Audit Fixes Verification');
console.log('====================================================\n');

const repoRoot = path.resolve('.');
const html = fs.readFileSync(path.join(repoRoot, 'popup/popup.html'), 'utf8');
const popupJs = fs.readFileSync(path.join(repoRoot, 'popup/popup.js'), 'utf8');
const css = fs.readFileSync(path.join(repoRoot, 'popup/popup.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const cookieManagerJs = fs.readFileSync(path.join(repoRoot, 'src/cookie-manager.js'), 'utf8');

// -------------------------------------------------------------------
// Suite 1: Fix 4 - plain vocabulary and field hints
// -------------------------------------------------------------------
console.log('Suite 1: Fix 4 - Plain Vocabulary & Field Hints');
assert(!/forge/i.test(html), 'popup.html contains no "Forge" in any string');
assert(!/forge/i.test(popupJs), 'popup.js contains no "Forge" in any string');
assert(html.includes('Add New Cookie'), 'Add/edit modal title and empty-state button say "Add New Cookie"');
assert(popupJs.includes('Added cookie'), 'Add success toast says "Added cookie"');
assert(html.includes('Controls whether the cookie is sent to other sites that embed this one.'), 'Modal shows a plain-language line under SameSite');
assert(popupJs.includes('Controls whether the cookie is sent to other sites that embed this one.'), 'Inline editor shows a plain-language line under SameSite');
assert(html.includes('Only sent over secure HTTPS connections.'), 'Modal shows a plain-language line for Secure');
assert(popupJs.includes('Only sent over secure HTTPS connections.'), 'Inline editor shows a plain-language line for Secure');
assert(html.includes('JavaScript on the page cannot read this cookie.'), 'Modal shows a plain-language line for HttpOnly');
assert(popupJs.includes('JavaScript on the page cannot read this cookie.'), 'Inline editor shows a plain-language line for HttpOnly');
assert(css.includes('.field-hint'), 'Field hint styling exists in popup.css');

// -------------------------------------------------------------------
// Suite 2: Fixes 2 + 5 - guide strip, trust line, persisted dismissal
// -------------------------------------------------------------------
console.log('\nSuite 2: Fixes 2 + 5 - Guide Strip & Trust Line');
assert(html.includes('id="guideStrip"'), 'Guide strip element exists in popup.html');
assert(html.includes('Pick a cookie to edit or delete it'), 'Guide entry 1: pick a cookie to edit or delete it');
assert(html.includes('Clear All signs you out'), 'Guide entry 2: Clear All signs you out');
assert(!html.includes('Clear All signs you out of this site'), 'Guide entry 2 is trimmed so the entries fit one line (height fix)');
assert(html.includes('Add creates a new cookie'), 'Guide entry 3: Add creates a new cookie');
assert(/\.guide-entries\s*\{[^}]*white-space:\s*nowrap/.test(css), 'Guide entries are held to a single line so the strip renders about two lines tall');
assert(html.includes('id="btnDismissGuide"'), 'Guide strip has a manual dismiss control');
assert(html.includes('CookieSmith works only on your device, and nothing is ever sent off it.'), 'Trust line: works only on your device, and nothing is ever sent off it');
assert(!html.includes('only reads cookies when this popup is open'), 'Trust line no longer claims reads happen only while the popup is open (the service worker reads with it closed)');
assert(!popupJs.includes('only reads cookies when this popup is open'), 'No popup-open read claim remains in popup.js');
assert((html.match(/\.\.\/privacy\.html/g) || []).length >= 2, 'Privacy policy link appears in the guide strip and the footer');
assert(css.includes('.guide-strip'), 'Guide strip styling exists in popup.css');
assert(popupJs.includes('cookiesmith_guide_dismissed'), 'Guide dismissal uses a persisted storage key');
assert(popupJs.includes('chrome.storage.local'), 'Guide dismissal persists via chrome.storage.local (no new permissions)');
const dismissCallSites = (popupJs.match(/dismissGuideStrip\(\)/g) || []).length;
assert(dismissCallSites >= 6, `dismissGuideStrip is wired to the definition plus manual dismiss and all core actions (${dismissCallSites} occurrences)`);
assert(popupJs.includes('refreshGuideStrip'), 'Popup checks the persisted dismissal state on open');
assert(!popupJs.includes('guideDismissedCache = false'), 'Dismissal race: the initial read no longer pre-seeds the cache to false');
assert(popupJs.includes('guideDismissedRead'), 'Dismissal race: the initial storage read is memoized as one promise');
assert(popupJs.includes('guideDismissedCache !== true'), 'Dismissal race: a dismissal landing during the read wins over the read result');

// -------------------------------------------------------------------
// Suite 3: Fix 3 - empty Tab URL scope
// -------------------------------------------------------------------
console.log('\nSuite 3: Fix 3 - Empty Tab URL Scope');
assert(html.includes('id="btnEmptyScope"'), 'Empty state has a dedicated domain-scope switch button');
assert(popupJs.includes('domainCookieCount'), 'Popup tracks the domain-scope cookie count');
assert(popupJs.includes('exist for the entire domain'), 'Empty state message states how many cookies exist for the entire domain');
assert(popupJs.includes('switchToDomainScope'), 'One-click scope switch handler exists');
assert(popupJs.includes('scopeDomain.checked = true'), 'Scope switch activates the Entire Domain radio without reopening the popup');

// -------------------------------------------------------------------
// Suite 4: Fix 6 - undo for single-cookie delete
// -------------------------------------------------------------------
console.log('\nSuite 4: Fix 6 - Delete Undo');
assert(html.includes('id="toastActionBtn"'), 'Toast carries an action button element');
assert(/id="toast"[^>]*role="status"/.test(html), 'Toast carries role="status"');
assert(/id="toast"[^>]*aria-live="polite"/.test(html), 'Toast is a polite live region so screen readers announce the delete and the Undo offer');
assert(html.includes('>Undo</button>'), 'Toast action button is labelled "Undo"');
assert(popupJs.includes('lastDeletedCookie'), 'Deleted cookie snapshot is kept in popup memory');
assert(popupJs.includes('snapshotCookieForUndo'), 'Delete flow snapshots the full cookie before deleting');
assert(popupJs.includes('Deleted cookie "${cookie.name}" from ${cookie.domain'), 'Delete toast names the cookie and its domain');
const undoDurationMatch = popupJs.match(/UNDO_TOAST_DURATION_MS = (\d+)/);
assert(Boolean(undoDurationMatch) && Number(undoDurationMatch[1]) >= 10000, 'Undo offer lasts at least 10 seconds');
assert(popupJs.includes('setCookie({ ...snapshot }'), 'Undo re-creates the cookie from the snapshot via setCookie');
assert(popupJs.includes('Restored cookie'), 'Undo confirms the restore and the list reloads');
assert(popupJs.includes('buildCookieUrl(snapshot'), 'Undo builds its restore URL from the snapshot, not from the tab (host-only cookies return to their own host)');
assert(popupJs.includes('partitionKey: cookie.partitionKey'), 'Undo snapshot keeps the cookie partitionKey');
assert(cookieManagerJs.includes('setDetails.partitionKey = cookieData.partitionKey'), 'setCookie passes partitionKey through to chrome.cookies.set');
assert(popupJs.includes('Could not restore partitioned cookie'), 'A refused partitioned restore is surfaced on the toast, never silently restored unpartitioned');
assert(popupJs.includes('undoOfferExpiresAt'), 'A plain toast inside the Undo window no longer destroys the Undo offer before its deadline');
assert(css.includes('.toast-action-btn'), 'Toast action button styling exists in popup.css');

// -------------------------------------------------------------------
// Suite 5: Fix 7 - edit affordance
// -------------------------------------------------------------------
console.log('\nSuite 5: Fix 7 - Edit Affordance');
assert(popupJs.includes('btn-edit'), 'Cookie card template includes the edit affordance button');
assert(popupJs.includes('>Edit</span>'), 'Edit affordance shows a visible "Edit" label');
assert(popupJs.includes("querySelector('.btn-edit')"), 'Edit affordance is wired to a click handler');
assert(popupJs.includes('aria-expanded="${isExpanded}"'), 'Card header keeps its aria-expanded behavior');
assert(popupJs.includes("e.key === 'Enter'"), 'Card header keeps its keyboard toggle behavior');

// -------------------------------------------------------------------
// Suite 6: Standing rules - no new permissions, version untouched
// -------------------------------------------------------------------
console.log('\nSuite 6: Standing Rules');
const sortedPermissions = [...(manifest.permissions || [])].sort();
assert(
  JSON.stringify(sortedPermissions) === JSON.stringify(['activeTab', 'cookies', 'storage']),
  'Manifest permissions are unchanged (cookies, activeTab, storage)'
);
assert(manifest.manifest_version === 3, 'Manifest stays at Version 3');

console.log(`\n====================================================`);
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log(`====================================================\n`);

if (failed > 0) {
  process.exit(1);
}
