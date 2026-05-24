// ==UserScript==
// @name         色花堂工具箱
// @namespace    https://sehuatang.net/
// @version      1.0.2
// @description  自动签到、无缝翻页、图片预览、板块筛选、帖子操作、自动回复、批量收藏、资源导出
// @author       米波
// @match        https://sehuatang.net/*
// @match        https://www.sehuatang.net/*
// @match        https://sehuatang.org/*
// @match        https://www.sehuatang.org/*
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    var ORIGIN = location.origin;

    // ============ CONFIG ============
    var CONFIG = {
        IMAGE_HEIGHT: 200,
        IMAGE_WIDTH: 240,
        MAX_IMAGES: 6,
        PREVIEW_CONCURRENCY: 6,
        ALL_PAGES: 120,
        EXPORT_DELAY_MS: 200,
        EXPORT_CONCURRENCY: 3,
        ATTACH_PARSE_CONCURRENCY: 2,
        ATTACH_TEXT_MAX: 2 * 1024 * 1024,
        ATTACH_ZIP_MAX: 20 * 1024 * 1024,
        ATTACH_TIMEOUT_MS: 30000,

        AUTO_SIGN_KEY: 'sht_auto_sign_enabled',
        AUTO_SIGN_STATE_KEY: 'sht_auto_sign_state',
        AUTO_SIGN_SECQAAHASH: 'qSAxcb0',
        AUTO_SIGN_DELAY_MS: 1200,
        RATE_REASON: '永久地址 WWW.98T.LA',

        OPEN_REGISTRY_KEY: 'sht_open_thread_tabs_v1',
        OPEN_TAB_ID_KEY: 'sht_open_thread_tab_id_v1',
        OPEN_HEARTBEAT_MS: 10000,
        OPEN_STALE_MS: 45000,
        FAVORITE_DELAY_MS: 600,

        AUTO_REPLY_KEY: 'sht_auto_reply_enabled',
        AUTO_REPLY_STATE_KEY: 'sht_auto_reply',
        AUTO_REPLY_TARGET_FID: '155',
        AUTO_REPLY_MAX_PER_SESSION: 5,
        AUTO_REPLY_COOLDOWN: 60000,

        AUTO_PAGINATION_KEY: 'sht_auto_pagination',
        AUTO_SCROLL_THRESHOLD: 500,
        AUTO_PREVIEW_KEY: 'sht_auto_preview',
        PREVIEW_CACHE_KEY: 'sht_preview_cache_v1',
        PREVIEW_CACHE_TTL_MS: 3 * 24 * 60 * 60 * 1000,
        PREVIEW_CACHE_MAX: 500,
        SEARCH_FILTER_VISIBLE_FIDS_KEY: 'sht_search_filter_visible_fids',
        SEARCH_FILTER_SHOW_UNKNOWN_KEY: 'sht_search_filter_show_unknown',
        SEARCH_FILTER_EXCLUDE_KEYWORDS_KEY: 'sht_search_filter_exclude_keywords',
        THREAD_IMAGES_SHOWN_KEY: 'sht_thread_images_shown',
        TOOLBAR_COLLAPSED_KEY: 'sht_toolbar_collapsed',
        TOOLBAR_POSITION_KEY: 'sht_toolbar_position',
        TASK_LOG_KEY: 'sht_task_log',
        TASK_LOG_MAX: 50,
    };

    var REPLY_POOL = [
        '身材真不错，感谢分享', '拍得很棒，支持原创', '楼主好福气，羡慕了',
        '黑丝好评，期待更多作品', '皮肤好白，身材绝了', '拍得很有感觉，支持一波',
        '这腿绝了，楼主太幸福了', '每一期都追，楼主加油', '身材太好了，看得停不下来',
        '很真实的拍摄，喜欢这种风格', '照片质量很高，期待下一期', '看了好几遍，拍得真好',
        '支持原创自拍，感谢楼主', '绝了绝了，这谁顶得住', '每次更新都来看，太棒了',
        '真实的才是最好的，支持', '太有感觉了，感谢分享', '技术越来越好了，加油',
        '第一张就惊艳到了', '楼主出品必属精品',
    ];

    var SITE_MAP = {
        '每日合集': 106, '国产原创': 2, '亚洲无码原创': 36, '亚洲有码原创': 37,
        '高清中文字幕': 103, '三级写真': 107, '素人有码系列': 104, '欧美无码': 38,
        '4K原版': 151, '韩国主播': 152, '动漫原创': 39, 'VR视频区': 160, '国产自拍': 41,
        '中文字幕': 109, '日韩无码': 42, '日韩有码': 43, '欧美风情': 44,
        '卡通动漫': 45, '剧情三级': 46, '自提字幕区': 145, '自译字幕区': 146,
        '字幕分享区': 121, '分享新区': 159, '原创自拍区': 155, '转贴自拍': 125,
        '华人街拍区': 50, '亚洲性爱': 48, '欧美性爱': 49, '原创人生': 154,
        '乱伦人妻': 135, '青春校园': 137, '武侠虚幻': 138, '激情都市': 136,
        'TXT小说下载': 139, '综合讨论区': 95, '色花视频自拍': 124,
        '网友原创区': 141, '转帖交流区': 142, '求片问答悬赏区': 143,
        '投诉建议区': 96, '禁言申诉区': 150, '资源出售区': 97, 'AI区': 166,
        '图区卡通动漫': 117, '图区套图下载': 165, '投稿送邀请码': 157
    };

    // ============ STATE ============
    var STATE = {
        threads: [],
        listMaxPage: 1,
        previewRunning: false,
        previewVisible: true,
        searchCancelled: false,
        refreshTimer: null,
        listObserver: null,
        nextPagesLoading: false,
        nextPagesAutoStarted: false,
        nextScrollBound: false,
        autoScrollEnd: false,
        loadedMaxPage: 1,
        signRunning: false,
        signAutoStarted: false,
        signMessage: '',
        threadActionRunning: false,
        threadActionMessage: '',
        threadEnhanceTimer: null,
    };

    // ============ UTILS ============
    function $(s, r) { return (r || document).querySelector(s); }
    function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
    function each(ns, fn) { for (var i = 0; i < ns.length; i++) fn(ns[i], i); }
    function textOf(el) { return (el ? (el.textContent || el.innerText || '') : '').replace(/\s+/g, ' ').trim(); }
    function getBool(k, d) { var v = localStorage.getItem(k); return v === null ? !!d : v === 'true'; }
    function setBool(k, v) { localStorage.setItem(k, v ? 'true' : 'false'); }
    function readJson(k, fb) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch(e) { return fb; } }
    function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
    function escapeHtml(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
    function escapeRegExp(v) { return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function isInsideToolUi(el) { return !!(el && el.closest && el.closest('#shtx-toolbar, #shtx-dialog, #shtx-toast, .shtx-preview-container')); }
    function normalizeUrl(url) {
        url = String(url || '').replace(/&amp;/g, '&').trim();
        if (!url || /^(javascript:|about:|data:)/i.test(url)) return '';
        if (/^https?:\/\//i.test(url)) return url;
        if (url.indexOf('//') === 0) return location.protocol + url;
        if (url.charAt(0) === '/') return ORIGIN + url;
        return ORIGIN + '/' + url.replace(/^\.\//, '');
    }
    function siteItems() {
        return Object.keys(SITE_MAP).map(function(n) { return { name: n, fid: String(SITE_MAP[n]) }; });
    }

    function appendTaskLog(type, message, detail) {
        var log = readJson(CONFIG.TASK_LOG_KEY, []);
        log.unshift({ type: type, message: message, detail: detail || '', time: Date.now() });
        if (log.length > CONFIG.TASK_LOG_MAX) log = log.slice(0, CONFIG.TASK_LOG_MAX);
        writeJson(CONFIG.TASK_LOG_KEY, log);
    }

    function getPreviewCache() {
        var c = readJson(CONFIG.PREVIEW_CACHE_KEY, {});
        var now = Date.now();
        var clean = false;
        Object.keys(c).forEach(function(tid) {
            if (now - (c[tid].time || 0) > CONFIG.PREVIEW_CACHE_TTL_MS) { delete c[tid]; clean = true; }
        });
        var tids = Object.keys(c).sort(function(a, b) { return (c[b].time || 0) - (c[a].time || 0); });
        if (tids.length > CONFIG.PREVIEW_CACHE_MAX) { tids.slice(CONFIG.PREVIEW_CACHE_MAX).forEach(function(t) { delete c[t]; }); clean = true; }
        if (clean) writeJson(CONFIG.PREVIEW_CACHE_KEY, c);
        return c;
    }
    function getCachedPreviewImages(tid) {
        var item = getPreviewCache()[tid];
        return (item && Array.isArray(item.urls) && item.urls.length) ? item.urls.slice(0, CONFIG.MAX_IMAGES) : null;
    }
    function setCachedPreviewImages(tid, urls) {
        var c = getPreviewCache();
        c[tid] = { time: Date.now(), urls: (urls || []).slice(0, CONFIG.MAX_IMAGES) };
        writeJson(CONFIG.PREVIEW_CACHE_KEY, c);
    }

    function toast(msg, type) {
        var old = $('#shtx-toast'); if (old) old.remove();
        var el = document.createElement('div');
        el.id = 'shtx-toast'; el.textContent = msg;
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:' + (type === 'error' ? '#c0392b' : '#333') + ';color:#fff;border-radius:6px;z-index:999999;font-size:14px;opacity:0;transition:opacity 0.3s;';
        document.body.appendChild(el);
        setTimeout(function() { el.style.opacity = '1'; }, 10);
        setTimeout(function() { el.style.opacity = '0'; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300); }, 2200);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() { toast('已复制到剪贴板'); }).catch(function() { fallbackCopy(text); });
        } else { fallbackCopy(text); }
    }
    function fallbackCopy(text) {
        var ta = document.createElement('textarea'); ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch(e) { toast('复制失败', 'error'); }
        document.body.removeChild(ta);
    }
    function downloadAsFile(text, filename, type) {
        var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url); toast('文件已下载');
    }

    // ============ PAGE DETECTION ============
    function getParams() { return new URLSearchParams(location.search); }
    function getTid() {
        var m = location.href.match(/[?&]tid=(\d+)/) || location.href.match(/thread-(\d+)-\d+-\d+\.html/);
        return m ? m[1] : '';
    }
    function getFid() {
        var fid = getParams().get('fid') || '';
        if (fid) return fid;
        var m = location.href.match(/forum-(\d+)-\d+\.html/);
        if (m) return m[1];
        var links = $all('a[href*="forumdisplay"][href*="fid="], a[href*="action=reply"][href*="fid="], #pt a[href*="fid="]');
        for (var i = 0; i < links.length; i++) {
            var fm = (links[i].href || '').match(/[?&]fid=(\d+)/); if (fm) return fm[1];
        }
        return '';
    }
    function getUid() {
        var uid = getParams().get('uid') || '';
        if (uid) return uid;
        var link = $('a[href*="mod=space"][href*="uid="]');
        if (link) { var m = link.href.match(/[?&]uid=(\d+)/); if (m) return m[1]; }
        return '';
    }

    function isThreadPage() {
        return /forum\.php/i.test(location.pathname) && getParams().get('mod') === 'viewthread' && !!getTid()
            || /\/thread-\d+-\d+-\d+\.html/i.test(location.href);
    }
    function isForumDisplayPage() {
        return /forum\.php/i.test(location.pathname) && getParams().get('mod') === 'forumdisplay'
            || /\/forum-\d+-\d+\.html/i.test(location.href);
    }
    function isSearchResultPage() {
        return /search\.php/i.test(location.pathname) && getParams().get('mod') === 'forum';
    }
    function isSiteHomeIndexPage() {
        var path = location.pathname.replace(/\/+$/, '') || '/';
        if (path === '/' || /\/index\.php$/i.test(path)) return true;
        if (/\/forum\.php$/i.test(path)) {
            var params = getParams();
            return !params.get('mod') && !params.get('tid') && !params.get('fid');
        }
        return false;
    }
    function isPreviewToolPage() { return !isSiteHomeIndexPage() && !isThreadPage(); }
    function isHomePage() { return /home\.php/i.test(location.pathname); }
    function isFavoritePage() { return isHomePage() && getParams().get('do') === 'favorite'; }
    function isUserThreadPage() {
        var p = getParams(), mod = p.get('mod');
        return isHomePage() && p.get('do') === 'thread' && (!mod || mod === 'space');
    }
    function isSpacePage() {
        return /home\.php\?mod=space(.*&&uid=\d+)?.*&do=thread&view=me(.*&from=space)?.*&(type=(reply|thread))?/.test(location.href);
    }
    function isMySpacePage() {
        return /(forum|home)\.php\?mod=(guide|space|misc)&(view=(hot|digest|new|newthread|sofa|my)|action=showdarkroom|do=favorite)(&type=(thread|reply|postcomment))?/.test(location.href);
    }
    function isMyfavoritePage() {
        return /home\.php\?mod=space&do=favorite&view=me/.test(location.href);
    }
    function isListToolPage() { return isFavoritePage() || isUserThreadPage(); }
    function isNextPageLoadPage() { return isListToolPage() || isForumDisplayPage() || isSearchResultPage() || isThreadPage() || isSpacePage() || isMySpacePage() || isMyfavoritePage(); }

    function getContentSelector() {
        if (isThreadPage()) return '#postlist';
        if (isSearchResultPage() || isForumDisplayPage()) return '#threadlist';
        if (isMyfavoritePage() || isFavoritePage()) return '#favorite_ul';
        if (isUserThreadPage()) return '#threadlist';
        if (isSpacePage()) return '#delform';
        if (isMySpacePage()) return '#threadlist';
        return '#threadlist';
    }
    function getPageNameForScroll() {
        if (isSearchResultPage()) return 'isSearchPage';
        if (isForumDisplayPage()) return 'isForumDisplayPage';
        if (isThreadPage()) return 'isPostPage';
        if (isSpacePage()) return 'isSpacePage';
        if (isMySpacePage()) return 'isMySpacePage';
        if (isMyfavoritePage()) return 'isMyfavoritePage';
        return 'isForumDisplayPage';
    }

    // ============ STYLES ============
    function addStyle() {
        if ($('#shtx-style')) return;
        var s = document.createElement('style'); s.id = 'shtx-style';
        s.textContent =
            '.shtx-toolbar{position:fixed;top:50%;z-index:99999;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;padding:12px 10px;background:#f8f9fa;border:1px solid #dee2e6;max-width:200px;font:12px/1.4 Arial,"Microsoft YaHei",sans-serif;color:#555;}' +
            '.shtx-toolbar.shtx-left{left:0;border-left:0;border-radius:0 8px 8px 0;box-shadow:2px 2px 10px rgba(0,0,0,0.15);}' +
            '.shtx-toolbar.shtx-right{right:0;border-right:0;border-radius:8px 0 0 8px;box-shadow:-2px 2px 10px rgba(0,0,0,0.15);}' +
            '.shtx-folder-body{display:flex;flex-direction:column;gap:6px;}' +
            '.shtx-toolbar.shtx-collapsed{padding:8px 6px;min-width:0;}' +
            '.shtx-toolbar.shtx-collapsed .shtx-toolbar-body{display:none;}' +
            '.shtx-title{font-weight:bold;font-size:13px;color:#e74c3c;white-space:nowrap;margin-bottom:2px;}' +
            '.shtx-collapse-btn{width:42px;height:24px;padding:0;border:0;border-radius:4px;background:#e74c3c;color:#fff;cursor:pointer;font-size:12px;font-weight:bold;line-height:24px;}' +
            '.shtx-section-title{font-size:12px;color:#666;border-top:1px solid #e4e7eb;padding-top:6px;margin-top:4px;white-space:nowrap;}' +
            '.shtx-section-title:first-child{border-top:0;padding-top:0;margin-top:0;}' +
            '.shtx-btn{padding:6px 12px;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;font-weight:bold;}' +
            '.shtx-btn:disabled{opacity:.65;cursor:not-allowed;}' +
            '.shtx-red{background:#e74c3c}.shtx-blue{background:#3498db}.shtx-green{background:#27ae60}.shtx-gray{background:#95a5a6}.shtx-orange{background:#e67e22}' +
            '.shtx-status{color:#666;font-size:12px;white-space:normal;line-height:1.45;}' +
            '.shtx-status-line{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#666;font-size:12px;line-height:1.45;}' +
            '.shtx-status-label{color:#888;white-space:nowrap;}' +
            '.shtx-status-value{color:#333;font-weight:bold;text-align:right;word-break:break-all;}' +
            '.shtx-settings-section{border-top:1px solid #eee;padding-top:12px;margin-top:12px;}' +
            '.shtx-settings-section:first-child{border-top:0;padding-top:0;margin-top:0;}' +
            '.shtx-settings-title{font-weight:bold;color:#e74c3c;margin-bottom:8px;font-size:14px;}' +
            '.shtx-settings-note{color:#888;font-size:12px;line-height:1.5;margin:4px 0 10px;}' +
            '.shtx-switch-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #f2f2f2;cursor:pointer;}' +
            '.shtx-switch-copy{display:flex;flex-direction:column;gap:2px;min-width:0;}' +
            '.shtx-switch-copy strong{font-size:13px;color:#333;font-weight:bold;}' +
            '.shtx-switch-copy small{font-size:12px;color:#888;line-height:1.45;}' +
            '.shtx-check{width:16px;height:16px;flex:0 0 auto;accent-color:#e74c3c;cursor:pointer;}' +
            '.shtx-preview-container{display:grid;grid-template-columns:repeat(3,' + CONFIG.IMAGE_WIDTH + 'px);gap:4px;margin:6px 0 8px;width:100%;max-width:' + (CONFIG.IMAGE_WIDTH * 3 + 8) + 'px;box-sizing:border-box;}' +
            '.shtx-preview-container a{display:block;}' +
            '.shtx-preview-container img{display:block;width:' + CONFIG.IMAGE_WIDTH + 'px!important;height:' + CONFIG.IMAGE_HEIGHT + 'px!important;object-fit:cover;border-radius:3px;border:1px solid #ddd;}' +
            '.shtx-preview-empty{padding:8px;color:#aaa;font-size:11px;}' +
            '.shtx-dialog{display:flex;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:680px;max-height:80vh;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;overflow:hidden;flex-direction:column;font:13px/1.45 Arial,"Microsoft YaHei",sans-serif;color:#333;}' +
            '.shtx-dialog-head{padding:14px 16px;background:#f8f9fa;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;gap:10px;}' +
            '.shtx-dialog-body{flex:1;overflow:auto;padding:12px 16px;}' +
            '.shtx-dialog-foot{padding:10px 16px;border-top:1px solid #eee;font-size:12px;color:#999;}' +
            '.shtx-close{background:none;border:none;font-size:20px;cursor:pointer;color:#999;line-height:1;}' +
            '.shtx-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;}' +
            '.shtx-input,.shtx-select{padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;}' +
            '.shtx-textarea{width:100%;box-sizing:border-box;min-height:72px;padding:7px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;line-height:1.5;outline:none;resize:vertical;}' +
            '.shtx-result-row{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;}' +
            '.shtx-result-row a{color:#e74c3c;text-decoration:none;flex:1;word-break:break-all;line-height:1.4;}' +
            '.shtx-code-copy{margin:4px 0 6px;padding:3px 8px;background:#3498db;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:12px;}' +
            '.shtx-filter-actions{display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap;}' +
            '.shtx-filter-list{max-height:52vh;overflow:auto;border:1px solid #eee;border-radius:6px;background:#fafafa;padding:8px;box-sizing:border-box;}' +
            '.shtx-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px 10px;margin:0;}' +
            '.shtx-filter-item{display:flex;align-items:flex-start;gap:6px;color:#333;font-size:12px;line-height:1.35;min-width:0;white-space:normal;word-break:break-all;cursor:pointer;}' +
            '.shtx-filter-item input{accent-color:#e74c3c;flex:0 0 auto;margin-top:2px;}' +
            '.shtx-filter-name{display:block;min-width:0;user-select:none;}' +
            '.shtx-autoload-simple{padding:6px 0;border-bottom:1px solid #eee;}' +
            '.shtx-autoload-simple a{color:#e74c3c;text-decoration:none;word-break:break-all;}';
        document.head.appendChild(s);
    }

    // ============ TOOLBAR ============
    function makeBtn(text, color, handler) {
        var b = document.createElement('button'); b.className = 'shtx-btn shtx-' + (color || 'gray');
        b.textContent = text; b.addEventListener('click', handler); return b;
    }
    function appendSection(bar, title) {
        var el = document.createElement('div'); el.className = 'shtx-section-title';
        el.textContent = title; bar.appendChild(el);
    }
    function createDialog(title, width) {
        var old = $('#shtx-dialog'); if (old) old.remove();
        var dlg = document.createElement('div'); dlg.id = 'shtx-dialog'; dlg.className = 'shtx-dialog';
        if (width) dlg.style.width = width;
        dlg.innerHTML = '<div class="shtx-dialog-head"><span style="font-weight:bold;font-size:14px;">' + escapeHtml(title) + '</span><button class="shtx-close">&times;</button></div><div class="shtx-dialog-body"></div><div class="shtx-dialog-foot"></div>';
        var close = function() { dlg.remove(); };
        $('.shtx-close', dlg).onclick = close;
        document.body.appendChild(dlg);
        return { root: dlg, body: $('.shtx-dialog-body', dlg), foot: $('.shtx-dialog-foot', dlg), close: close };
    }
    function appendSettingsSection(parent, title, note) {
        var sec = document.createElement('div'); sec.className = 'shtx-settings-section';
        var h = document.createElement('div'); h.className = 'shtx-settings-title'; h.textContent = title;
        sec.appendChild(h);
        if (note) { var n = document.createElement('div'); n.className = 'shtx-settings-note'; n.textContent = note; sec.appendChild(n); }
        parent.appendChild(sec); return sec;
    }
    function appendSwitch(parent, title, note, checked, onChange) {
        var row = document.createElement('label'); row.className = 'shtx-switch-row';
        row.innerHTML = '<span class="shtx-switch-copy"><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(note || '') + '</small></span><input class="shtx-check" type="checkbox">';
        var inp = $('input', row); inp.checked = !!checked;
        inp.addEventListener('change', function() { onChange(!!inp.checked); });
        parent.appendChild(row); return row;
    }
    function appendStatusLine(bar, id, label, value) {
        var row = document.createElement('div'); row.id = 'shtx-status-' + id; row.className = 'shtx-status-line';
        row.innerHTML = '<span class="shtx-status-label">' + escapeHtml(label) + '</span><span class="shtx-status-value">' + escapeHtml(value) + '</span>';
        bar.appendChild(row);
    }
    function setStatusLine(id, value) {
        var el = $('#shtx-status-' + id + ' .shtx-status-value'); if (el) el.textContent = value;
    }

    function getToolbarPosition() {
        return localStorage.getItem(CONFIG.TOOLBAR_POSITION_KEY) === 'right' ? 'right' : 'left';
    }
    function setToolbarPosition(pos) {
        localStorage.setItem(CONFIG.TOOLBAR_POSITION_KEY, pos === 'right' ? 'right' : 'left');
    }

    function getPageTypeLabel() {
        if (isSiteHomeIndexPage()) return '首页'; if (isFavoritePage()) return '收藏页';
        if (isUserThreadPage()) return '用户主题页'; if (isThreadPage()) return '帖子页';
        if (isSearchResultPage()) return '搜索页'; if (isForumDisplayPage()) return '板块页';
        return '普通页面';
    }

    function addCollapsibleSection(body, title, key, defaultOpen, contentFn) {
        var isOpen = getBool(key, defaultOpen);
        appendSection(body, title);
        var header = body.lastElementChild;
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        header.setAttribute('data-shtx-folder', key);
        var wrapper = document.createElement('div');
        wrapper.className = 'shtx-folder-body';
        wrapper.style.display = isOpen ? '' : 'none';
        contentFn(wrapper);
        body.appendChild(wrapper);
        if (!isOpen) header.style.opacity = '0.6';
        header.addEventListener('click', function() {
            var now = wrapper.style.display === 'none';
            wrapper.style.display = now ? '' : 'none';
            header.style.opacity = now ? '' : '0.6';
            setBool(key, now);
        });
    }

    function createToolbar() {
        var old = $('#shtx-toolbar'); if (old) old.remove();
        var openCount = getOpenThreads().length;
        var hasOpenTool = isThreadPage() || openCount > 0;
        var hasListTool = isListToolPage();
        var hasThreadTool = isThreadPage();
        var hasReplyTool = isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID;
        var hasNextTool = isNextPageLoadPage();
        var hasPreviewTool = isPreviewToolPage();

        var bar = document.createElement('div');
        bar.id = 'shtx-toolbar'; bar.className = 'shtx-toolbar shtx-' + getToolbarPosition() + (getBool(CONFIG.TOOLBAR_COLLAPSED_KEY, false) ? ' shtx-collapsed' : '');

        var head = document.createElement('div'); head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
        var title = document.createElement('div'); title.className = 'shtx-title'; title.textContent = '色花堂工具箱';
        var collapseBtn = document.createElement('button'); collapseBtn.className = 'shtx-collapse-btn';
        collapseBtn.textContent = getBool(CONFIG.TOOLBAR_COLLAPSED_KEY, false) ? '展开' : '收起';
        collapseBtn.addEventListener('click', function() {
            var c = !getBool(CONFIG.TOOLBAR_COLLAPSED_KEY, false);
            setBool(CONFIG.TOOLBAR_COLLAPSED_KEY, c);
            bar.classList.toggle('shtx-collapsed', c);
            collapseBtn.textContent = c ? '展开' : '收起';
        });
        head.appendChild(title); head.appendChild(collapseBtn); bar.appendChild(head);
        bar.appendChild(makeBtn('设置', 'red', openSettingsDialog));
        bar.appendChild(makeBtn('记录', 'gray', openTaskLogDialog));

        var body = document.createElement('div'); body.className = 'shtx-toolbar-body';

        if (hasPreviewTool || isSearchResultPage() || hasNextTool) {
            addCollapsibleSection(body, '常用', 'shtx_folder_common', true, function(w) {
                if (hasPreviewTool) w.appendChild(makeBtn(getPreviewToggleText(), 'blue', togglePreviewPanel));
                if (isSearchResultPage()) w.appendChild(makeBtn('搜索筛选', 'green', openSearchFilterDialog));
                if (hasNextTool) w.appendChild(makeBtn('加载后一页', 'green', function() { loadNextPage(false); }));
                if (hasListTool) {
                    w.appendChild(makeBtn(isFavoritePage() ? '搜全部收藏' : '搜全部主题', 'blue', openSearchDialog));
                    w.appendChild(makeBtn('导出资源', 'green', openExportDialog));
                }
            });
        }

        if (hasThreadTool) {
            addCollapsibleSection(body, '帖子', 'shtx_folder_thread', true, function(w) {
                if (getBool('sht_show_btn_fastpost', true)) w.appendChild(makeBtn('快速发帖', 'green', openFastPost));
                if (getBool('sht_show_btn_fastreply', true)) w.appendChild(makeBtn('快速回复', 'green', openFastReply));
                if (getBool('sht_show_btn_copycode', true)) w.appendChild(makeBtn('复制代码', 'blue', copyAllCodeBlocks));
                if (getBool('sht_show_btn_fastcopy', true)) w.appendChild(makeBtn('复制帖子', 'blue', copyCurrentPostContent));
                if (getBool('sht_show_btn_down', true)) w.appendChild(makeBtn('下载附件', 'green', openAttachmentDialog));
                if (getBool('sht_show_btn_imgtoggle', true)) w.appendChild(makeBtn(getPostImageToggleText(), 'orange', togglePostImages));
                if (getBool('sht_show_btn_star', true)) w.appendChild(makeBtn('收藏本帖', 'blue', favoriteCurrentThread));
                if (getBool('sht_show_btn_grade', true)) w.appendChild(makeBtn('评分', 'orange', rateCurrentThread));
                if (getBool('sht_show_btn_double', true)) w.appendChild(makeBtn('一键二连', 'red', twoActionCurrentThread));
                if (getBool('sht_show_btn_ratings', true)) w.appendChild(makeBtn('查看评分', 'gray', openViewRatings));
                if (getBool('sht_show_btn_paylog', true)) w.appendChild(makeBtn('购买记录', 'gray', openPayLog));
            });
        }

        if (hasOpenTool) {
            addCollapsibleSection(body, '批量', 'shtx_folder_batch', true, function(w) {
                w.appendChild(makeBtn('收藏打开帖子', 'red', openFavoriteDialog));
                w.appendChild(makeBtn('清理打开记录', 'gray', clearOpenThreadRecords));
            });
        }

        appendSection(body, '状态');
        appendStatusLine(body, 'page', '页面', getPageTypeLabel());
        appendStatusLine(body, 'sign', '签到', getSignStatusText());
        if (hasPreviewTool && isPreviewToolPage()) {
            appendStatusLine(body, 'list-count', '主题', getThreadCountText());
            appendStatusLine(body, 'preview', '预览', getPreviewStatusText());
        }
        if (isSearchResultPage()) appendStatusLine(body, 'search-filter', '筛选', getSearchFilterStatusText());
        if (hasNextTool) {
            appendStatusLine(body, 'scroll', '翻页', getPaginationStatusText());
            appendStatusLine(body, 'next-message', '加载', getNextMessageText());
        }
        if (hasThreadTool) {
            appendStatusLine(body, 'thread-action', '操作', getThreadActionStatusText());
            appendStatusLine(body, 'post-images', '图片', getPostImageStatusText());
        }
        if (hasReplyTool) appendStatusLine(body, 'auto-reply', '自动回复', getBool(CONFIG.AUTO_REPLY_KEY, true) ? '开启' : '关闭');
        if (hasOpenTool) appendStatusLine(body, 'open-count', '打开帖', openCount + ' 个');

        while (head.nextSibling && head.nextSibling !== body) body.appendChild(head.nextSibling);
        bar.appendChild(body);
        document.body.appendChild(bar);
    }

    function getPreviewStatusText() {
        var auto = getBool(CONFIG.AUTO_PREVIEW_KEY, true) ? '自动' : '手动';
        return (STATE.previewVisible ? '已展开' : '已收起') + ' / ' + auto;
    }
    function getPreviewToggleText() { return STATE.previewVisible ? '收起预览' : '展开预览'; }
    function getPaginationStatusText() {
        if (STATE.nextPagesLoading) return '加载中'; if (STATE.autoScrollEnd) return '已到底'; return '就绪';
    }
    function getNextMessageText() {
        if (STATE.nextPagesLoading) return '加载中'; if (STATE.autoScrollEnd) return '没有更多'; return '空闲';
    }
    function getThreadActionStatusText() {
        if (STATE.threadActionRunning) return '处理中'; return STATE.threadActionMessage || '空闲';
    }
    function getPostImageStatusText() { return getBool(CONFIG.THREAD_IMAGES_SHOWN_KEY, true) ? '显示' : '隐藏'; }
    function getPostImageToggleText() { return getBool(CONFIG.THREAD_IMAGES_SHOWN_KEY, true) ? '隐藏图片' : '显示图片'; }
    function getThreadCountText() {
        if (isSearchResultPage()) {
            var items = getSearchResultItems();
            var vf = getVisibleSearchFids(), su = getBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, true);
            var v = items.filter(function(it) { return it.fid ? vf.indexOf(String(it.fid)) !== -1 : su; }).length;
            return v + '/' + items.length + ' 个';
        }
        return STATE.threads.length + ' 个';
    }
    function getSignStatusText() {
        if (STATE.signRunning) return '签到中';
        var info = getCurrentSignUserInfo(), today = getDateKey(new Date());
        if (info.lastSignDate === today) {
            var p = ['已签到']; if (info.signCount) p.push('累计' + info.signCount + '天');
            if (info.signStreak) p.push('连续' + info.signStreak + '天'); return p.join(' / ');
        }
        if (!getBool(CONFIG.AUTO_SIGN_KEY, true)) return '关闭';
        if (STATE.signMessage) return STATE.signMessage;
        if (info.lastAttemptDate === today && info.lastResult === 'error') return '今日失败';
        return '待签到';
    }

    // ============ SETTINGS ============
    function openSettingsDialog() {
        var dlg = createDialog('设置', '600px');

        var signSec = appendSettingsSection(dlg.body, '签到');
        appendSwitch(signSec, '自动签到', '每天自动签到并记录连续天数', getBool(CONFIG.AUTO_SIGN_KEY, true), function(v) {
            setBool(CONFIG.AUTO_SIGN_KEY, v); if (v) initAutoSign(true); createToolbar();
        });

        var previewSec = appendSettingsSection(dlg.body, '全局预览');
        appendSwitch(previewSec, '自动加载预览', '列表页自动展开缩略图预览', getBool(CONFIG.AUTO_PREVIEW_KEY, true), function(v) {
            setBool(CONFIG.AUTO_PREVIEW_KEY, v);
            if (v && isPreviewToolPage()) { STATE.previewVisible = true; setPreviewVisibility(true); refreshThreads(); loadAllPreviews(); }
            createToolbar();
        });
        var imgCountRow = document.createElement('div'); imgCountRow.className = 'shtx-switch-row';
        imgCountRow.innerHTML = '<span class="shtx-switch-copy"><strong>预览图片数</strong><small>每个帖子最多显示的缩略图数量</small></span><select class="shtx-select" id="shtx-set-imgcount"><option value="3">3 张</option><option value="5">5 张</option><option value="6">6 张</option><option value="8">8 张</option></select>';
        previewSec.appendChild(imgCountRow);
        var imgSelect = $('#shtx-set-imgcount', dlg.root); imgSelect.value = String(CONFIG.MAX_IMAGES);
        imgSelect.addEventListener('change', function() { CONFIG.MAX_IMAGES = parseInt(imgSelect.value, 10); localStorage.setItem('sht_preview_img_count', String(CONFIG.MAX_IMAGES)); });

        var pageSec = appendSettingsSection(dlg.body, '无缝翻页');
        appendSwitch(pageSec, '自动加载后一页', '滚动接近页面底部时自动加载下一页', getBool(CONFIG.AUTO_PAGINATION_KEY, true), function(v) {
            setBool(CONFIG.AUTO_PAGINATION_KEY, v); if (v) initAutoPagination(); createToolbar();
        });
        var distRow = document.createElement('div'); distRow.className = 'shtx-switch-row';
        distRow.innerHTML = '<span class="shtx-switch-copy"><strong>触发距离</strong><small>距底部多少像素时触发加载</small></span><select class="shtx-select" id="shtx-set-dist"><option value="300">300px（激进）</option><option value="500">500px（标准）</option><option value="900">900px（保守）</option></select>';
        pageSec.appendChild(distRow);
        var distSelect = $('#shtx-set-dist', dlg.root); distSelect.value = String(CONFIG.AUTO_SCROLL_THRESHOLD);
        distSelect.addEventListener('change', function() { CONFIG.AUTO_SCROLL_THRESHOLD = parseInt(distSelect.value, 10); localStorage.setItem('sht_scroll_threshold', String(CONFIG.AUTO_SCROLL_THRESHOLD)); });

        if (isSearchResultPage()) {
            var filterSec = appendSettingsSection(dlg.body, '板块筛选');
            filterSec.appendChild(makeBtn('打开板块筛选', 'blue', openSearchFilterDialog));
        }

        var threadSec = appendSettingsSection(dlg.body, '帖子页');
        appendSwitch(threadSec, '自动回复', '原创自拍区检测到回复可见时自动回复', getBool(CONFIG.AUTO_REPLY_KEY, true), function(v) {
            setBool(CONFIG.AUTO_REPLY_KEY, v); createToolbar();
            if (v && isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID) runAutoReply();
        });
        var cooldownRow = document.createElement('div'); cooldownRow.className = 'shtx-switch-row';
        cooldownRow.innerHTML = '<span class="shtx-switch-copy"><strong>回复冷却</strong><small>两次自动回复间隔秒数</small></span><select class="shtx-select" id="shtx-set-cooldown"><option value="30">30 秒</option><option value="60">60 秒</option><option value="120">120 秒</option></select>';
        threadSec.appendChild(cooldownRow);
        var cdSelect = $('#shtx-set-cooldown', dlg.root); cdSelect.value = String(CONFIG.AUTO_REPLY_COOLDOWN / 1000);
        cdSelect.addEventListener('change', function() { CONFIG.AUTO_REPLY_COOLDOWN = parseInt(cdSelect.value, 10) * 1000; localStorage.setItem('sht_reply_cooldown', String(CONFIG.AUTO_REPLY_COOLDOWN)); });
        var maxReplyRow = document.createElement('div'); maxReplyRow.className = 'shtx-switch-row';
        maxReplyRow.innerHTML = '<span class="shtx-switch-copy"><strong>回复上限</strong><small>每会话最多自动回复次数</small></span><select class="shtx-select" id="shtx-set-maxreply"><option value="3">3 次</option><option value="5">5 次</option><option value="10">10 次</option></select>';
        threadSec.appendChild(maxReplyRow);
        var mrSelect = $('#shtx-set-maxreply', dlg.root); mrSelect.value = String(CONFIG.AUTO_REPLY_MAX_PER_SESSION);
        mrSelect.addEventListener('change', function() { CONFIG.AUTO_REPLY_MAX_PER_SESSION = parseInt(mrSelect.value, 10); localStorage.setItem('sht_reply_max', String(CONFIG.AUTO_REPLY_MAX_PER_SESSION)); });

        var toolbarSec = appendSettingsSection(dlg.body, '工具栏');
        var posRow = document.createElement('div'); posRow.className = 'shtx-switch-row';
        posRow.innerHTML = '<span class="shtx-switch-copy"><strong>工具栏位置</strong><small>贴在页面左侧或右侧</small></span><select class="shtx-select" id="shtx-set-pos"><option value="left">左侧</option><option value="right">右侧</option></select>';
        toolbarSec.appendChild(posRow);
        var posSelect = $('#shtx-set-pos', dlg.root); posSelect.value = getToolbarPosition();
        posSelect.addEventListener('change', function() { setToolbarPosition(posSelect.value); createToolbar(); });

        var showBtns = [
            { id: 'showFastPost', label: '快速发帖', key: 'sht_show_btn_fastpost', def: true },
            { id: 'showFastReply', label: '快速回复', key: 'sht_show_btn_fastreply', def: true },
            { id: 'showCopyCode', label: '复制代码', key: 'sht_show_btn_copycode', def: true },
            { id: 'showFastCopy', label: '复制帖子', key: 'sht_show_btn_fastcopy', def: true },
            { id: 'showDown', label: '下载附件', key: 'sht_show_btn_down', def: true },
            { id: 'showImgToggle', label: '显隐图片', key: 'sht_show_btn_imgtoggle', def: true },
            { id: 'showQuickStar', label: '收藏本帖', key: 'sht_show_btn_star', def: true },
            { id: 'showQuickGrade', label: '评分', key: 'sht_show_btn_grade', def: true },
            { id: 'showClickDouble', label: '一键二连', key: 'sht_show_btn_double', def: true },
            { id: 'showViewRatings', label: '查看评分', key: 'sht_show_btn_ratings', def: true },
            { id: 'showPayLog', label: '购买记录', key: 'sht_show_btn_paylog', def: true },
        ];
        showBtns.forEach(function(item) {
            appendSwitch(toolbarSec, item.label, '', getBool(item.key, item.def), function(v) {
                setBool(item.key, v); createToolbar();
            });
        });

        dlg.foot.textContent = '设置立即保存并生效';
    }

    // ============ TASK LOG ============
    function openTaskLogDialog() {
        var log = readJson(CONFIG.TASK_LOG_KEY, []);
        var dlg = createDialog('任务记录', '560px');
        if (!log.length) {
            dlg.body.innerHTML = '<div style="text-align:center;padding:30px;color:#ccc;font-size:13px;">暂无记录</div>';
        } else {
            var icons = { sign: '签到', rate: '评分', fav: '收藏', reply: '回复', export: '导出', error: '错误' };
            dlg.body.innerHTML = log.map(function(entry) {
                var t = new Date(entry.time).toLocaleString();
                var icon = icons[entry.type] || entry.type;
                var color = entry.type === 'error' ? '#e74c3c' : (entry.type === 'sign' ? '#27ae60' : '#3498db');
                return '<div class="shtx-result-row"><span style="color:' + color + ';font-weight:bold;white-space:nowrap;">[' + icon + ']</span><span style="flex:1;">' + escapeHtml(entry.message) + '</span><span style="color:#999;font-size:11px;white-space:nowrap;">' + escapeHtml(t) + '</span></div>';
            }).join('');
        }
        dlg.foot.innerHTML = '<button class="shtx-btn shtx-gray" id="shtx-clear-log">清空记录</button>';
        $('#shtx-clear-log', dlg.root).addEventListener('click', function() {
            writeJson(CONFIG.TASK_LOG_KEY, []);
            dlg.close(); toast('已清空');
        });
    }

    // ============ AUTO SIGN ============
    function getDateKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function getYesterdayKey(d) { var y = new Date(d); y.setDate(y.getDate() - 1); return getDateKey(y); }
    function loadSignState() { var s = readJson(CONFIG.AUTO_SIGN_STATE_KEY, {}); if (!s || typeof s !== 'object') s = {}; if (!s.users || typeof s.users !== 'object') s.users = {}; return s; }
    function saveSignState(s) { writeJson(CONFIG.AUTO_SIGN_STATE_KEY, s); }
    function getCurrentUserIdForSign() {
        var sels = ['#um a[href*="uid="]', '.avt a[href*="uid="]', 'div.avt > a[href*="uid="]', 'a[href*="home.php?mod=space"][href*="uid="]'];
        for (var i = 0; i < sels.length; i++) { var link = $(sels[i]); if (!link) continue; var m = (link.getAttribute('href') || link.href || '').match(/[?&]uid=(\d+)|uid-(\d+)/); if (m) return m[1] || m[2] || ''; }
        return getUid() || '0';
    }
    function getSignUserInfo(state, uid) { state = state || loadSignState(); uid = uid || getCurrentUserIdForSign(); if (!state.users[uid]) state.users[uid] = { lastSignDate: '', signCount: 0, signStreak: 0, lastAttemptDate: '', lastResult: '', lastMessage: '' }; return state.users[uid]; }
    function getCurrentSignUserInfo() { return getSignUserInfo(loadSignState(), getCurrentUserIdForSign()); }
    function isSignedToday() { return getCurrentSignUserInfo().lastSignDate === getDateKey(new Date()); }
    function rememberSignSuccess(msg) {
        var state = loadSignState(), uid = getCurrentUserIdForSign(), info = getSignUserInfo(state, uid);
        var now = new Date(), today = getDateKey(now);
        if (info.lastSignDate !== today) { info.signCount = (parseInt(info.signCount, 10) || 0) + 1; info.signStreak = info.lastSignDate === getYesterdayKey(now) ? ((parseInt(info.signStreak, 10) || 0) + 1) : 1; info.lastSignDate = today; }
        info.lastAttemptDate = today; info.lastResult = 'success'; info.lastMessage = msg || '签到成功'; saveSignState(state); return info;
    }
    function rememberSignFailure(msg) { var state = loadSignState(), info = getSignUserInfo(state, getCurrentUserIdForSign()); info.lastAttemptDate = getDateKey(new Date()); info.lastResult = 'error'; info.lastMessage = msg || '签到失败'; saveSignState(state); }
    function decodeHtmlEntities(text) { var ta = document.createElement('textarea'); ta.innerHTML = String(text || ''); return ta.value; }
    function parseSignAjaxHtml(text) {
        var xml = new DOMParser().parseFromString(String(text || ''), 'text/xml');
        var root = xml.getElementsByTagName('root')[0];
        return decodeHtmlEntities(root ? root.textContent : text);
    }
    function htmlToPlainText(html) { return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
    function safeEvalSimpleMath(expr) {
        expr = String(expr || '').replace(/\s*=\s*\?\s*$/, '').trim();
        var m = expr.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/); if (!m) return NaN;
        var a = parseFloat(m[1]), b = parseFloat(m[3]);
        switch (m[2]) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b !== 0 ? a / b : NaN; default: return NaN; }
    }
    function fetchSignInfo() {
        return fetch(ORIGIN + '/plugin.php?id=dd_sign&ac=sign&infloat=yes&handlekey=pc_click_ddsign&inajax=1&ajaxtarget=fwin_content_pc_click_ddsign', { credentials: 'include' })
            .then(function(r) { return r.text(); }).then(function(text) {
                var html = parseSignAjaxHtml(text), plain = htmlToPlainText(html);
                if (/已经签到|重复签到|已签到|今日已签/.test(plain)) return { already: true };
                if (/请先登录|登录后|您需要登录/.test(plain)) return { error: '需要登录后才能签到' };
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var fh = $('input[name="formhash"]', doc), st = $('input[name="signtoken"]', doc);
                var sf = $('form[name="login"]', doc) || $('form[id^="signform_"]', doc);
                if (!fh || !st || !sf) return { error: '获取签到信息失败' };
                var sh = (sf.getAttribute('id') || '').replace(/^signform_/, '');
                if (!sh) return { error: '获取签到参数失败' };
                return { formhash: fh.value, signtoken: st.value, signhash: sh };
            });
    }
    function fetchSignValidateText() {
        return fetch(ORIGIN + '/misc.php?mod=secqaa&action=update&idhash=' + encodeURIComponent(CONFIG.AUTO_SIGN_SECQAAHASH), { credentials: 'include' })
            .then(function(r) { return r.text(); }).then(function(text) {
                var n = String(text || '').replace("sectplcode[2] + '", '前').replace("' + sectplcode[3]", '后');
                var m = n.match(/前([\w\W]+)后/); return m ? m[1] : '';
            });
    }
    function submitSign(info, answer) {
        var data = new URLSearchParams();
        data.append('formhash', info.formhash); data.append('signtoken', info.signtoken);
        data.append('secqaahash', CONFIG.AUTO_SIGN_SECQAAHASH); data.append('secanswer', String(answer));
        return fetch(ORIGIN + '/plugin.php?id=dd_sign&ac=sign&signsubmit=yes&handlekey=pc_click_ddsign&signhash=' + encodeURIComponent(info.signhash) + '&inajax=1', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data,
        }).then(function(r) { return r.text(); });
    }
    function doSignRequest() {
        return fetchSignInfo().then(function(info) {
            if (!info) return { ok: false, message: '获取签到信息失败' };
            if (info.already) return { ok: true, message: '已经签到过啦' };
            if (info.error) return { ok: false, message: info.error };
            return fetchSignValidateText().then(function(expr) {
                if (!expr) return { ok: false, message: '获取签到验证失败' };
                var answer = safeEvalSimpleMath(expr);
                if (isNaN(answer)) return { ok: false, message: '验证计算失败' };
                return submitSign(info, answer).then(function(text) {
                    var plain = htmlToPlainText(parseSignAjaxHtml(text));
                    if (/已经签到过|重复签到|已经签到|今日已签|已签到/.test(plain)) return { ok: true, message: '已经签到过啦' };
                    if (/签到成功|成功签到/.test(plain)) return { ok: true, message: '签到成功' };
                    if (/请先登录|登录后|您需要登录/.test(plain)) return { ok: false, message: '需要登录后才能签到' };
                    if (/请至少发表或回复一个帖子后再来签到/.test(plain)) return { ok: false, message: '请先发帖或回复后再签到' };
                    return { ok: false, message: '签到出现未知错误' };
                });
            });
        }).catch(function() { return { ok: false, message: '签到请求失败' }; });
    }
    function runAutoSign(manual) {
        if (STATE.signRunning) return;
        if (!manual && !getBool(CONFIG.AUTO_SIGN_KEY, true)) return;
        var today = getDateKey(new Date()), info = getCurrentSignUserInfo();
        if (!manual) { if (info.lastSignDate === today) return; if (info.lastAttemptDate === today && info.lastResult === 'error') return; }
        STATE.signRunning = true; STATE.signMessage = '签到中'; updateSignStatus(); createToolbar();
        doSignRequest().then(function(r) {
            STATE.signRunning = false;
            if (r.ok) { var s = rememberSignSuccess(r.message); STATE.signMessage = '已签到'; if (manual) toast(r.message + '，连续' + s.signStreak + '天'); appendTaskLog('sign', '签到成功', '连续' + s.signStreak + '天'); }
            else { rememberSignFailure(r.message); STATE.signMessage = r.message; toast(r.message, 'error'); appendTaskLog('error', '签到失败', r.message); }
            createToolbar(); updateSignStatus();
        });
    }
    function initAutoSign(force) { if (!force && STATE.signAutoStarted) return; if (!getBool(CONFIG.AUTO_SIGN_KEY, true)) return; STATE.signAutoStarted = true; setTimeout(function() { runAutoSign(false); }, CONFIG.AUTO_SIGN_DELAY_MS); }
    function updateSignStatus(msg) { if (msg) STATE.signMessage = msg; setStatusLine('sign', getSignStatusText()); }

    // ============ INFINITE SCROLL ============
    function loadNextPage(fromAuto) {
        if (!isNextPageLoadPage()) { toast('当前页面不支持'); return; }
        if (STATE.nextPagesLoading) return;
        var basePage = Math.max(getCurrentPageNumber(), STATE.loadedMaxPage || 1);
        var nextUrl = getNextPageUrl(document);
        if (!nextUrl) {
            var detectedMax = Math.max(detectMaxPage(document) || 1, STATE.listMaxPage || 1);
            if (basePage >= detectedMax) {
                STATE.autoScrollEnd = true;
                setStatusLine('scroll', getPaginationStatusText());
                setStatusLine('next-message', '没有更多页面'); if (!fromAuto) toast('没有更多页面'); return;
            }
            nextUrl = buildNextPageUrl(basePage + 1);
        }
        if (!nextUrl) {
            STATE.autoScrollEnd = true;
            setStatusLine('scroll', getPaginationStatusText());
            setStatusLine('next-message', '没有更多页面'); if (!fromAuto) toast('没有更多页面'); return;
        }

        var pageName = getPageNameForScroll();
        var pageNo = getPageNumberFromUrl(nextUrl) || (getCurrentPageNumber() + 1);

        STATE.nextPagesLoading = true;
        STATE.autoScrollEnd = false;
        setStatusLine('scroll', getPaginationStatusText());
        setStatusLine('next-message', '加载第 ' + pageNo + ' 页...');

        fetch(nextUrl, { credentials: 'include' }).then(function(r) { return r.text(); }).then(function(html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var added = appendNewContent(doc, pageNo);
            updatePaginationFromDoc(doc);
            STATE.loadedMaxPage = Math.max(STATE.loadedMaxPage || 1, pageNo);

            STATE.nextPagesLoading = false;
            if (!getNextPageUrl(document)) STATE.autoScrollEnd = true;
            setStatusLine('scroll', getPaginationStatusText());
            setStatusLine('next-message', '新增 ' + added + (isThreadPage() ? ' 个楼层' : ' 个主题'));
            processPageContent(pageName);
            if (!fromAuto) toast('新增 ' + added + ' 个主题');
            checkAndLoadIfContentNotEnough();
        }).catch(function() {
            STATE.nextPagesLoading = false;
            setStatusLine('next-message', '加载失败');
            toast('加载失败', 'error');
        });
    }
    function getCurrentPageNumber() {
        var p = parseInt(getParams().get('page'), 10);
        if (!isNaN(p) && p > 0) return p;
        var m = location.href.match(/thread-\d+-(\d+)-\d+\.html/i) || location.href.match(/forum-\d+-(\d+)\.html/i);
        p = m ? parseInt(m[1], 10) : 1;
        return isNaN(p) || p < 1 ? 1 : p;
    }
    function getPageNumberFromUrl(url) {
        var m = String(url || '').match(/[?&]page=(\d+)/) || String(url || '').match(/thread-\d+-(\d+)-\d+\.html/i) || String(url || '').match(/forum-\d+-(\d+)\.html/i);
        var p = m ? parseInt(m[1], 10) : 0;
        return isNaN(p) ? 0 : p;
    }
    function getNextPageUrl(root) {
        var a = $('.pg a.nxt[href], a.nxt[href]', root || document);
        return a ? normalizeUrl(a.getAttribute('href') || a.href) : '';
    }
    function buildNextPageUrl(page) {
        if (isFavoritePage()) return ORIGIN + '/home.php?mod=space&uid=' + encodeURIComponent(getUid()) + '&do=favorite&view=me&page=' + page;
        if (isUserThreadPage()) { var url = new URL(location.href); url.searchParams.set('page', page); return url.href; }
        if (isForumDisplayPage()) {
            var pfm = location.href.match(/forum-(\d+)-\d+\.html/i);
            if (pfm) return ORIGIN + '/forum-' + pfm[1] + '-' + page + '.html';
        }
        if (isThreadPage()) {
            var ptm = location.href.match(/thread-(\d+)-\d+-\d+\.html/i);
            if (ptm) return ORIGIN + '/thread-' + ptm[1] + '-' + page + '-1.html';
        }
        var furl = new URL(location.href); furl.searchParams.set('page', page); return furl.href;
    }
    function detectMaxPage(root) {
        root = root || document; var max = parseInt(getParams().get('page'), 10) || 1;
        $all('.pg a[href], a.last[href]', root).forEach(function(a) {
            var href = a.getAttribute('href') || a.href || '';
            var m = href.match(/[?&]page=(\d+)/) || href.match(/thread-\d+-(\d+)-\d+\.html/i) || href.match(/forum-\d+-(\d+)\.html/i);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return max || 1;
    }
    function appendNewContent(doc, page) {
        var selector = getContentSelector();
        var target = document.querySelector(selector);
        var source = doc.querySelector(selector);
        if (!target || !source) return 0;
        var sep = document.createElement('div');
        sep.className = 'shtx-autoload-sep';
        sep.setAttribute('data-page', String(page));
        sep.style.cssText = 'clear:both;text-align:center;margin:8px 0;padding:4px 0;border-top:1px dashed #ddd;color:#999;font-size:11px;';
        sep.textContent = '—— 第 ' + page + ' 页 ——';
        target.appendChild(sep);
        var added = 0;
        each(source.childNodes, function(child) {
            var clone = child.cloneNode(true);
            if (clone.nodeType === 1 && clone.setAttribute) clone.setAttribute('data-shtx-autoload-page', String(page));
            target.appendChild(clone); added++;
        });
        return added;
    }
    function processPageContent(pageName) {
        if (pageName === 'isSearchPage') { applySearchFilter(); refreshThreads(); if (getBool(CONFIG.AUTO_PREVIEW_KEY, true) && STATE.previewVisible) loadAllPreviews(); }
        else if (pageName === 'isForumDisplayPage') { refreshThreads(); if (getBool(CONFIG.AUTO_PREVIEW_KEY, true) && STATE.previewVisible) loadAllPreviews(); }
        else if (pageName === 'isPostPage') initThreadEnhancements();
    }
    function updatePaginationFromDoc(doc) {
        var newer = $all('.pg', doc); if (!newer.length) return;
        $all('.pg').forEach(function(pg, i) { pg.innerHTML = (newer[i] || newer[0]).innerHTML; });
    }
    function isNearPageBottom() {
        var doc = document.documentElement;
        var top = window.pageYOffset || doc.scrollTop || document.body.scrollTop || 0;
        var height = Math.max(doc.scrollHeight || 0, document.body.scrollHeight || 0);
        return height - (top + window.innerHeight) < CONFIG.AUTO_SCROLL_THRESHOLD;
    }
    function checkAndLoadIfContentNotEnough() {
        if (STATE.nextPagesLoading || STATE.autoScrollEnd) return;
        if (document.body.offsetHeight <= window.innerHeight) loadNextPage(true);
    }
    function initAutoPagination() {
        if (!isNextPageLoadPage()) return;
        if (!getBool(CONFIG.AUTO_PAGINATION_KEY, true)) return;
        if (STATE.nextScrollBound) return;
        STATE.nextScrollBound = true;
        STATE.nextPagesAutoStarted = true;
        var onScroll = function() {
            if (STATE.nextPagesLoading || STATE.autoScrollEnd) return;
            if (isNearPageBottom()) loadNextPage(true);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // ============ IMAGE PREVIEW ============
    function getTidFromHref(href) {
        var m = String(href || '').match(/[?&]tid=(\d+)/) || String(href || '').match(/thread-(\d+)-\d+-\d+\.html/i);
        return m ? m[1] : '';
    }
    function titleScore(a, title) { var s = title ? title.length : 0; if (/\bxst\b/.test(a.className || '')) s += 1000; if (!title || /^\d+$/.test(title)) s -= 500; return s; }
    function getThreadsWithLinks(root) {
        root = root || document;
        var links = root.querySelectorAll('a[href*="viewthread"][href*="tid="], a[href*="thread-"]'), map = {};
        each(links, function(a) {
            if (isInsideToolUi(a)) return; if (!getPreviewMountNode(a)) return;
            var tid = getTidFromHref(a.getAttribute('href') || a.href); if (!tid) return;
            var title = textOf(a) || a.title || ('tid=' + tid);
            var item = { tid: tid, link: a, title: title, score: titleScore(a, title) };
            if (!map[tid] || item.score > map[tid].score) map[tid] = item;
        });
        return Object.keys(map).map(function(tid) { return { tid: tid, link: map[tid].link, title: map[tid].title }; });
    }
    function refreshThreads() {
        if (!isPreviewToolPage()) return;
        dedupeThreadItems(); dedupePreviewContainers();
        var before = STATE.threads.length;
        STATE.threads = getThreadsWithLinks(document);
        STATE.listMaxPage = Math.max(STATE.listMaxPage || 1, detectMaxPage(document));
        setStatusLine('list-count', getThreadCountText());
        if (STATE.threads.length !== before && getBool(CONFIG.AUTO_PREVIEW_KEY, true) && STATE.previewVisible) loadAllPreviews();
    }
    function scheduleRefresh() {
        if (STATE.refreshTimer) clearTimeout(STATE.refreshTimer);
        STATE.refreshTimer = setTimeout(function() { STATE.refreshTimer = null; refreshThreads(); }, 500);
    }
    function initListTools() {
        STATE.previewVisible = getBool(CONFIG.AUTO_PREVIEW_KEY, true);
        if (isNextPageLoadPage()) STATE.loadedMaxPage = Math.max(STATE.loadedMaxPage || 1, getCurrentPageNumber());
        if (!isPreviewToolPage()) return;
        refreshThreads();
        if (getBool(CONFIG.AUTO_PREVIEW_KEY, true)) loadAllPreviews(); else setPreviewVisibility(false);
        if (!STATE.listObserver && window.MutationObserver) {
            STATE.listObserver = new MutationObserver(function(muts) {
                for (var i = 0; i < muts.length; i++) {
                    var nodes = Array.prototype.slice.call(muts[i].addedNodes || []);
                    if (nodes.some(function(n) { return n && n.nodeType === 1 && !isInsideToolUi(n) && (n.matches && n.matches('a[href*="viewthread"], a[href*="thread-"]') || (n.querySelector && n.querySelector('a[href*="viewthread"], a[href*="thread-"]'))); })) { scheduleRefresh(); break; }
                }
            });
            STATE.listObserver.observe(document.body, { childList: true, subtree: true });
        }
    }
    function togglePreviewPanel() {
        if (!isPreviewToolPage()) return;
        if (STATE.previewVisible) { setPreviewVisibility(false); createToolbar(); return; }
        STATE.previewVisible = true; setPreviewVisibility(true);
        if (isSearchResultPage()) applySearchFilter();
        refreshThreads(); createToolbar(); loadAllPreviews().then(function() { createToolbar(); });
    }
    function setPreviewVisibility(visible) {
        STATE.previewVisible = !!visible;
        $all('.shtx-preview-row, .shtx-preview-block').forEach(function(el) { el.style.display = visible ? '' : 'none'; });
        $all('.shtx-preview-container').forEach(function(el) { el.style.display = visible ? '' : 'none'; });
        if (visible && isSearchResultPage()) applySearchFilter();
    }
    function fetchImages(tid) {
        var cached = getCachedPreviewImages(tid);
        if (cached) return Promise.resolve(cached);
        return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid), { credentials: 'include' })
            .then(function(r) { return r.text(); }).then(function(html) {
                var urls = extractImageUrls(html);
                setCachedPreviewImages(tid, urls);
                return urls;
            }).catch(function() { return []; });
    }
    function extractImageUrls(html) {
        var urls = [], seen = {};
        var regex = /<img[^>]*?class\s*=\s*["'][^"']*?zoom[^"']*?["'][^>]*?>/gi, match;
        while ((match = regex.exec(html)) !== null) {
            var tag = match[0], src = '';
            var fm = tag.match(/file\s*=\s*["']([^"']+)["']/i);
            if (fm) src = fm[1]; else { var sm = tag.match(/src\s*=\s*["']([^"']+)["']/i); if (sm) src = sm[1]; }
            src = normalizeUrl(src); if (!src || seen[src] || /static\/image|smiley|avatar/i.test(src)) continue;
            seen[src] = true; urls.push(src);
        }
        return urls.slice(0, CONFIG.MAX_IMAGES);
    }
    function renderPreview(thread, imageUrls) {
        if (isSearchResultPage() && !isThreadAllowedForPreview(thread)) return;
        var anchor = getPreviewMountNode(thread.link); if (!anchor || getPreviewContainerForAnchor(anchor, thread.tid)) return;
        var container = document.createElement('div'); container.className = 'shtx-preview-container';
        container.setAttribute('data-tid', thread.tid);
        if (!STATE.previewVisible) container.style.display = 'none';
        if (imageUrls.length > 0) {
            imageUrls.forEach(function(url) {
                var wrapper = document.createElement('a');
                wrapper.href = ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(thread.tid);
                wrapper.target = '_blank';
                var img = document.createElement('img'); img.loading = 'lazy'; img.src = url;
                wrapper.appendChild(img); container.appendChild(wrapper);
            });
        }
        if (!container.children.length) { var e = document.createElement('div'); e.className = 'shtx-preview-empty'; e.textContent = '无预览'; container.appendChild(e); }
        insertPreviewAfterAnchor(anchor, thread.tid, container);
    }
    function loadAllPreviews() {
        if (!isPreviewToolPage() || STATE.previewRunning) return Promise.resolve();
        if (!STATE.previewVisible) return Promise.resolve();
        STATE.previewRunning = true; refreshThreads();
        var pending = STATE.threads.filter(function(t) {
            if (isSearchResultPage() && !isThreadAllowedForPreview(t)) return false;
            var a = getPreviewMountNode(t.link);
            return a && !getPreviewContainerForAnchor(a, t.tid);
        });
        if (pending.length === 0) { STATE.previewRunning = false; return Promise.resolve(); }
        function batch(i) {
            if (i >= pending.length) { STATE.previewRunning = false; dedupePreviewContainers(); return Promise.resolve(); }
            setStatusLine('preview', '加载 ' + Math.min(i + CONFIG.PREVIEW_CONCURRENCY, pending.length) + '/' + pending.length);
            return Promise.all(pending.slice(i, i + CONFIG.PREVIEW_CONCURRENCY).map(function(t) {
                return fetchImages(t.tid).then(function(urls) {
                    if (!isSearchResultPage() || isThreadAllowedForPreview(t)) renderPreview(t, urls);
                });
            })).then(function() { return batch(i + CONFIG.PREVIEW_CONCURRENCY); });
        }
        return batch(0);
    }
    function isDocumentShellNode(node) { if (!node) return true; var d = node.ownerDocument || document; return node === d.body || node === d.documentElement; }
    function isInlineNode(node) { return !!(node && /^(A|SPAN|EM|I|B|STRONG|FONT|SMALL|LABEL|IMG)$/i.test(node.tagName || '')); }
    function isBlockedPreviewArea(el) { if (isInsideToolUi(el)) return true; if (isThreadPage()) return true; return !!(el && el.closest && el.closest('#postlist, .t_f, .t_fsz, .pcb, #fastpostform, #pt, .pg, .pgs')); }
    function getUniqueTidsInNode(node) { var t = {}; if (!node || !node.querySelectorAll) return t; $all('a[href*="viewthread"][href*="tid="], a[href*="thread-"]', node).forEach(function(a) { if (isInsideToolUi(a)) return; var tid = getTidFromHref(a.getAttribute('href') || a.href); if (tid) t[tid] = true; }); return t; }
    function isSingleThreadItemNode(node, tid) { if (!node || isDocumentShellNode(node) || isInlineNode(node) || isBlockedPreviewArea(node)) return false; if (node.classList && node.classList.contains('shtx-preview-container')) return false; var tids = getUniqueTidsInNode(node); return !!tids[tid] && Object.keys(tids).length === 1; }
    function getThreadItemNode(link) { if (!link || !link.closest) return link ? link.parentElement : null; var tid = getTidFromHref(link.getAttribute('href') || link.href); var c = link.closest('tbody[id*="thread_"], tr, li, dl, .bbda'); if (isSingleThreadItemNode(c, tid)) return c; var n = link.parentElement; while (n && !isDocumentShellNode(n)) { if (isSingleThreadItemNode(n, tid)) return n; n = n.parentElement; } return null; }
    function getPreviewMountNode(link) { if (!link || isBlockedPreviewArea(link)) return null; var n = getThreadItemNode(link); return n && !isInlineNode(n) ? n : null; }
    function insertAfter(ref, node) { if (ref && ref.parentNode) ref.parentNode.insertBefore(node, ref.nextSibling); }
    function getPreviewWrapperForAnchor(anchor, tid) { if (!anchor || !anchor.nextElementSibling) return null; var n = anchor.nextElementSibling; while (n) { if (!n.classList || !(n.classList.contains('shtx-preview-row') || n.classList.contains('shtx-preview-block'))) break; if (!tid || n.getAttribute('data-tid') === tid || (n.querySelector && n.querySelector('.shtx-preview-container[data-tid="' + tid + '"]'))) return n; n = n.nextElementSibling; } return null; }
    function getPreviewContainerForAnchor(anchor, tid) { var w = getPreviewWrapperForAnchor(anchor, tid); if (w && w.querySelector) return w.querySelector('.shtx-preview-container[data-tid="' + tid + '"]'); return null; }
    function insertPreviewAfterAnchor(anchor, tid, container) {
        var d = document.createElement('div');
        d.className = 'shtx-preview-row';
        d.setAttribute('data-tid', tid);
        d.style.cssText = 'clear:both;';
        d.appendChild(container);
        insertAfter(anchor, d);
    }
    function dedupeThreadItems() {
        if (!isNextPageLoadPage()) return;
        var groups = {}, pairs = [];
        $all('a[href*="viewthread"][href*="tid="], a[href*="thread-"]').forEach(function(a) {
            if (isInsideToolUi(a)) return; var tid = getTidFromHref(a.getAttribute('href') || a.href); if (!tid) return;
            var node = getThreadItemNode(a); if (!isSingleThreadItemNode(node, tid)) return;
            for (var i = 0; i < pairs.length; i++) { if (pairs[i].tid === tid && pairs[i].node === node) return; }
            pairs.push({ tid: tid, node: node }); if (!groups[tid]) groups[tid] = []; groups[tid].push(node);
        });
        Object.keys(groups).forEach(function(tid) {
            var nodes = groups[tid]; if (nodes.length < 2) return;
            var keep = nodes[0]; nodes.forEach(function(n) { if (nodeScore(n, tid) > nodeScore(keep, tid)) keep = n; });
            nodes.forEach(function(n) { if (n === keep || !n.parentNode || n.contains(keep)) return; n.parentNode.removeChild(n); });
        });
    }
    function nodeScore(node, tid) { var s = 0; var p = getPreviewContainerForAnchor(node, tid); if (p) s += p.querySelector('img') ? 1000 : 800; if (!node.getAttribute || !node.getAttribute('data-shtx-autoload-page')) s += 120; s -= Math.min(node.querySelectorAll ? node.querySelectorAll('*').length : 0, 80); return s; }
    function dedupePreviewContainers() { var k = []; $all('.shtx-preview-container').forEach(function(el) { var tid = el.getAttribute('data-tid'), p = el.parentNode; if (!tid || !p) return; for (var i = 0; i < k.length; i++) { if (k[i].tid === tid && k[i].parent === p) { p.removeChild(el); return; } } k.push({ tid: tid, parent: p }); }); }

    // ============ SEARCH FILTER ============
    function getAllSearchFids() { return siteItems().map(function(it) { return it.fid; }); }
    function getVisibleSearchFids() { var s = readJson(CONFIG.SEARCH_FILTER_VISIBLE_FIDS_KEY, null); if (!Array.isArray(s)) return getAllSearchFids(); return s.map(String); }
    function saveVisibleSearchFids(fids) { writeJson(CONFIG.SEARCH_FILTER_VISIBLE_FIDS_KEY, (fids || []).map(String)); }
    function getSearchExcludeKeywords() { var s = readJson(CONFIG.SEARCH_FILTER_EXCLUDE_KEYWORDS_KEY, []); return Array.isArray(s) ? s.map(String).map(function(v) { return v.trim(); }).filter(Boolean) : []; }
    function saveSearchExcludeKeywords(words) { writeJson(CONFIG.SEARCH_FILTER_EXCLUDE_KEYWORDS_KEY, (words || []).map(String).map(function(v) { return v.trim(); }).filter(Boolean)); }
    function getSearchItemFid(node) {
        if (!node) return '';
        var links = $all('a[href]', node), fid = '';
        for (var i = 0; i < links.length; i++) { var m = (links[i].href || '').match(/[?&]fid=(\d+)/) || (links[i].href || '').match(/forum-(\d+)-\d+\.html/i); if (m) { fid = m[1]; break; } }
        if (!fid) { var text = textOf(node); var items = siteItems(); for (var j = 0; j < items.length; j++) { if (text.indexOf(items[j].name) !== -1) { fid = items[j].fid; break; } } }
        return fid;
    }
    function getSearchResultItems() {
        if (!isSearchResultPage()) return [];
        var pairs = [];
        $all('a[href*="viewthread"][href*="tid="], a[href*="thread-"]').forEach(function(a) {
            if (isInsideToolUi(a)) return; var tid = getTidFromHref(a.getAttribute('href') || a.href); if (!tid) return;
            var node = getThreadItemNode(a) || a.closest('tbody, tr, li, dl, .bbda, .pbw'); if (!node || isDocumentShellNode(node)) return;
            for (var i = 0; i < pairs.length; i++) { if (pairs[i].node === node || pairs[i].tid === tid) return; }
            pairs.push({ tid: tid, link: a, node: node, fid: getSearchItemFid(node), visible: true });
        });
        return pairs;
    }
    function getSearchFilterContext() {
        return {
            visibleFids: getVisibleSearchFids(),
            showUnknown: getBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, true),
            keywords: getSearchExcludeKeywords()
        };
    }
    function isSearchItemAllowed(item, ctx) {
        if (!item || !item.node) return false;
        ctx = ctx || getSearchFilterContext();
        var show = item.fid ? ctx.visibleFids.indexOf(String(item.fid)) !== -1 : ctx.showUnknown;
        if (show && ctx.keywords.length) {
            var text = textOf(item.node).toLowerCase();
            show = !ctx.keywords.some(function(word) { return text.indexOf(word.toLowerCase()) !== -1; });
        }
        return show;
    }
    function getSearchItemFromThread(thread) {
        if (!thread || !thread.link) return null;
        var tid = thread.tid || getTidFromHref(thread.link.getAttribute('href') || thread.link.href);
        var node = getThreadItemNode(thread.link) || thread.link.closest('tbody, tr, li, dl, .bbda, .pbw');
        if (!tid || !node || isDocumentShellNode(node)) return null;
        return { tid: tid, link: thread.link, node: node, fid: getSearchItemFid(node), visible: true };
    }
    function isThreadAllowedForPreview(thread, ctx) {
        if (!isSearchResultPage()) return true;
        return isSearchItemAllowed(getSearchItemFromThread(thread), ctx);
    }
    function setSearchItemVisible(item, visible) {
        item.visible = visible;
        if (item.node) item.node.style.display = visible ? '' : 'none';
        var mount = item.link ? getPreviewMountNode(item.link) : item.node;
        var preview = getPreviewWrapperForAnchor(mount, item.tid) || getPreviewWrapperForAnchor(item.node, item.tid);
        if (preview) preview.style.display = visible && STATE.previewVisible ? '' : 'none';
        var container = getPreviewContainerForAnchor(mount, item.tid) || getPreviewContainerForAnchor(item.node, item.tid);
        if (container) container.style.display = visible && STATE.previewVisible ? '' : 'none';
    }
    function applySearchFilter() {
        if (!isSearchResultPage()) return;
        var ctx = getSearchFilterContext();
        getSearchResultItems().forEach(function(item) {
            setSearchItemVisible(item, isSearchItemAllowed(item, ctx));
        });
    }
    function getSearchFilterStatusText() {
        if (!isSearchResultPage()) return '非搜索页';
        var items = getSearchResultItems(), ctx = getSearchFilterContext();
        var v = items.filter(function(it) { return isSearchItemAllowed(it, ctx); }).length;
        return v + '/' + items.length + ' 显示';
    }
    function openSearchFilterDialog() {
        var dlg = createDialog('板块筛选', '780px');
        var vf = getVisibleSearchFids(), vm = {}; vf.forEach(function(f) { vm[String(f)] = true; });
        var su = getBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, true), items = siteItems();
        dlg.body.innerHTML = '<div class="shtx-settings-note">勾选要显示的板块，板块名称不可编辑。</div>' +
            '<div class="shtx-filter-actions"><button class="shtx-btn shtx-blue" id="shtx-filter-all">全选</button>' +
            '<button class="shtx-btn shtx-gray" id="shtx-filter-none">全不选</button>' +
            '<button class="shtx-btn shtx-green" id="shtx-filter-restore">一键恢复全部</button>' +
            '<label class="shtx-filter-item"><input id="shtx-filter-unknown" type="checkbox"' + (su ? ' checked' : '') + '>显示未识别板块</label></div>' +
            '<div class="shtx-filter-list"><div class="shtx-filter-grid">' + items.map(function(it) {
                return '<label class="shtx-filter-item"><input type="checkbox" class="shtx-filter-fid" data-fid="' + escapeHtml(it.fid) + '"' + (vm[it.fid] ? ' checked' : '') + '><span class="shtx-filter-name">' + escapeHtml(it.name) + '</span></label>';
            }).join('') + '</div></div>';
        function apply() {
            var sel = $all('.shtx-filter-fid:checked', dlg.body).map(function(inp) { return inp.getAttribute('data-fid') || ''; }).filter(Boolean);
            saveVisibleSearchFids(sel); setBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, !!$('#shtx-filter-unknown', dlg.body).checked);
            applySearchFilter(); createToolbar();
        }
        $all('.shtx-filter-fid', dlg.body).forEach(function(inp) { inp.addEventListener('change', apply); });
        $('#shtx-filter-unknown', dlg.body).addEventListener('change', apply);
        $('#shtx-filter-all', dlg.body).onclick = function() { $all('.shtx-filter-fid', dlg.body).forEach(function(inp) { inp.checked = true; }); apply(); };
        $('#shtx-filter-none', dlg.body).onclick = function() { $all('.shtx-filter-fid', dlg.body).forEach(function(inp) { inp.checked = false; }); apply(); };
        $('#shtx-filter-restore', dlg.body).onclick = function() {
            saveVisibleSearchFids(getAllSearchFids()); setBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, true);
            dlg.close(); openSearchFilterDialog();
            applySearchFilter(); createToolbar(); toast('已恢复全部');
        };
    }

    // ============ POST ACTIONS ============
    function openSiteWindow(handle, url) {
        var rel = String(url || '').replace(/^\//, '');
        if (typeof window.showWindow === 'function') {
            window.showWindow(handle, rel, 'get', -1);
        } else {
            window.open(normalizeUrl(rel), '_blank');
        }
    }
    function getFirstPostPid() {
        var po = $('#postlist .po.hin') || $('.po.hin');
        var table = po && po.closest ? po.closest('table[id^="pid"]') : null;
        if (!table) table = $('#postlist table[id^="pid"]');
        if (table && table.id) {
            var m = table.id.match(/^pid(\d+)/i);
            if (m) return m[1];
        }
        var post = $('#postlist [id^="post_"]');
        if (post && post.id) {
            var m2 = post.id.match(/^post_(\d+)/i);
            if (m2) return m2[1];
        }
        return '';
    }
    function getThreadIdsForAction() {
        return { tid: getTid(), fid: getFid(), pid: getFirstPostPid() };
    }
    function openFastPost() {
        var ids = getThreadIdsForAction();
        if (!ids.fid) { toast('未识别到板块', 'error'); return; }
        openSiteWindow('newthread', 'forum.php?mod=post&action=newthread&fid=' + encodeURIComponent(ids.fid));
    }
    function openFastReply() {
        var ids = getThreadIdsForAction();
        if (!ids.tid || !ids.fid) { toast('未识别到帖子参数', 'error'); return; }
        openSiteWindow('reply', 'forum.php?mod=post&action=reply&fid=' + encodeURIComponent(ids.fid) + '&tid=' + encodeURIComponent(ids.tid));
    }
    function openViewRatings() {
        var ids = getThreadIdsForAction();
        if (!ids.tid || !ids.pid) { toast('未识别到评分楼层', 'error'); return; }
        openSiteWindow('viewratings', 'forum.php?mod=misc&action=viewratings&tid=' + encodeURIComponent(ids.tid) + '&pid=' + encodeURIComponent(ids.pid));
    }
    function openPayLog() {
        var ids = getThreadIdsForAction();
        if (!ids.tid || !ids.pid) { toast('未识别到购买记录楼层', 'error'); return; }
        openSiteWindow('pay', 'forum.php?mod=misc&action=viewpayments&tid=' + encodeURIComponent(ids.tid) + '&pid=' + encodeURIComponent(ids.pid));
    }
    function openAttachmentDialog() {
        var parts = [];
        $all('span[id*="attach_"], dl.tattl, div.locked').forEach(function(el) {
            if (el.matches && el.matches('div.locked') && textOf(el).indexOf('购买') === -1) return;
            if (parts.indexOf(el) === -1) parts.push(el);
        });
        if (!parts.length) { toast('没有找到附件', 'error'); return; }
        var dlg = createDialog('下载附件', '640px');
        dlg.body.innerHTML = '<div class="shtx-settings-note">下面是当前帖内检测到的附件或购买提示。</div>' +
            parts.map(function(el) { return '<div class="shtx-result-row" style="display:block;">' + el.outerHTML + '</div>'; }).join('');
    }
    function copyCurrentPostContent() {
        var posts = $all('#postlist .t_f');
        if (!posts.length) { toast('未找到帖子正文', 'error'); return; }
        var chunks = [extractPostContentText(posts[0])];
        if (posts[1] && posts[1].querySelectorAll('img').length > 3) chunks.push(extractPostContentText(posts[1]));
        var text = chunks.filter(Boolean).join('\n\n').trim();
        if (!text) { toast('帖子正文为空', 'error'); return; }
        copyToClipboard(text);
    }
    function extractPostContentText(node) {
        var clone = node.cloneNode(true);
        $all('script, style, .pstatus, .tip_4', clone).forEach(function(el) { if (el.parentNode) el.parentNode.removeChild(el); });
        $all('img', clone).forEach(function(img) {
            var url = img.getAttribute('file') || img.getAttribute('src') || '';
            url = normalizeUrl(url);
            img.parentNode.replaceChild(document.createTextNode(url && !/static\/image|smiley|avatar/i.test(url) ? '\n' + url + '\n' : ''), img);
        });
        $all('a[href]', clone).forEach(function(a) {
            var raw = (a.getAttribute('href') || '').replace(/&amp;/g, '&');
            var href = /^(ed2k|magnet):/i.test(raw) ? raw : normalizeUrl(raw);
            var label = textOf(a);
            var text = href && label && label !== href ? label + ' ' + href : (href || label);
            a.parentNode.replaceChild(document.createTextNode(text), a);
        });
        var html = clone.innerHTML
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|tr|table|blockquote|ol|ul)>/gi, '\n')
            .replace(/<[^>]+>/g, '');
        return decodeHtmlEntities(html).replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    function getPostImageNodes() {
        var r = [], seen = [];
        $all('#postlist img.zoom, #postlist .t_fsz img[file], #postlist .t_f img[file], #postlist .pcb img[file]').forEach(function(img) { if (seen.indexOf(img) !== -1 || isInsideToolUi(img) || img.closest('.pls, .avt')) return; seen.push(img); r.push(img); });
        return r;
    }
    function applyPostImageVisibility() {
        var v = getBool(CONFIG.THREAD_IMAGES_SHOWN_KEY, true);
        getPostImageNodes().forEach(function(img) { img.style.display = v ? '' : 'none'; });
    }
    function togglePostImages() {
        var v = !getBool(CONFIG.THREAD_IMAGES_SHOWN_KEY, true); setBool(CONFIG.THREAD_IMAGES_SHOWN_KEY, v);
        applyPostImageVisibility(); createToolbar(); toast(v ? '已显示图片' : '已隐藏图片');
    }
    function getCodeBlocks() { var s = [], r = []; $all('#postlist .blockcode, .t_fsz .blockcode, .pcb .blockcode').forEach(function(c) { if (s.indexOf(c) !== -1) return; s.push(c); r.push(c); }); return r; }
    function getCodeBlockText(c) { var rows = $all('li', c); if (rows.length) return rows.map(function(li) { return (li.innerText || li.textContent || '').replace(/\n/g, ''); }).join('\n'); return (c.innerText || c.textContent || '').replace(/^\s*复制代码\s*/i, '').trim(); }
    function copyAllCodeBlocks() { var b = getCodeBlocks(), t = b.map(getCodeBlockText).filter(Boolean).join('\n\n'); if (!t) { toast('未找到代码块', 'error'); return; } copyToClipboard(t); }
    function initCodeCopyButtons() { getCodeBlocks().forEach(function(c) { if (c.querySelector('.shtx-code-copy')) return; var b = document.createElement('button'); b.className = 'shtx-code-copy'; b.textContent = '复制代码'; b.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); var t = getCodeBlockText(c); if (t) copyToClipboard(t); }); c.insertBefore(b, c.firstChild); }); }
    function initThreadEnhancements() { if (!isThreadPage()) return; initCodeCopyButtons(); applyPostImageVisibility(); }
    function scheduleThreadEnhancements() { if (!isThreadPage()) return; if (STATE.threadEnhanceTimer) clearTimeout(STATE.threadEnhanceTimer); STATE.threadEnhanceTimer = setTimeout(function() { STATE.threadEnhanceTimer = null; initThreadEnhancements(); }, 300); }

    function getFormhashFromDocument(doc) {
        var inp = $('input[name="formhash"]', doc); if (inp && inp.value) return inp.value;
        var lo = $('a[href*="logout"][href*="formhash="]', doc); if (lo) { var m = lo.href.match(/formhash=([a-z0-9]+)/i); if (m) return m[1]; }
        var scs = $all('script:not([src])', doc); for (var i = 0; i < scs.length; i++) { var m2 = scs[i].textContent.match(/formhash\s*=\s*['"]([a-z0-9]+)['"]/i); if (m2) return m2[1]; }
        return '';
    }
    function getFormhash() { var l = getFormhashFromDocument(document); if (l) return Promise.resolve(l); return fetch(ORIGIN + '/forum.php', { credentials: 'include' }).then(function(r) { return r.text(); }).then(function(html) { return getFormhashFromDocument(new DOMParser().parseFromString(html, 'text/html')); }); }
    function parseFavoriteResponse(html) { var t = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); if (/收藏成功|信息收藏成功|成功加入|添加收藏成功/.test(t)) return { state: 'success', label: '收藏成功' }; if (/您已收藏|已经收藏|已收藏|重复收藏|请勿重复/.test(t)) return { state: 'exists', label: '已收藏' }; if (/请先登录|登录后|未登录/.test(t)) return { state: 'error', label: '需要登录' }; if (/formhash|表单|提交.*无效/.test(t)) return { state: 'error', label: 'formhash 无效' }; return { state: 'error', label: '收藏失败' }; }
    function favoriteThread(tid, formhash) {
        return fetch(ORIGIN + '/home.php?mod=spacecp&ac=favorite&type=thread&id=' + encodeURIComponent(tid) + '&formhash=' + encodeURIComponent(formhash) + '&infloat=yes&handlekey=k_favorite&inajax=1&ajaxtarget=fwin_content_k_favorite', { credentials: 'include' }).then(function(r) { return r.text(); }).then(parseFavoriteResponse).catch(function() { return { state: 'error', label: '网络失败' }; });
    }
    function beginThreadAction(msg) { if (!isThreadPage()) { toast('当前页面不是帖子页', 'error'); return false; } if (STATE.threadActionRunning) { toast('操作处理中'); return false; } STATE.threadActionRunning = true; STATE.threadActionMessage = msg || '处理中'; createToolbar(); setStatusLine('thread-action', getThreadActionStatusText()); return true; }
    function finishThreadAction(msg, type) { STATE.threadActionRunning = false; STATE.threadActionMessage = msg || '空闲'; createToolbar(); if (msg) toast(msg, type); }
    function favoriteCurrentThreadRequest() { var tid = getTid(); if (!tid) return Promise.resolve({ state: 'error', label: '未识别到当前帖子' }); return getFormhash().then(function(fh) { if (!fh) return { state: 'error', label: '无法获取 formhash' }; return favoriteThread(tid, fh).then(function(r) { if (r.state === 'success') return { state: 'success', label: '收藏成功' }; if (r.state === 'exists') return { state: 'exists', label: '已收藏' }; return r; }); }).catch(function() { return { state: 'error', label: '收藏请求失败' }; }); }
    function favoriteCurrentThread() { if (!beginThreadAction('收藏中')) return; favoriteCurrentThreadRequest().then(function(r) { finishThreadAction(r.label, r.state === 'error' ? 'error' : null); }); }
    function rateCurrentThread() {
        if (!beginThreadAction('打开评分')) return;
        var ids = getThreadIdsForAction();
        if (!ids.tid || !ids.pid) { finishThreadAction('未识别到评分楼层', 'error'); return; }
        openSiteWindow('rate', 'forum.php?mod=misc&action=rate&tid=' + encodeURIComponent(ids.tid) + '&pid=' + encodeURIComponent(ids.pid));
        finishThreadAction('已打开评分窗口');
    }
    function getRateInfo(pid, tid) {
        var url = ORIGIN + '/forum.php?mod=misc&action=rate&tid=' + encodeURIComponent(tid) + '&pid=' + encodeURIComponent(pid) + '&infloat=yes&handlekey=rate&t=' + Date.now() + '&inajax=1&ajaxtarget=fwin_content_rate';
        return fetch(url, { credentials: 'include' }).then(function(r) { return r.text(); }).then(function(text) {
            var html = parseSignAjaxHtml(text);
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var err = $('.alert_error', doc);
            if (err) return { ok: false, label: textOf(err) || '无法评分' };
            var maxEl = $('#scoreoption8 li', doc);
            var formHash = $('input[name="formhash"]', doc);
            var referer = $('input[name="referer"]', doc);
            var handleKey = $('input[name="handlekey"]', doc);
            if (!maxEl || !formHash) return { ok: false, label: '评分信息不足' };
            var max = parseInt((textOf(maxEl).match(/\d+/) || [0])[0], 10) || 0;
            if (max < 1) return { ok: false, label: '今日评分不足' };
            return {
                ok: true,
                formhash: formHash.value,
                referer: referer ? referer.value : location.href,
                handlekey: handleKey ? handleKey.value : 'rate',
            };
        }).catch(function() { return { ok: false, label: '获取评分信息失败' }; });
    }
    function autoRateCurrentThreadRequest() {
        var ids = getThreadIdsForAction();
        if (!ids.tid || !ids.pid) return Promise.resolve({ state: 'error', label: '未识别到评分楼层' });
        return getRateInfo(ids.pid, ids.tid).then(function(info) {
            if (!info.ok) return { state: 'error', label: info.label };
            var data = new URLSearchParams();
            data.append('formhash', info.formhash);
            data.append('tid', ids.tid);
            data.append('pid', ids.pid);
            data.append('referer', info.referer);
            data.append('handlekey', info.handlekey);
            data.append('score8', '1');
            data.append('reason', CONFIG.RATE_REASON);
            data.append('sendreasonpm', 'on');
            return fetch(ORIGIN + '/forum.php?mod=misc&action=rate&ratesubmit=yes&infloat=yes&inajax=1', {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data,
            }).then(function(r) { return r.text(); }).then(function(text) {
                var plain = htmlToPlainText(parseSignAjaxHtml(text));
                if (/感谢您的参与|评分成功|操作成功/.test(plain)) return { state: 'success', label: '+1评分成功' };
                if (/已经评过分|不能重复评分|重复/.test(plain)) return { state: 'exists', label: '已评分' };
                if (/请先登录|登录后|未登录/.test(plain)) return { state: 'error', label: '需要登录' };
                return { state: 'error', label: '评分失败' };
            });
        }).catch(function() { return { state: 'error', label: '评分请求失败' }; });
    }
    function twoActionCurrentThread() {
        if (!beginThreadAction('一键二连中')) return;
        autoRateCurrentThreadRequest().then(function(rr) {
            return favoriteCurrentThreadRequest().then(function(fr) { return { rate: rr, fav: fr }; });
        }).then(function(r) {
            var labels = ['评分：' + r.rate.label, '收藏：' + r.fav.label];
            var type = (r.rate.state === 'error' && r.fav.state === 'error') ? 'error' : null;
            finishThreadAction(labels.join('；'), type);
            if (r.rate.state === 'success') appendTaskLog('rate', '评分成功', r.rate.label);
            if (r.fav.state === 'success') appendTaskLog('fav', '收藏成功', r.fav.label);
        }).catch(function() { finishThreadAction('一键二连失败', 'error'); appendTaskLog('error', '一键二连失败'); });
    }

    // ============ AUTO REPLY ============
    function loadAutoReplyState() { return readJson(CONFIG.AUTO_REPLY_STATE_KEY, { repliedTids: [], sessionCount: 0, lastReplyTime: 0 }); }
    function saveAutoReplyState(s) { writeJson(CONFIG.AUTO_REPLY_STATE_KEY, s); }
    function hasHiddenContent() { var t = document.body.textContent || ''; if (/回复可见|回复后可见|需要回复|回复才可以浏览|如果您要查看本帖隐藏内容请回复|以下内容需要回复才能|本帖隐藏的内容/.test(t)) return true; return !!$all('.locked, .alert_info, [id*="locked"]').some(function(el) { return /回复/.test(textOf(el)); }); }
    function getRandomReply() { var n = 1 + Math.floor(Math.random() * 2); return REPLY_POOL.slice().sort(function() { return Math.random() - 0.5; }).slice(0, n).join('，'); }
    function submitReply(reply, tid, fid, fh) {
        var d = new URLSearchParams(); d.append('formhash', fh); d.append('message', reply); d.append('replysubmit', 'yes'); d.append('modpost', 'on'); d.append('handlekey', 'fastpost');
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, 10000);
        return fetch(ORIGIN + '/forum.php?mod=post&action=reply&fid=' + encodeURIComponent(fid) + '&tid=' + encodeURIComponent(tid) + '&extra=&replysubmit=yes', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': location.href },
            body: d, signal: controller.signal
        }).finally(function() { clearTimeout(timer); }).catch(function() {});
    }
    function runAutoReply() {
        if (!isThreadPage() || !getBool(CONFIG.AUTO_REPLY_KEY, true)) return;
        var tid = getTid(), fid = getFid(); if (fid !== CONFIG.AUTO_REPLY_TARGET_FID || !hasHiddenContent()) return;
        var s = loadAutoReplyState(); if (s.repliedTids.indexOf(tid) !== -1) return;
        if ((s.sessionCount || 0) >= CONFIG.AUTO_REPLY_MAX_PER_SESSION) return;
        if (Date.now() - (s.lastReplyTime || 0) < CONFIG.AUTO_REPLY_COOLDOWN) return;
        getFormhash().then(function(fh) { if (!fh) return; var reply = getRandomReply(); return submitReply(reply, tid, fid, fh).then(function() { s.repliedTids.push(tid); if (s.repliedTids.length > 200) s.repliedTids = s.repliedTids.slice(-200); s.sessionCount = (s.sessionCount || 0) + 1; s.lastReplyTime = Date.now(); saveAutoReplyState(s); toast('已自动回复'); appendTaskLog('reply', '已自动回复', reply); setTimeout(function() { location.reload(); }, 2000); }); });
    }

    // ============ OPEN TABS ============
    function getOpenTabId() { var id = ''; try { id = sessionStorage.getItem(CONFIG.OPEN_TAB_ID_KEY) || ''; } catch(e) {} if (!id) { id = String(Date.now()) + '_' + Math.random().toString(16).slice(2); try { sessionStorage.setItem(CONFIG.OPEN_TAB_ID_KEY, id); } catch(e) {} } return id; }
    function cleanTitle(text) { return String(text || '').replace(/\s+/g, ' ').replace(/\s*[-_].*?色花堂.*$/i, '').trim(); }
    function getThreadTitle() { var el = $('#thread_subject') || $('.ts span') || $('h1'); return cleanTitle(textOf(el) || document.title) || ('tid=' + getTid()); }
    function readOpenRegistry() { return readJson(CONFIG.OPEN_REGISTRY_KEY, {}); }
    function cleanOpenRegistry(reg) { var now = Date.now(); Object.keys(reg).forEach(function(tabId) { var item = reg[tabId]; if (!item || !item.tid || !item.updatedAt || now - item.updatedAt > CONFIG.OPEN_STALE_MS) delete reg[tabId]; }); return reg; }
    function registerCurrentThread() { if (!isThreadPage()) return; var reg = cleanOpenRegistry(readOpenRegistry()); reg[getOpenTabId()] = { tid: getTid(), title: getThreadTitle(), url: ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(getTid()), updatedAt: Date.now() }; writeJson(CONFIG.OPEN_REGISTRY_KEY, reg); setStatusLine('open-count', getOpenThreads().length + ' 个'); }
    function unregisterCurrentThread() { if (!isThreadPage()) return; var reg = readOpenRegistry(); delete reg[getOpenTabId()]; writeJson(CONFIG.OPEN_REGISTRY_KEY, reg); }
    function getOpenThreads() { var reg = cleanOpenRegistry(readOpenRegistry()); writeJson(CONFIG.OPEN_REGISTRY_KEY, reg); var byTid = {}; Object.keys(reg).forEach(function(tabId) { var item = reg[tabId]; if (!item || !item.tid) return; if (!byTid[item.tid] || byTid[item.tid].updatedAt < item.updatedAt) byTid[item.tid] = item; }); return Object.keys(byTid).map(function(tid) { return byTid[tid]; }).sort(function(a, b) { return b.updatedAt - a.updatedAt; }); }
    function initOpenRegistry() { writeJson(CONFIG.OPEN_REGISTRY_KEY, cleanOpenRegistry(readOpenRegistry())); if (isThreadPage()) { registerCurrentThread(); _timers.push(setInterval(registerCurrentThread, CONFIG.OPEN_HEARTBEAT_MS)); window.addEventListener('beforeunload', unregisterCurrentThread); window.addEventListener('pagehide', unregisterCurrentThread); window.addEventListener('unload', unregisterCurrentThread); } _timers.push(setInterval(function() { setStatusLine('open-count', getOpenThreads().length + ' 个'); }, CONFIG.OPEN_HEARTBEAT_MS)); }
    function clearOpenThreadRecords() { writeJson(CONFIG.OPEN_REGISTRY_KEY, {}); setStatusLine('open-count', '0 个'); toast('已清理'); createToolbar(); }
    function removeOpenTid(tid) { var reg = readOpenRegistry(); Object.keys(reg).forEach(function(tabId) { if (reg[tabId] && reg[tabId].tid === tid) delete reg[tabId]; }); writeJson(CONFIG.OPEN_REGISTRY_KEY, reg); }
    function openFavoriteDialog() {
        var threads = getOpenThreads(); if (threads.length === 0) { toast('未检测到打开的帖子'); return; }
        var dlg = createDialog('收藏打开帖子', '680px');
        dlg.body.innerHTML = threads.map(function(item) { return '<div class="shtx-result-row" data-tid="' + escapeHtml(item.tid) + '"><a href="' + escapeHtml(item.url) + '" target="_blank">' + escapeHtml(item.title) + '</a><span class="shtx-status">待收藏</span><button class="shtx-btn shtx-gray" data-tid="' + escapeHtml(item.tid) + '" style="padding:3px 8px;">移除</button></div>'; }).join('');
        $all('.shtx-btn.shtx-gray', dlg.body).forEach(function(btn) { btn.onclick = function() { removeOpenTid(this.getAttribute('data-tid')); var r = this.closest('.shtx-result-row'); if (r) r.remove(); }; });
        var progress = document.createElement('div'); progress.className = 'shtx-status'; dlg.foot.appendChild(progress);
        var startBtn = makeBtn('开始收藏', 'red', function() { batchFavoriteOpened(threads, progress, dlg.root, startBtn); });
        dlg.foot.appendChild(startBtn);
        dlg.foot.appendChild(makeBtn('刷新列表', 'blue', function() { dlg.close(); openFavoriteDialog(); }));
    }
    function batchFavoriteOpened(threads, progress, root, btn) {
        if (btn && btn.disabled) return;
        if (btn) { btn.disabled = true; btn.textContent = '收藏中...'; }
        getFormhash().then(function(fh) { if (!fh) throw new Error('请确认已登录'); var s = 0, e = 0, f = 0;
            function next(i) { if (i >= threads.length) { progress.textContent = '成功 ' + s + '，已收藏 ' + e + '，失败 ' + f; toast('批量收藏完成'); if (btn) { btn.disabled = false; btn.textContent = '开始收藏'; } return; }
                var item = threads[i]; progress.textContent = (i + 1) + '/' + threads.length + '：' + item.title;
                favoriteThread(item.tid, fh).then(function(r) { if (r.state === 'success') { s++; setFavoriteRow(root, item.tid, r.label, '#27ae60'); } else if (r.state === 'exists') { e++; setFavoriteRow(root, item.tid, r.label, '#999'); } else { f++; setFavoriteRow(root, item.tid, r.label, '#e74c3c'); } setTimeout(function() { next(i + 1); }, CONFIG.FAVORITE_DELAY_MS); }); }
            next(0);
        }).catch(function(e) { progress.textContent = e.message || '批量收藏失败'; toast(progress.textContent, 'error'); if (btn) { btn.disabled = false; btn.textContent = '重新开始'; } });
    }
    function setFavoriteRow(root, tid, text, color) { var el = root.querySelector('.shtx-result-row[data-tid="' + tid + '"] .shtx-status'); if (!el) return; el.textContent = text; el.style.color = color || '#777'; }

    // ============ SEARCH & EXPORT ============
    function buildListPageUrl(page) { if (isFavoritePage()) return ORIGIN + '/home.php?mod=space&uid=' + encodeURIComponent(getUid()) + '&do=favorite&view=me&page=' + page; var url = new URL(location.href); url.searchParams.set('page', page); return url.href; }
    function openSearchDialog() {
        var dlg = createDialog(isFavoritePage() ? '收藏搜索' : '主题搜索', '720px');
        $('.shtx-close', dlg.root).onclick = function() { STATE.searchCancelled = true; dlg.close(); };
        dlg.body.innerHTML = '<div class="shtx-row"><label>关键词：</label><input id="shtx-search-kw" class="shtx-input" style="flex:1;" placeholder="输入搜索关键词"></div>' +
            '<div class="shtx-row"><label>页码范围：</label><input id="shtx-search-start" class="shtx-input" type="number" min="1" value="1" style="width:64px;">至<input id="shtx-search-end" class="shtx-input" type="number" min="1" value="' + (STATE.listMaxPage || CONFIG.ALL_PAGES) + '" style="width:64px;"></div>' +
            '<div id="shtx-search-results" style="min-height:100px;"><div style="text-align:center;padding:30px;color:#ccc;font-size:13px;">输入关键词和页码范围后点击开始搜索</div></div>';
        var footer = document.createElement('div'); footer.className = 'shtx-status'; dlg.foot.appendChild(footer);
        var startBtn = makeBtn('开始搜索', 'red', function() {
            var kw = $('#shtx-search-kw').value.trim(); var s = parseInt($('#shtx-search-start').value, 10) || 1; var e = parseInt($('#shtx-search-end').value, 10) || STATE.listMaxPage || CONFIG.ALL_PAGES;
            if (!kw) { toast('请输入关键词'); return; } if (s > e) { var t = s; s = e; e = t; }
            runSearch(kw, s, e, $('#shtx-search-results'), footer, startBtn);
        });
        dlg.foot.appendChild(startBtn);
        dlg.foot.appendChild(makeBtn('取消', 'gray', function() { STATE.searchCancelled = true; dlg.close(); }));
    }
    function runSearch(kw, start, end, div, footer, btn) {
        STATE.searchCancelled = false; btn.disabled = true; btn.textContent = '搜索中...'; div.innerHTML = '';
        var total = 0, kwLower = kw.toLowerCase();
        function page(p) {
            if (p > end || STATE.searchCancelled) { footer.textContent = STATE.searchCancelled ? '已取消，共' + total + '个' : '完成，共' + total + '个匹配'; btn.disabled = false; btn.textContent = '开始搜索'; return; }
            footer.textContent = '搜索第 ' + p + ' 页...';
            fetch(buildListPageUrl(p), { credentials: 'include' }).then(function(r) { return r.text(); }).then(function(html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                getThreadsWithLinks(doc).forEach(function(t) { if (t.title.toLowerCase().indexOf(kwLower) === -1) return; total++;
                    var row = document.createElement('div'); row.className = 'shtx-result-row';
                    row.innerHTML = '<a target="_blank" href="' + ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(t.tid) + '">' + highlightKeyword(t.title, kw) + '</a><span class="shtx-status">第' + p + '页</span>';
                    div.appendChild(row);
                });
                footer.textContent = '已搜 ' + (p - start + 1) + '/' + (end - start + 1) + ' 页，共' + total + '个';
            }).catch(function() {}).then(function() { setTimeout(function() { page(p + 1); }, 120); });
        }
        page(start);
    }
    function highlightKeyword(text, kw) { return escapeHtml(text).replace(new RegExp('(' + escapeRegExp(escapeHtml(kw)) + ')', 'gi'), '<span style="background:#ffd54f;padding:0 2px;">$1</span>'); }

    function openExportDialog() {
        refreshThreads(); var threads = getThreadsWithLinks(document); if (threads.length === 0) { toast('当前页没有主题'); return; }
        var dlg = createDialog('导出资源链接', '520px');
        dlg.body.innerHTML = '<div class="shtx-settings-note">将打开每个帖子提取 ed2k/magnet 链接并下载解析 txt/zip 附件。文本附件 &le;2MB，ZIP &le;20MB。r ar/ 7z 会标记为未解析。</div>' +
            '<div class="shtx-status">当前页 ' + threads.length + ' 个主题</div>';
        var progress = document.createElement('div'); progress.className = 'shtx-status'; dlg.foot.appendChild(progress);
        var cancelled = false;
        var startBtn = makeBtn('导出 CSV', 'green', function() {
            if (startBtn.disabled) return; startBtn.disabled = true; startBtn.textContent = '导出中...';
            runExport(threads, progress, function(text) {
                var ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                downloadAsFile(text, 'sehuatang_export_' + ts + '.csv', 'text/csv;charset=utf-8');
                progress.textContent = '已完成'; startBtn.textContent = '已完成';
            }, function() { return cancelled; });
        });
        dlg.foot.appendChild(startBtn);
        dlg.foot.appendChild(makeBtn('停止', 'gray', function() { cancelled = true; }));
    }

    function extractResourceLinks(tid, title) {
        var url = ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid);
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, CONFIG.ATTACH_TIMEOUT_MS);
        return fetch(url, { credentials: 'include', signal: controller.signal }).then(function(r) {
            return r.text();
        }).then(function(html) {
            clearTimeout(timer);
            return extractResourcesFromHtml(html, tid, title);
        }).catch(function(e) {
            clearTimeout(timer);
            return { title: title, tid: tid, url: url, links: [], attachments: [], exportOk: false, errors: ['页面加载失败: ' + (e.name === 'AbortError' ? '超时' : (e.message || ''))] };
        });
    }

    function extractResourcesFromHtml(html, tid, title) {
        var r = { title: title, tid: tid, url: ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid), links: [], attachments: [], exportOk: true, errors: [] };
        var match;
        var cleanHtml = html.replace(/&#124;/g, '|').replace(/%7C/g, '|');
        var er = /ed2k:\/\/\|file\|[^\n\r"<>]+/gi;
        while ((match = er.exec(cleanHtml)) !== null) addUniqueLink(r.links, match[0].replace(/&amp;/g, '&').trim(), 'ED2K', '正文');
        var mr = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}[^\s"<>]*/gi;
        while ((match = mr.exec(cleanHtml)) !== null) addUniqueLink(r.links, match[0].replace(/&amp;/g, '&').trim(), 'Magnet', '正文');
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var attachLinks = doc.querySelectorAll('a[href*="mod=attachment"], a[href*="aid="]');
        var sa = {};
        if (!attachLinks.length) {
            var ar = /<a[^>]*href\s*=\s*["']([^"']*(?:mod=attachment|aid=\d+)[^"']*)["'][^>]*>([^<]*)<\/a>/gi;
            var rm;
            while ((rm = ar.exec(html)) !== null) {
                var hrf = rm[1].replace(/&amp;/g, '&');
                var fu2; try { fu2 = new URL(hrf, ORIGIN).href; } catch(e2) { fu2 = ORIGIN + '/' + hrf.replace(/^\//, ''); }
                if (sa[fu2]) continue; sa[fu2] = true;
                var aname = rm[2].replace(/\s+/g, ' ').trim();
                if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(aname)) continue;
                r.attachments.push({ url: fu2, name: aname || '附件', status: 'pending' });
            }
            return r;
        }
        each(attachLinks, function(a) {
            var rawHref = (a.href || a.getAttribute('href') || '').replace(/&amp;/g, '&');
            if (!/forum\.php\?mod=attachment/i.test(rawHref)) return;
            var fu = /^https?:\/\//i.test(rawHref) ? rawHref : (ORIGIN + '/' + rawHref.replace(/^\//, ''));
            if (sa[fu]) return; sa[fu] = true;
            var name = (a.textContent || a.innerText || '').replace(/\s+/g, ' ').trim();
            if (!name || name === '附件' || name === '下载附件') {
                var parent = a.closest('dl, p, span, div, td');
                if (parent) {
                    var parentText = (parent.textContent || parent.innerText || '').replace(/\s+/g, ' ').trim();
                    var extMatch = parentText.match(/(\S+\.(txt|url|zip|rar|7z))/i);
                    if (extMatch) name = extMatch[1];
                    if (!name || name === a.textContent.trim()) {
                        var before = parentText.substring(0, parentText.indexOf(a.textContent.trim()));
                        var beforeMatch = before.match(/(\S+\.\w{2,4})\s*$/);
                        if (beforeMatch) name = beforeMatch[1];
                    }
                }
            }
            if (!name || name === '附件') name = a.getAttribute('title') || '';
            if (!name || name === '附件') name = '附件';
            if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) return;
            r.attachments.push({ url: fu, name: name, status: 'pending' });
        });
        return r;
    }

    function parseAttachment(attachment, onProgress) {
        var name = (attachment.name || '').toLowerCase();
        var isText = /\.(txt|url)$/i.test(name);
        var isZip = /\.zip$/i.test(name);
        var isUnsupported = /\.(rar|7z)$/i.test(name);
        var isUnknown = !isText && !isZip && !isUnsupported;
        if (isUnsupported) { attachment.status = 'unsupported'; attachment.error = '格式不支持'; return Promise.resolve({ ok: false, reason: 'unsupported' }); }
        var maxSize = isZip || isUnknown ? CONFIG.ATTACH_ZIP_MAX : CONFIG.ATTACH_TEXT_MAX;
        return downloadWithCheck(attachment.url, maxSize, function(size) {
            onProgress('下载 ' + name + ' ' + formatSize(size));
        }).then(function(result) {
            if (!result.blob) { attachment.status = 'error'; attachment.error = result.error || '下载失败'; return { ok: false, reason: 'download' }; }
            if (result.filename && isUnknown) {
                var newName = result.filename.toLowerCase();
                isText = /\.(txt|url)$/i.test(newName);
                isZip = /\.zip$/i.test(newName);
                isUnsupported = /\.(rar|7z)$/i.test(newName);
                if (isText || isZip || isUnsupported) { attachment.name = result.filename; name = newName; }
            }
            if (isUnknown && result.contentType) {
                var ct = result.contentType.toLowerCase();
                if (/text\/|json|xml|javascript|x-www-form-urlencoded/.test(ct)) isText = true;
                else if (/zip|compressed/.test(ct)) isZip = true;
            }
            if (isUnsupported) { attachment.status = 'unsupported'; attachment.error = '格式不支持'; return { ok: false, reason: 'unsupported' }; }
            if (isText) return parseTextContent(result.blob, attachment.name).then(function(links) {
                attachment.links = links;
                if (!links.length) {
                    attachment.status = 'no-links'; attachment.error = '未识别到资源链接';
                    return { ok: false, reason: 'no-links', links: [] };
                }
                attachment.status = 'parsed'; return { ok: true, links: links, source: '附件: ' + attachment.name };
            });
            if (isZip) return parseZipContent(result.blob, attachment.name, onProgress).then(function(zr) {
                var links = zr.links || []; var errors = zr.errors || [];
                attachment.status = errors.length ? 'error' : 'parsed'; attachment.links = links;
                if (errors.length) attachment.error = '无法读取: ' + errors.join(', ');
                if (!errors.length && !links.length) { attachment.status = 'no-links'; attachment.error = '未识别到资源链接'; return { ok: false, reason: 'no-links', links: [] }; }
                return { ok: !errors.length, links: links, source: '压缩包: ' + attachment.name };
            }).catch(function(e) {
                attachment.status = 'error'; attachment.error = e.message || '解压失败'; return { ok: false, reason: 'zip-error' };
            });
            if (result.blob.size <= CONFIG.ATTACH_TEXT_MAX) {
                return parseTextContent(result.blob, attachment.name).then(function(links) {
                    attachment.links = links;
                    if (links.length) {
                        attachment.status = 'parsed';
                        attachment.error = '';
                        return { ok: true, links: links, source: '附件: ' + attachment.name + '（按文本识别）' };
                    }
                    attachment.status = 'no-links';
                    attachment.error = '未知附件格式或未识别到资源链接';
                    return { ok: false, reason: 'no-links', links: [] };
                });
            }
            attachment.status = 'skipped'; attachment.error = '未知附件格式';
            return { ok: false, reason: 'skipped' };
        });
    }

    function downloadWithCheck(url, maxSize, onSize) {
        return new Promise(function(resolve) {
            if (typeof GM_xmlhttpRequest !== 'function') {
                resolve({ blob: null, error: 'GM_xmlhttpRequest不可用' }); return;
            }
            var buffer = null, totalSize = 0;
            var timedOut = false;
            var timer = setTimeout(function() {
                timedOut = true;
                resolve({ blob: null, error: '下载超时' });
            }, CONFIG.ATTACH_TIMEOUT_MS);
            GM_xmlhttpRequest({
                method: 'GET', url: url, responseType: 'arraybuffer',
                timeout: CONFIG.ATTACH_TIMEOUT_MS, anonymous: false,
                headers: { 'Referer': location.href, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' },
                onload: function(resp) {
                    if (timedOut) return; clearTimeout(timer);
                    if (resp.status === 401 || resp.status === 403) { resolve({ blob: null, error: '权限不足' }); return; }
                    if (resp.status < 200 || resp.status >= 300) { resolve({ blob: null, error: 'HTTP ' + resp.status }); return; }
                    buffer = resp.response;
                    if (!buffer || buffer.byteLength === 0) { resolve({ blob: null, error: '空内容' }); return; }
                    if (buffer.byteLength > maxSize) { resolve({ blob: null, error: '附件过大' }); return; }
                    var contentType = (resp.responseHeaders || '').match(/content-type:\s*([^\r\n]+)/i);
                    var ct = contentType ? contentType[1] : '';
                    if (ct.indexOf('text/html') !== -1 && resp.finalUrl && resp.finalUrl.indexOf('login') !== -1) {
                        resolve({ blob: null, error: '需要登录' }); return;
                    }
                    var disposition = (resp.responseHeaders || '').match(/content-disposition:\s*([^\r\n]+)/i);
                    var cdName = '';
                    if (disposition) {
                        var cdText = disposition[1];
                        var cdStar = cdText.match(/filename\*\s*=\s*(?:UTF-8''|GBK''|GB2312'')?([^;\n]+)/i);
                        var cdMatch = cdText.match(/filename\s*=\s*['"]?([^'"\n;]*)['"]?/i);
                        cdName = cdStar ? cdStar[1] : (cdMatch ? cdMatch[1] : '');
                        cdName = cdName.replace(/["']/g, '').trim();
                        try { cdName = decodeURIComponent(cdName); } catch(e) {}
                    }
                    var blob = new Blob([buffer]);
                    resolve({ blob: blob, error: '', filename: cdName, contentType: ct, finalUrl: resp.finalUrl || url });
                },
                onerror: function() { if (!timedOut) { clearTimeout(timer); resolve({ blob: null, error: '网络错误' }); } },
                ontimeout: function() { if (!timedOut) { clearTimeout(timer); timedOut = true; resolve({ blob: null, error: '下载超时' }); } },
                onprogress: function(e) { if (onSize && e.lengthComputable) onSize(e.loaded); }
            });
        });
    }

    function parseTextContent(blob, sourceName) {
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function() { resolve(extractLinksFromText(reader.result, sourceName)); };
            reader.onerror = function() { resolve([]); };
            reader.readAsText(blob);
        });
    }

    function extractLinksFromText(text, sourceName) {
        var links = [], match;
        var er = /ed2k:\/\/\|file\|[^\n\r<>"]+/gi;
        while ((match = er.exec(text)) !== null) addUniqueLink(links, match[0].trim(), 'ED2K', sourceName);
        var mr = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}[^\s"<>]*/gi;
        while ((match = mr.exec(text)) !== null) addUniqueLink(links, match[0].trim(), 'Magnet', sourceName);
        return links;
    }

    function parseZipContent(blob, zipName, onProgress) {
        return new Promise(function(resolve, reject) {
            if (typeof JSZip === 'undefined') { reject(new Error('JSZip未加载')); return; }
            if (blob.size > CONFIG.ATTACH_ZIP_MAX) { reject(new Error('ZIP过大')); return; }
            JSZip.loadAsync(blob).then(function(zip) {
                var textExts = /\.(txt|url|html|htm|nfo|md)$/i;
                var files = [];
                zip.forEach(function(relativePath, file) {
                    if (!file.dir && textExts.test(file.name)) files.push(file);
                });
                if (!files.length) { resolve({ links: [], errors: [] }); return; }
                var links = [], zipErrors = [];
                function next(i) {
                    if (i >= files.length) { resolve({ links: links, errors: zipErrors }); return; }
                    var f = files[i];
                    if (onProgress) onProgress('解压 ' + f.name);
                    f.async('text').then(function(content) {
                        var source = zipName + '/' + f.name;
                        links = links.concat(extractLinksFromText(content, source));
                        next(i + 1);
                    }).catch(function() {
                        zipErrors.push(f.name);
                        next(i + 1);
                    });
                }
                next(0);
            }).catch(function(e) { reject(new Error('ZIP解压失败')); });
        });
    }

    function addUniqueLink(list, url, type, source) {
        if (!url) return;
        for (var i = 0; i < list.length; i++) { if (list[i].url === url) return; }
        list.push({ type: type, url: url, source: source || '正文' });
    }

    function csvEscape(value) {
        return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    }

    function addUniqueError(list, message) {
        if (!message) return;
        if (list.indexOf(message) === -1) list.push(message);
    }

    function attachmentFailureReason(a) {
        if (!a) return '附件解析失败';
        if (a.error) return a.error;
        if (a.status === 'unsupported') return '格式不支持';
        if (a.status === 'skipped') return '未知附件格式';
        if (a.status === 'no-links') return '未识别到资源链接';
        if (a.status === 'pending') return '未完成解析';
        if (a.status === 'error') return '解析失败';
        return '';
    }

    function finalizeExportResult(r) {
        r.links = r.links || [];
        r.attachments = r.attachments || [];
        r.errors = r.errors || [];
        r.unresolvedAttachments = [];
        r.attachments.forEach(function(a) {
            if (a.status === 'parsed') return;
            var reason = attachmentFailureReason(a);
            r.unresolvedAttachments.push({ name: a.name || '附件', url: a.url || '', status: a.status || 'unknown', error: reason });
        });
        if (!r.links.length) addUniqueError(r.errors, '未导出资源链接');
        if (r.unresolvedAttachments.length) addUniqueError(r.errors, '存在未完整解析的附件');
        r.exportOk = r.links.length > 0 && r.errors.length === 0 && r.unresolvedAttachments.length === 0;
        return r;
    }

    function formatResources(results) {
        var lines = ['帖子名称,资源链接,状态,来源,说明'];
        results.forEach(function(r) {
            if (r.links && r.links.length) {
                r.links.forEach(function(l) {
                    lines.push([csvEscape(r.title), csvEscape(l.url), csvEscape('成功'), csvEscape(l.source || l.type || '正文'), csvEscape('')].join(','));
                });
            }
            if (r.unresolvedAttachments && r.unresolvedAttachments.length) {
                r.unresolvedAttachments.forEach(function(a) {
                    lines.push([csvEscape(r.title), csvEscape(a.url || ''), csvEscape('导出失败'), csvEscape('附件: ' + a.name), csvEscape(a.error || '附件未完整解析')].join(','));
                });
            }
            if (r.errors && r.errors.length) {
                r.errors.forEach(function(e) {
                    lines.push([csvEscape(r.title), csvEscape(''), csvEscape('导出失败'), csvEscape('帖子'), csvEscape(e)].join(','));
                });
            }
        });
        return '﻿' + lines.join('\n');
    }

    function runExport(threads, progress, done, isCancelled) {
        var results = [], nextIndex = 0, finished = 0, stopped = false;
        var parseQueue = [], parsing = 0;
        function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
        function runParseQueue() {
            while (parsing < CONFIG.ATTACH_PARSE_CONCURRENCY && parseQueue.length > 0) {
                (function(item) {
                    parsing++;
                    var done = false;
                    var tid = setTimeout(function() {
                        if (done) return;
                        done = true; parsing--; item.att.status = 'error'; item.att.error = '解析超时'; runParseQueue();
                    }, CONFIG.ATTACH_TIMEOUT_MS);
                    parseAttachment(item.att, function(msg) { progress.textContent = msg; }).then(function(result) {
                        if (done) return;
                        done = true; clearTimeout(tid);
                        if (result.links) {
                            result.links.forEach(function(l) { addUniqueLink(item.result.links, l.url, l.type, l.source); });
                        }
                        parsing--; runParseQueue();
                    });
                })(parseQueue.shift());
            }
        }
        function worker() {
            if (stopped || isCancelled()) { stopped = true; return Promise.resolve(); }
            var i = nextIndex++; if (i >= threads.length) return Promise.resolve();
            var start = Date.now();
            progress.textContent = '帖子 ' + (finished + 1) + '/' + threads.length + '：' + threads[i].title.substring(0, 40);
            return extractResourceLinks(threads[i].tid, threads[i].title).then(function(r) {
                results[i] = r; finished++;
                if (r.attachments && r.attachments.length) {
                    r.attachments.forEach(function(att) { parseQueue.push({ result: r, att: att }); });
                    runParseQueue();
                }
            }).then(function() {
                return wait(Math.max(0, CONFIG.EXPORT_DELAY_MS - (Date.now() - start)));
            }).then(worker);
        }
        var count = Math.min(CONFIG.EXPORT_CONCURRENCY, threads.length);
        Promise.all(Array.from({ length: count }, worker)).then(function() {
            var pollStart = Date.now();
            function pollParse() {
                if (stopped || isCancelled()) { progress.textContent = '已停止'; return; }
                if (parseQueue.length > 0 || parsing > 0) {
                    if (Date.now() - pollStart > 60000) {
                        parseQueue.length = 0; parsing = 0;
                        progress.textContent = '附件解析超时，正在生成文件...';
                    } else { setTimeout(pollParse, 200); return; }
                }
                var finalResults = results.filter(Boolean).map(finalizeExportResult);
                var okCount = finalResults.filter(function(r) { return r.exportOk; }).length;
                var failCount = finalResults.length - okCount;
                done(formatResources(finalResults));
                appendTaskLog('export', '导出完成', '成功 ' + okCount + '，失败 ' + failCount);
            }
            pollParse();
        });
    }

    // ============ MUTATION OBSERVER ============
    function startMutationObserver() {
        if (!window.MutationObserver) return;
        if (_observer) _observer.disconnect();
        var timer = null;
        _observer = new MutationObserver(function(muts) {
            if (document.hidden) return;
            var rel = false; for (var i = 0; i < muts.length; i++) { if (Array.prototype.slice.call(muts[i].addedNodes || []).some(function(n) { return n && n.nodeType === 1 && !isInsideToolUi(n); })) { rel = true; break; } } if (!rel) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function() { timer = null; if (isPreviewToolPage()) scheduleRefresh(); if (isThreadPage()) scheduleThreadEnhancements(); if (isSearchResultPage()) applySearchFilter(); }, 700);
        });
        _observer.observe(document.body, { childList: true, subtree: true });
    }

    // ============ CLEANUP ============
    function cleanup() {
        ['sht-open-fav-panel', 'sht-progressive-image-loader-panel', 'sht-toolbar', 'sht-user-thread-toolbar'].forEach(function(id) { var el = document.getElementById(id); if (el && el.parentNode) el.parentNode.removeChild(el); });
        $all('.sht-preview-container, .sht-user-thread-preview').forEach(function(el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    }

    // ============ INIT ============
    var _timers = [];
    var _observer = null;
    var _storageDebounce = 0;

    function pauseAll() {
        _timers.forEach(function(t) { clearInterval(t); });
        _timers = [];
        if (_observer) { _observer.disconnect(); _observer = null; }
    }
    function resumeAll() {
        if (!isThreadPage()) return;
        _timers.push(setInterval(registerCurrentThread, CONFIG.OPEN_HEARTBEAT_MS));
        _timers.push(setInterval(function() { setStatusLine('open-count', getOpenThreads().length + ' 个'); }, CONFIG.OPEN_HEARTBEAT_MS));
        startMutationObserver();
    }

    function init() {
        addStyle(); cleanup(); initOpenRegistry(); initListTools(); applySearchFilter(); createToolbar();
        initThreadEnhancements(); initAutoSign(false); initAutoPagination(); startMutationObserver();
        if (isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID && getBool(CONFIG.AUTO_REPLY_KEY, true)) setTimeout(runAutoReply, 1200);
        if (typeof GM_registerMenuCommand === 'function') {
            try { GM_registerMenuCommand('收藏打开的帖子页', openFavoriteDialog); } catch(e) {}
        }
        migrateLegacyKeys();

        document.addEventListener('visibilitychange', function() {
            if (document.hidden) { pauseAll(); }
            else { resumeAll(); registerCurrentThread(); }
        });
        window.addEventListener('storage', function(e) {
            if (e.key !== CONFIG.OPEN_REGISTRY_KEY) return;
            var now = Date.now();
            if (now - _storageDebounce < 500) return;
            _storageDebounce = now;
            var bar = $('#shtx-toolbar');
            if (bar) { setStatusLine('open-count', getOpenThreads().length + ' 个'); return; }
            createToolbar();
        });
    }

    function migrateLegacyKeys() {
        var migrations = [
            ['sht_user_thread_auto_preview', CONFIG.AUTO_PREVIEW_KEY],
        ];
        migrations.forEach(function(pair) {
            var oldVal = localStorage.getItem(pair[0]);
            if (oldVal !== null && localStorage.getItem(pair[1]) === null) {
                localStorage.setItem(pair[1], oldVal);
            }
        });
        var persisted = { img: 'sht_preview_img_count', dist: 'sht_scroll_threshold', cd: 'sht_reply_cooldown', max: 'sht_reply_max' };
        var img = parseInt(localStorage.getItem(persisted.img), 10); if (img >= 3 && img <= 8) CONFIG.MAX_IMAGES = img;
        var dist = parseInt(localStorage.getItem(persisted.dist), 10); if (dist >= 100 && dist <= 2000) CONFIG.AUTO_SCROLL_THRESHOLD = dist;
        var cd = parseInt(localStorage.getItem(persisted.cd), 10); if (cd >= 10000 && cd <= 300000) CONFIG.AUTO_REPLY_COOLDOWN = cd;
        var max = parseInt(localStorage.getItem(persisted.max), 10); if (max >= 1 && max <= 50) CONFIG.AUTO_REPLY_MAX_PER_SESSION = max;
    }

    setTimeout(init, 500);
})();
