/**
 * CookieSmith - Background Service Worker (Manifest V3)
 * 
 * Rules:
 * 1. 100% ephemeral - no in-memory state across events.
 * 2. Zero telemetry, zero analytics, zero external network requests.
 * 3. Updates action badge with cookie count for the active tab.
 */

async function updateBadgeForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) {
      await chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    const urlLower = tab.url.toLowerCase();
    if (urlLower.startsWith('chrome:') || urlLower.startsWith('edge:') || urlLower.startsWith('about:') || urlLower.startsWith('chrome-extension:')) {
      await chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    const cookies = await chrome.cookies.getAll({ url: tab.url });
    const count = cookies ? cookies.length : 0;
    const badgeText = count > 0 ? (count > 999 ? '999+' : String(count)) : '';

    await chrome.action.setBadgeText({ tabId, text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' }); // CookieSmith golden-amber badge
  } catch (err) {
    // Tab might be closed or restricted
  }
}

// Update badge when user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateBadgeForTab(activeInfo.tabId);
});

// Update badge when active tab finishes loading/navigating
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await updateBadgeForTab(tabId);
  }
});

// Update badge when cookies change
chrome.cookies.onChanged.addListener(async () => {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id) {
      await updateBadgeForTab(activeTab.id);
    }
  } catch {
    // Ignore transient query errors
  }
});
