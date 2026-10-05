/**
 * CookieSmith Feature Flags & Architecture Seam
 * 
 * Free MVP Round:
 * - 100% local, zero monetization code, no licensing servers, no telemetry.
 * - Clean seams defined here for future Pro features (profiles, team sharing,
 *   custom templates, tracker audit) so they can be plugged in without
 *   destabilizing core cookie operations.
 */

export const FEATURE_FLAGS = {
  // Master Pro switch (false for free MVP)
  PRO_FEATURES_ENABLED: false,

  // Planned future seams:
  SAVED_PROFILES: false,     // Multi-environment cookie switching (dev/stage/prod)
  TEAM_SHARING: false,       // Encrypted peer cookie sharing
  EXPORT_TEMPLATES: false,   // Curl, Postman, Puppeteer code export templates
  TRACKER_AUDIT: false,      // Privacy tracker & third-party cookie health report
  COOKIE_WATCHER: false      // Real-time cookie alteration notifications
};

/**
 * Check if a specific feature is enabled.
 * @param {keyof typeof FEATURE_FLAGS} featureName 
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName) {
  return Boolean(FEATURE_FLAGS[featureName]);
}
