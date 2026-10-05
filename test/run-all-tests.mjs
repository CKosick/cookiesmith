/**
 * CookieSmith Master Test Runner
 * Orchestrates the full test suite:
 * - Unit & Edge Case Suite (test-cookie-manager.mjs)
 * - Security & Zero-Telemetry Audit (test-security-audit.mjs)
 * - Import/Export Stress & Compatibility Suite (test-import-export-stress.mjs)
 */

import { execSync } from 'child_process';
import path from 'path';

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║         CookieSmith Complete Test Runner             ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

const testSuites = [
  { name: 'Unit & Edge Cases Suite', file: 'test/test-cookie-manager.mjs' },
  { name: 'Security & Zero-Telemetry Audit', file: 'test/test-security-audit.mjs' },
  { name: 'Import/Export Stress & Compatibility Suite', file: 'test/test-import-export-stress.mjs' }
];

let totalPassed = 0;
let totalFailed = 0;
const overallStart = performance.now();

for (const suite of testSuites) {
  const start = performance.now();
  console.log(`▶ Executing ${suite.name} (${suite.file})...`);
  try {
    const output = execSync(`node ${suite.file}`, { encoding: 'utf8', stdio: 'pipe' });
    const duration = (performance.now() - start).toFixed(1);
    console.log(output);
    console.log(`  ➔ ${suite.name}: COMPLETED in ${duration}ms\n`);
    totalPassed++;
  } catch (err) {
    console.error(`\n❌ ERROR in ${suite.name}:`);
    console.error(err.stdout || err.message);
    totalFailed++;
  }
}

const totalDuration = (performance.now() - overallStart).toFixed(1);

console.log('════════════════════════════════════════════════════════');
console.log(`🏁 MASTER TEST RUN COMPLETE in ${totalDuration}ms`);
console.log(`   Suites Passed: ${totalPassed} / ${testSuites.length}`);
console.log(`   Suites Failed: ${totalFailed}`);
console.log('════════════════════════════════════════════════════════\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Codebase is ready for review.');
}
