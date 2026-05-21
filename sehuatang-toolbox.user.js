// ==UserScript==
// @name         色花堂工具箱
// @namespace    https://sehuatang.net/
// @version      1.0.0
// @description  自动签到、无缝翻页、图片预览、板块筛选、帖子操作、自动回复、批量收藏、资源导出
// @author       米波
// @match        https://sehuatang.net/*
// @match        https://www.sehuatang.net/*
// @match        https://sehuatang.org/*
// @match        https://www.sehuatang.org/*
// @grant        GM_registerMenuCommand
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
        AUTO_PREVIEW_KEY: 'sht_auto_preview',
        SEARCH_FILTER_VISIBLE_FIDS_KEY: 'sht_search_filter_visible_fids',
        SEARCH_FILTER_SHOW_UNKNOWN_KEY: 'sht_search_filter_show_unknown',
        SEARCH_FILTER_EXCLUDE_KEYWORDS_KEY: 'sht_search_filter_exclude_keywords',
        THREAD_IMAGES_SHOWN_KEY: 'sht_thread_images_shown',
        TOOLBAR_COLLAPSED_KEY: 'sht_toolbar_collapsed',
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
        if (isSpacePage()) return '#delform';
        if (isMySpacePage()) return '#threadlist';
        if (isMyfavoritePage()) return '#favorite_ul';
        if (isFavoritePage() || isUserThreadPage()) return '#threadlist';
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
            '.shtx-toolbar{position:fixed;top:50%;left:0;z-index:99999;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;padding:12px 10px;background:#f8f9fa;border:1px solid #dee2e6;border-left:0;border-radius:0 8px 8px 0;box-shadow:2px 2px 10px rgba(0,0,0,0.15);max-width:200px;font:12px/1.4 Arial,"Microsoft YaHei",sans-serif;color:#555;}' +
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
            '.shtx-filter-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:6px 10px;margin:8px 0 10px;}' +
            '.shtx-filter-item{display:flex;align-items:center;gap:6px;color:#333;font-size:12px;white-space:nowrap;}' +
            '.shtx-filter-item input{accent-color:#e74c3c;}' +
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

    function getPageTypeLabel() {
        if (isSiteHomeIndexPage()) return '首页'; if (isFavoritePage()) return '收藏页';
        if (isUserThreadPage()) return '用户主题页'; if (isThreadPage()) return '帖子页';
        if (isSearchResultPage()) return '搜索页'; if (isForumDisplayPage()) return '板块页';
        return '普通页面';
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
        bar.id = 'shtx-toolbar'; bar.className = 'shtx-toolbar' + (getBool(CONFIG.TOOLBAR_COLLAPSED_KEY, false) ? ' shtx-collapsed' : '');

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

        var body = document.createElement('div'); body.className = 'shtx-toolbar-body';
        var commonAdded = false;
        function ensureCommon() { if (!commonAdded) { appendSection(body, '常用操作'); commonAdded = true; } }

        if (hasPreviewTool) { ensureCommon(); body.appendChild(makeBtn(getPreviewToggleText(), 'blue', togglePreviewPanel)); }
        if (isSearchResultPage()) { ensureCommon(); body.appendChild(makeBtn('搜索筛选', 'green', openSearchFilterDialog)); }
        if (hasListTool) {
            body.appendChild(makeBtn('加载后一页', 'green', function() { loadNextPage(false); }));
            body.appendChild(makeBtn(isFavoritePage() ? '搜全部收藏' : '搜全部主题', 'blue', openSearchDialog));
            body.appendChild(makeBtn('导出资源', 'green', openExportDialog));
        } else if (hasNextTool) {
            ensureCommon(); body.appendChild(makeBtn('加载后一页', 'green', function() { loadNextPage(false); }));
        }
        if (hasThreadTool) {
            ensureCommon();
            body.appendChild(makeBtn('快速发帖', 'green', openFastPost));
            body.appendChild(makeBtn('快速回复', 'green', openFastReply));
            body.appendChild(makeBtn('复制全部代码', 'blue', copyAllCodeBlocks));
            body.appendChild(makeBtn('复制帖子', 'blue', copyCurrentPostContent));
            body.appendChild(makeBtn('下载附件', 'green', openAttachmentDialog));
            body.appendChild(makeBtn(getPostImageToggleText(), 'orange', togglePostImages));
            body.appendChild(makeBtn('收藏本帖', 'blue', favoriteCurrentThread));
            body.appendChild(makeBtn('评分', 'orange', rateCurrentThread));
            body.appendChild(makeBtn('一键二连', 'red', twoActionCurrentThread));
            body.appendChild(makeBtn('查看评分', 'gray', openViewRatings));
            body.appendChild(makeBtn('购买记录', 'gray', openPayLog));
        }
        if (hasOpenTool) {
            ensureCommon();
            body.appendChild(makeBtn('收藏打开帖子', 'red', openFavoriteDialog));
            body.appendChild(makeBtn('清理打开记录', 'gray', clearOpenThreadRecords));
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

        var pageSec = appendSettingsSection(dlg.body, '无缝翻页');
        appendSwitch(pageSec, '自动加载后一页', '滚动接近页面底部时自动加载下一页', getBool(CONFIG.AUTO_PAGINATION_KEY, true), function(v) {
            setBool(CONFIG.AUTO_PAGINATION_KEY, v);
            if (v) initAutoPagination();
            createToolbar();
        });

        if (isSearchResultPage()) {
            var filterSec = appendSettingsSection(dlg.body, '板块筛选');
            filterSec.appendChild(makeBtn('打开板块筛选', 'blue', openSearchFilterDialog));
        }

        var threadSec = appendSettingsSection(dlg.body, '帖子页');
        appendSwitch(threadSec, '自动回复', '原创自拍区检测到回复可见时自动回复', getBool(CONFIG.AUTO_REPLY_KEY, true), function(v) {
            setBool(CONFIG.AUTO_REPLY_KEY, v); createToolbar();
            if (v && isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID) runAutoReply();
        });

        dlg.foot.textContent = '设置立即保存并生效';
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
            if (r.ok) { var s = rememberSignSuccess(r.message); STATE.signMessage = '已签到'; if (manual) toast(r.message + '，连续' + s.signStreak + '天'); }
            else { rememberSignFailure(r.message); STATE.signMessage = r.message; toast(r.message, 'error'); }
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
        return height - (top + window.innerHeight) < 500;
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
        $all('.shtx-preview-container').forEach(function(el) { el.style.display = visible ? '' : 'none'; });
    }
    function fetchImages(tid) {
        return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid), { credentials: 'include' })
            .then(function(r) { return r.text(); }).then(extractImageUrls).catch(function() { return []; });
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
        var pending = STATE.threads.filter(function(t) { var a = getPreviewMountNode(t.link); return a && !getPreviewContainerForAnchor(a, t.tid); });
        if (pending.length === 0) { STATE.previewRunning = false; return Promise.resolve(); }
        function batch(i) {
            if (i >= pending.length) { STATE.previewRunning = false; dedupePreviewContainers(); return Promise.resolve(); }
            setStatusLine('preview', '加载 ' + Math.min(i + CONFIG.PREVIEW_CONCURRENCY, pending.length) + '/' + pending.length);
            return Promise.all(pending.slice(i, i + CONFIG.PREVIEW_CONCURRENCY).map(function(t) { return fetchImages(t.tid).then(function(urls) { renderPreview(t, urls); }); })).then(function() { return batch(i + CONFIG.PREVIEW_CONCURRENCY); });
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
            pairs.push({ tid: tid, node: node, fid: getSearchItemFid(node), visible: true });
        });
        return pairs;
    }
    function applySearchFilter() {
        if (!isSearchResultPage()) return;
        var vf = getVisibleSearchFids(), su = getBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, true), kw = getSearchExcludeKeywords();
        getSearchResultItems().forEach(function(item) {
            var v = item.fid ? vf.indexOf(String(item.fid)) !== -1 : su;
            if (v && kw.length) {
                var text = textOf(item.node).toLowerCase();
                v = !kw.some(function(word) { return text.indexOf(word.toLowerCase()) !== -1; });
            }
            item.visible = v; if (item.node) item.node.style.display = v ? '' : 'none';
        });
    }
    function getSearchFilterStatusText() {
        if (!isSearchResultPage()) return '非搜索页';
        var items = getSearchResultItems(), vf = getVisibleSearchFids(), su = getBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, true), kw = getSearchExcludeKeywords();
        var v = items.filter(function(it) {
            var show = it.fid ? vf.indexOf(String(it.fid)) !== -1 : su;
            if (show && kw.length) {
                var text = textOf(it.node).toLowerCase();
                show = !kw.some(function(word) { return text.indexOf(word.toLowerCase()) !== -1; });
            }
            return show;
        }).length;
        return v + '/' + items.length + ' 显示';
    }
    function openSearchFilterDialog() {
        var dlg = createDialog('板块筛选', '760px');
        var vf = getVisibleSearchFids(), vm = {}; vf.forEach(function(f) { vm[String(f)] = true; });
        var su = getBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, true), items = siteItems(), words = getSearchExcludeKeywords();
        dlg.body.innerHTML = '<div class="shtx-settings-note">勾选要显示的板块，并可按关键词排除搜索结果；每行一个关键词。</div>' +
            '<div class="shtx-row"><button class="shtx-btn shtx-blue" id="shtx-filter-all">全选</button><button class="shtx-btn shtx-gray" id="shtx-filter-none">全不选</button>' +
            '<label class="shtx-filter-item"><input id="shtx-filter-unknown" type="checkbox"' + (su ? ' checked' : '') + '>显示未识别板块</label></div>' +
            '<div class="shtx-filter-grid">' + items.map(function(it) { return '<label class="shtx-filter-item"><input class="shtx-filter-fid" value="' + escapeHtml(it.fid) + '"' + (vm[it.fid] ? ' checked' : '') + '>' + escapeHtml(it.name) + '</label>'; }).join('') + '</div>' +
            '<label class="shtx-settings-note" for="shtx-filter-keywords">排除关键字</label><textarea id="shtx-filter-keywords" class="shtx-textarea" placeholder="每行一个关键词">' + escapeHtml(words.join('\n')) + '</textarea>';
        function apply() {
            var sel = $all('.shtx-filter-fid:checked', dlg.body).map(function(inp) { return inp.value; });
            saveVisibleSearchFids(sel); setBool(CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY, !!$('#shtx-filter-unknown', dlg.body).checked);
            saveSearchExcludeKeywords(($('#shtx-filter-keywords', dlg.body).value || '').split(/\r?\n/));
            applySearchFilter(); createToolbar();
        }
        $all('.shtx-filter-fid', dlg.body).forEach(function(inp) { inp.addEventListener('change', apply); });
        $('#shtx-filter-unknown', dlg.body).addEventListener('change', apply);
        $('#shtx-filter-keywords', dlg.body).addEventListener('input', apply);
        $('#shtx-filter-all', dlg.body).onclick = function() { $all('.shtx-filter-fid', dlg.body).forEach(function(inp) { inp.checked = true; }); apply(); };
        $('#shtx-filter-none', dlg.body).onclick = function() { $all('.shtx-filter-fid', dlg.body).forEach(function(inp) { inp.checked = false; }); apply(); };
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
        }).catch(function() { finishThreadAction('一键二连失败', 'error'); });
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
        getFormhash().then(function(fh) { if (!fh) return; var reply = getRandomReply(); return submitReply(reply, tid, fid, fh).then(function() { s.repliedTids.push(tid); if (s.repliedTids.length > 200) s.repliedTids = s.repliedTids.slice(-200); s.sessionCount = (s.sessionCount || 0) + 1; s.lastReplyTime = Date.now(); saveAutoReplyState(s); toast('已自动回复'); setTimeout(function() { location.reload(); }, 2000); }); });
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
    function initOpenRegistry() { writeJson(CONFIG.OPEN_REGISTRY_KEY, cleanOpenRegistry(readOpenRegistry())); if (isThreadPage()) { registerCurrentThread(); setInterval(registerCurrentThread, CONFIG.OPEN_HEARTBEAT_MS); window.addEventListener('beforeunload', unregisterCurrentThread); window.addEventListener('pagehide', unregisterCurrentThread); window.addEventListener('unload', unregisterCurrentThread); document.addEventListener('visibilitychange', function() { if (!document.hidden) registerCurrentThread(); }); } setInterval(function() { setStatusLine('open-count', getOpenThreads().length + ' 个'); }, CONFIG.OPEN_HEARTBEAT_MS); window.addEventListener('storage', function(e) { if (e.key === CONFIG.OPEN_REGISTRY_KEY) createToolbar(); }); }
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
        dlg.body.innerHTML = '<div class="shtx-row"><label>输出格式：</label><select id="shtx-export-format" class="shtx-select" style="flex:1;"><option value="full">标题 + 链接</option><option value="url">纯链接</option><option value="csv">CSV</option></select></div>' +
            '<div class="shtx-row"><label>输出方式：</label><select id="shtx-export-mode" class="shtx-select" style="flex:1;"><option value="copy">复制到剪贴板</option><option value="download">下载文件</option></select></div>' +
            '<div class="shtx-status">当前页 ' + threads.length + ' 个主题</div>';
        var progress = document.createElement('div'); progress.className = 'shtx-status'; dlg.foot.appendChild(progress);
        var cancelled = false;
        dlg.foot.appendChild(makeBtn('开始导出', 'green', function() {
            var btn = dlg.foot.querySelector('.shtx-green'); if (btn.disabled) return; btn.disabled = true; btn.textContent = '导出中...';
            var format = $('#shtx-export-format').value, mode = $('#shtx-export-mode').value;
            runExport(threads, format, progress, function(text) {
                var ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                if (mode === 'copy') copyToClipboard(text); else downloadAsFile(text, 'sehuatang_export_' + ts + (format === 'csv' ? '.csv' : '.txt'), format === 'csv' ? 'text/csv;charset=utf-8' : undefined);
                progress.textContent = '已完成'; btn.textContent = '已完成';
            }, function() { return cancelled; });
        }));
        dlg.foot.appendChild(makeBtn('停止', 'gray', function() { cancelled = true; }));
    }
    function extractResourceLinks(tid, title) { return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid), { credentials: 'include' }).then(function(r) { return r.text(); }).then(function(html) { return extractResourcesFromHtml(html, tid, title); }).catch(function() { return { title: title, tid: tid, ed2k: [], magnet: [], attachments: [], error: '加载失败' }; }); }
    function extractResourcesFromHtml(html, tid, title) {
        var r = { title: title, tid: tid, ed2k: [], magnet: [], attachments: [] }, match;
        var er = /ed2k:\/\/\|file\|[^\n"<>]+/g; while ((match = er.exec(html)) !== null) addUnique(r.ed2k, match[0].replace(/&amp;/g, '&').trim());
        var mr = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}[^"<\s]*/g; while ((match = mr.exec(html)) !== null) addUnique(r.magnet, match[0].replace(/&amp;/g, '&').trim());
        var ar = /<a[^>]*?href\s*=\s*["']([^"']*forum\.php\?mod=attachment(?:&|&amp;)aid=\d+[^"']*)["'][^>]*?>/gi, sa = {};
        while ((match = ar.exec(html)) !== null) { var href = match[1].replace(/&amp;/g, '&'); var fu = /^https?:\/\//i.test(href) ? href : ORIGIN + '/' + href.replace(/^\//, ''); if (sa[fu]) continue; sa[fu] = true; var nm = match[0].match(/>([^<]+)</); var name = nm ? nm[1].replace(/\s+/g, ' ').trim() : '附件'; if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) continue; r.attachments.push({ url: fu, name: name }); }
        return r;
    }
    function addUnique(list, value) { if (value && list.indexOf(value) === -1) list.push(value); }
    function csvEscape(value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }
    function formatResources(results, format) {
        var lines = [], index = 0; if (format === 'csv') lines.push('标题,链接类型,链接');
        results.forEach(function(r) { var links = []; r.ed2k.forEach(function(u) { links.push({ type: 'ED2K', url: u }); }); r.magnet.forEach(function(u) { links.push({ type: 'Magnet', url: u }); }); r.attachments.forEach(function(a) { links.push({ type: '附件', url: a.url, name: a.name }); });
            if (links.length === 0) { if (format === 'url') return; if (format === 'csv') lines.push([csvEscape(r.title), csvEscape('无链接'), csvEscape('')].join(',')); else lines.push((++index) + '. ' + r.title + '\n   ' + (r.error ? '[加载失败]' : '[无链接]')); return; }
            if (format === 'url') links.forEach(function(l) { lines.push(l.url); }); else if (format === 'csv') links.forEach(function(l) { lines.push([csvEscape(r.title), csvEscape(l.type + (l.name ? '(' + l.name + ')' : '')), csvEscape(l.url)].join(',')); }); else lines.push((++index) + '. ' + r.title + '\n' + links.map(function(l) { return '  [' + l.type + (l.name ? ': ' + l.name : '') + '] ' + l.url; }).join('\n'));
        });
        return lines.join('\n');
    }
    function runExport(threads, format, progress, done, isCancelled) {
        var results = [], nextIndex = 0, finished = 0, stopped = false;
        function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
        function worker() { if (isCancelled()) { stopped = true; return Promise.resolve(); } var i = nextIndex++; if (i >= threads.length) return Promise.resolve(); var start = Date.now(); progress.textContent = '处理 (' + (finished + 1) + '/' + threads.length + ')：' + threads[i].title.substring(0, 42); return extractResourceLinks(threads[i].tid, threads[i].title).then(function(r) { results[i] = r; finished++; }).then(function() { return wait(Math.max(0, CONFIG.EXPORT_DELAY_MS - (Date.now() - start))); }).then(worker); }
        Promise.all(Array.from({ length: Math.min(CONFIG.EXPORT_CONCURRENCY, threads.length) }, worker)).then(function() { if (stopped || isCancelled()) { progress.textContent = '已停止'; return; } done(formatResources(results.filter(Boolean), format)); });
    }

    // ============ MUTATION OBSERVER ============
    function startMutationObserver() {
        if (!window.MutationObserver) return; var timer = null;
        new MutationObserver(function(muts) {
            var rel = false; for (var i = 0; i < muts.length; i++) { if (Array.prototype.slice.call(muts[i].addedNodes || []).some(function(n) { return n && n.nodeType === 1 && !isInsideToolUi(n); })) { rel = true; break; } } if (!rel) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function() { timer = null; if (isPreviewToolPage()) scheduleRefresh(); if (isThreadPage()) scheduleThreadEnhancements(); if (isSearchResultPage()) applySearchFilter(); }, 700);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ============ CLEANUP ============
    function cleanup() {
        ['sht-open-fav-panel', 'sht-progressive-image-loader-panel', 'sht-toolbar', 'sht-user-thread-toolbar'].forEach(function(id) { var el = document.getElementById(id); if (el && el.parentNode) el.parentNode.removeChild(el); });
        $all('.sht-preview-container, .sht-user-thread-preview').forEach(function(el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    }

    // ============ INIT ============
    function init() {
        addStyle(); cleanup(); initOpenRegistry(); initListTools(); applySearchFilter(); createToolbar();
        initThreadEnhancements(); initAutoSign(false); initAutoPagination(); startMutationObserver();
        if (isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID && getBool(CONFIG.AUTO_REPLY_KEY, true)) setTimeout(runAutoReply, 1200);
        if (typeof GM_registerMenuCommand === 'function') {
            try { GM_registerMenuCommand('收藏打开的帖子页', openFavoriteDialog); } catch(e) {}
        }
        migrateLegacyKeys();
        setInterval(cleanup, 8000);
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
    }

    setTimeout(init, 500);
})();
