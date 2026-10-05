/**
 * CookieSmith Import/Export Stress & Compatibility Suite
 * Validates JSON parsing edge cases, EditThisCookie format compatibility,
 * and resilient error recovery.
 */

import {
  exportCookiesToJson,
  importCookiesFromJson
} from '../src/cookie-manager.js';

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
console.log('📦 CookieSmith Import & Export Stress Test');
console.log('====================================================\n');

// -------------------------------------------------------------------
// Suite 1: Malformed JSON Syntax Handling
// -------------------------------------------------------------------
console.log('Suite 1: Error Recovery & Malformed Input');

async function testInvalidJson(input, expectedErrorFragment, testName) {
  try {
    await importCookiesFromJson(input, 'https://example.com/');
    assert(false, `${testName} (Should have thrown)`);
  } catch (err) {
    const matched = err.message.toLowerCase().includes(expectedErrorFragment.toLowerCase());
    assert(matched, `${testName}: Caught error "${err.message}"`);
  }
}

await testInvalidJson('', 'Invalid JSON syntax', 'Rejects empty string');
await testInvalidJson('{not a json}', 'Invalid JSON syntax', 'Rejects broken JSON syntax');
await testInvalidJson('[]', 'No cookies found', 'Rejects empty array');

// -------------------------------------------------------------------
// Suite 2: Partial & Malformed Cookie Entries in Batch
// -------------------------------------------------------------------
console.log('\nSuite 2: Resilient Batch Import with Skipped Invalid Items');
const mixedBatch = JSON.stringify([
  { name: 'valid_cookie_1', value: 'val1', domain: 'example.com', path: '/' },
  { not_a_name: 'broken', value: 'val2' }, // Missing name
  null,                                     // Null entry
  { name: 'valid_cookie_2', value: 'val3', domain: 'example.com', path: '/' }
]);

const mixedResult = await importCookiesFromJson(mixedBatch, 'https://example.com/');
assert(mixedResult.total === 4, 'Detected 4 items in raw JSON');
assert(mixedResult.successCount === 2, 'Imported the 2 valid cookies successfully');
assert(mixedResult.failedCount === 2, 'Flagged the 2 malformed items with errors');
assert(mixedResult.errors.length === 2, 'Collected error details without crashing');

// -------------------------------------------------------------------
// Suite 3: EditThisCookie Compatibility Format
// -------------------------------------------------------------------
console.log('\nSuite 3: EditThisCookie Compatibility Format');
const etcSample = JSON.stringify([
  {
    "domain": ".github.com",
    "expirationDate": 1893456000,
    "hostOnly": false,
    "httpOnly": true,
    "name": "user_session",
    "path": "/",
    "sameSite": "lax",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "gh_secret_session_token_xyz"
  },
  {
    "domain": "github.com",
    "hostOnly": true,
    "httpOnly": false,
    "name": "tz",
    "path": "/",
    "sameSite": "unspecified",
    "secure": false,
    "session": true,
    "storeId": "0",
    "value": "America/New_York"
  }
]);

const etcResult = await importCookiesFromJson(etcSample, 'https://github.com/');
assert(etcResult.successCount === 2, 'Imports EditThisCookie JSON format cleanly');
assert(etcResult.failedCount === 0, 'Zero errors on standard EditThisCookie export');

// -------------------------------------------------------------------
// Suite 4: 100 Diverse Cookies Lossless Round-Trip
// -------------------------------------------------------------------
console.log('\nSuite 4: 100 Diverse Cookies Lossless Round-Trip');
const diverseCookies = [];
for (let i = 1; i <= 100; i++) {
  diverseCookies.push({
    name: `stress_cookie_${i}`,
    value: `val_!@#$%^&*()_+={}|[]:;<>?,./~-${i * 99}_${i % 3 === 0 ? 'unicode_🍪_✨' : 'std'}`,
    domain: i % 2 === 0 ? '.example.org' : 'sub.example.org',
    path: i % 4 === 0 ? '/secure/api' : '/',
    secure: i % 2 === 0,
    httpOnly: i % 3 === 0,
    sameSite: i % 2 === 0 ? 'lax' : 'strict',
    expirationDate: i % 5 === 0 ? undefined : 1790000000 + i * 500,
    session: i % 5 === 0,
    hostOnly: i % 2 !== 0,
    storeId: '0'
  });
}

const exported100 = exportCookiesToJson(diverseCookies);
const parsed100 = JSON.parse(exported100);

assert(parsed100.length === 100, 'Exported all 100 cookies to JSON');

let allMatched = true;
for (let i = 0; i < 100; i++) {
  const orig = diverseCookies[i];
  const round = parsed100[i];
  if (
    orig.name !== round.name ||
    orig.value !== round.value ||
    orig.domain !== round.domain ||
    orig.path !== round.path ||
    orig.secure !== round.secure ||
    orig.httpOnly !== round.httpOnly ||
    orig.sameSite !== round.sameSite ||
    orig.session !== round.session
  ) {
    allMatched = false;
    console.error(`Mismatch on cookie #${i}:`, { orig, round });
    break;
  }
}

assert(allMatched, 'All 100 cookies round-tripped with 100% field-level fidelity (0 loss)');

console.log(`\n====================================================`);
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log(`====================================================\n`);

if (failed > 0) {
  process.exit(1);
}
