/**
 * CookieSmith Security & Network Silence Audit
 * 
 * Verifies the foundational promise:
 * "Trust is the product. Zero telemetry, zero analytics SDKs, zero outbound requests."
 * 
 * Scans all extension files to verify:
 * 1. Zero outbound network calls (no fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource).
 * 2. Zero remote script or stylesheet inclusions (no CDN links, no remote script tags).
 * 3. Zero dynamic code execution (no eval, no new Function).
 * 4. Zero tracking or telemetry SDK signatures.
 * 5. Strict Manifest V3 compliance.
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
console.log('🛡️ CookieSmith Security & Zero-Telemetry Audit');
console.log('====================================================\n');

const repoRoot = path.resolve('.');

// Files to scan for security audit
const filesToScan = [
  'manifest.json',
  'background/service-worker.js',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'src/cookie-manager.js',
  'src/feature-flags.js',
  'privacy.html'
];

// Patterns that would indicate network communication or tracking
const forbiddenPatterns = [
  { regex: /\bfetch\s*\(/, desc: 'fetch() API call' },
  { regex: /\bXMLHttpRequest\b/, desc: 'XMLHttpRequest constructor' },
  { regex: /\bsendBeacon\s*\(/, desc: 'navigator.sendBeacon() call' },
  { regex: /\bWebSocket\b/, desc: 'WebSocket connection' },
  { regex: /\bEventSource\b/, desc: 'EventSource / SSE connection' },
  { regex: /\beval\s*\(/, desc: 'eval() code execution' },
  { regex: /\bnew\s+Function\s*\(/, desc: 'new Function() constructor' },
  { regex: /<script[^>]+src=["']https?:\/\//i, desc: 'Remote HTTP/HTTPS script inclusion' },
  { regex: /<link[^>]+href=["']https?:\/\//i, desc: 'Remote HTTP/HTTPS stylesheet inclusion' },
  { regex: /google-analytics\.com/i, desc: 'Google Analytics domain' },
  { regex: /googletagmanager\.com/i, desc: 'Google Tag Manager domain' },
  { regex: /mixpanel/i, desc: 'Mixpanel analytics SDK' },
  { regex: /segment\.com/i, desc: 'Segment analytics SDK' },
  { regex: /sentry\.io/i, desc: 'Sentry error reporting SDK' }
];

console.log('Suite 1: Static Code Inspection for Outbound Calls & Trackers');

for (const relPath of filesToScan) {
  const fullPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️ File not found: ${relPath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  for (const { regex, desc } of forbiddenPatterns) {
    const match = content.match(regex);
    assert(
      !match,
      `[${relPath}] Zero occurrences of ${desc}`
    );
  }
}

// -------------------------------------------------------------------
// Suite 2: Manifest V3 Compliance Check
// -------------------------------------------------------------------
console.log('\nSuite 2: Manifest V3 Compliance & Minimal Permissions');
const manifestContent = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));

assert(manifestContent.manifest_version === 3, 'manifest_version is exactly 3');
assert(Boolean(manifestContent.action), 'action object declared');
assert(manifestContent.action.default_popup === 'popup/popup.html', 'action.default_popup points to popup/popup.html');
assert(Boolean(manifestContent.background?.service_worker), 'background.service_worker declared (no background pages)');

// Check icons exist on disk
for (const [size, iconPath] of Object.entries(manifestContent.icons || {})) {
  const diskPath = path.join(repoRoot, iconPath);
  const exists = fs.existsSync(diskPath);
  assert(exists, `Icon ${size}x${size} exists on disk at ${iconPath}`);
  if (exists) {
    const stats = fs.statSync(diskPath);
    assert(stats.size > 100, `Icon ${size}x${size} file has non-trivial size (${stats.size} bytes)`);
  }
}

// Check permissions
const declaredPermissions = manifestContent.permissions || [];
assert(!declaredPermissions.includes('webRequest'), 'Does NOT request sensitive webRequest permission');
assert(!declaredPermissions.includes('declarativeNetRequest'), 'Does NOT request declarativeNetRequest permission');
assert(!declaredPermissions.includes('identity'), 'Does NOT request identity permission (free MVP)');
assert(!declaredPermissions.includes('management'), 'Does NOT request management permission');
assert(declaredPermissions.includes('cookies'), 'Requests required cookies permission');
assert(declaredPermissions.includes('activeTab'), 'Requests activeTab permission for tab detection');

console.log(`\n====================================================`);
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log(`====================================================\n`);

if (failed > 0) {
  process.exit(1);
}
