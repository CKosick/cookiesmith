/**
 * CookieSmith Automated Unit Test Suite
 * Tests cookie-manager pure functions and round-trip data integrity.
 */

import {
  getBaseDomain,
  buildCookieUrl,
  enrichCookie,
  filterAndSortCookies,
  exportCookiesToJson
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

console.log('--- Running CookieSmith Unit Tests ---\n');

// 1. Base domain tests
console.log('Test Suite 1: Base Domain Resolution');
assert(getBaseDomain('example.com') === 'example.com', 'Standard domain');
assert(getBaseDomain('sub.example.com') === 'example.com', 'Subdomain');
assert(getBaseDomain('deep.sub.example.com') === 'example.com', 'Deep subdomain');
assert(getBaseDomain('localhost') === 'localhost', 'Localhost');
assert(getBaseDomain('127.0.0.1') === '127.0.0.1', 'IP address');
assert(getBaseDomain('shop.amazon.co.uk') === 'amazon.co.uk', 'Multi-part ccTLD co.uk');

// 2. Cookie URL construction tests
console.log('\nTest Suite 2: Cookie URL Construction');
const urlSecure = buildCookieUrl({ domain: '.example.com', path: '/app', secure: true });
assert(urlSecure === 'https://example.com/app', 'Secure HTTPS URL');

const urlHttp = buildCookieUrl({ domain: 'example.com', path: '/', secure: false });
assert(urlHttp === 'http://example.com/', 'HTTP URL');

const urlFallback = buildCookieUrl({ domain: '', path: '/api', secure: true }, 'https://mytest.org/page');
assert(urlFallback.startsWith('https://mytest.org/api'), 'Fallback to tab URL hostname');

// 3. Cookie Enrichment & Third Party Detection
console.log('\nTest Suite 3: Cookie Enrichment & Third Party Detection');
const tabInfo = {
  hostname: 'app.example.com',
  baseDomain: 'example.com',
  url: 'https://app.example.com/dashboard'
};

const firstPartyCookie = enrichCookie({
  name: 'auth_session',
  value: 'secret123',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  expirationDate: Math.round(Date.now() / 1000) + 86400
}, tabInfo);

assert(firstPartyCookie.isThirdParty === false, 'First-party cookie identified correctly');
assert(firstPartyCookie.isSession === false, 'Persistent cookie identified');
assert(firstPartyCookie.size === ('auth_session'.length + 'secret123'.length), 'Size calculated accurately');

const thirdPartyCookie = enrichCookie({
  name: 'tracker_id',
  value: 'xyz789',
  domain: '.adnetwork.net',
  path: '/',
  secure: true,
  expirationDate: undefined
}, tabInfo);

assert(thirdPartyCookie.isThirdParty === true, 'Third-party cookie identified correctly');
assert(thirdPartyCookie.isSession === true, 'Session cookie identified');

// 4. Search, Filter, Sort
console.log('\nTest Suite 4: Search, Filter, Sort');
const testCookies = [
  enrichCookie({ name: 'beta_flag', value: '1', domain: 'example.com', path: '/', isSession: true, size: 10 }, tabInfo),
  enrichCookie({ name: 'alpha_token', value: 'secret', domain: 'example.com', path: '/', secure: true, isSession: false, size: 17, expirationDate: 1800000000 }, tabInfo),
  enrichCookie({ name: 'zebra_cart', value: '99', domain: 'adnetwork.net', path: '/', isThirdParty: true, isSession: true, size: 12 }, tabInfo)
];

// Search
const searchResult = filterAndSortCookies(testCookies, { search: 'alpha' });
assert(searchResult.length === 1 && searchResult[0].name === 'alpha_token', 'Search by name');

// Filter: session
const sessionFiltered = filterAndSortCookies(testCookies, { filter: 'session' });
assert(sessionFiltered.length === 2, 'Filter session cookies');

// Filter: third party
const thirdPartyFiltered = filterAndSortCookies(testCookies, { filter: 'thirdparty' });
assert(thirdPartyFiltered.length === 1 && thirdPartyFiltered[0].name === 'zebra_cart', 'Filter third party cookies');

// Sort: Name A-Z
const sortedAsc = filterAndSortCookies(testCookies, { sort: 'name-asc' });
assert(sortedAsc[0].name === 'alpha_token' && sortedAsc[2].name === 'zebra_cart', 'Sort Name Ascending');

// Sort: Size Desc
const sortedSize = filterAndSortCookies(testCookies, { sort: 'size-desc' });
assert(sortedSize[0].name === 'alpha_token', 'Sort Size Descending');

// 5. JSON Export & Round Trip Integrity
console.log('\nTest Suite 5: JSON Export & Round Trip Integrity');
const original = [
  {
    name: 'test_cookie_1',
    value: 'value_with_special_chars=&$%^@!',
    domain: '.example.com',
    path: '/path1',
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    expirationDate: 1798765432,
    session: false,
    hostOnly: false,
    storeId: '0'
  }
];

const exportedJson = exportCookiesToJson(original);
assert(typeof exportedJson === 'string' && exportedJson.length > 50, 'Export creates non-empty JSON string');

const parsedRoundTrip = JSON.parse(exportedJson);
assert(parsedRoundTrip.length === 1, 'Round-trip array length matches');
assert(parsedRoundTrip[0].name === original[0].name, 'Round-trip name matches');
assert(parsedRoundTrip[0].value === original[0].value, 'Round-trip value matches (lossless)');
assert(parsedRoundTrip[0].secure === original[0].secure, 'Round-trip secure matches');
assert(parsedRoundTrip[0].sameSite === original[0].sameSite, 'Round-trip sameSite matches');
assert(parsedRoundTrip[0].expirationDate === original[0].expirationDate, 'Round-trip expirationDate matches');

console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
