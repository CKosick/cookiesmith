/**
 * CookieSmith - Core Cookie Management Logic
 * Clean, modern Manifest V3 chrome.cookies abstraction.
 * 100% local, zero external network requests.
 */

/**
 * Get current active tab in current window.
 * Returns tab and validation info.
 */
// Mock store for standalone browser preview mode (when running outside Chrome extension context)
const mockStore = [
  {
    name: 'user_session',
    value: 's%3A_Q9Z1aBC99812x.xyz0918',
    domain: '.example.com',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    expirationDate: Math.round(Date.now() / 1000) + 86400 * 7,
    storeId: '0'
  },
  {
    name: 'theme',
    value: 'dark',
    domain: 'example.com',
    path: '/',
    secure: false,
    httpOnly: false,
    sameSite: 'lax',
    expirationDate: Math.round(Date.now() / 1000) + 86400 * 30,
    storeId: '0'
  },
  {
    name: 'cart_temp_id',
    value: 'cart_887192_session',
    domain: 'example.com',
    path: '/',
    secure: true,
    httpOnly: false,
    sameSite: 'strict',
    expirationDate: undefined, // Session cookie
    storeId: '0'
  },
  {
    name: '_ga_tracker',
    value: 'GA1.2.98172635.1728000',
    domain: '.adnetwork.net',
    path: '/',
    secure: true,
    httpOnly: false,
    sameSite: 'no_restriction',
    expirationDate: Math.round(Date.now() / 1000) + 86400 * 365,
    storeId: '0'
  }
];

/**
 * Get current active tab in current window.
 * Returns tab and validation info.
 */
export async function getActiveTab() {
  // If chrome extension API is available, use real active tab
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        return { tab: null, isSupported: false, reason: 'No active tab found' };
      }

      const tab = tabs[0];
      if (!tab.url) {
        return { tab, isSupported: false, reason: 'Tab URL unavailable (permission or blank tab)' };
      }

      const urlLower = tab.url.toLowerCase();
      const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'devtools:', 'view-source:', 'about:'];
      for (const protocol of restrictedProtocols) {
        if (urlLower.startsWith(protocol)) {
          return {
            tab,
            isSupported: false,
            reason: `Browser security restricts extension access on internal "${protocol}" pages.`
          };
        }
      }

      const parsed = new URL(tab.url);
      const hostname = parsed.hostname;
      const origin = parsed.origin;
      const baseDomain = getBaseDomain(hostname);

      return {
        tab,
        isSupported: true,
        url: tab.url,
        hostname,
        origin,
        baseDomain,
        protocol: parsed.protocol
      };
    } catch (err) {
      return {
        tab: null,
        isSupported: false,
        reason: `Could not parse tab URL: ${err.message}`
      };
    }
  }

  // Standalone browser preview fallback
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/';
  const parsed = new URL(currentUrl);
  return {
    tab: { id: 1, url: currentUrl },
    isSupported: true,
    url: currentUrl,
    hostname: parsed.hostname === 'localhost' ? 'example.com' : parsed.hostname,
    origin: parsed.origin,
    baseDomain: parsed.hostname === 'localhost' ? 'example.com' : getBaseDomain(parsed.hostname),
    protocol: parsed.protocol
  };
}

/**
 * Extract root/base domain (e.g. sub.example.com -> example.com, localhost -> localhost)
 */
export function getBaseDomain(hostname) {
  if (!hostname) return '';
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // Handle two-part TLDs like .co.uk, .com.au
  const secondLevelTlds = ['co.uk', 'gov.uk', 'ac.uk', 'org.uk', 'com.au', 'net.au', 'co.jp', 'com.br'];
  const lastTwo = parts.slice(-2).join('.');
  if (secondLevelTlds.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Fetch cookies for a given tab.
 * @param {object} tabInfo - Active tab info from getActiveTab()
 * @param {object} [options] - { domainWide: boolean }
 */
export async function getCookies(tabInfo, options = { domainWide: false }) {
  if (!tabInfo || !tabInfo.isSupported) {
    return [];
  }

  // If running outside Chrome extension context, use mockStore
  if (typeof chrome === 'undefined' || !chrome.cookies || !chrome.cookies.getAll) {
    return mockStore.map(cookie => enrichCookie(cookie, tabInfo));
  }

  const cookieMap = new Map();

  // 1. Fetch cookies by exact tab URL
  try {
    const urlCookies = await chrome.cookies.getAll({ url: tabInfo.url });
    for (const c of urlCookies) {
      const key = getCookieKey(c);
      cookieMap.set(key, c);
    }
  } catch (err) {
    console.warn('CookieSmith: error querying cookies by URL:', err);
  }

  // 2. If domainWide is requested or fallback needed, query by domain
  if (options.domainWide && tabInfo.baseDomain) {
    try {
      const domainCookies = await chrome.cookies.getAll({ domain: tabInfo.baseDomain });
      for (const c of domainCookies) {
        const key = getCookieKey(c);
        if (!cookieMap.has(key)) {
          cookieMap.set(key, c);
        }
      }
    } catch (err) {
      console.warn('CookieSmith: error querying cookies by domain:', err);
    }
  }

  const rawCookies = Array.from(cookieMap.values());
  return rawCookies.map(cookie => enrichCookie(cookie, tabInfo));
}

/**
 * Generate a unique key for deduplication
 */
function getCookieKey(c) {
  return `${c.name}@@${c.domain}@@${c.path}@@${c.storeId || '0'}`;
}

/**
 * Enrich cookie with computed metadata and formatting
 */
export function enrichCookie(cookie, tabInfo) {
  const isSession = !cookie.expirationDate;
  const isExpired = Boolean(cookie.expirationDate && cookie.expirationDate <= Date.now() / 1000);
  const size = (cookie.name || '').length + (cookie.value || '').length;

  // Determine third-party context
  let isThirdParty = false;
  if (tabInfo && tabInfo.hostname) {
    const cookieDomainClean = (cookie.domain || '').replace(/^\./, '').toLowerCase();
    const tabHost = tabInfo.hostname.toLowerCase();
    const tabBase = (tabInfo.baseDomain || '').toLowerCase();

    const isDirectMatch = tabHost === cookieDomainClean || tabHost.endsWith('.' + cookieDomainClean);
    const isBaseMatch = cookieDomainClean.endsWith(tabBase);

    isThirdParty = !(isDirectMatch || isBaseMatch);
  }

  // Expiration label
  let expiryLabel = 'Session';
  let expiryDateIso = '';
  if (cookie.expirationDate) {
    const date = new Date(cookie.expirationDate * 1000);
    expiryDateIso = date.toISOString();
    expiryLabel = formatExpiry(date);
  }

  return {
    ...cookie,
    isSession,
    isExpired,
    isThirdParty,
    size,
    expiryLabel,
    expiryDateIso
  };
}

/**
 * Format expiry date into a readable string
 */
function formatExpiry(date) {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    return diffHours <= 1 ? 'In < 1 hour' : `In ${diffHours} hours`;
  }
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 30) return `In ${diffDays} days`;
  if (diffDays < 365) return `In ${Math.round(diffDays / 30)} months`;
  return `In ${(diffDays / 365).toFixed(1)} years`;
}

/**
 * Construct valid URL for chrome.cookies operations based on cookie attributes
 */
export function buildCookieUrl(cookie, fallbackTabUrl) {
  if (fallbackTabUrl && (!cookie.domain || fallbackTabUrl.includes(cookie.domain.replace(/^\./, '')))) {
    try {
      const tabUrlObj = new URL(fallbackTabUrl);
      const scheme = cookie.secure ? 'https:' : (tabUrlObj.protocol || 'https:');
      const cleanPath = cookie.path && cookie.path.startsWith('/') ? cookie.path : '/';
      const cleanDomain = (cookie.domain || tabUrlObj.hostname).replace(/^\./, '');
      return `${scheme}//${cleanDomain}${cleanPath}`;
    } catch {
      // fallback
    }
  }

  const scheme = cookie.secure ? 'https:' : 'http:';
  const cleanDomain = (cookie.domain || 'localhost').replace(/^\./, '');
  const cleanPath = cookie.path && cookie.path.startsWith('/') ? cookie.path : '/';
  return `${scheme}//${cleanDomain}${cleanPath}`;
}

/**
 * Set (create or update) a cookie
 * @param {object} cookieData
 * @param {string} [fallbackTabUrl]
 * @param {object} [previousCookie] - If provided and key fields changed, deletes the old one
 */
export async function setCookie(cookieData, fallbackTabUrl, previousCookie = null) {
  if (!cookieData.name || cookieData.name.trim() === '') {
    throw new Error('Cookie name is required.');
  }

  // Browser security rule: SameSite: None (no_restriction) requires Secure: true
  let secure = Boolean(cookieData.secure);
  let sameSite = cookieData.sameSite || 'lax';
  if (sameSite === 'no_restriction') {
    secure = true;
  }

  let cleanDomain = cookieData.domain ? cookieData.domain.trim() : undefined;
  // If hostOnly is true or domain is empty, leave domain undefined for chrome.cookies.set
  if (cookieData.hostOnly || !cleanDomain) {
    cleanDomain = undefined;
  }

  let cleanPath = cookieData.path ? cookieData.path.trim() : '/';
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }

  const targetUrl = buildCookieUrl({
    domain: cleanDomain || (previousCookie ? previousCookie.domain : ''),
    path: cleanPath,
    secure
  }, fallbackTabUrl);

  const setDetails = {
    url: targetUrl,
    name: cookieData.name.trim(),
    value: cookieData.value != null ? String(cookieData.value) : '',
    path: cleanPath,
    secure,
    httpOnly: Boolean(cookieData.httpOnly),
    sameSite
  };

  if (cleanDomain) {
    setDetails.domain = cleanDomain;
  }

  if (cookieData.storeId) {
    setDetails.storeId = cookieData.storeId;
  }

  // Expiration handling: session vs persistent
  if (!cookieData.isSession && cookieData.expirationDate) {
    const expNum = Number(cookieData.expirationDate);
    if (!isNaN(expNum) && expNum > 0) {
      setDetails.expirationDate = Math.round(expNum);
    }
  }

  // If old cookie exists and name, domain, or path changed, remove the previous cookie first
  if (previousCookie) {
    const keyChanged = previousCookie.name !== setDetails.name ||
      previousCookie.domain !== setDetails.domain ||
      previousCookie.path !== setDetails.path;

    if (keyChanged) {
      try {
        await deleteCookie(previousCookie, fallbackTabUrl);
      } catch (err) {
        console.warn('Could not remove previous cookie during rename:', err);
      }
    }
  }

  if (typeof chrome === 'undefined' || !chrome.cookies || !chrome.cookies.set) {
    const idx = mockStore.findIndex(c => c.name === setDetails.name);
    const newEntry = {
      name: setDetails.name,
      value: setDetails.value,
      domain: setDetails.domain || 'example.com',
      path: setDetails.path,
      secure: setDetails.secure,
      httpOnly: setDetails.httpOnly,
      sameSite: setDetails.sameSite,
      expirationDate: setDetails.expirationDate,
      storeId: setDetails.storeId || '0'
    };
    if (idx >= 0) mockStore[idx] = newEntry;
    else mockStore.push(newEntry);
    return newEntry;
  }

  const result = await chrome.cookies.set(setDetails);
  if (!result) {
    throw new Error(chrome.runtime.lastError?.message || 'Failed to save cookie. Verify permissions and domain.');
  }
  return result;
}

/**
 * Delete a single cookie
 */
export async function deleteCookie(cookie, fallbackTabUrl) {
  if (typeof chrome === 'undefined' || !chrome.cookies || !chrome.cookies.remove) {
    const idx = mockStore.findIndex(c => c.name === cookie.name);
    if (idx >= 0) mockStore.splice(idx, 1);
    return { name: cookie.name };
  }

  const url = buildCookieUrl(cookie, fallbackTabUrl);
  const removeDetails = {
    url,
    name: cookie.name
  };
  if (cookie.storeId) {
    removeDetails.storeId = cookie.storeId;
  }
  if (cookie.partitionKey) {
    removeDetails.partitionKey = cookie.partitionKey;
  }

  const result = await chrome.cookies.remove(removeDetails);
  if (!result) {
    throw new Error(chrome.runtime.lastError?.message || `Failed to delete cookie "${cookie.name}".`);
  }
  return result;
}

/**
 * Delete all cookies in the given list
 */
export async function deleteAllCookies(cookies, fallbackTabUrl) {
  let deletedCount = 0;
  const errors = [];

  for (const cookie of cookies) {
    try {
      await deleteCookie(cookie, fallbackTabUrl);
      deletedCount++;
    } catch (err) {
      errors.push({ name: cookie.name, error: err.message });
    }
  }

  return { deletedCount, total: cookies.length, errors };
}

/**
 * Export cookies to standard JSON string
 */
export function exportCookiesToJson(cookies) {
  const exportable = cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: Boolean(c.secure),
    httpOnly: Boolean(c.httpOnly),
    sameSite: c.sameSite || 'unspecified',
    expirationDate: c.expirationDate || undefined,
    session: Boolean(c.isSession ?? (!c.expirationDate)),
    hostOnly: Boolean(c.hostOnly),
    storeId: c.storeId || '0'
  }));

  return JSON.stringify(exportable, null, 2);
}

/**
 * Import cookies from JSON string
 */
export async function importCookiesFromJson(jsonString, fallbackTabUrl) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Invalid JSON syntax: ${err.message}`);
  }

  const cookieList = Array.isArray(parsed) ? parsed : [parsed];
  if (cookieList.length === 0) {
    throw new Error('No cookies found in the provided JSON.');
  }

  let successCount = 0;
  const errors = [];

  for (const item of cookieList) {
    if (!item || typeof item !== 'object' || !item.name) {
      errors.push({ item, error: 'Missing required cookie "name"' });
      continue;
    }

    try {
      await setCookie({
        name: item.name,
        value: item.value || '',
        domain: item.domain,
        path: item.path || '/',
        secure: item.secure,
        httpOnly: item.httpOnly,
        sameSite: item.sameSite,
        isSession: item.session ?? (!item.expirationDate),
        expirationDate: item.expirationDate,
        hostOnly: item.hostOnly,
        storeId: item.storeId
      }, fallbackTabUrl);
      successCount++;
    } catch (err) {
      errors.push({ name: item.name, error: err.message });
    }
  }

  return {
    total: cookieList.length,
    successCount,
    failedCount: errors.length,
    errors
  };
}

/**
 * Filter, search, and sort cookies
 */
export function filterAndSortCookies(cookies, { search = '', filter = 'all', sort = 'name-asc' }) {
  const query = search.trim().toLowerCase();

  let filtered = cookies.filter(c => {
    // Search match
    if (query) {
      const matchName = (c.name || '').toLowerCase().includes(query);
      const matchValue = (c.value || '').toLowerCase().includes(query);
      const matchDomain = (c.domain || '').toLowerCase().includes(query);
      if (!matchName && !matchValue && !matchDomain) {
        return false;
      }
    }

    // Filter chip match
    switch (filter) {
      case 'session':
        return c.isSession;
      case 'persistent':
        return !c.isSession;
      case 'secure':
        return c.secure;
      case 'httponly':
        return c.httpOnly;
      case 'thirdparty':
        return c.isThirdParty;
      default:
        return true;
    }
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sort) {
      case 'name-asc':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'name-desc':
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      case 'expiry-asc': {
        const aExp = a.expirationDate || Number.MAX_SAFE_INTEGER;
        const bExp = b.expirationDate || Number.MAX_SAFE_INTEGER;
        return aExp - bExp;
      }
      case 'expiry-desc': {
        const aExp = a.expirationDate || 0;
        const bExp = b.expirationDate || 0;
        return bExp - aExp;
      }
      case 'size-desc':
        return b.size - a.size;
      default:
        return 0;
    }
  });

  return filtered;
}
