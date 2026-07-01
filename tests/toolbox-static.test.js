const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'sehuatang-toolbox.user.js');

const main = fs.readFileSync(mainPath, 'utf8');
const batchStart = main.indexOf('function batchFavoriteOpened');
const batchEnd = main.indexOf('function setFavoriteRow', batchStart);
const batchFavorite = main.slice(batchStart, batchEnd);
const exportStart = main.indexOf('function runExport');
const exportEnd = main.indexOf('// ============ MUTATION OBSERVER', exportStart);
const runExport = main.slice(exportStart, exportEnd);
const pauseStart = main.indexOf('function pauseAll');
const pauseEnd = main.indexOf('function resumeAll', pauseStart);
const pauseAll = main.slice(pauseStart, pauseEnd);
const openRegistryStart = main.indexOf('var OpenThreadRegistry = {');
const openRegistryEnd = main.indexOf('function getFavoriteConcurrency', openRegistryStart);
const openRegistry = main.slice(openRegistryStart, openRegistryEnd);
const styleStart = main.indexOf('function addStyle');
const styleEnd = main.indexOf('// ============ TOOLBAR', styleStart);
const styles = main.slice(styleStart, styleEnd);
const toolbarStart = main.indexOf('function createToolbar');
const toolbarEnd = main.indexOf('function getPreviewStatusText', toolbarStart);
const toolbar = main.slice(toolbarStart, toolbarEnd);
const autoPaginationStart = main.indexOf('function checkAndLoadIfContentNotEnough');
const autoPaginationEnd = main.indexOf('// ============ IMAGE PREVIEW', autoPaginationStart);
const autoPagination = main.slice(autoPaginationStart, autoPaginationEnd);
const searchStart = main.indexOf('function buildListPageUrl');
const searchEnd = main.indexOf('function openExportDialog', searchStart);
const searchTools = main.slice(searchStart, searchEnd);

assert.match(
  main,
  /var hasOpenTool\s*=\s*true;/,
  'the opened-thread batch tools should be visible on every supported site page',
);

assert.match(
  main,
  /FAVORITE_CONCURRENCY:\s*parseInt\(localStorage\.getItem\('sht_favorite_concurrency'\)\s*\|\|\s*'3'/,
  'batch favorite should expose a persisted concurrency limit',
);

assert.match(
  main,
  /favoriteOpenedRunning:\s*false/,
  'batch favorite should have a running lock in STATE',
);

assert.match(
  main,
  /function getFavoriteConcurrency\(/,
  'batch favorite should clamp and read the concurrency setting through a helper',
);

assert.match(
  main,
  /function runLimitedQueue\(items, options\)/,
  'bounded concurrent work should live in a reusable queue helper',
);

assert.doesNotMatch(
  batchFavorite,
  /function worker\(|function next\(i\)/,
  'batch favorite should not keep its own queue loop',
);

assert.match(
  batchFavorite,
  /runLimitedQueue\(/,
  'batch favorite should use the reusable queue helper',
);

assert.doesNotMatch(
  runExport,
  /function worker\(/,
  'resource export should not keep its own thread queue loop',
);

assert.match(
  runExport,
  /runLimitedQueue\(/,
  'resource export should use the reusable queue helper',
);

assert.match(
  main,
  /运行中/,
  'batch favorite progress should show running task count',
);

assert.doesNotMatch(
  main,
  /AUTO_REPLY_COOLDOWN|AUTO_REPLY_MAX_PER_SESSION|sht_reply_cooldown|sht_reply_max/,
  'auto reply should not expose or enforce cooldown/session limits',
);

assert.doesNotMatch(
  main,
  /回复冷却|回复上限|两次自动回复|最多自动回复/,
  'auto reply settings should only keep the enable switch',
);

assert.doesNotMatch(
  main,
  /sessionCount|lastReplyTime/,
  'auto reply state should not track cooldown or session count',
);

assert.match(
  main,
  /OPEN_STALE_MS:\s*30\s*\*\s*60\s*\*\s*1000/,
  'opened thread records should not expire during normal background tab throttling',
);

assert.match(
  main,
  /var _openRegistryTimers\s*=\s*\[\];/,
  'opened thread heartbeats should use timers separate from pausable page work',
);

assert.match(
  main,
  /var OpenThreadRegistry\s*=\s*\{/,
  'opened-thread tracking should live in a reusable registry module',
);

assert.match(
  openRegistry,
  /list:\s*function\(/,
  'opened-thread registry should expose a list method',
);

assert.match(
  openRegistry,
  /listSince:\s*function\(since\)/,
  'opened-thread registry should expose fresh records from a refresh window',
);

assert.match(
  openRegistry,
  /registerCurrent:\s*function\(/,
  'opened-thread registry should expose a current-tab registration method',
);

assert.match(
  openRegistry,
  /requestRefresh:\s*function\(/,
  'opened-thread registry should actively request open thread tabs to re-register',
);

assert.match(
  openRegistry,
  /writeStoredJson\(CONFIG\.OPEN_REFRESH_KEY/,
  'opened-thread refresh should broadcast through userscript storage',
);

assert.match(
  openRegistry,
  /handleRefreshRequest:\s*function\(/,
  'thread tabs should handle refresh requests from the favorite dialog',
);

assert.match(
  openRegistry,
  /_openRegistryTimers\.push\(setInterval\(OpenThreadRegistry\.registerCurrent/,
  'thread tabs should keep registering through the registry module while backgrounded',
);

assert.doesNotMatch(
  pauseAll,
  /_openRegistryTimers|registerCurrentThread|OPEN_REGISTRY/,
  'visibility pause should not stop opened-thread registry heartbeats',
);

assert.match(
  main,
  /OpenThreadRegistry\.init\(\)/,
  'startup should initialize opened-thread tracking through the registry module',
);

assert.match(
  main,
  /OpenThreadRegistry\.list\(\)\.length/,
  'toolbar/status code should read opened-thread count through the registry module',
);

assert.match(
  main,
  /@version\s+1\.0\.15/,
  'opened-thread tab-storage fix should bump the userscript version',
);

assert.match(
  main,
  /@grant\s+GM_setValue/,
  'opened-thread registry should request userscript write storage for cross-origin tabs',
);

assert.match(
  main,
  /@grant\s+GM_getValue/,
  'opened-thread registry should request userscript read storage for cross-origin tabs',
);

assert.match(
  main,
  /@grant\s+GM_addValueChangeListener/,
  'opened-thread registry should request userscript storage listeners for cross-origin tabs',
);

assert.match(
  main,
  /@grant\s+GM_getTab/,
  'opened-thread registry should request Tampermonkey per-tab storage',
);

assert.match(
  main,
  /@grant\s+GM_saveTab/,
  'opened-thread registry should be able to save the current tab record',
);

assert.match(
  main,
  /@grant\s+GM_getTabs/,
  'opened-thread registry should list the current userscript tabs instead of racing on one shared object',
);

assert.match(
  main,
  /function readStoredJson\(k, fb\)[\s\S]*GM_getValue\(k, fb\)/,
  'stored JSON helper should prefer GM_getValue over page localStorage',
);

assert.match(
  main,
  /function writeStoredJson\(k, v\)[\s\S]*GM_setValue\(k, v\)/,
  'stored JSON helper should prefer GM_setValue over page localStorage',
);

assert.match(
  main,
  /function addStoredValueListener\(k, fn\)[\s\S]*GM_addValueChangeListener\(k, function\(name, oldValue, newValue, remote\)/,
  'stored JSON helper should bind GM value listeners for cross-origin refresh requests',
);

assert.match(
  main,
  /OPEN_REFRESH_KEY:\s*'sht_open_thread_refresh_v1'/,
  'opened-thread registry should define an explicit refresh request key',
);

assert.match(
  main,
  /OPEN_REFRESH_WAIT_MS:\s*2500/,
  'opened-thread refresh should wait long enough for throttled background tabs to respond',
);

assert.match(
  main,
  /OPEN_REFRESH_POLL_MS:\s*150/,
  'opened-thread refresh should poll fresh records while open tabs are responding',
);

assert.match(
  main,
  /OPEN_TAB_RECORD_KEY:\s*'shtOpenThreadRecord'/,
  'opened-thread registry should store records on each Tampermonkey tab object',
);

assert.match(
  main,
  /function isAutoPaginationPage\(\) \{ return isNextPageLoadPage\(\) && !isThreadPage\(\); \}/,
  'automatic pagination should exclude thread pages while keeping manual next-page support',
);

assert.match(
  autoPagination,
  /function checkAndLoadIfContentNotEnough\(\) \{[\s\S]*if \(!isAutoPaginationPage\(\)\) return;/,
  'content-too-short checks should not auto-load the next page inside thread bodies',
);

assert.match(
  autoPagination,
  /function initAutoPagination\(\) \{\s*if \(!isAutoPaginationPage\(\)\) return;/,
  'scroll-triggered auto pagination should not bind on thread pages',
);

assert.match(
  openRegistry,
  /listenRefreshRequests:\s*function\(\)[\s\S]*addStoredValueListener\(CONFIG\.OPEN_REFRESH_KEY, function\(value, oldValue, remote\)/,
  'GM value changes should cause open thread tabs to re-register on demand',
);

assert.match(
  openRegistry,
  /waitForFreshRecords:\s*function\(since, onUpdate\)/,
  'opened-thread refresh should expose a polling wait that can update the dialog progressively',
);

assert.match(
  openRegistry,
  /saveCurrentTabRecord:\s*function\(record\)[\s\S]*GM_getTab\(function\(tab\)[\s\S]*GM_saveTab\(tab/,
  'current thread tabs should save their own record instead of writing one shared registry object',
);

assert.match(
  openRegistry,
  /listAsync:\s*function\(\)[\s\S]*GM_getTabs\(function\(tabs\)/,
  'favorite dialog should read opened threads from Tampermonkey tab objects',
);

assert.match(
  openRegistry,
  /requestRefresh:\s*function\(onUpdate\)[\s\S]*id:\s*requestId/,
  'refresh requests should carry a request id so responding tabs can be identified',
);

assert.match(
  main,
  /OpenThreadRegistry\.requestRefresh\(function\(freshThreads\)[\s\S]*then\(function\(finalThreads\)/,
  'opening the favorite dialog should live-update as open thread tabs respond',
);

assert.match(
  main,
  /刷新列表[\s\S]*openFavoriteDialog\(\)/,
  'refreshing the favorite dialog should trigger the same re-identification path',
);

assert.match(
  main,
  /SEARCH_CONCURRENCY:\s*4/,
  'topic search should define a bounded concurrency limit',
);

assert.match(
  main,
  /@grant\s+GM_openInTab/,
  'opening all search results should request the userscript tab-opening API to avoid popup blocking',
);

assert.match(
  searchTools,
  /function getSearchDefaultEndPage\(/,
  'search dialog should compute the default end page through a reusable helper',
);

assert.match(
  searchTools,
  /Math\.max\(detectMaxPage\(document\) \|\| 1, STATE\.listMaxPage \|\| 1\)/,
  'search range should default to the detected last page instead of a fixed configured page count',
);

assert.match(
  searchTools,
  /id="shtx-search-start"[^>]*value=""/,
  'search range start input should be visually blank by default',
);

assert.match(
  searchTools,
  /id="shtx-search-end"[^>]*value=""/,
  'search range end input should be visually blank by default',
);

assert.match(
  searchTools,
  /function parseSearchPageRange\(/,
  'search range parsing should be isolated in a helper',
);

assert.match(
  searchTools,
  /function getSearchConcurrency\(/,
  'search concurrency should be clamped through a helper',
);

assert.match(
  searchTools,
  /startRaw \? parseInt\(startRaw, 10\) : 1/,
  'blank search start page should mean page 1',
);

assert.match(
  searchTools,
  /var followNext = !endRaw/,
  'blank search end page should enable next-link based dynamic scanning',
);

assert.match(
  searchTools,
  /return \{ start: start, end: end, followNext: followNext \}/,
  'parsed search range should carry whether the end page was left blank',
);

assert.match(
  searchTools,
  /runSearch\(kw, range\.start, range\.end, \$\('#shtx-search-results'\), footer, startBtn, range\.followNext\)/,
  'search should pass dynamic next-page mode into the runner',
);

assert.match(
  searchTools,
  /function getSearchResultLinks\(root\)/,
  'search result links should be collected through a reusable helper',
);

assert.match(
  searchTools,
  /function fetchSearchPage\(p, pageUrl, kwLower\)/,
  'search page fetching should be isolated so multiple pages can run concurrently',
);

assert.match(
  searchTools,
  /fetch\(pageUrl, \{ credentials: 'include' \}\)/,
  'search page fetching should use the provided page url',
);

assert.match(
  searchTools,
  /function appendSearchMatches\(matches, kw, page, div, seenTids\)/,
  'search result rendering should be isolated from concurrent fetching',
);

assert.match(
  searchTools,
  /if \(seenTids\[t\.tid\]\) return;/,
  'concurrent search should dedupe result rows by thread id',
);

assert.match(
  searchTools,
  /function getSearchResultThreads\(root\)/,
  'search result rows should be collected as reusable thread records',
);

assert.match(
  searchTools,
  /function openSearchResultTab\(url\)/,
  'opening one search result should go through a reusable helper',
);

assert.match(
  searchTools,
  /GM_openInTab\(url, \{ active: false/,
  'open-all should prefer GM_openInTab so every current result can be opened',
);

assert.match(
  searchTools,
  /function openCurrentSearchResults\(root, footer\)/,
  'search dialog should expose an action for opening the current rendered results',
);

assert.match(
  searchTools,
  /\.shtx-result-row a\[href\]/,
  'open-current-results should only read links from rendered search rows',
);

assert.match(
  searchTools,
  /links\.forEach\(function\(url\) \{ if \(openSearchResultTab\(url\)\)/,
  'open-current-results should attempt every rendered result link, not just one',
);

assert.match(
  searchTools,
  /function favoriteCurrentSearchResults\(root, progress, btn\)/,
  'search dialog should expose an action for favoriting the current rendered results',
);

assert.match(
  searchTools,
  /batchFavoriteOpened\(getSearchResultThreads\(root\), progress, root, btn\)/,
  'favorite-current-results should reuse the existing batch favorite engine',
);

assert.match(
  searchTools,
  /一键打开当前结果/,
  'search dialog should add a one-click open-current-results button next to cancel',
);

assert.match(
  searchTools,
  /一键收藏当前结果/,
  'search dialog should add a one-click favorite-current-results button',
);

assert.match(
  searchTools,
  /暂停搜索/,
  'search dialog should include a pause button that keeps current results visible',
);

assert.match(
  searchTools,
  /STATE\.searchCancelled = true; footer\.textContent = '正在暂停搜索\.\.\.'/,
  'pause should stop the current search without closing the dialog',
);

assert.match(
  searchTools,
  /row\.setAttribute\('data-tid', t\.tid\)/,
  'search result rows should keep the thread id so batch favorite can update row status',
);

assert.match(
  searchTools,
  /function runSearch\(kw, start, end, div, footer, btn, followNext\)/,
  'search runner should know whether to use fixed end-page or next-link mode',
);

assert.match(
  searchTools,
  /var concurrency = getSearchConcurrency\(\)/,
  'search runner should use the configured concurrency',
);

assert.match(
  searchTools,
  /while \(active < concurrency && canQueue\(\)\)/,
  'search runner should keep multiple page fetches in flight',
);

assert.match(
  searchTools,
  /queuePage\(nextPage\+\+\)/,
  'search runner should queue page numbers concurrently',
);

assert.match(
  searchTools,
  /if \(!followNext\) return nextPage <= end/,
  'fixed end-page mode should keep its explicit end-page stop condition',
);

assert.match(
  searchTools,
  /nextUrl:\s*getNextPageUrl\(doc\)/,
  'dynamic mode should inspect each fetched page for a next-page link',
);

assert.match(
  searchTools,
  /if \(followNext && !r\.nextUrl\)/,
  'dynamic mode should stop only when the fetched page has no next-page link',
);

assert.match(
  styles,
  /--shtx-accent/,
  'UI should define a shared accent token instead of scattered button colors',
);

assert.match(
  styles,
  /:root\{[^}]*--shtx-accent/,
  'UI color tokens should be available to dialogs, not only the toolbar',
);

assert.match(
  styles,
  /--shtx-line:#cbd5e1/,
  'UI boundaries should use a darker shared line color',
);

assert.match(
  styles,
  /--shtx-panel:#f1f5f9/,
  'UI panels should use a slightly darker panel background for clearer separation',
);

assert.match(
  styles,
  /\.shtx-btn\{[^}]*border:1px solid #cbd5e1/,
  'default buttons should have a clearer border',
);

assert.match(
  styles,
  /\.shtx-dialog\{[^}]*border:1px solid #cbd5e1/,
  'dialogs should have a clearer outer border',
);

assert.match(
  styles,
  /\.shtx-toolbar-head/,
  'toolbar should have a styled header area',
);

assert.match(
  styles,
  /\.shtx-toolbar-actions/,
  'toolbar should group top-level actions separately from feature groups',
);

assert.match(
  styles,
  /\.shtx-folder-body\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'feature actions should use a compact two-column grid',
);

assert.match(
  styles,
  /\.shtx-status-panel/,
  'status lines should sit in a distinct status panel',
);

assert.match(
  styles,
  /\.shtx-dialog-title/,
  'dialogs should use a styled title class instead of inline title styles',
);

assert.match(
  toolbar,
  /className = 'shtx-toolbar-head'/,
  'toolbar header should use the shared header class',
);

assert.match(
  toolbar,
  /className = 'shtx-toolbar-actions'/,
  'settings and log actions should be grouped in a toolbar action strip',
);

assert.match(
  toolbar,
  /className = 'shtx-status-panel'/,
  'toolbar status lines should be wrapped in the status panel',
);

console.log('toolbox static checks passed');
