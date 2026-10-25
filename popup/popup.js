/**
 * CookieSmith - Popup Controller
 * 100% local, zero telemetry, full Manifest V3 compliance.
 */

import {
  getActiveTab,
  getCookies,
  setCookie,
  deleteCookie,
  deleteAllCookies,
  exportCookiesToJson,
  importCookiesFromJson,
  filterAndSortCookies,
  buildCookieUrl
} from '../src/cookie-manager.js';

import { FEATURE_FLAGS, isFeatureEnabled } from '../src/feature-flags.js';

// Application State
const state = {
  tabInfo: null,
  rawCookies: [],
  filteredCookies: [],
  expandedCookieKeys: new Set(),
  searchQuery: '',
  activeFilter: 'all',
  activeSort: 'name-asc',
  domainWideScope: false,
  domainCookieCount: 0,
  editingCookie: null
};

// DOM Elements
const elements = {
  activeDomain: document.getElementById('activeDomain'),
  sitePill: document.getElementById('sitePill'),
  badgeCount: document.getElementById('badgeCount'),
  btnRefresh: document.getElementById('btnRefresh'),
  restrictedNotice: document.getElementById('restrictedNotice'),
  restrictedReason: document.getElementById('restrictedReason'),
  mainContent: document.getElementById('mainContent'),
  guideStrip: document.getElementById('guideStrip'),
  btnDismissGuide: document.getElementById('btnDismissGuide'),
  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  scopeUrl: document.getElementById('scopeUrl'),
  scopeDomain: document.getElementById('scopeDomain'),
  sortSelect: document.getElementById('sortSelect'),
  cookieList: document.getElementById('cookieList'),
  emptyState: document.getElementById('emptyState'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptyDesc: document.getElementById('emptyDesc'),
  btnEmptyAdd: document.getElementById('btnEmptyAdd'),
  btnEmptyScope: document.getElementById('btnEmptyScope'),

  // Filter Chips
  chips: document.querySelectorAll('.chip'),
  chipCountAll: document.getElementById('chipCountAll'),
  chipCountSession: document.getElementById('chipCountSession'),
  chipCountPersistent: document.getElementById('chipCountPersistent'),
  chipCountSecure: document.getElementById('chipCountSecure'),
  chipCountHttpOnly: document.getElementById('chipCountHttpOnly'),
  chipCountThirdParty: document.getElementById('chipCountThirdParty'),

  // Toolbar Actions
  btnOpenAddModal: document.getElementById('btnOpenAddModal'),
  btnOpenImportModal: document.getElementById('btnOpenImportModal'),
  btnOpenExportModal: document.getElementById('btnOpenExportModal'),
  btnOpenDeleteAllModal: document.getElementById('btnOpenDeleteAllModal'),

  // Modals
  cookieFormModal: document.getElementById('cookieFormModal'),
  formModalTitle: document.getElementById('formModalTitle'),
  cookieForm: document.getElementById('cookieForm'),
  formName: document.getElementById('formName'),
  formValue: document.getElementById('formValue'),
  formValueStats: document.getElementById('formValueStats'),
  formDomain: document.getElementById('formDomain'),
  formPath: document.getElementById('formPath'),
  formSameSite: document.getElementById('formSameSite'),
  formSessionToggle: document.getElementById('formSessionToggle'),
  formExpiryWrapper: document.getElementById('formExpiryWrapper'),
  formExpiryDate: document.getElementById('formExpiryDate'),
  formSecure: document.getElementById('formSecure'),
  formHttpOnly: document.getElementById('formHttpOnly'),
  formHostOnly: document.getElementById('formHostOnly'),

  importModal: document.getElementById('importModal'),
  importFileInput: document.getElementById('importFileInput'),
  importFileStatus: document.getElementById('importFileStatus'),
  importJsonTextarea: document.getElementById('importJsonTextarea'),
  importSummary: document.getElementById('importSummary'),
  importSummaryText: document.getElementById('importSummaryText'),
  btnConfirmImport: document.getElementById('btnConfirmImport'),

  exportModal: document.getElementById('exportModal'),
  exportCountBadge: document.getElementById('exportCountBadge'),
  exportJsonTextarea: document.getElementById('exportJsonTextarea'),
  btnCopyExport: document.getElementById('btnCopyExport'),
  btnDownloadExport: document.getElementById('btnDownloadExport'),

  deleteAllModal: document.getElementById('deleteAllModal'),
  deleteAllCount: document.getElementById('deleteAllCount'),
  deleteAllDomain: document.getElementById('deleteAllDomain'),
  btnConfirmDeleteAll: document.getElementById('btnConfirmDeleteAll'),

  toast: document.getElementById('toast'),
  toastIcon: document.getElementById('toastIcon'),
  toastMessage: document.getElementById('toastMessage'),
  toastActionBtn: document.getElementById('toastActionBtn'),
  toastAnnouncer: document.getElementById('toastAnnouncer')
};

// Toast notification helper
let toastTimeout = null;
// Full contents of the most recently deleted cookie, kept in popup memory
// only so the delete toast can offer Undo. Module state dies with the
// popup, so closing and reopening the popup clears the offer.
let lastDeletedCookie = null;
// Deadline (ms epoch) until which a pending delete Undo offer must stay
// reachable, even if another toast renders in the meantime.
let undoOfferExpiresAt = 0;

// Ends a pending delete Undo offer without touching the toast itself.
// Wholesale cookie-set changes end the offer: once Clear All or an Import
// completes, a dangling single-cookie Undo would sit next to their result
// message and read as undoing that change instead.
function endUndoOffer() {
  lastDeletedCookie = null;
  undoOfferExpiresAt = 0;
  elements.toastActionBtn.classList.add('hidden');
  elements.toast.classList.remove('toast-actionable');
}

// Mirrors a toast message into the permanent screen-reader live region.
// The visible toast is display:none between messages, and some screen
// readers never announce a live region that was just un-hidden, so the
// announcer element stays rendered at all times and carries the text.
function announceToastForScreenReaders(message) {
  if (elements.toastAnnouncer) {
    elements.toastAnnouncer.textContent = message;
  }
}

function showToast(message, isError = false) {
  if (toastTimeout) clearTimeout(toastTimeout);
  // A plain toast may replace the delete toast visually, but it must not
  // destroy a live Undo offer: the snapshot and the "Undo delete" button
  // stay in place until the offer's original deadline. (Clear All and
  // Import end the offer explicitly via endUndoOffer before showing
  // their result toasts.)
  const undoStillOffered = lastDeletedCookie !== null && Date.now() < undoOfferExpiresAt;
  if (!undoStillOffered) {
    endUndoOffer();
  }
  elements.toastMessage.textContent = message;
  elements.toastIcon.textContent = isError ? '✕' : '✓';
  elements.toastIcon.style.color = isError ? '#ef4444' : '#f59e0b';
  elements.toast.classList.remove('hidden');
  announceToastForScreenReaders(message);

  if (undoStillOffered) {
    toastTimeout = setTimeout(hideToast, Math.max(0, undoOfferExpiresAt - Date.now()));
  } else {
    toastTimeout = setTimeout(() => {
      elements.toast.classList.add('hidden');
      announceToastForScreenReaders('');
    }, 2500);
  }
}

// First-open guide strip helpers.
// The strip (with the trust line inside it) shows until the user completes a
// first core action (save, delete, import, clear) or dismisses it manually.
// Dismissal is persisted in chrome.storage.local so it never reappears,
// including after a browser restart. No new permissions: 'storage' is
// already declared in the manifest.
const GUIDE_DISMISSED_KEY = 'cookiesmith_guide_dismissed';
let guideDismissedCache = null;
let guideDismissedRead = null;

// The initial storage read is memoized as a single promise and never
// overwrites a dismissal that landed while the read was in flight:
// dismissGuideStrip sets the cache to true synchronously, and the read
// only fills the cache when no dismissal beat it to it.
function isGuideDismissed() {
  if (guideDismissedCache !== null) return Promise.resolve(guideDismissedCache);
  if (!guideDismissedRead) {
    guideDismissedRead = (async () => {
      let dismissed = false;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const data = await chrome.storage.local.get(GUIDE_DISMISSED_KEY);
          dismissed = Boolean(data && data[GUIDE_DISMISSED_KEY]);
        }
      } catch {
        // Storage unavailable (e.g. standalone preview): treat as not dismissed
        // for this session only.
      }
      if (guideDismissedCache !== true) {
        guideDismissedCache = dismissed;
      }
      return guideDismissedCache;
    })();
  }
  return guideDismissedRead;
}

async function refreshGuideStrip() {
  if (!elements.guideStrip) return;
  const dismissed = await isGuideDismissed();
  if (dismissed) {
    elements.guideStrip.classList.add('hidden');
  } else {
    elements.guideStrip.classList.remove('hidden');
  }
}

async function dismissGuideStrip() {
  guideDismissedCache = true;
  if (elements.guideStrip) {
    elements.guideStrip.classList.add('hidden');
  }
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [GUIDE_DISMISSED_KEY]: true });
    }
  } catch {
    // Non-fatal: the strip stays hidden for this popup session.
  }
}

// Undo support for single-cookie deletes.
// The toast stays up for UNDO_TOAST_DURATION_MS with an Undo button that
// re-creates the cookie exactly as it was.
const UNDO_TOAST_DURATION_MS = 10000;

function snapshotCookieForUndo(cookie) {
  return {
    name: cookie.name,
    value: cookie.value != null ? cookie.value : '',
    domain: cookie.domain || '',
    path: cookie.path || '/',
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: cookie.sameSite || 'unspecified',
    hostOnly: Boolean(cookie.hostOnly),
    isSession: Boolean(cookie.isSession ?? !cookie.expirationDate),
    expirationDate: cookie.expirationDate,
    storeId: cookie.storeId,
    partitionKey: cookie.partitionKey
  };
}

function hideToast() {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  endUndoOffer();
  elements.toast.classList.add('hidden');
  announceToastForScreenReaders('');
}

function showDeleteUndoToast(cookie) {
  if (toastTimeout) clearTimeout(toastTimeout);
  undoOfferExpiresAt = Date.now() + UNDO_TOAST_DURATION_MS;
  elements.toastMessage.textContent = `Deleted cookie "${cookie.name}" from ${cookie.domain || 'this site'}`;
  elements.toastIcon.textContent = '✓';
  elements.toastIcon.style.color = '#f59e0b';
  // "Undo delete", not "Undo": the button can outlive this message when a
  // later toast renders inside the window, and it must never read as
  // undoing that later action (above all not a Clear All).
  elements.toastActionBtn.textContent = 'Undo delete';
  elements.toastActionBtn.classList.remove('hidden');
  elements.toast.classList.add('toast-actionable');
  elements.toast.classList.remove('hidden');
  // The announced text adds what the visible toast only shows as a button:
  // screen-reader users should hear that the Undo delete action exists.
  announceToastForScreenReaders(`${elements.toastMessage.textContent}. Undo delete available`);

  toastTimeout = setTimeout(() => {
    hideToast();
  }, UNDO_TOAST_DURATION_MS);
}

// Delete a single cookie and offer Undo on the toast.
async function deleteCookieWithUndo(cookie) {
  const snapshot = snapshotCookieForUndo(cookie);
  await deleteCookie(cookie, state.tabInfo.url);
  lastDeletedCookie = snapshot;
  await dismissGuideStrip();
  showDeleteUndoToast(snapshot);
  await reloadCookies();
}

// Restore the most recently deleted cookie exactly as it was.
async function undoLastDelete() {
  const snapshot = lastDeletedCookie;
  if (!snapshot) {
    hideToast();
    return;
  }
  lastDeletedCookie = null;
  hideToast();
  // Build the restore URL from the snapshot itself, not from the current
  // tab: a host-only cookie deleted from another subdomain (visible in
  // Entire Domain scope) must be re-created on its own host, and
  // setCookie would otherwise fall back to the tab's host for it.
  const restoreUrl = buildCookieUrl(snapshot, state.tabInfo.url);
  try {
    await setCookie({ ...snapshot }, restoreUrl);
  } catch (err) {
    if (snapshot.partitionKey) {
      // Never fall back to restoring a partitioned cookie unpartitioned;
      // say so on the toast instead.
      showToast(`Could not restore partitioned cookie "${snapshot.name}": ${err.message}`, true);
      await reloadCookies();
      return;
    }
    throw err;
  }
  showToast(`Restored cookie "${snapshot.name}"`);
  await reloadCookies();
}

// Modal open/close helpers with focus management and trapping
let lastFocusedElement = null;

function openModal(modalEl) {
  lastFocusedElement = document.activeElement;
  modalEl.classList.remove('hidden');
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');

  // Focus the first focusable input or button
  const focusable = modalEl.querySelectorAll('input:not([type="hidden"]), textarea, select, button:not([data-close-modal])');
  if (focusable.length > 0) {
    setTimeout(() => focusable[0].focus(), 50);
  }
}

function closeModal(modalEl) {
  modalEl.classList.add('hidden');
  modalEl.removeAttribute('aria-modal');
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

// Initialize Application
async function init() {
  attachEventListeners();
  await loadTabAndCookies();
}

// Fetch active tab and reload cookies
async function loadTabAndCookies() {
  state.tabInfo = await getActiveTab();

  if (!state.tabInfo.isSupported) {
    elements.restrictedReason.textContent = state.tabInfo.reason || 'Protected page';
    elements.restrictedNotice.classList.remove('hidden');
    elements.mainContent.classList.add('hidden');
    elements.activeDomain.textContent = 'Restricted';
    elements.badgeCount.textContent = '0';
    return;
  }

  elements.restrictedNotice.classList.add('hidden');
  elements.mainContent.classList.remove('hidden');

  await refreshGuideStrip();

  // Update domain pill
  elements.activeDomain.textContent = state.tabInfo.hostname || 'Active Tab';
  elements.sitePill.title = state.tabInfo.url;

  await reloadCookies();
}

async function reloadCookies() {
  try {
    state.rawCookies = await getCookies(state.tabInfo, {
      domainWide: state.domainWideScope
    });
    elements.badgeCount.textContent = String(state.rawCookies.length);

    // Fix 3 support: when Tab URL scope is empty, learn whether the wider
    // domain scope has cookies so the empty state can say so and offer the
    // switch. getCookies with domainWide merges URL + domain results, so
    // with an empty URL scope its count is exactly the domain-scope count.
    state.domainCookieCount = 0;
    if (!state.domainWideScope && state.rawCookies.length === 0) {
      try {
        const domainCookies = await getCookies(state.tabInfo, { domainWide: true });
        state.domainCookieCount = domainCookies.length;
      } catch {
        state.domainCookieCount = 0;
      }
    }

    updateFilterCounts();
    applyFilterAndRender();
  } catch (err) {
    console.error('Failed to load cookies:', err);
    showToast('Failed to load cookies: ' + err.message, true);
  }
}

// Update filter chip badge counts
function updateFilterCounts() {
  const all = state.rawCookies.length;
  let session = 0;
  let persistent = 0;
  let secure = 0;
  let httpOnly = 0;
  let thirdParty = 0;

  for (const c of state.rawCookies) {
    if (c.isSession) session++;
    else persistent++;
    if (c.secure) secure++;
    if (c.httpOnly) httpOnly++;
    if (c.isThirdParty) thirdParty++;
  }

  elements.chipCountAll.textContent = String(all);
  elements.chipCountSession.textContent = String(session);
  elements.chipCountPersistent.textContent = String(persistent);
  elements.chipCountSecure.textContent = String(secure);
  elements.chipCountHttpOnly.textContent = String(httpOnly);
  elements.chipCountThirdParty.textContent = String(thirdParty);
}

// Filter, sort, and render cookie list
function applyFilterAndRender() {
  state.filteredCookies = filterAndSortCookies(state.rawCookies, {
    search: state.searchQuery,
    filter: state.activeFilter,
    sort: state.activeSort
  });

  renderCookieList();
}

// Render the list of cookies with DocumentFragment batching
let renderAnimationId = null;

function renderCookieList() {
  if (renderAnimationId) {
    cancelAnimationFrame(renderAnimationId);
    renderAnimationId = null;
  }

  elements.cookieList.innerHTML = '';

  if (state.filteredCookies.length === 0) {
    elements.cookieList.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');

    if (state.searchQuery || state.activeFilter !== 'all') {
      elements.btnEmptyScope.classList.add('hidden');
      elements.emptyTitle.textContent = 'No matching cookies';
      elements.emptyDesc.textContent = 'No cookies match your active search or filter criteria.';
      elements.btnEmptyAdd.textContent = 'Reset Filters';
      elements.btnEmptyAdd.onclick = () => {
        state.searchQuery = '';
        elements.searchInput.value = '';
        elements.btnClearSearch.classList.add('hidden');
        setActiveFilter('all');
      };
    } else if (!state.domainWideScope && state.domainCookieCount > 0) {
      // Tab URL scope is empty but the wider domain has cookies: say how
      // many and offer a one-click switch to the Entire Domain scope.
      const count = state.domainCookieCount;
      const domainLabel = state.tabInfo.baseDomain || state.tabInfo.hostname;
      elements.emptyTitle.textContent = 'No cookies for this page';
      elements.emptyDesc.textContent = `This page has no cookies in Tab URL scope, but ${count} cookie${count === 1 ? '' : 's'} exist for the entire domain (${domainLabel}).`;
      elements.btnEmptyAdd.textContent = '+ Add New Cookie';
      elements.btnEmptyAdd.onclick = () => openAddCookieModal();
      elements.btnEmptyScope.textContent = `Show ${count} domain cookie${count === 1 ? '' : 's'}`;
      elements.btnEmptyScope.classList.remove('hidden');
      elements.btnEmptyScope.onclick = () => switchToDomainScope();
    } else {
      elements.btnEmptyScope.classList.add('hidden');
      elements.emptyTitle.textContent = 'No cookies found';
      elements.emptyDesc.textContent = `No cookies are currently set for ${state.tabInfo.hostname}.`;
      elements.btnEmptyAdd.textContent = '+ Add New Cookie';
      elements.btnEmptyAdd.onclick = () => openAddCookieModal();
    }
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.cookieList.classList.remove('hidden');

  // Optimization: render in chunks via DocumentFragment to prevent layout thrashing
  const total = state.filteredCookies.length;
  const FIRST_BATCH = 40;

  const fragment = document.createDocumentFragment();
  const initialBatch = state.filteredCookies.slice(0, FIRST_BATCH);

  for (const cookie of initialBatch) {
    fragment.appendChild(createCookieCard(cookie));
  }
  elements.cookieList.appendChild(fragment);

  // If list is large, render remainder asynchronously on next frame
  if (total > FIRST_BATCH) {
    let offset = FIRST_BATCH;
    const CHUNK_SIZE = 50;

    function renderNextChunk() {
      if (offset >= total) return;
      const chunkFragment = document.createDocumentFragment();
      const end = Math.min(offset + CHUNK_SIZE, total);
      for (let i = offset; i < end; i++) {
        chunkFragment.appendChild(createCookieCard(state.filteredCookies[i]));
      }
      elements.cookieList.appendChild(chunkFragment);
      offset = end;
      if (offset < total) {
        renderAnimationId = requestAnimationFrame(renderNextChunk);
      }
    }

    renderAnimationId = requestAnimationFrame(renderNextChunk);
  }
}

// Generate DOM element for a cookie card with accessibility & lazy editor
function createCookieCard(cookie) {
  const card = document.createElement('div');
  card.className = 'cookie-card';
  card.setAttribute('role', 'listitem');
  const cookieKey = `${cookie.name}@@${cookie.domain}@@${cookie.path}`;
  const isExpanded = state.expandedCookieKeys.has(cookieKey);
  if (isExpanded) card.classList.add('expanded');

  // Value preview string (truncated)
  const valPreview = cookie.value ? (cookie.value.length > 70 ? cookie.value.slice(0, 70) + '...' : cookie.value) : '<empty>';

  // Badges HTML
  let badgesHtml = '';
  if (cookie.isThirdParty) {
    badgesHtml += '<span class="badge badge-thirdparty">3rd Party</span>';
  }
  if (cookie.secure) {
    badgesHtml += '<span class="badge badge-secure">Secure</span>';
  }
  if (cookie.httpOnly) {
    badgesHtml += '<span class="badge badge-httponly">HttpOnly</span>';
  }
  if (cookie.sameSite && cookie.sameSite !== 'unspecified') {
    badgesHtml += `<span class="badge badge-samesite">${cookie.sameSite}</span>`;
  }
  if (cookie.isSession) {
    badgesHtml += '<span class="badge badge-session">Session</span>';
  } else if (cookie.expiryLabel) {
    badgesHtml += `<span class="badge badge-expiry">${escapeHtml(cookie.expiryLabel)}</span>`;
  }

  card.innerHTML = `
    <div class="card-header" tabindex="0" role="button" aria-expanded="${isExpanded}" aria-label="Cookie ${escapeHtml(cookie.name)}">
      <div class="card-top-row">
        <div class="card-title-group">
          <svg class="card-chevron" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
          <span class="cookie-name mono" title="${escapeHtml(cookie.name)}">${escapeHtml(cookie.name)}</span>
          <span class="cookie-domain-sub">${escapeHtml(cookie.domain || '')}</span>
        </div>
        <div class="card-quick-actions">
          <button class="btn-mini btn-edit" title="Edit Cookie" aria-label="Edit Cookie">
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            <span class="btn-edit-label">Edit</span>
          </button>
          <button class="btn-mini btn-copy-val" title="Copy Cookie Value" aria-label="Copy Cookie Value">
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 2H9a3 3 0 01-3-2z" />
            </svg>
          </button>
          <button class="btn-mini btn-mini-danger btn-quick-del" title="Delete Cookie" aria-label="Delete Cookie">
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div class="card-badges-row">${badgesHtml}</div>
      <div class="card-value-preview mono">${escapeHtml(valPreview)}</div>
    </div>
    <div class="card-editor ${isExpanded ? '' : 'hidden'}">
      <!-- Expanded Editor Content will be injected when opened -->
    </div>
  `;

  // Attach event listeners for card header
  const header = card.querySelector('.card-header');
  const btnEdit = card.querySelector('.btn-edit');
  const btnCopy = card.querySelector('.btn-copy-val');
  const btnDel = card.querySelector('.btn-quick-del');

  btnEdit.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCardExpansion();
  });

  btnCopy.addEventListener('click', async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(cookie.value || '');
    showToast(`Copied value of "${cookie.name}"`);
  });

  btnDel.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await deleteCookieWithUndo(cookie);
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, true);
    }
  });

  function toggleCardExpansion() {
    const editor = card.querySelector('.card-editor');
    if (state.expandedCookieKeys.has(cookieKey)) {
      state.expandedCookieKeys.delete(cookieKey);
      card.classList.remove('expanded');
      header.setAttribute('aria-expanded', 'false');
      editor.classList.add('hidden');
    } else {
      state.expandedCookieKeys.add(cookieKey);
      card.classList.add('expanded');
      header.setAttribute('aria-expanded', 'true');
      renderCardEditor(editor, cookie);
      editor.classList.remove('hidden');
    }
  }

  header.addEventListener('click', toggleCardExpansion);
  header.addEventListener('keydown', (e) => {
    if (isHeaderToggleKey(e, header)) {
      e.preventDefault();
      toggleCardExpansion();
    }
  });

  if (isExpanded) {
    const editor = card.querySelector('.card-editor');
    renderCardEditor(editor, cookie);
  }

  return card;
}

// Enter or Space toggles a card only when pressed on the header itself.
// Key presses on the Edit, Copy and Delete buttons inside the header bubble
// up to the header too; those must be left to the button's own activation,
// otherwise preventDefault cancels the button's click and the card toggles.
function isHeaderToggleKey(e, header) {
  if (e.key === 'Enter' || e.key === ' ') {
    return e.target === header;
  }
  return false;
}

// Render the inline editor inside an expanded card
function renderCardEditor(editorEl, cookie) {
  const isSession = cookie.isSession;
  let dateInputValue = '';
  if (cookie.expirationDate) {
    const d = new Date(cookie.expirationDate * 1000);
    // Format YYYY-MM-DDTHH:mm
    const pad = (n) => String(n).padStart(2, '0');
    dateInputValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  editorEl.innerHTML = `
    <form class="inline-edit-form">
      <div class="form-group col-span-2">
        <label>Value</label>
        <textarea class="form-textarea mono edit-val" rows="3" spellcheck="false">${escapeHtml(cookie.value || '')}</textarea>
        <div class="input-helper">
          <span class="edit-val-stats">${(cookie.value || '').length} chars (${new Blob([cookie.value || '']).size} bytes)</span>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>Domain</label>
          <input type="text" class="form-input edit-domain" value="${escapeHtml(cookie.domain || '')}" spellcheck="false">
        </div>

        <div class="form-group">
          <label>Path</label>
          <input type="text" class="form-input edit-path" value="${escapeHtml(cookie.path || '/')}" spellcheck="false">
        </div>

        <div class="form-group">
          <label>SameSite</label>
          <select class="form-select edit-samesite">
            <option value="lax" ${cookie.sameSite === 'lax' ? 'selected' : ''}>Lax</option>
            <option value="strict" ${cookie.sameSite === 'strict' ? 'selected' : ''}>Strict</option>
            <option value="no_restriction" ${cookie.sameSite === 'no_restriction' ? 'selected' : ''}>None (no_restriction)</option>
            <option value="unspecified" ${!cookie.sameSite || cookie.sameSite === 'unspecified' ? 'selected' : ''}>Unspecified</option>
          </select>
          <div class="field-hint">Controls whether the cookie is sent to other sites that embed this one.</div>
        </div>

        <div class="form-group">
          <label>Expiration</label>
          <label class="checkbox-label" style="padding-top: 4px;">
            <input type="checkbox" class="edit-session-toggle" ${isSession ? 'checked' : ''}>
            <span>Session Cookie</span>
          </label>
        </div>

        <div class="form-group col-span-2 edit-expiry-group ${isSession ? 'hidden' : ''}">
          <label>Expiry Date & Time</label>
          <input type="datetime-local" class="form-input edit-expiry-input" value="${dateInputValue}">
        </div>

        <div class="form-group col-span-2 flags-group">
          <div class="flag-field">
            <label class="checkbox-label">
              <input type="checkbox" class="edit-secure" ${cookie.secure ? 'checked' : ''}>
              <span>Secure</span>
            </label>
            <div class="field-hint">Only sent over secure HTTPS connections.</div>
          </div>
          <div class="flag-field">
            <label class="checkbox-label">
              <input type="checkbox" class="edit-httponly" ${cookie.httpOnly ? 'checked' : ''}>
              <span>HttpOnly</span>
            </label>
            <div class="field-hint">JavaScript on the page cannot read this cookie.</div>
          </div>
          <label class="checkbox-label">
            <input type="checkbox" class="edit-hostonly" ${cookie.hostOnly ? 'checked' : ''}>
            <span>HostOnly</span>
          </label>
        </div>
      </div>

      <div class="editor-actions">
        <button type="button" class="btn btn-danger-ghost btn-sm btn-editor-delete">Delete</button>
        <div class="editor-right-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-editor-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm btn-editor-save">Save Changes</button>
        </div>
      </div>
    </form>
  `;

  // Attach editor event listeners
  const form = editorEl.querySelector('.inline-edit-form');
  const sessionToggle = editorEl.querySelector('.edit-session-toggle');
  const expiryGroup = editorEl.querySelector('.edit-expiry-group');
  const expiryInput = editorEl.querySelector('.edit-expiry-input');
  const valTextarea = editorEl.querySelector('.edit-val');
  const valStats = editorEl.querySelector('.edit-val-stats');
  const sameSiteSelect = editorEl.querySelector('.edit-samesite');
  const secureCheckbox = editorEl.querySelector('.edit-secure');
  const btnCancel = editorEl.querySelector('.btn-editor-cancel');
  const btnDelete = editorEl.querySelector('.btn-editor-delete');

  valTextarea.addEventListener('input', () => {
    const val = valTextarea.value;
    valStats.textContent = `${val.length} chars (${new Blob([val]).size} bytes)`;
  });

  sessionToggle.addEventListener('change', () => {
    if (sessionToggle.checked) {
      expiryGroup.classList.add('hidden');
    } else {
      expiryGroup.classList.remove('hidden');
      if (!expiryInput.value) {
        // default to 1 year ahead
        const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        expiryInput.value = `${oneYear.getFullYear()}-${pad(oneYear.getMonth() + 1)}-${pad(oneYear.getDate())}T${pad(oneYear.getHours())}:${pad(oneYear.getMinutes())}`;
      }
    }
  });

  sameSiteSelect.addEventListener('change', () => {
    if (sameSiteSelect.value === 'no_restriction') {
      secureCheckbox.checked = true;
    }
  });

  btnCancel.addEventListener('click', () => {
    const cookieKey = `${cookie.name}@@${cookie.domain}@@${cookie.path}`;
    state.expandedCookieKeys.delete(cookieKey);
    const card = editorEl.closest('.cookie-card');
    if (card) {
      card.classList.remove('expanded');
      editorEl.classList.add('hidden');
    }
  });

  btnDelete.addEventListener('click', async () => {
    try {
      await deleteCookieWithUndo(cookie);
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, true);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedValue = valTextarea.value;
    const updatedDomain = editorEl.querySelector('.edit-domain').value;
    const updatedPath = editorEl.querySelector('.edit-path').value;
    const updatedSameSite = sameSiteSelect.value;
    const isSessionNow = sessionToggle.checked;
    const isSecure = secureCheckbox.checked;
    const isHttpOnly = editorEl.querySelector('.edit-httponly').checked;
    const isHostOnly = editorEl.querySelector('.edit-hostonly').checked;

    let expirationDate = undefined;
    if (!isSessionNow && expiryInput.value) {
      expirationDate = Math.round(new Date(expiryInput.value).getTime() / 1000);
    }

    try {
      await setCookie({
        name: cookie.name,
        value: updatedValue,
        domain: updatedDomain,
        path: updatedPath,
        sameSite: updatedSameSite,
        secure: isSecure,
        httpOnly: isHttpOnly,
        hostOnly: isHostOnly,
        isSession: isSessionNow,
        expirationDate,
        storeId: cookie.storeId
      }, state.tabInfo.url, cookie);

      await dismissGuideStrip();
      showToast(`Saved cookie "${cookie.name}"`);
      await reloadCookies();
    } catch (err) {
      showToast(`Save failed: ${err.message}`, true);
    }
  });
}

// Add Cookie Modal Logic
function openAddCookieModal() {
  state.editingCookie = null;
  elements.formModalTitle.textContent = 'Add New Cookie';
  elements.cookieForm.reset();

  // Pre-fill active domain & default path
  const host = state.tabInfo ? (state.tabInfo.hostname || '') : '';
  elements.formDomain.value = host ? (host.startsWith('localhost') ? '' : `.${host}`) : '';
  elements.formPath.value = '/';
  elements.formSameSite.value = 'lax';
  elements.formSessionToggle.checked = true;
  elements.formExpiryWrapper.classList.add('hidden');
  elements.formSecure.checked = state.tabInfo ? state.tabInfo.protocol === 'https:' : true;
  elements.formHttpOnly.checked = false;
  elements.formHostOnly.checked = false;
  elements.formValueStats.textContent = '0 chars (0 bytes)';

  openModal(elements.cookieFormModal);
  elements.formName.focus();
}

// Export Modal Logic
function openExportModal() {
  const jsonStr = exportCookiesToJson(state.rawCookies);
  elements.exportCountBadge.textContent = `${state.rawCookies.length} Cookies`;
  elements.exportJsonTextarea.value = jsonStr;
  openModal(elements.exportModal);
}

// Import Modal Logic
function openImportModal() {
  elements.importJsonTextarea.value = '';
  elements.importFileInput.value = '';
  elements.importFileStatus.textContent = 'No file chosen';
  elements.importSummary.classList.add('hidden');
  openModal(elements.importModal);
}

// Delete All Modal Logic
function openDeleteAllModal() {
  elements.deleteAllCount.textContent = String(state.rawCookies.length);
  elements.deleteAllDomain.textContent = state.domainWideScope ? (state.tabInfo.baseDomain || state.tabInfo.hostname) : state.tabInfo.hostname;
  openModal(elements.deleteAllModal);
}

// Switch the scope toggle to Entire Domain and reload in place
async function switchToDomainScope() {
  state.domainWideScope = true;
  elements.scopeDomain.checked = true;
  elements.scopeUrl.checked = false;
  await reloadCookies();
}

// Set active filter chip
function setActiveFilter(filterName) {
  state.activeFilter = filterName;
  elements.chips.forEach(chip => {
    if (chip.getAttribute('data-filter') === filterName) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  applyFilterAndRender();
}

// Helper to escape HTML characters
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Attach all DOM Event Listeners
function attachEventListeners() {
  // Undo button on the delete toast
  elements.toastActionBtn.addEventListener('click', async () => {
    try {
      await undoLastDelete();
    } catch (err) {
      showToast(`Undo failed: ${err.message}`, true);
    }
  });

  // Guide strip manual dismiss
  if (elements.btnDismissGuide) {
    elements.btnDismissGuide.addEventListener('click', async () => {
      await dismissGuideStrip();
    });
  }

  // Refresh button
  elements.btnRefresh.addEventListener('click', async () => {
    elements.btnRefresh.classList.add('spinning');
    await reloadCookies();
    setTimeout(() => elements.btnRefresh.classList.remove('spinning'), 300);
    showToast('Refreshed cookies');
  });

  // Search input & clear button with micro-debounce
  let searchDebounceTimer = null;
  elements.searchInput.addEventListener('input', () => {
    state.searchQuery = elements.searchInput.value;
    if (state.searchQuery) {
      elements.btnClearSearch.classList.remove('hidden');
    } else {
      elements.btnClearSearch.classList.add('hidden');
    }

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applyFilterAndRender();
    }, 60);
  });

  elements.btnClearSearch.addEventListener('click', () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.btnClearSearch.classList.add('hidden');
    applyFilterAndRender();
    elements.searchInput.focus();
  });

  // Scope toggle (Tab URL vs Entire Domain)
  elements.scopeUrl.addEventListener('change', async () => {
    if (elements.scopeUrl.checked) {
      state.domainWideScope = false;
      await reloadCookies();
    }
  });

  elements.scopeDomain.addEventListener('change', async () => {
    if (elements.scopeDomain.checked) {
      state.domainWideScope = true;
      await reloadCookies();
    }
  });

  // Sort selector
  elements.sortSelect.addEventListener('change', () => {
    state.activeSort = elements.sortSelect.value;
    applyFilterAndRender();
  });

  // Filter chips
  elements.chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter');
      setActiveFilter(filter);
    });
  });

  // Toolbar Modal Triggers
  elements.btnOpenAddModal.addEventListener('click', openAddCookieModal);
  elements.btnOpenImportModal.addEventListener('click', openImportModal);
  elements.btnOpenExportModal.addEventListener('click', openExportModal);
  elements.btnOpenDeleteAllModal.addEventListener('click', openDeleteAllModal);

  // Close modals on [data-close-modal] buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      const target = document.getElementById(modalId);
      if (target) closeModal(target);
    });
  });

  // Close modals on clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop);
      }
    });
  });

  // Form value stats calculation
  elements.formValue.addEventListener('input', () => {
    const val = elements.formValue.value;
    elements.formValueStats.textContent = `${val.length} chars (${new Blob([val]).size} bytes)`;
  });

  // Expiry toggle in Add Form
  elements.formSessionToggle.addEventListener('change', () => {
    if (elements.formSessionToggle.checked) {
      elements.formExpiryWrapper.classList.add('hidden');
    } else {
      elements.formExpiryWrapper.classList.remove('hidden');
      if (!elements.formExpiryDate.value) {
        const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        elements.formExpiryDate.value = `${oneYear.getFullYear()}-${pad(oneYear.getMonth() + 1)}-${pad(oneYear.getDate())}T${pad(oneYear.getHours())}:${pad(oneYear.getMinutes())}`;
      }
    }
  });

  // SameSite None requires Secure
  elements.formSameSite.addEventListener('change', () => {
    if (elements.formSameSite.value === 'no_restriction') {
      elements.formSecure.checked = true;
    }
  });

  // Add Cookie Form Submit
  elements.cookieForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = elements.formName.value.trim();
    const value = elements.formValue.value;
    const domain = elements.formDomain.value.trim();
    const path = elements.formPath.value.trim() || '/';
    const sameSite = elements.formSameSite.value;
    const isSession = elements.formSessionToggle.checked;
    const secure = elements.formSecure.checked;
    const httpOnly = elements.formHttpOnly.checked;
    const hostOnly = elements.formHostOnly.checked;

    let expirationDate = undefined;
    if (!isSession && elements.formExpiryDate.value) {
      expirationDate = Math.round(new Date(elements.formExpiryDate.value).getTime() / 1000);
    }

    try {
      await setCookie({
        name,
        value,
        domain,
        path,
        sameSite,
        secure,
        httpOnly,
        hostOnly,
        isSession,
        expirationDate
      }, state.tabInfo.url);

      closeModal(elements.cookieFormModal);
      await dismissGuideStrip();
      showToast(`Added cookie "${name}"`);
      await reloadCookies();
    } catch (err) {
      showToast(`Could not save cookie: ${err.message}`, true);
    }
  });

  // Export Copy Button
  elements.btnCopyExport.addEventListener('click', async () => {
    await navigator.clipboard.writeText(elements.exportJsonTextarea.value);
    showToast(`Copied ${state.rawCookies.length} cookies to clipboard`);
  });

  // Export Download Button (Local Blob download link, zero server calls)
  elements.btnDownloadExport.addEventListener('click', () => {
    const jsonStr = elements.exportJsonTextarea.value;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const domainStr = (state.tabInfo.hostname || 'site').replace(/[^a-zA-Z0-9.-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `cookiesmith-${domainStr}-${dateStr}.json`;

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    showToast(`Downloaded ${filename}`);
  });

  // Import File Input
  elements.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    elements.importFileStatus.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      elements.importJsonTextarea.value = event.target.result;
      updateImportSummary(event.target.result);
    };
    reader.readAsText(file);
  });

  elements.importJsonTextarea.addEventListener('input', () => {
    updateImportSummary(elements.importJsonTextarea.value);
  });

  function updateImportSummary(text) {
    if (!text.trim()) {
      elements.importSummary.classList.add('hidden');
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const count = Array.isArray(parsed) ? parsed.length : 1;
      elements.importSummaryText.textContent = `Found ${count} cookie${count === 1 ? '' : 's'} in JSON payload`;
      elements.importSummary.classList.remove('hidden');
    } catch {
      elements.importSummaryText.textContent = 'Invalid JSON syntax';
      elements.importSummary.classList.remove('hidden');
    }
  }

  // Import Confirm
  elements.btnConfirmImport.addEventListener('click', async () => {
    const text = elements.importJsonTextarea.value.trim();
    if (!text) {
      showToast('Please provide JSON cookie data', true);
      return;
    }

    try {
      const result = await importCookiesFromJson(text, state.tabInfo.url);
      closeModal(elements.importModal);
      await dismissGuideStrip();
      // The import rewrote the cookie set wholesale; a pending
      // single-cookie Undo offer must not survive across it.
      endUndoOffer();
      showToast(`Imported ${result.successCount} of ${result.total} cookies`);
      if (result.failedCount > 0) {
        console.warn('CookieSmith import warnings:', result.errors);
      }
      await reloadCookies();
    } catch (err) {
      showToast(`Import failed: ${err.message}`, true);
    }
  });

  // Delete All Confirm
  elements.btnConfirmDeleteAll.addEventListener('click', async () => {
    try {
      const result = await deleteAllCookies(state.rawCookies, state.tabInfo.url);
      closeModal(elements.deleteAllModal);
      await dismissGuideStrip();
      // Clear All must not leave a pending single-cookie Undo offer next
      // to the "Cleared N cookies" message, where it would read as an
      // undo for the Clear All itself.
      endUndoOffer();
      showToast(`Cleared ${result.deletedCount} cookies`);
      await reloadCookies();
    } catch (err) {
      showToast(`Clear all failed: ${err.message}`, true);
    }
  });

  // Keyboard shortcut Esc to close modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(modal => {
        closeModal(modal);
      });
    }
  });
}

// Start
document.addEventListener('DOMContentLoaded', init);
