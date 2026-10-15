/**
 * CookieSmith Comprehensive Unit Test Suite
 * Validates domain parsing, URL construction, cookie enrichment,
 * search/filter/sort algorithms, SameSite compliance, and scale benchmarks.
 */

import {
  getBaseDomain,
  buildCookieUrl,
  enrichCookie,
  filterAndSortCookies,
  exportCookiesToJson,
  setCookie
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
console.log('🧪 CookieSmith Comprehensive Unit Tests');
console.log('====================================================\n');

// -------------------------------------------------------------------
// Test Suite 1: Domain Resolution & Edge Cases
// -------------------------------------------------------------------
console.log('Suite 1: Base Domain Resolution & ccTLD Edge Cases');
assert(getBaseDomain('example.com') === 'example.com', 'Standard domain (example.com)');
assert(getBaseDomain('sub.example.com') === 'example.com', 'Single-level subdomain (sub.example.com)');
assert(getBaseDomain('deep.nested.sub.example.com') === 'example.com', 'Deeply nested subdomain (deep.nested.sub.example.com)');
assert(getBaseDomain('localhost') === 'localhost', 'Localhost');
assert(getBaseDomain('127.0.0.1') === '127.0.0.1', 'IPv4 loopback (127.0.0.1)');
assert(getBaseDomain('192.168.1.100') === '192.168.1.100', 'IPv4 private network (192.168.1.100)');
assert(getBaseDomain('shop.amazon.co.uk') === 'amazon.co.uk', 'UK ccTLD (shop.amazon.co.uk -> amazon.co.uk)');
assert(getBaseDomain('portal.service.gov.uk') === 'service.gov.uk', 'UK Government ccTLD (.gov.uk)');
assert(getBaseDomain('store.sydney.com.au') === 'sydney.com.au', 'Australian ccTLD (.com.au)');
assert(getBaseDomain('tokyo.metro.co.jp') === 'metro.co.jp', 'Japanese ccTLD (.co.jp)');
assert(getBaseDomain('api.cloud.ac.uk') === 'cloud.ac.uk', 'Academic ccTLD (.ac.uk)');
assert(getBaseDomain('') === '', 'Empty domain returns empty string');
assert(getBaseDomain(null) === '', 'Null domain handled safely');

// -------------------------------------------------------------------
// Test Suite 2: Cookie URL Construction & Scheme Handling
// -------------------------------------------------------------------
console.log('\nSuite 2: Cookie URL Construction');
const urlSecure = buildCookieUrl({ domain: '.example.com', path: '/app', secure: true });
assert(urlSecure === 'https://example.com/app', 'Secure cookie constructs https:// and strips leading dot');

const urlHttp = buildCookieUrl({ domain: 'example.com', path: '/', secure: false });
assert(urlHttp === 'http://example.com/', 'Insecure cookie constructs http://');

const urlFallback = buildCookieUrl({ domain: '', path: '/api', secure: true }, 'https://mytest.org/page');
assert(urlFallback === 'https://mytest.org/api', 'Fallback to tab URL hostname when domain is empty');

const urlNoLeadingSlash = buildCookieUrl({ domain: 'api.io', path: 'v1/users', secure: true });
assert(urlNoLeadingSlash === 'https://api.io/v1/users', 'Path without leading slash gets normalized');

const urlRootFallback = buildCookieUrl({ domain: '', path: '', secure: false });
assert(urlRootFallback === 'http://localhost/', 'Missing domain & path falls back to http://localhost/');

// -------------------------------------------------------------------
// Test Suite 3: Cookie Enrichment, Flags & Third-Party Context
// -------------------------------------------------------------------
console.log('\nSuite 3: Cookie Enrichment & Flag Detection');
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

assert(firstPartyCookie.isThirdParty === false, 'Root domain match identified as First-Party');
assert(firstPartyCookie.isSession === false, 'Has expirationDate -> isSession is false');
assert(firstPartyCookie.isExpired === false, 'Future expiration -> isExpired is false');
assert(firstPartyCookie.size === ('auth_session'.length + 'secret123'.length), 'Cookie size calculation matches name+value length');

const thirdPartyCookie = enrichCookie({
  name: '_ga',
  value: 'GA1.2.3456789.1728000',
  domain: '.adnetwork.net',
  path: '/',
  secure: true,
  expirationDate: undefined
}, tabInfo);

assert(thirdPartyCookie.isThirdParty === true, 'Foreign domain identified as 3rd Party');
assert(thirdPartyCookie.isSession === true, 'Undefined expirationDate -> isSession is true');
assert(thirdPartyCookie.expiryLabel === 'Session', 'Session cookie label is "Session"');

const expiredCookie = enrichCookie({
  name: 'old_token',
  value: 'expired_val',
  domain: 'app.example.com',
  path: '/',
  expirationDate: Math.round(Date.now() / 1000) - 3600 // 1 hour ago
}, tabInfo);

assert(expiredCookie.isExpired === true, 'Past expiration date marked as isExpired');
assert(expiredCookie.expiryLabel === 'Expired', 'Expired cookie labeled as "Expired"');

// -------------------------------------------------------------------
// Test Suite 4: Special Characters & Complex Values
// -------------------------------------------------------------------
console.log('\nSuite 4: Special Characters & Complex Values');
const specialValues = [
  { name: 'b64_cookie', val: 'eyJhY2NvdW50X2lkIjoxMjM0NSwidHlwZSI6InVzZXIifQ==' },
  { name: 'url_encoded', val: 'user%40example.com%3Aprofile%20data%3Fparam%3D1%26opt%3Dtrue' },
  { name: 'json_string', val: '{"settings":{"theme":"dark","v":2,"flags":[1,2,3]}}' },
  { name: 'unicode_val', val: '🍪_Cookie_Smith_🔨_Forge_Test_日本語_✨' },
  { name: 'delimited_val', val: 'id=1024&hash=a1b2c3d4e5f6&sig=xyz987' }
];

for (const item of specialValues) {
  const enriched = enrichCookie({
    name: item.name,
    value: item.val,
    domain: 'example.com',
    path: '/'
  }, tabInfo);

  assert(enriched.value === item.val, `Preserves complex value without corruption: ${item.name}`);
  assert(enriched.size === (item.name.length + item.val.length), `Calculates size accurately for ${item.name}`);
}

// -------------------------------------------------------------------
// Test Suite 5: Search, Filtering & Multi-Token Match
// -------------------------------------------------------------------
console.log('\nSuite 5: Search, Filtering & Multi-Token Match');
const cookieDataset = [
  enrichCookie({ name: 'session_token', value: 'tok_live_9981', domain: 'example.com', path: '/', isSession: true, size: 26 }, tabInfo),
  enrichCookie({ name: 'theme_pref', value: 'dark_mode', domain: 'example.com', path: '/', secure: false, isSession: false, expirationDate: 1800000000, size: 19 }, tabInfo),
  enrichCookie({ name: 'stripe_sid', value: 'cus_live_abc', domain: '.stripe.com', path: '/', secure: true, isThirdParty: true, isSession: true, size: 22 }, tabInfo),
  enrichCookie({ name: 'admin_key', value: 'super_secret', domain: 'admin.example.com', path: '/admin', secure: true, httpOnly: true, isSession: false, expirationDate: 1900000000, size: 21 }, tabInfo),
  enrichCookie({ name: 'ab_test_group', value: 'variant_B', domain: 'example.com', path: '/', isSession: false, expirationDate: 1750000000, size: 22 }, tabInfo)
];

// Search matches name, domain, or value
const searchByName = filterAndSortCookies(cookieDataset, { search: 'session' });
assert(searchByName.length === 1 && searchByName[0].name === 'session_token', 'Search by cookie name');

const searchByValue = filterAndSortCookies(cookieDataset, { search: 'dark_mode' });
assert(searchByValue.length === 1 && searchByValue[0].name === 'theme_pref', 'Search by cookie value');

const searchByDomain = filterAndSortCookies(cookieDataset, { search: 'stripe' });
assert(searchByDomain.length === 1 && searchByDomain[0].name === 'stripe_sid', 'Search by domain');

// Case-insensitivity
const searchCaseInsensitive = filterAndSortCookies(cookieDataset, { search: 'STRIPE' });
assert(searchCaseInsensitive.length === 1, 'Search is case-insensitive');

// Filters
const filterSession = filterAndSortCookies(cookieDataset, { filter: 'session' });
assert(filterSession.length === 2, 'Filter: session cookies only');

const filterPersistent = filterAndSortCookies(cookieDataset, { filter: 'persistent' });
assert(filterPersistent.length === 3, 'Filter: persistent cookies only');

const filterSecure = filterAndSortCookies(cookieDataset, { filter: 'secure' });
assert(filterSecure.length === 2, 'Filter: secure cookies only');

const filterHttpOnly = filterAndSortCookies(cookieDataset, { filter: 'httponly' });
assert(filterHttpOnly.length === 1 && filterHttpOnly[0].name === 'admin_key', 'Filter: httpOnly cookies only');

const filterThirdParty = filterAndSortCookies(cookieDataset, { filter: 'thirdparty' });
assert(filterThirdParty.length === 1 && filterThirdParty[0].name === 'stripe_sid', 'Filter: third-party cookies only');

// Sorts
const sortNameAsc = filterAndSortCookies(cookieDataset, { sort: 'name-asc' });
assert(sortNameAsc[0].name === 'ab_test_group' && sortNameAsc[sortNameAsc.length - 1].name === 'theme_pref', 'Sort: Name Ascending (A-Z)');

const sortNameDesc = filterAndSortCookies(cookieDataset, { sort: 'name-desc' });
assert(sortNameDesc[0].name === 'theme_pref' && sortNameDesc[sortNameDesc.length - 1].name === 'ab_test_group', 'Sort: Name Descending (Z-A)');

const sortExpiryAsc = filterAndSortCookies(cookieDataset, { sort: 'expiry-asc' });
assert(sortExpiryAsc[0].name === 'ab_test_group', 'Sort: Expiry Ascending (soonest first among persistent)');

// -------------------------------------------------------------------
// Test Suite 6: Lossless Round-Trip Export & Import Format
// -------------------------------------------------------------------
console.log('\nSuite 6: Lossless Round-Trip Export Integrity');
const testExportPayload = [
  {
    name: 'test_token',
    value: 'secret!@#$%^&*()_+~`|}{[]:;?><,./-=1234567890',
    domain: '.example.com',
    path: '/api/v2',
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    expirationDate: 1850000000,
    session: false,
    hostOnly: false,
    storeId: '0'
  }
];

const exported = exportCookiesToJson(testExportPayload);
assert(typeof exported === 'string' && exported.length > 50, 'exportCookiesToJson produces formatted JSON');

const parsed = JSON.parse(exported);
assert(parsed.length === 1, 'Array length matches');
assert(parsed[0].name === testExportPayload[0].name, 'Cookie name preserved losslessly');
assert(parsed[0].value === testExportPayload[0].value, 'Cookie value preserved losslessly with all special characters');
assert(parsed[0].domain === testExportPayload[0].domain, 'Domain preserved');
assert(parsed[0].path === testExportPayload[0].path, 'Path preserved');
assert(parsed[0].secure === true, 'Secure flag preserved');
assert(parsed[0].httpOnly === true, 'HttpOnly flag preserved');
assert(parsed[0].sameSite === 'strict', 'SameSite strict preserved');
assert(parsed[0].expirationDate === 1850000000, 'Expiration timestamp preserved');

// -------------------------------------------------------------------
// Test Suite 7: Scale & Performance Benchmark (500 cookies)
// -------------------------------------------------------------------
console.log('\nSuite 7: Scale & Performance Benchmark (500 cookies)');
const largeCookieSet = [];
for (let i = 1; i <= 500; i++) {
  largeCookieSet.push(enrichCookie({
    name: `benchmark_cookie_${i}`,
    value: `bench_value_hash_${i * 47}_payload_data_xyz`,
    domain: i % 4 === 0 ? '.tracker-network.com' : (i % 2 === 0 ? '.example.com' : 'app.example.com'),
    path: i % 3 === 0 ? '/admin' : '/',
    secure: i % 2 === 0,
    httpOnly: i % 3 === 0,
    sameSite: i % 2 === 0 ? 'lax' : 'strict',
    expirationDate: i % 5 === 0 ? undefined : 1750000000 + i * 1000
  }, tabInfo));
}

assert(largeCookieSet.length === 500, 'Constructed 500 simulated cookies for stress testing');

const startTime = performance.now();
// 1. Search across 500 cookies
const searchBench = filterAndSortCookies(largeCookieSet, { search: 'cookie_25' });
// 2. Filter by session
const filterBench = filterAndSortCookies(largeCookieSet, { filter: 'session' });
// 3. Sort by size
const sortBench = filterAndSortCookies(largeCookieSet, { sort: 'size-desc' });
const duration = performance.now() - startTime;

assert(searchBench.length >= 10, 'Search across 500 cookies matches correctly (10 matches)');
assert(filterBench.length === 100, 'Filter session cookies from 500 returns exact count (100)');
assert(sortBench.length === 500, 'Sort 500 cookies completes');
assert(duration < 25, `500 cookie search/filter/sort completed in ${duration.toFixed(2)}ms (< 25ms threshold)`);

// -------------------------------------------------------------------
// Test Suite 8: Undo Restore Probes (stubbed chrome.cookies)
// Regression coverage for the Claude review of the delete Undo (F2/F3):
// restoring must target the deleted cookie's own host for host-only
// cookies, and must carry partitionKey through chrome.cookies.set
// instead of silently restoring the cookie unpartitioned.
// -------------------------------------------------------------------
console.log('\nSuite 8: Undo Restore Probes (stubbed chrome.cookies)');
const undoTabUrl = 'https://www.example.com/account';
const hostOnlySnapshot = {
  name: 'api_session',
  value: 'abc123',
  domain: 'api.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'lax',
  hostOnly: true,
  isSession: true,
  expirationDate: undefined,
  storeId: '0'
};

// The popup Undo builds its restore URL from the snapshot itself.
const undoRestoreUrl = buildCookieUrl(hostOnlySnapshot, undoTabUrl);
assert(new URL(undoRestoreUrl).hostname === 'api.example.com', 'Undo restore URL targets the deleted host-only cookie\'s own host');
// Control: the pre-fix call shape (the bare tab URL as fallback) resolves
// to the tab's host instead, which is the bug being guarded against.
const preFixUrl = buildCookieUrl({ ...hostOnlySnapshot, domain: '' }, undoTabUrl);
assert(new URL(preFixUrl).hostname === 'www.example.com', 'Control: building from the bare tab URL lands on the tab host (the old bug)');

const capturedSetDetails = [];
globalThis.chrome = {
  cookies: {
    set: async (details) => { capturedSetDetails.push(details); return { ...details }; },
    remove: async (details) => ({ ...details })
  },
  runtime: {}
};

await setCookie({ ...hostOnlySnapshot }, undoRestoreUrl);
const hostOnlySet = capturedSetDetails[capturedSetDetails.length - 1];
assert(new URL(hostOnlySet.url).hostname === 'api.example.com', 'chrome.cookies.set is called with the api.example.com URL for the host-only restore');
assert(hostOnlySet.domain === undefined, 'Host-only restore passes no domain attribute, so the cookie stays host-only');

const partitionedSnapshot = {
  name: 'pcs_cookie',
  value: 'p1',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: false,
  sameSite: 'lax',
  hostOnly: false,
  isSession: false,
  expirationDate: 1893456000,
  storeId: '0',
  partitionKey: { topLevelSite: 'https://shop.example.com', hasCrossSiteAncestor: false }
};
capturedSetDetails.length = 0;
await setCookie({ ...partitionedSnapshot }, buildCookieUrl(partitionedSnapshot, undoTabUrl));
const partitionedSet = capturedSetDetails[capturedSetDetails.length - 1];
assert(Boolean(partitionedSet.partitionKey) && partitionedSet.partitionKey.topLevelSite === 'https://shop.example.com', 'chrome.cookies.set receives the snapshot partitionKey on restore');

// If the API refuses the partitioned set, setCookie must throw so the
// Undo can surface it, never succeed by dropping the partition.
globalThis.chrome.cookies.set = async () => null;
let partitionedRestoreThrew = false;
try {
  await setCookie({ ...partitionedSnapshot }, buildCookieUrl(partitionedSnapshot, undoTabUrl));
} catch {
  partitionedRestoreThrew = true;
}
assert(partitionedRestoreThrew, 'A refused partitioned restore throws instead of silently restoring unpartitioned');

delete globalThis.chrome;

console.log(`\n====================================================`);
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log(`====================================================\n`);

if (failed > 0) {
  process.exit(1);
}
