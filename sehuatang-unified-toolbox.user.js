// ==UserScript==
// @name         色花堂统一工具箱
// @namespace    https://sehuatang.net/
// @version      1.3.6
// @description  全局预览、搜索筛选、自动签到、帖子收藏评分、代码复制、渐进全图、自动回复、后一页加载
// @author       米波
// @match        https://sehuatang.net/*
// @match        https://www.sehuatang.net/*
// @match        https://sehuatang.org/*
// @match        https://www.sehuatang.org/*
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    var ORIGIN = location.origin;

    var CONFIG = {
        IMAGE_HEIGHT: 200,
        IMAGE_WIDTH: 240,
        MAX_IMAGES: 6,
        CONCURRENCY: 3,
        ALL_PAGES: 120,
        EXPORT_DELAY_MS: 500,
        NEXT_PAGE_COUNT: 1,
        NEXT_PAGE_DELAY_MS: 650,
        SEARCH_FILTER_VISIBLE_FIDS_KEY: 'sht_search_filter_visible_fids',
        SEARCH_FILTER_SHOW_UNKNOWN_KEY: 'sht_search_filter_show_unknown',

        AUTO_SIGN_KEY: 'sht_auto_sign_enabled',
        AUTO_SIGN_STATE_KEY: 'sht_auto_sign_state',
        AUTO_SIGN_SECQAAHASH: 'qSAxcb0',
        AUTO_SIGN_DELAY_MS: 1200,

        OPEN_REGISTRY_KEY: 'sht_open_thread_tabs_v1',
        OPEN_TAB_ID_KEY: 'sht_open_thread_tab_id_v1',
        OPEN_HEARTBEAT_MS: 10000,
        OPEN_STALE_MS: 45000,
        FAVORITE_DELAY_MS: 600,

        FULL_IMAGE_KEY: 'sht_progressive_image_loader_enabled',
        FULL_IMAGE_BATCH: 3,
        FULL_IMAGE_DELAY_MS: 900,
        FULL_IMAGE_TIMEOUT_MS: 12000,
        FULL_IMAGE_RESCAN_MS: 1500,
        FULL_IMAGE_MAX_RESCAN: 3,
        THREAD_IMAGES_SHOWN_KEY: 'sht_thread_images_shown',

        AUTO_REPLY_KEY: 'sht_auto_reply_enabled',
        AUTO_REPLY_STATE_KEY: 'sht_auto_reply',
        AUTO_REPLY_TARGET_FID: '155',
        AUTO_REPLY_MAX_PER_SESSION: 5,
        AUTO_REPLY_COOLDOWN: 60000,
    };

    var REPLY_POOL = [
        '身材真不错，感谢分享',
        '拍得很棒，支持原创',
        '楼主好福气，羡慕了',
        '黑丝好评，期待更多作品',
        '皮肤好白，身材绝了',
        '拍得很有感觉，支持一波',
        '这腿绝了，楼主太幸福了',
        '每一期都追，楼主加油',
        '身材太好了，看得停不下来',
        '很真实的拍摄，喜欢这种风格',
        '照片质量很高，期待下一期',
        '看了好几遍，拍得真好',
        '支持原创自拍，感谢楼主',
        '绝了绝了，这谁顶得住',
        '每次更新都来看，太棒了',
        '真实的才是最好的，支持',
        '太有感觉了，感谢分享',
        '技术越来越好了，加油',
        '第一张就惊艳到了',
        '楼主出品必属精品',
    ];

    var KEYS = {
        autoPreview: 'sht_unified_auto_preview',
        searchVisibleFids: CONFIG.SEARCH_FILTER_VISIBLE_FIDS_KEY,
        searchShowUnknown: CONFIG.SEARCH_FILTER_SHOW_UNKNOWN_KEY,
        autoSign: CONFIG.AUTO_SIGN_KEY,
        autoNextPages: 'sht_unified_auto_next_pages',
        autoScrollPages: 'sht_unified_auto_scroll_pages',
        toolbarCollapsed: 'sht_unified_toolbar_collapsed',
        threadImagesShown: CONFIG.THREAD_IMAGES_SHOWN_KEY,
        autoReply: CONFIG.AUTO_REPLY_KEY,
    };

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
        autoScrollEnd: false,
        autoScrollTimer: null,
        loadedMaxPage: 1,
        fullImageRunning: false,
        fullImageCancelToken: 0,
        signRunning: false,
        signAutoStarted: false,
        signMessage: '',
        threadActionRunning: false,
        threadActionMessage: '',
        threadEnhanceTimer: null,
    };

    var SITE_MAP = {
        '每日合集': 106,
        '国产原创': 2,
        '亚洲无码原创': 36,
        '亚洲有码原创': 37,
        '高清中文字幕': 103,
        '三级写真': 107,
        '素人有码系列': 104,
        '欧美无码': 38,
        '4K原版': 151,
        '韩国主播': 152,
        '动漫原创': 39,
        '国产自拍': 41,
        '中文字幕': 109,
        '日韩无码': 42,
        '日韩有码': 43,
        '欧美风情': 44,
        '卡通动漫': 45,
        '剧情三级': 46,
        '自提字幕区': 145,
        '自译字幕区': 146,
        '字幕分享区': 121,
        '分享新区': 159,
        '原创自拍区': 155,
        '转贴自拍': 125,
        '华人街拍区': 50,
        '亚洲性爱': 48,
        '欧美性爱': 49,
        '原创人生': 154,
        '乱伦人妻': 135,
        '青春校园': 137,
        '武侠虚幻': 138,
        '激情都市': 136,
        'TXT小说下载': 139,
        '综合讨论区': 95,
        '色花视频自拍': 124,
        '网友原创区': 141,
        '转帖交流区': 142,
        '求片问答悬赏区': 143,
        '投诉建议区': 96,
        '禁言申诉区': 150,
        '资源出售区': 97,
        '投稿送邀请码': 157
    };

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }
    function $all(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }
    function forEachNode(nodes, fn) {
        for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
    }
    function textOf(el) {
        return (el ? (el.textContent || el.innerText || '') : '').replace(/\s+/g, ' ').trim();
    }
    function siteItems() {
        return Object.keys(SITE_MAP).map(function(name) {
            return { name: name, fid: String(SITE_MAP[name]) };
        });
    }
    function getBool(key, defaultValue) {
        var value = localStorage.getItem(key);
        if (value === null) return !!defaultValue;
        return value === 'true';
    }
    function setBool(key, value) {
        localStorage.setItem(key, value ? 'true' : 'false');
    }
    function readJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch(e) {
            return fallback;
        }
    }
    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
    }
    function escapeHtml(value) {
        var div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }
    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function safeEvalSimpleMath(expr) {
        expr = String(expr || '').replace(/\s*=\s*\?\s*$/, '').trim();
        var m = expr.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/);
        if (!m) return NaN;
        var a = parseFloat(m[1]);
        var b = parseFloat(m[3]);
        switch (m[2]) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return b !== 0 ? a / b : NaN;
            default: return NaN;
        }
    }
    function isInsideToolUi(el) {
        return !!(el && el.closest && el.closest('#shtx-toolbar, #shtx-dialog, #shtx-toast, .shtx-preview-container'));
    }
    function normalizeUrl(url) {
        url = String(url || '').replace(/&amp;/g, '&').trim();
        if (!url) return '';
        if (/^(javascript:|about:|data:)/i.test(url)) return '';
        if (/^https?:\/\//i.test(url)) return url;
        if (url.indexOf('//') === 0) return location.protocol + url;
        if (url.charAt(0) === '/') return ORIGIN + url;
        return ORIGIN + '/' + url.replace(/^\.\//, '');
    }

    function getParams() {
        return new URLSearchParams(location.search);
    }
    function getTid() {
        return getParams().get('tid') || ((location.href.match(/[?&]tid=(\d+)/) || [])[1] || '');
    }
    function getFid() {
        var fid = getParams().get('fid') || '';
        if (fid) return fid;
        var links = $all('a[href*="forumdisplay"][href*="fid="], a[href*="action=reply"][href*="fid="], #pt a[href*="fid="]');
        for (var i = 0; i < links.length; i++) {
            var m = (links[i].href || '').match(/[?&]fid=(\d+)/);
            if (m) return m[1];
        }
        return '';
    }
    function isThreadPage() {
        return /forum\.php/i.test(location.pathname) && getParams().get('mod') === 'viewthread' && !!getTid();
    }
    function isForumDisplayPage() {
        return /forum\.php/i.test(location.pathname) && getParams().get('mod') === 'forumdisplay';
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
    function isPreviewToolPage() {
        return !isSiteHomeIndexPage() && !isThreadPage();
    }
    function isHomePage() {
        return /home\.php/i.test(location.pathname);
    }
    function isFavoritePage() {
        return isHomePage() && getParams().get('do') === 'favorite';
    }
    function isUserThreadPage() {
        var params = getParams();
        var mod = params.get('mod');
        return isHomePage() && params.get('do') === 'thread' && (!mod || mod === 'space');
    }
    function isListToolPage() {
        return isFavoritePage() || isUserThreadPage();
    }
    function isAutoScrollNextPage() {
        return isListToolPage() || isForumDisplayPage() || isSearchResultPage();
    }
    function isNextPageLoadPage() {
        return isListToolPage() || isForumDisplayPage() || isSearchResultPage();
    }

    function getUid() {
        var uid = getParams().get('uid') || '';
        if (uid) return uid;
        var link = $('a[href*="mod=space"][href*="uid="]');
        if (link) {
            var m = link.href.match(/[?&]uid=(\d+)/);
            if (m) return m[1];
        }
        return '';
    }

    function toast(message, type) {
        var old = $('#shtx-toast');
        if (old) old.remove();
        var el = document.createElement('div');
        el.id = 'shtx-toast';
        el.textContent = message;
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:' + (type === 'error' ? '#c0392b' : '#333') + ';color:#fff;border-radius:6px;z-index:999999;font-size:14px;opacity:0;transition:opacity 0.3s;';
        document.body.appendChild(el);
        setTimeout(function() { el.style.opacity = '1'; }, 10);
        setTimeout(function() {
            el.style.opacity = '0';
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
        }, 2200);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() { toast('已复制到剪贴板'); })
                .catch(function() { fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
    }
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('已复制到剪贴板'); }
        catch(e) { toast('复制失败', 'error'); }
        document.body.removeChild(ta);
    }
    function downloadAsFile(text, filename, type) {
        var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('文件已下载');
    }

    function addStyle() {
        if ($('#shtx-style')) return;
        var style = document.createElement('style');
        style.id = 'shtx-style';
        style.textContent =
            '.shtx-toolbar{position:fixed;top:50%;left:0;z-index:99999;transform:translateY(-50%);display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:12px 10px;background:#f8f9fa;border:1px solid #dee2e6;border-left:0;border-radius:0 8px 8px 0;box-shadow:2px 2px 10px rgba(0,0,0,0.15);max-width:200px;font:12px/1.4 Arial,"Microsoft YaHei",sans-serif;color:#555;}' +
            '.shtx-toolbar-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}' +
            '.shtx-toolbar-body{display:flex;flex-direction:column;align-items:stretch;gap:6px;}' +
            '.shtx-toolbar.shtx-collapsed{padding:8px 6px;min-width:0;}' +
            '.shtx-toolbar.shtx-collapsed .shtx-title{display:none;}' +
            '.shtx-toolbar.shtx-collapsed .shtx-toolbar-body{display:none;}' +
            '.shtx-toolbar.shtx-collapsed .shtx-toolbar-head{justify-content:center;}' +
            '.shtx-title{font-weight:bold;font-size:13px;color:#e74c3c;white-space:nowrap;margin-bottom:2px;}' +
            '.shtx-collapse-btn{flex:0 0 auto;width:42px;height:24px;padding:0;border:0;border-radius:4px;background:#e74c3c;color:#fff;cursor:pointer;font-size:12px;font-weight:bold;line-height:24px;}' +
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
            '.shtx-empty{padding:8px 0;color:#888;font-size:12px;line-height:1.5;}' +
            '.shtx-preview-container{display:grid;clear:both;width:100%;min-width:100%;max-width:' + (CONFIG.IMAGE_WIDTH * 3 + 8) + 'px;box-sizing:border-box;grid-template-columns:repeat(3,' + CONFIG.IMAGE_WIDTH + 'px);gap:4px;margin:6px 0 8px;}' +
            '.shtx-preview-container a{display:block;width:' + CONFIG.IMAGE_WIDTH + 'px;height:' + CONFIG.IMAGE_HEIGHT + 'px;min-width:0;}' +
            '.shtx-preview-container img{display:block;width:' + CONFIG.IMAGE_WIDTH + 'px!important;height:' + CONFIG.IMAGE_HEIGHT + 'px!important;object-fit:cover;border-radius:3px;border:1px solid #ddd;}' +
            '.shtx-preview-row td,.shtx-preview-row th{padding-top:4px!important;padding-bottom:6px!important;}' +
            '.shtx-preview-block{display:block;clear:both;width:100%;}' +
            '.shtx-dialog{display:flex;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:720px;max-height:80vh;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;overflow:hidden;flex-direction:column;font:13px/1.45 Arial,"Microsoft YaHei",sans-serif;color:#333;}' +
            '.shtx-dialog-head{padding:14px 16px;background:#f8f9fa;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;gap:10px;}' +
            '.shtx-dialog-body{flex:1;overflow:auto;padding:12px 16px;}' +
            '.shtx-dialog-foot{padding:10px 16px;border-top:1px solid #eee;font-size:12px;color:#999;}' +
            '.shtx-close{background:none;border:none;font-size:20px;cursor:pointer;color:#999;line-height:1;}' +
            '.shtx-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;}' +
            '.shtx-input,.shtx-select{padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;}' +
            '.shtx-result-row{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;}' +
            '.shtx-result-row a{color:#e74c3c;text-decoration:none;flex:1;word-break:break-all;line-height:1.4;}' +
            '.shtx-code-copy{margin:4px 0 6px;padding:3px 8px;background:#3498db;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:12px;}' +
            '.shtx-filter-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:6px 10px;margin:8px 0 10px;}' +
            '.shtx-filter-item{display:flex;align-items:center;gap:6px;color:#333;font-size:12px;white-space:nowrap;}' +
            '.shtx-filter-item input{accent-color:#e74c3c;}' +
            '.shtx-autoload-simple{padding:6px 0;border-bottom:1px solid #eee;}' +
            '.shtx-autoload-simple a{color:#e74c3c;text-decoration:none;word-break:break-all;}';
        document.head.appendChild(style);
    }

    function makeButton(text, color, handler) {
        var btn = document.createElement('button');
        btn.className = 'shtx-btn shtx-' + (color || 'gray');
        btn.textContent = text;
        btn.addEventListener('click', handler);
        return btn;
    }
    function appendSection(toolbar, title) {
        var el = document.createElement('div');
        el.className = 'shtx-section-title';
        el.textContent = title;
        toolbar.appendChild(el);
    }

    function createDialog(title, width) {
        var old = $('#shtx-dialog');
        if (old) old.remove();
        var dlg = document.createElement('div');
        dlg.id = 'shtx-dialog';
        dlg.className = 'shtx-dialog';
        if (width) dlg.style.width = width;
        dlg.innerHTML =
            '<div class="shtx-dialog-head"><span style="font-weight:bold;font-size:14px;">' + escapeHtml(title) + '</span><button class="shtx-close">&times;</button></div>' +
            '<div class="shtx-dialog-body"></div>' +
            '<div class="shtx-dialog-foot"></div>';
        $('.shtx-close', dlg).onclick = function() { dlg.remove(); };
        document.body.appendChild(dlg);
        return { root: dlg, body: $('.shtx-dialog-body', dlg), foot: $('.shtx-dialog-foot', dlg), close: function() { dlg.remove(); } };
    }

    function appendSettingsSection(parent, title, note) {
        var section = document.createElement('div');
        section.className = 'shtx-settings-section';
        var head = document.createElement('div');
        head.className = 'shtx-settings-title';
        head.textContent = title;
        section.appendChild(head);
        if (note) {
            var noteEl = document.createElement('div');
            noteEl.className = 'shtx-settings-note';
            noteEl.textContent = note;
            section.appendChild(noteEl);
        }
        parent.appendChild(section);
        return section;
    }
    function appendSwitchSetting(parent, title, note, checked, onChange) {
        var row = document.createElement('label');
        row.className = 'shtx-switch-row';
        row.innerHTML =
            '<span class="shtx-switch-copy"><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(note || '') + '</small></span>' +
            '<input class="shtx-check" type="checkbox">';
        var input = $('input', row);
        input.checked = !!checked;
        input.addEventListener('change', function() { onChange(!!input.checked); });
        parent.appendChild(row);
        return row;
    }
    function setListPreviewEnabled(on) {
        setBool(KEYS.autoPreview, on);
        if (on && isPreviewToolPage()) {
            STATE.previewVisible = true;
            setPreviewVisibility(true);
            if (isSearchResultPage()) applySearchFilter();
            refreshThreads();
            loadAllPreviews();
        }
        createToolbar();
        updateListStatus(on ? '自动预览已开启' : '自动预览已关闭');
    }
    function setAutoNextPagesEnabled(on) {
        setBool(KEYS.autoNextPages, on);
        createToolbar();
        if (on && isNextPageLoadPage() && !isListToolPage()) loadNextFivePages(true);
        else updateNextStatus(on ? '自动后一页已开启' : '自动加载后一页已关闭');
    }
    function setAutoScrollPagesEnabled(on) {
        setBool(KEYS.autoScrollPages, on);
        STATE.autoScrollEnd = false;
        createToolbar();
        if (on && isAutoScrollNextPage()) scheduleAutoScrollCheck();
        else updateNextStatus(on ? '滚动翻页已开启' : '滚动翻页已关闭');
    }
    function setFullImageLoadEnabled(on) {
        setBool(CONFIG.FULL_IMAGE_KEY, on);
        if (on && isThreadPage()) startFullImageLoad();
        else {
            if (isThreadPage()) stopFullImageLoad();
            createToolbar();
            updateFullImageStatus(on ? '全图加载已开启' : '已停止本页');
            return;
        }
        createToolbar();
    }
    function setAutoSignEnabled(on) {
        setBool(KEYS.autoSign, on);
        createToolbar();
        if (on) initAutoSign(true);
        else {
            STATE.signMessage = '自动签到已关闭';
            updateSignStatus();
        }
    }
    function setAutoReplyEnabled(on) {
        setBool(KEYS.autoReply, on);
        createToolbar();
        if (on && isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID) runAutoReply();
    }
    function clearOpenThreadRecords() {
        writeJson(CONFIG.OPEN_REGISTRY_KEY, {});
        updateOpenStatus();
        toast('已清理打开记录');
        createToolbar();
    }
    function openSettingsDialog() {
        var dlg = createDialog('工具设置', '600px');
        appendSettingsSection(dlg.body, '当前页面', '当前页面：' + getPageTypeLabel() + '。所有开关都会保存，只在对应页面自动生效。');

        var sign = appendSettingsSection(dlg.body, '签到', '每天首次打开站点时自动尝试签到，也可以在左侧工具栏手动签到。');
        appendSwitchSetting(sign, '自动签到', '自动完成签到验证并记录累计 / 连续签到天数。', getBool(KEYS.autoSign, true), setAutoSignEnabled);

        var preview = appendSettingsSection(dlg.body, '全局预览', '除站点首页和帖子详情页外，识别到主题列表项的页面都会生效。');
        appendSwitchSetting(preview, '自动加载预览', '打开页面或列表新增内容时自动展开并加载预览；工具栏按钮仍可手动展开 / 收起。', getBool(KEYS.autoPreview, true), setListPreviewEnabled);

        var search = appendSettingsSection(dlg.body, '搜索页筛选', '在搜索结果页按板块显示或隐藏主题。');
        search.appendChild(makeButton('打开板块筛选', 'blue', openSearchFilterDialog));

        var list = appendSettingsSection(dlg.body, '收藏页 / 用户主题页 / 搜索页', '这些设置在收藏页、用户主题页和搜索结果页生效。');
        appendSwitchSetting(list, '滚动自动翻页', '滑到页面底部附近时，自动加载后一页内容。', getBool(KEYS.autoScrollPages, false), setAutoScrollPagesEnabled);

        var next = appendSettingsSection(dlg.body, '板块页 / 搜索页', '这些设置在板块列表页和搜索结果页生效。');
        appendSwitchSetting(next, '自动加载后一页', '打开后进入板块页或搜索页会自动加载后一页，关闭后只保留手动加载。', getBool(KEYS.autoNextPages, false), setAutoNextPagesEnabled);

        var image = appendSettingsSection(dlg.body, '帖子页', '这些设置在帖子详情页生效。');
        appendSwitchSetting(image, '全图渐进加载', '打开后分批加载整页图片，关闭后保持网站默认懒加载。', getBool(CONFIG.FULL_IMAGE_KEY, false), setFullImageLoadEnabled);

        var reply = appendSettingsSection(dlg.body, '原创自拍区', '只在原创自拍区帖子页遇到回复可见内容时生效。');
        appendSwitchSetting(reply, '自动回复', '检测到回复可见内容时自动提交随机回复。', getBool(KEYS.autoReply, true), setAutoReplyEnabled);

        dlg.foot.textContent = '设置会立即保存；常用操作按钮在左侧页面工具栏里。';
    }

    function getPageTypeLabel() {
        if (isSiteHomeIndexPage()) return '首页';
        if (isFavoritePage()) return '收藏页';
        if (isUserThreadPage()) return '用户主题页';
        if (isThreadPage()) return '帖子页';
        if (isSearchResultPage()) return '搜索页';
        if (isForumDisplayPage()) return '板块页';
        return '普通页面';
    }
    function getPreviewStatusText() {
        if (STATE.previewRunning) return '加载中';
        var auto = getBool(KEYS.autoPreview, true) ? '自动' : '手动';
        return (STATE.previewVisible ? '已展开' : '已收起') + ' / ' + auto;
    }
    function getAutoScrollStatusText() {
        if (!getBool(KEYS.autoScrollPages, false)) return '关闭';
        if (STATE.nextPagesLoading) return '加载中';
        if (STATE.autoScrollEnd) return '已到底';
        return '开启';
    }
    function getAutoNextStatusText() {
        if (!getBool(KEYS.autoNextPages, false)) return '关闭';
        return STATE.nextPagesLoading ? '加载中' : '开启';
    }
    function getNextMessageText() {
        if (STATE.nextPagesLoading) return '加载中';
        if (STATE.autoScrollEnd) return '没有更多页面';
        return '空闲';
    }
    function getFullImageStatusText() {
        if (!getBool(CONFIG.FULL_IMAGE_KEY, false)) return '关闭';
        return STATE.fullImageRunning ? '加载中' : '开启';
    }
    function getSignStatusText() {
        if (STATE.signRunning) return '签到中';
        var info = getCurrentSignUserInfo();
        var today = getDateKey(new Date());
        if (info.lastSignDate === today) {
            var parts = ['已签到'];
            if (info.signCount) parts.push('累计' + info.signCount + '天');
            if (info.signStreak) parts.push('连续' + info.signStreak + '天');
            return parts.join(' / ');
        }
        if (!getBool(KEYS.autoSign, true)) return '关闭';
        if (STATE.signMessage) return STATE.signMessage;
        if (info.lastAttemptDate === today && info.lastResult === 'error') return '今日失败';
        return '待签到';
    }
    function getReplyStatusText() {
        return getBool(KEYS.autoReply, true) ? '开启' : '关闭';
    }
    function getThreadActionStatusText() {
        if (STATE.threadActionRunning) return '处理中';
        return STATE.threadActionMessage || '空闲';
    }
    function getPostImageStatusText() {
        return getBool(KEYS.threadImagesShown, true) ? '显示' : '隐藏';
    }
    function getSearchFilterStatusText() {
        if (!isSearchResultPage()) return '非搜索页';
        var items = getSearchResultItems();
        var visibleFids = getVisibleSearchFids();
        var showUnknown = getBool(KEYS.searchShowUnknown, true);
        var visible = items.filter(function(item) {
            return item.fid ? visibleFids.indexOf(String(item.fid)) !== -1 : showUnknown;
        }).length;
        return visible + '/' + items.length + ' 显示';
    }
    function appendStatusLine(toolbar, id, label, value) {
        var row = document.createElement('div');
        row.id = 'shtx-status-' + id;
        row.className = 'shtx-status-line';
        row.innerHTML = '<span class="shtx-status-label">' + escapeHtml(label) + '</span><span class="shtx-status-value">' + escapeHtml(value) + '</span>';
        toolbar.appendChild(row);
    }
    function setStatusLine(id, value) {
        var el = $('#shtx-status-' + id + ' .shtx-status-value');
        if (el) el.textContent = value;
    }
    function getToolbarCollapsed() {
        return getBool(KEYS.toolbarCollapsed, false);
    }
    function setToolbarCollapseButton(btn, collapsed) {
        if (!btn) return;
        btn.textContent = collapsed ? '展开' : '收起';
        btn.title = collapsed ? '展开工具栏' : '收起工具栏';
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    function applyToolbarCollapsed(bar, collapsed) {
        if (!bar) return;
        bar.classList.toggle('shtx-collapsed', !!collapsed);
        setToolbarCollapseButton($('.shtx-collapse-btn', bar), !!collapsed);
    }
    function toggleToolbarCollapsed() {
        var collapsed = !getToolbarCollapsed();
        setBool(KEYS.toolbarCollapsed, collapsed);
        applyToolbarCollapsed($('#shtx-toolbar'), collapsed);
    }

    function createToolbar() {
        cleanupLegacyPanels();

        var old = $('#shtx-toolbar');
        if (old) old.remove();

        var openCount = getOpenThreads().length;
        var hasOpenTool = isThreadPage() || openCount > 0;
        var hasListTool = isListToolPage();
        var hasThreadTool = isThreadPage();
        var hasReplyTool = isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID;
        var hasNextTool = isNextPageLoadPage();
        var hasPreviewTool = isPreviewToolPage();
        var hasSignTool = true;

        var bar = document.createElement('div');
        bar.id = 'shtx-toolbar';
        bar.className = 'shtx-toolbar' + (getToolbarCollapsed() ? ' shtx-collapsed' : '');
        var head = document.createElement('div');
        head.className = 'shtx-toolbar-head';
        var title = document.createElement('div');
        title.className = 'shtx-title';
        title.textContent = '色花堂工具箱';
        head.appendChild(title);
        var collapseBtn = document.createElement('button');
        collapseBtn.type = 'button';
        collapseBtn.className = 'shtx-collapse-btn';
        collapseBtn.addEventListener('click', toggleToolbarCollapsed);
        setToolbarCollapseButton(collapseBtn, getToolbarCollapsed());
        head.appendChild(collapseBtn);
        bar.appendChild(head);
        bar.appendChild(makeButton('设置', 'red', openSettingsDialog));

        var commonSectionAdded = false;
        function ensureCommonSection() {
            if (commonSectionAdded) return;
            appendSection(bar, '常用操作');
            commonSectionAdded = true;
        }

        ensureCommonSection();
        bar.appendChild(makeButton(getSignButtonText(), getSignButtonColor(), handleSignButtonClick));

        if (hasPreviewTool) {
            ensureCommonSection();
            bar.appendChild(makeButton(getPreviewToggleText(), 'blue', togglePreviewPanel));
        }

        if (isSearchResultPage()) {
            ensureCommonSection();
            bar.appendChild(makeButton('搜索筛选', 'green', openSearchFilterDialog));
        }

        if (hasListTool) {
            bar.appendChild(makeButton('加载后一页', 'green', function() { loadNextFivePages(false); }));
            bar.appendChild(makeButton(isFavoritePage() ? '搜全部收藏' : '搜全部主题', 'blue', openSearchDialog));
            bar.appendChild(makeButton('导出资源', 'green', openExportDialog));
        } else if (hasNextTool) {
            ensureCommonSection();
            bar.appendChild(makeButton('加载后一页', 'green', function() { loadNextFivePages(false); }));
        }

        if (hasThreadTool) {
            ensureCommonSection();
            bar.appendChild(makeButton('复制全部代码', 'blue', copyAllCodeBlocks));
            bar.appendChild(makeButton(getPostImageToggleText(), 'orange', togglePostImages));
            bar.appendChild(makeButton('收藏本帖', 'blue', favoriteCurrentThread));
            bar.appendChild(makeButton('评分', 'orange', rateCurrentThread));
            bar.appendChild(makeButton('一键二连', 'red', twoActionCurrentThread));
            bar.appendChild(makeButton('停止全图', 'gray', function() { stopFullImageLoad(); createToolbar(); updateFullImageStatus('已停止本页'); }));
        }

        if (hasOpenTool) {
            ensureCommonSection();
            bar.appendChild(makeButton('收藏打开帖子', 'red', openFavoriteDialog));
            bar.appendChild(makeButton('清理打开记录', 'gray', clearOpenThreadRecords));
        }

        appendSection(bar, '当前状态');
        appendStatusLine(bar, 'page', '页面', getPageTypeLabel());
        appendStatusLine(bar, 'sign', '签到', getSignStatusText());

        if (hasPreviewTool) {
            appendStatusLine(bar, 'list-count', '主题', STATE.threads.length + ' 个');
            appendStatusLine(bar, 'preview', '预览', getPreviewStatusText());
        }

        if (isSearchResultPage()) {
            appendStatusLine(bar, 'search-filter', '搜索筛选', getSearchFilterStatusText());
        }

        if (hasListTool) {
            appendStatusLine(bar, 'scroll', '滚动翻页', getAutoScrollStatusText());
            appendStatusLine(bar, 'next-message', '加载', getNextMessageText());
        } else if (hasNextTool) {
            appendStatusLine(bar, 'next-auto', '自动后一页', getAutoNextStatusText());
            appendStatusLine(bar, 'next-message', '加载', getNextMessageText());
        }

        if (hasThreadTool) {
            appendStatusLine(bar, 'thread-action', '帖子操作', getThreadActionStatusText());
            appendStatusLine(bar, 'post-images', '帖内图片', getPostImageStatusText());
            appendStatusLine(bar, 'full-image', '全图加载', getFullImageStatusText());
            appendStatusLine(bar, 'full-message', '图片', STATE.fullImageRunning ? '处理中' : '空闲');
        }

        if (hasReplyTool) {
            appendStatusLine(bar, 'auto-reply', '自动回复', getReplyStatusText());
        }

        if (hasOpenTool) {
            appendStatusLine(bar, 'open-count', '打开帖', openCount + ' 个');
        }

        if (!hasOpenTool && !hasPreviewTool && !hasListTool && !hasThreadTool && !hasNextTool && !hasReplyTool && !hasSignTool) {
            appendStatusLine(bar, 'available', '功能', '暂无可用');
        }

        var body = document.createElement('div');
        body.className = 'shtx-toolbar-body';
        while (head.nextSibling) body.appendChild(head.nextSibling);
        bar.appendChild(body);
        applyToolbarCollapsed(bar, getToolbarCollapsed());
        document.body.appendChild(bar);
    }

    function updateListStatus(message) {
        setStatusLine('list-count', STATE.threads.length + ' 个');
        setStatusLine('preview', getPreviewStatusText());
        setStatusLine('scroll', getAutoScrollStatusText());
        setStatusLine('next-message', message || getNextMessageText());
    }
    function updateNextStatus(message) {
        setStatusLine('next-auto', getAutoNextStatusText());
        setStatusLine('scroll', getAutoScrollStatusText());
        setStatusLine('next-message', message || getNextMessageText());
    }
    function updateFullImageStatus(message) {
        setStatusLine('full-image', getFullImageStatusText());
        setStatusLine('full-message', message || (STATE.fullImageRunning ? '处理中' : '空闲'));
    }
    function updateOpenStatus() {
        setStatusLine('open-count', getOpenThreads().length + ' 个');
    }
    function updateThreadActionStatus(message) {
        if (message) STATE.threadActionMessage = message;
        setStatusLine('thread-action', getThreadActionStatusText());
    }
    function updatePostImageStatus() {
        setStatusLine('post-images', getPostImageStatusText());
    }
    function updateSearchFilterStatus() {
        setStatusLine('search-filter', getSearchFilterStatusText());
    }
    function updateSignStatus(message) {
        if (message) STATE.signMessage = message;
        setStatusLine('sign', getSignStatusText());
    }

    function getSignButtonText() {
        if (STATE.signRunning) return '签到中...';
        return isSignedToday() ? '已签到' : '签到';
    }
    function getSignButtonColor() {
        if (STATE.signRunning) return 'gray';
        return isSignedToday() ? 'green' : 'orange';
    }
    function handleSignButtonClick() {
        if (STATE.signRunning) return;
        if (isSignedToday()) {
            window.open(ORIGIN + '/plugin.php?id=dd_sign:index', '_blank');
            return;
        }
        runAutoSign(true);
    }

    // ---------------- 自动签到 ----------------
    function getDateKey(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }
    function getYesterdayKey(date) {
        var d = new Date(date);
        d.setDate(d.getDate() - 1);
        return getDateKey(d);
    }
    function loadSignState() {
        var state = readJson(CONFIG.AUTO_SIGN_STATE_KEY, {});
        if (!state || typeof state !== 'object') state = {};
        if (!state.users || typeof state.users !== 'object') state.users = {};
        return state;
    }
    function saveSignState(state) {
        writeJson(CONFIG.AUTO_SIGN_STATE_KEY, state);
    }
    function getCurrentUserIdForSign() {
        var selectors = [
            '#um a[href*="uid="]',
            '.avt a[href*="uid="]',
            'div.avt > a[href*="uid="]',
            'a[href*="home.php?mod=space"][href*="uid="]'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var link = $(selectors[i]);
            if (!link) continue;
            var href = link.getAttribute('href') || link.href || '';
            var m = href.match(/[?&]uid=(\d+)|uid-(\d+)/);
            if (m) return m[1] || m[2] || '';
        }
        return getUid() || '0';
    }
    function getSignUserInfo(state, uid) {
        state = state || loadSignState();
        uid = uid || getCurrentUserIdForSign();
        if (!state.users[uid]) {
            state.users[uid] = { lastSignDate: '', signCount: 0, signStreak: 0, lastAttemptDate: '', lastResult: '', lastMessage: '' };
        }
        return state.users[uid];
    }
    function getCurrentSignUserInfo() {
        var state = loadSignState();
        return getSignUserInfo(state, getCurrentUserIdForSign());
    }
    function isSignedToday() {
        return getCurrentSignUserInfo().lastSignDate === getDateKey(new Date());
    }
    function rememberSignSuccess(message) {
        var state = loadSignState();
        var uid = getCurrentUserIdForSign();
        var info = getSignUserInfo(state, uid);
        var now = new Date();
        var today = getDateKey(now);
        if (info.lastSignDate !== today) {
            var previous = info.lastSignDate || '';
            info.signCount = (parseInt(info.signCount, 10) || 0) + 1;
            info.signStreak = previous === getYesterdayKey(now) ? ((parseInt(info.signStreak, 10) || 0) + 1) : 1;
            info.lastSignDate = today;
        }
        info.lastAttemptDate = today;
        info.lastAttemptAt = Date.now();
        info.lastResult = 'success';
        info.lastMessage = message || '签到成功';
        saveSignState(state);
        return info;
    }
    function rememberSignFailure(message) {
        var state = loadSignState();
        var info = getSignUserInfo(state, getCurrentUserIdForSign());
        info.lastAttemptDate = getDateKey(new Date());
        info.lastAttemptAt = Date.now();
        info.lastResult = 'error';
        info.lastMessage = message || '签到失败';
        saveSignState(state);
    }
    function parseSignAjaxHtml(text) {
        text = String(text || '');
        var xml = new DOMParser().parseFromString(text, 'text/xml');
        var root = xml.getElementsByTagName('root')[0];
        return root ? root.textContent : text;
    }
    function htmlToPlainText(html) {
        return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function fetchSignInfo() {
        var url = ORIGIN + '/plugin.php?id=dd_sign&mod=sign&infloat=yes&handlekey=pc_click_ddsign&inajax=1&ajaxtarget=fwin_content_pc_click_ddsign';
        return fetch(url, { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(function(text) {
                var html = parseSignAjaxHtml(text);
                var plain = htmlToPlainText(html);
                if (/已经签到|已签到|今日已签/.test(plain)) return { already: true };
                if (/请先登录|登录后|您需要登录/.test(plain)) return { error: '需要登录后才能签到' };
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var formhash = $('input[name="formhash"]', doc);
                var signtoken = $('input[name="signtoken"]', doc);
                var signform = $('form[name="login"]', doc) || $('form[id^="signform_"]', doc);
                if (!formhash || !signtoken || !signform) return { error: '获取签到信息失败' };
                var signhash = (signform.getAttribute('id') || '').replace(/^signform_/, '');
                if (!signhash) return { error: '获取签到参数失败' };
                return { formhash: formhash.value, signtoken: signtoken.value, signhash: signhash };
            });
    }
    function fetchSignValidateText() {
        return fetch(ORIGIN + '/misc.php?mod=secqaa&action=update&idhash=' + encodeURIComponent(CONFIG.AUTO_SIGN_SECQAAHASH), { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(function(text) {
                var normalized = String(text || '').replace("sectplcode[2] + '", '前').replace("' + sectplcode[3]", '后');
                var m = normalized.match(/前([\s\S]+?)后/);
                return m ? m[1] : '';
            });
    }
    function submitSign(signInfo, answer) {
        var data = new URLSearchParams();
        data.append('formhash', signInfo.formhash);
        data.append('signtoken', signInfo.signtoken);
        data.append('secqaahash', CONFIG.AUTO_SIGN_SECQAAHASH);
        data.append('secanswer', String(answer));
        var url = ORIGIN + '/plugin.php?id=dd_sign&mod=sign&signsubmit=yes&handlekey=pc_click_ddsign&signhash=' + encodeURIComponent(signInfo.signhash) + '&inajax=1';
        return fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data,
        }).then(function(resp) { return resp.text(); });
    }
    function doSignRequest() {
        return fetchSignInfo().then(function(signInfo) {
            if (!signInfo) return { ok: false, message: '获取签到信息失败' };
            if (signInfo.already) return { ok: true, message: '已经签到过啦，请明天再来' };
            if (signInfo.error) return { ok: false, message: signInfo.error };
            return fetchSignValidateText().then(function(expr) {
                if (!expr) return { ok: false, message: '获取签到验证失败，请手动签到' };
                var answer = safeEvalSimpleMath(expr);
                if (isNaN(answer)) return { ok: false, message: '签到验证计算失败，请手动签到' };
                return submitSign(signInfo, answer).then(function(text) {
                    var plain = htmlToPlainText(parseSignAjaxHtml(text));
                    if (/已经签到过|已经签到|今日已签|已签到/.test(plain)) return { ok: true, message: '已经签到过啦，请明天再来' };
                    if (/签到成功|成功签到/.test(plain)) return { ok: true, message: '签到成功，金钱+2，明天记得来哦' };
                    if (/请先登录|登录后|您需要登录/.test(plain)) return { ok: false, message: '需要登录后才能签到' };
                    return { ok: false, message: '签到出现未知错误' };
                });
            });
        }).catch(function() {
            return { ok: false, message: '签到请求失败，请稍后重试' };
        });
    }
    function runAutoSign(manual) {
        if (STATE.signRunning) return;
        if (!manual && !getBool(KEYS.autoSign, true)) return;
        var today = getDateKey(new Date());
        var info = getCurrentSignUserInfo();
        if (!manual) {
            if (info.lastSignDate === today) return;
            if (info.lastAttemptDate === today && info.lastResult === 'error') return;
        }
        STATE.signRunning = true;
        STATE.signMessage = '签到中';
        updateSignStatus();
        createToolbar();
        doSignRequest().then(function(result) {
            STATE.signRunning = false;
            if (result.ok) {
                var signed = rememberSignSuccess(result.message);
                STATE.signMessage = '已签到';
                toast(result.message + '，连续' + signed.signStreak + '天');
            } else {
                rememberSignFailure(result.message);
                STATE.signMessage = result.message;
                toast(result.message, 'error');
            }
            createToolbar();
            updateSignStatus();
        });
    }
    function initAutoSign(force) {
        if (!force && STATE.signAutoStarted) return;
        if (!getBool(KEYS.autoSign, true)) return;
        STATE.signAutoStarted = true;
        setTimeout(function() { runAutoSign(false); }, CONFIG.AUTO_SIGN_DELAY_MS);
    }

    // ---------------- 打开页收藏 ----------------
    function getOpenTabId() {
        var id = '';
        try { id = sessionStorage.getItem(CONFIG.OPEN_TAB_ID_KEY) || ''; } catch(e) {}
        if (!id) {
            id = String(Date.now()) + '_' + Math.random().toString(16).slice(2);
            try { sessionStorage.setItem(CONFIG.OPEN_TAB_ID_KEY, id); } catch(e2) {}
        }
        return id;
    }
    function cleanTitle(text) {
        return String(text || '').replace(/\s+/g, ' ').replace(/\s*[-_].*?色花堂.*$/i, '').trim();
    }
    function getThreadTitle() {
        var el = $('#thread_subject') || $('.ts span') || $('h1');
        return cleanTitle(textOf(el) || document.title) || ('tid=' + getTid());
    }
    function readOpenRegistry() {
        return readJson(CONFIG.OPEN_REGISTRY_KEY, {});
    }
    function cleanOpenRegistry(registry) {
        var current = Date.now();
        Object.keys(registry).forEach(function(tabId) {
            var item = registry[tabId];
            if (!item || !item.tid || !item.updatedAt || current - item.updatedAt > CONFIG.OPEN_STALE_MS) {
                delete registry[tabId];
            }
        });
        return registry;
    }
    function registerCurrentThread() {
        if (!isThreadPage()) return;
        var registry = cleanOpenRegistry(readOpenRegistry());
        registry[getOpenTabId()] = {
            tid: getTid(),
            title: getThreadTitle(),
            url: ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(getTid()),
            updatedAt: Date.now(),
        };
        writeJson(CONFIG.OPEN_REGISTRY_KEY, registry);
        updateOpenStatus();
    }
    function unregisterCurrentThread() {
        if (!isThreadPage()) return;
        var registry = readOpenRegistry();
        delete registry[getOpenTabId()];
        writeJson(CONFIG.OPEN_REGISTRY_KEY, registry);
    }
    function getOpenThreads() {
        var registry = cleanOpenRegistry(readOpenRegistry());
        writeJson(CONFIG.OPEN_REGISTRY_KEY, registry);
        var byTid = {};
        Object.keys(registry).forEach(function(tabId) {
            var item = registry[tabId];
            if (!item || !item.tid) return;
            if (!byTid[item.tid] || byTid[item.tid].updatedAt < item.updatedAt) byTid[item.tid] = item;
        });
        return Object.keys(byTid).map(function(tid) { return byTid[tid]; }).sort(function(a, b) { return b.updatedAt - a.updatedAt; });
    }
    function initOpenRegistry() {
        writeJson(CONFIG.OPEN_REGISTRY_KEY, cleanOpenRegistry(readOpenRegistry()));
        if (isThreadPage()) {
            registerCurrentThread();
            setInterval(registerCurrentThread, CONFIG.OPEN_HEARTBEAT_MS);
            window.addEventListener('beforeunload', unregisterCurrentThread);
            window.addEventListener('pagehide', unregisterCurrentThread);
            window.addEventListener('unload', unregisterCurrentThread);
            document.addEventListener('visibilitychange', function() {
                if (!document.hidden) registerCurrentThread();
            });
        }
        setInterval(updateOpenStatus, CONFIG.OPEN_HEARTBEAT_MS);
        window.addEventListener('storage', function(e) {
            if (e.key === CONFIG.OPEN_REGISTRY_KEY) {
                updateOpenStatus();
                createToolbar();
            }
        });
    }
    function getFormhashFromDocument(doc) {
        var input = $('input[name="formhash"]', doc);
        if (input && input.value) return input.value;
        var logout = $('a[href*="logout"][href*="formhash="]', doc);
        if (logout) {
            var m = logout.href.match(/formhash=([a-z0-9]+)/i);
            if (m) return m[1];
        }
        var scripts = $all('script:not([src])', doc);
        for (var i = 0; i < scripts.length; i++) {
            var m2 = scripts[i].textContent.match(/formhash\s*=\s*['"]([a-z0-9]+)['"]/i);
            if (m2) return m2[1];
        }
        return '';
    }
    function getFormhash() {
        var local = getFormhashFromDocument(document);
        if (local) return Promise.resolve(local);
        return fetch(ORIGIN + '/forum.php', { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(function(html) { return getFormhashFromDocument(new DOMParser().parseFromString(html, 'text/html')); });
    }
    function parseFavoriteResponse(html) {
        var text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        if (/收藏成功|信息收藏成功|成功加入|添加收藏成功/.test(text)) return { state: 'success', label: '收藏成功' };
        if (/您已收藏|已经收藏|已收藏|重复收藏|请勿重复/.test(text)) return { state: 'exists', label: '已收藏' };
        if (/请先登录|登录后|未登录/.test(text)) return { state: 'error', label: '需要登录' };
        return { state: 'error', label: '收藏失败' };
    }
    function favoriteThread(tid, formhash) {
        var url = ORIGIN + '/home.php?mod=spacecp&ac=favorite&type=thread&id=' + encodeURIComponent(tid) +
            '&formhash=' + encodeURIComponent(formhash) +
            '&infloat=yes&handlekey=k_favorite&inajax=1&ajaxtarget=fwin_content_k_favorite';
        return fetch(url, { credentials: 'include' }).then(function(resp) { return resp.text(); }).then(parseFavoriteResponse)
            .catch(function() { return { state: 'error', label: '网络失败' }; });
    }
    function openFavoriteDialog() {
        var threads = getOpenThreads();
        if (threads.length === 0) { toast('未检测到打开的帖子页'); return; }
        var dlg = createDialog('收藏打开的帖子页', '680px');
        dlg.body.innerHTML = threads.map(function(item) {
            return '<div class="shtx-result-row" data-tid="' + escapeHtml(item.tid) + '">' +
                '<a href="' + escapeHtml(item.url) + '" target="_blank">' + escapeHtml(item.title) + '</a>' +
                '<span class="shtx-status">待收藏</span>' +
                '<button class="shtx-btn shtx-gray shtx-remove-open" data-tid="' + escapeHtml(item.tid) + '" style="padding:3px 8px;">移除</button>' +
                '</div>';
        }).join('');
        $all('.shtx-remove-open', dlg.body).forEach(function(btn) {
            btn.onclick = function() {
                removeOpenTid(this.getAttribute('data-tid'));
                var row = this.closest('.shtx-result-row');
                if (row) row.remove();
                updateOpenStatus();
            };
        });
        var progress = document.createElement('div');
        progress.className = 'shtx-status';
        dlg.foot.appendChild(progress);
        var start = makeButton('开始收藏', 'red', function() { batchFavoriteOpened(threads, progress, dlg.root); });
        var refresh = makeButton('刷新列表', 'blue', function() { dlg.close(); openFavoriteDialog(); });
        dlg.foot.appendChild(start);
        dlg.foot.appendChild(refresh);
    }
    function removeOpenTid(tid) {
        var registry = readOpenRegistry();
        Object.keys(registry).forEach(function(tabId) {
            if (registry[tabId] && registry[tabId].tid === tid) delete registry[tabId];
        });
        writeJson(CONFIG.OPEN_REGISTRY_KEY, registry);
    }
    function setFavoriteRowStatus(root, tid, text, color) {
        var el = root.querySelector('.shtx-result-row[data-tid="' + tid + '"] .shtx-status');
        if (!el) return;
        el.textContent = text;
        el.style.color = color || '#777';
    }
    function batchFavoriteOpened(threads, progress, root) {
        getFormhash().then(function(formhash) {
            if (!formhash) throw new Error('无法获取 formhash，请确认已登录');
            var success = 0, exists = 0, fail = 0;
            function next(i) {
                if (i >= threads.length) {
                    progress.textContent = '完成：成功 ' + success + '，已收藏 ' + exists + '，失败 ' + fail;
                    toast('批量收藏完成');
                    return;
                }
                var item = threads[i];
                progress.textContent = '正在收藏 ' + (i + 1) + '/' + threads.length + '：' + item.title;
                setFavoriteRowStatus(root, item.tid, '处理中', '#3498db');
                favoriteThread(item.tid, formhash).then(function(result) {
                    if (result.state === 'success') { success++; setFavoriteRowStatus(root, item.tid, result.label, '#27ae60'); }
                    else if (result.state === 'exists') { exists++; setFavoriteRowStatus(root, item.tid, result.label, '#999'); }
                    else { fail++; setFavoriteRowStatus(root, item.tid, result.label, '#e74c3c'); }
                    setTimeout(function() { next(i + 1); }, CONFIG.FAVORITE_DELAY_MS);
                });
            }
            next(0);
        }).catch(function(e) {
            progress.textContent = e.message || '批量收藏失败';
            toast(progress.textContent, 'error');
        });
    }

    // ---------------- 帖子页收藏 / 评分 ----------------
    function parseFirstInteger(text) {
        var m = String(text || '').replace(/,/g, '').match(/[+-]?\d+/);
        return m ? parseInt(m[0], 10) : NaN;
    }
    function getFirstPostPidFromDocument(root) {
        var node = $('table[id^="pid"]', root);
        if (!node || !node.id) return '';
        return node.id.replace(/^pid/, '');
    }
    function buildFirstThreadPageUrl() {
        var url = new URL(location.href);
        url.searchParams.set('mod', 'viewthread');
        url.searchParams.set('tid', getTid());
        url.searchParams.set('page', '1');
        return url.href;
    }
    function getCurrentThreadFirstPid() {
        var localPid = getFirstPostPidFromDocument(document);
        if (localPid && getCurrentPageNumber() === 1) return Promise.resolve(localPid);
        if (!getTid()) return Promise.resolve('');
        return fetch(buildFirstThreadPageUrl(), { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(function(html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                return getFirstPostPidFromDocument(doc);
            })
            .catch(function() { return ''; });
    }
    function favoriteCurrentThreadRequest() {
        var tid = getTid();
        if (!tid) return Promise.resolve({ state: 'error', label: '未识别到当前帖子' });
        return getFormhash().then(function(formhash) {
            if (!formhash) return { state: 'error', label: '无法获取 formhash，请确认已登录' };
            return favoriteThread(tid, formhash).then(function(result) {
                if (result.state === 'success') return { state: 'success', label: '本帖收藏成功' };
                if (result.state === 'exists') return { state: 'exists', label: '本帖已收藏' };
                return result;
            });
        }).catch(function() {
            return { state: 'error', label: '收藏请求失败' };
        });
    }
    function getRateInfo(pid, tid) {
        var url = ORIGIN + '/forum.php?mod=misc&action=rate&tid=' + encodeURIComponent(tid) +
            '&pid=' + encodeURIComponent(pid) +
            '&infloat=yes&handlekey=rate&t=' + Date.now() +
            '&inajax=1&ajaxtarget=fwin_content_rate';
        return fetch(url, { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(function(text) {
                var html = parseSignAjaxHtml(text);
                var plain = htmlToPlainText(html);
                if (/请先登录|登录后|您需要登录/.test(plain)) return { state: false, error: '需要登录后才能评分' };
                if (/抱歉|不能对同一个帖子重复评分|对自己发表的帖子评分|重复评分|自己发表/.test(plain)) {
                    return { state: false, error: '不能重复评分，或不能给自己的帖子评分' };
                }

                var doc = new DOMParser().parseFromString(html, 'text/html');
                var scoreOption = $('#scoreoption8 li', doc);
                var leftCell = $('.dt.mbm td:last-child', doc);
                var formhash = $('input[name="formhash"]', doc);
                if (!scoreOption || !formhash) return { state: false, error: '获取评分信息失败' };

                var max = parseFirstInteger(textOf(scoreOption));
                var left = leftCell ? parseFirstInteger(textOf(leftCell)) : NaN;
                if (!isNaN(left)) max = Math.min(max, left);
                if (isNaN(max) || max <= 0) return { state: false, error: '今日可评分额度不足' };

                var referer = $('input[name="referer"]', doc);
                var handlekey = $('input[name="handlekey"]', doc);
                return {
                    state: true,
                    max: max,
                    formhash: formhash.value,
                    referer: referer ? referer.value : '',
                    handlekey: handlekey ? handlekey.value : 'rate',
                };
            })
            .catch(function() {
                return { state: false, error: '获取评分信息失败' };
            });
    }
    function submitRate(tid, pid, rateInfo) {
        var data = new URLSearchParams();
        data.append('formhash', rateInfo.formhash);
        data.append('tid', tid);
        data.append('pid', pid);
        data.append('referer', rateInfo.referer || location.href);
        data.append('handlekey', rateInfo.handlekey || 'rate');
        data.append('score8', '+' + rateInfo.max);
        data.append('reason', '');
        data.append('sendreasonpm', 'on');
        return fetch(ORIGIN + '/forum.php?mod=misc&action=rate&ratesubmit=yes&infloat=yes&inajax=1', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data,
        }).then(function(resp) {
            return resp.text();
        }).then(function(text) {
            var payload = parseSignAjaxHtml(text);
            var plain = htmlToPlainText(payload);
            var haystack = [String(text || ''), String(payload || ''), plain].join(' ');
            if (/感谢您的参与|评分成功|成功评分|hideWindow\(['"]rate['"]\)|succeedhandle_rate|ratecredits/i.test(haystack)) {
                return { state: 'success', label: '+' + rateInfo.max + ' 评分成功，已通知作者', score: rateInfo.max };
            }
            if (/重复评分|不能对同一个帖子重复评分|自己发表/.test(haystack)) {
                return { state: 'error', label: '不能重复评分，或不能给自己的帖子评分' };
            }
            if (/请先登录|登录后|您需要登录/.test(haystack)) return { state: 'error', label: '需要登录后才能评分' };
            return { state: 'error', label: '评分失败' };
        }).catch(function() {
            return { state: 'error', label: '评分请求失败' };
        });
    }
    function rateCurrentThreadRequest() {
        var tid = getTid();
        if (!tid) return Promise.resolve({ state: 'error', label: '未识别到当前帖子' });
        return getCurrentThreadFirstPid().then(function(pid) {
            if (!pid) return { state: 'error', label: '未识别到帖子楼主 pid' };
            return getRateInfo(pid, tid).then(function(info) {
                if (!info.state) return { state: 'error', label: info.error || '获取评分信息失败' };
                return submitRate(tid, pid, info);
            });
        }).catch(function() {
            return { state: 'error', label: '评分请求失败' };
        });
    }
    function beginThreadAction(message) {
        if (!isThreadPage()) {
            toast('当前页面不是帖子页', 'error');
            return false;
        }
        if (STATE.threadActionRunning) {
            toast('帖子操作正在处理中');
            return false;
        }
        STATE.threadActionRunning = true;
        STATE.threadActionMessage = message || '处理中';
        createToolbar();
        updateThreadActionStatus();
        return true;
    }
    function finishThreadAction(message, type) {
        STATE.threadActionRunning = false;
        STATE.threadActionMessage = message || '空闲';
        createToolbar();
        updateThreadActionStatus();
        if (message) toast(message, type);
    }
    function favoriteCurrentThread() {
        if (!beginThreadAction('收藏中')) return;
        favoriteCurrentThreadRequest().then(function(result) {
            finishThreadAction(result.label, result.state === 'error' ? 'error' : null);
        });
    }
    function rateCurrentThread() {
        if (!beginThreadAction('评分中')) return;
        rateCurrentThreadRequest().then(function(result) {
            finishThreadAction(result.label, result.state === 'error' ? 'error' : null);
        });
    }
    function twoActionCurrentThread() {
        if (!beginThreadAction('一键二连中')) return;
        favoriteCurrentThreadRequest().then(function(favoriteResult) {
            return rateCurrentThreadRequest().then(function(rateResult) {
                return { favorite: favoriteResult, rate: rateResult };
            });
        }).then(function(result) {
            var failed = result.favorite.state === 'error' || result.rate.state === 'error';
            var prefix = failed ? '一键二连部分失败：' : '一键二连完成：';
            finishThreadAction(prefix + result.favorite.label + '，' + result.rate.label, failed ? 'error' : null);
        }).catch(function() {
            finishThreadAction('一键二连失败', 'error');
        });
    }

    // ---------------- 帖子页代码 / 图片 ----------------
    function getThreadContentRoot() {
        return $('#postlist') || document;
    }
    function getCodeBlocks() {
        var seen = [];
        var result = [];
        $all('#postlist .blockcode, .t_fsz .blockcode, .pcb .blockcode').forEach(function(code) {
            if (seen.indexOf(code) !== -1) return;
            seen.push(code);
            result.push(code);
        });
        return result;
    }
    function getCodeBlockText(code) {
        var rows = $all('li', code);
        if (rows.length) {
            return rows.map(function(li) { return (li.innerText || li.textContent || '').replace(/\n/g, ''); }).join('\r\n');
        }
        return (code.innerText || code.textContent || '').replace(/^\s*复制代码\s*/i, '').trim();
    }
    function copyCodeBlock(code) {
        var text = getCodeBlockText(code);
        if (!text) { toast('未找到代码内容', 'error'); return; }
        copyToClipboard(text);
    }
    function copyAllCodeBlocks() {
        var blocks = getCodeBlocks();
        var text = blocks.map(getCodeBlockText).filter(Boolean).join('\r\n\r\n');
        if (!text) { toast('未找到代码块', 'error'); return; }
        copyToClipboard(text);
    }
    function initCodeCopyButtons() {
        getCodeBlocks().forEach(function(code) {
            if (code.querySelector('.shtx-code-copy')) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shtx-code-copy';
            btn.textContent = '复制代码';
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                copyCodeBlock(code);
            });
            code.insertBefore(btn, code.firstChild);
        });
    }
    function getPostImageNodes() {
        var result = [];
        var seen = [];
        $all('#postlist .t_fsz img, #postlist .t_f img, #postlist .pcb img').forEach(function(img) {
            if (seen.indexOf(img) !== -1 || isInsideToolUi(img)) return;
            if (img.closest('.pls, .avt, .shtx-preview-container')) return;
            if (!getRealImageUrl(img)) return;
            seen.push(img);
            result.push(img);
        });
        return result;
    }
    function getPostImageToggleText() {
        return getBool(KEYS.threadImagesShown, true) ? '隐藏图片' : '显示图片';
    }
    function applyPostImageVisibility() {
        var visible = getBool(KEYS.threadImagesShown, true);
        getPostImageNodes().forEach(function(img) {
            img.style.display = visible ? '' : 'none';
        });
    }
    function togglePostImages() {
        var visible = !getBool(KEYS.threadImagesShown, true);
        setBool(KEYS.threadImagesShown, visible);
        applyPostImageVisibility();
        createToolbar();
        updatePostImageStatus();
        toast(visible ? '已显示帖内图片' : '已隐藏帖内图片');
    }
    function initThreadEnhancements() {
        if (!isThreadPage()) return;
        initCodeCopyButtons();
        applyPostImageVisibility();
    }
    function scheduleThreadEnhancements() {
        if (!isThreadPage()) return;
        if (STATE.threadEnhanceTimer) clearTimeout(STATE.threadEnhanceTimer);
        STATE.threadEnhanceTimer = setTimeout(function() {
            STATE.threadEnhanceTimer = null;
            initThreadEnhancements();
        }, 300);
    }

    // ---------------- 搜索页板块筛选 ----------------
    function getAllSearchFids() {
        return siteItems().map(function(item) { return item.fid; });
    }
    function getVisibleSearchFids() {
        var saved = readJson(KEYS.searchVisibleFids, null);
        if (!Array.isArray(saved)) return getAllSearchFids();
        return saved.map(String);
    }
    function saveVisibleSearchFids(fids) {
        writeJson(KEYS.searchVisibleFids, (fids || []).map(String));
    }
    function getFidFromHref(href) {
        var value = String(href || '');
        var m = value.match(/[?&]fid=(\d+)/) || value.match(/forum-(\d+)-\d+\.html/i) || value.match(/fid-(\d+)/i);
        return m ? m[1] : '';
    }
    function getSearchItemFid(node) {
        if (!node) return '';
        var fid = '';
        var links = $all('a[href]', node);
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || links[i].href || '';
            if (/forumdisplay|forum-\d+-|fid=|fid-\d+/i.test(href)) {
                fid = getFidFromHref(href);
                if (fid) return fid;
            }
        }
        var text = textOf(node);
        var items = siteItems();
        for (var j = 0; j < items.length; j++) {
            if (text.indexOf(items[j].name) !== -1) return items[j].fid;
        }
        return '';
    }
    function getSearchResultItems() {
        if (!isSearchResultPage()) return [];
        var pairs = [];
        $all('a[href*="viewthread"][href*="tid="], a[href*="thread-"]').forEach(function(a) {
            if (isInsideToolUi(a)) return;
            var tid = getTidFromHref(a.getAttribute('href') || a.href);
            if (!tid) return;
            var node = getThreadItemNode(a) || a.closest('tbody, tr, li, dl, .bbda, .pbw');
            if (!node || isDocumentShellNode(node)) return;
            for (var i = 0; i < pairs.length; i++) {
                if (pairs[i].node === node || pairs[i].tid === tid) return;
            }
            var fid = getSearchItemFid(node);
            pairs.push({ tid: tid, node: node, fid: fid, visible: true });
        });
        return pairs;
    }
    function setSearchItemVisible(item, visible) {
        item.visible = visible;
        if (item.node) item.node.style.display = visible ? '' : 'none';
        var preview = getPreviewWrapperForAnchor(item.node, item.tid);
        if (preview) preview.style.display = visible && STATE.previewVisible ? '' : 'none';
    }
    function applySearchFilter() {
        if (!isSearchResultPage()) return;
        var visibleFids = getVisibleSearchFids();
        var showUnknown = getBool(KEYS.searchShowUnknown, true);
        getSearchResultItems().forEach(function(item) {
            var visible = item.fid ? visibleFids.indexOf(String(item.fid)) !== -1 : showUnknown;
            setSearchItemVisible(item, visible);
        });
        updateSearchFilterStatus();
    }
    function openSearchFilterDialog() {
        var dlg = createDialog('搜索页板块筛选', '760px');
        var visibleFids = getVisibleSearchFids();
        var visibleMap = {};
        visibleFids.forEach(function(fid) { visibleMap[String(fid)] = true; });
        var showUnknown = getBool(KEYS.searchShowUnknown, true);
        var items = siteItems();
        dlg.body.innerHTML =
            '<div class="shtx-settings-note">勾选要显示的板块，未勾选的板块会在搜索结果页隐藏。这个设置会保存，并在所有搜索结果页生效。</div>' +
            '<div class="shtx-row">' +
            '<button class="shtx-btn shtx-blue" id="shtx-filter-all" type="button">全选</button>' +
            '<button class="shtx-btn shtx-gray" id="shtx-filter-none" type="button">全不选</button>' +
            '<label class="shtx-filter-item"><input id="shtx-filter-unknown" type="checkbox"' + (showUnknown ? ' checked' : '') + '>显示未识别板块</label>' +
            '</div>' +
            '<div class="shtx-filter-grid">' + items.map(function(item) {
                return '<label class="shtx-filter-item"><input type="checkbox" class="shtx-filter-fid" value="' + escapeHtml(item.fid) + '"' + (visibleMap[item.fid] ? ' checked' : '') + '>' + escapeHtml(item.name) + '</label>';
            }).join('') + '</div>';

        function collectAndApply() {
            var selected = $all('.shtx-filter-fid:checked', dlg.body).map(function(input) { return input.value; });
            saveVisibleSearchFids(selected);
            setBool(KEYS.searchShowUnknown, !!$('#shtx-filter-unknown', dlg.body).checked);
            applySearchFilter();
            createToolbar();
        }
        $all('.shtx-filter-fid', dlg.body).forEach(function(input) {
            input.addEventListener('change', collectAndApply);
        });
        $('#shtx-filter-unknown', dlg.body).addEventListener('change', collectAndApply);
        $('#shtx-filter-all', dlg.body).onclick = function() {
            $all('.shtx-filter-fid', dlg.body).forEach(function(input) { input.checked = true; });
            collectAndApply();
        };
        $('#shtx-filter-none', dlg.body).onclick = function() {
            $all('.shtx-filter-fid', dlg.body).forEach(function(input) { input.checked = false; });
            collectAndApply();
        };
        dlg.foot.textContent = isSearchResultPage() ? ('当前页：' + getSearchFilterStatusText()) : '打开搜索结果页后会按这里的设置筛选。';
    }

    // ---------------- 收藏页 / 用户主题页 ----------------
    function getTidFromHref(href) {
        var m = String(href || '').match(/[?&]tid=(\d+)/) || String(href || '').match(/thread-(\d+)-\d+-\d+\.html/i);
        return m ? m[1] : '';
    }
    function titleScore(a, title) {
        var score = title ? title.length : 0;
        if (/\bxst\b/.test(a.className || '')) score += 1000;
        if (!title || /^\d+$/.test(title)) score -= 500;
        return score;
    }
    function getThreadsWithLinks(root) {
        root = root || document;
        var links = root.querySelectorAll('a[href*="viewthread"][href*="tid="], a[href*="thread-"]');
        var map = {};
        forEachNode(links, function(a) {
            if (isInsideToolUi(a)) return;
            if (!getPreviewMountNode(a)) return;
            var tid = getTidFromHref(a.getAttribute('href') || a.href);
            if (!tid) return;
            var title = textOf(a) || a.title || ('tid=' + tid);
            var item = { tid: tid, link: a, title: title, score: titleScore(a, title) };
            if (!map[tid] || item.score > map[tid].score) map[tid] = item;
        });
        return Object.keys(map).map(function(tid) {
            return { tid: tid, link: map[tid].link, title: map[tid].title };
        });
    }
    function detectMaxPage(root) {
        root = root || document;
        var max = parseInt(getParams().get('page'), 10) || 1;
        $all('.pg a[href*="page="], a.last[href*="page="]', root).forEach(function(a) {
            var m = (a.getAttribute('href') || a.href || '').match(/[?&]page=(\d+)/);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return max || 1;
    }
    function refreshThreads() {
        if (!isPreviewToolPage()) return;
        dedupeThreadItems();
        dedupePreviewContainers();
        var before = STATE.threads.length;
        STATE.threads = getThreadsWithLinks(document);
        STATE.listMaxPage = Math.max(STATE.listMaxPage || 1, detectMaxPage(document));
        updateListStatus();
        if (STATE.threads.length !== before && getBool(KEYS.autoPreview, true) && STATE.previewVisible) loadAllPreviews();
    }
    function scheduleRefreshThreads() {
        if (STATE.refreshTimer) clearTimeout(STATE.refreshTimer);
        STATE.refreshTimer = setTimeout(function() {
            STATE.refreshTimer = null;
            refreshThreads();
        }, 500);
    }
    function initListTools() {
        STATE.previewVisible = getBool(KEYS.autoPreview, true);
        if (isListToolPage()) STATE.loadedMaxPage = Math.max(STATE.loadedMaxPage || 1, getCurrentPageNumber());
        if (!isPreviewToolPage()) return;
        refreshThreads();
        if (getBool(KEYS.autoPreview, true)) loadAllPreviews();
        else setPreviewVisibility(false);
        if (!STATE.listObserver && window.MutationObserver) {
            STATE.listObserver = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var nodes = Array.prototype.slice.call(mutations[i].addedNodes || []);
                    var hasThread = nodes.some(function(node) {
                        if (!node || node.nodeType !== 1) return false;
                        if (isInsideToolUi(node)) return false;
                        if (node.classList && node.classList.contains('shtx-preview-container')) return false;
                        if (node.matches && node.matches('a[href*="viewthread"][href*="tid="], a[href*="thread-"]')) return true;
                        return !!(node.querySelector && node.querySelector('a[href*="viewthread"][href*="tid="], a[href*="thread-"]'));
                    });
                    if (hasThread) { scheduleRefreshThreads(); break; }
                }
            });
            STATE.listObserver.observe(document.body, { childList: true, subtree: true });
        }
    }
    function toggleListPreview() {
        setListPreviewEnabled(!getBool(KEYS.autoPreview, true));
    }
    function getPreviewToggleText() {
        if (STATE.previewRunning) return '预览加载中';
        return STATE.previewVisible ? '收起预览' : '展开预览';
    }
    function togglePreviewPanel() {
        if (!isPreviewToolPage()) return;
        if (STATE.previewVisible) {
            setPreviewVisibility(false);
            updateListStatus('预览已收起');
            createToolbar();
            return;
        }
        setPreviewVisibility(true);
        if (isSearchResultPage()) applySearchFilter();
        refreshThreads();
        updateListStatus('正在展开预览');
        createToolbar();
        loadAllPreviews().then(function() {
            updateListStatus();
            createToolbar();
        });
    }
    function fetchImages(tid) {
        return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid), { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(extractImageUrls)
            .catch(function() { return []; });
    }
    function extractImageUrls(html) {
        var urls = [], seen = {};
        var regex = /<img[^>]*?class\s*=\s*["'][^"']*?zoom[^"']*?["'][^>]*?>/gi;
        var match;
        while ((match = regex.exec(html)) !== null) {
            var tag = match[0];
            var src = '';
            var fileMatch = tag.match(/file\s*=\s*["']([^"']+)["']/i);
            if (fileMatch) src = fileMatch[1];
            else {
                var srcMatch = tag.match(/src\s*=\s*["']([^"']+)["']/i);
                if (srcMatch) src = srcMatch[1];
            }
            src = normalizeUrl(src);
            if (!src || seen[src] || /static\/image|smiley|avatar/i.test(src)) continue;
            seen[src] = true;
            urls.push(src);
        }
        return urls.slice(0, CONFIG.MAX_IMAGES);
    }
    function setPreviewVisibility(visible) {
        STATE.previewVisible = !!visible;
        $all('.shtx-preview-row').forEach(function(el) { el.style.display = visible ? '' : 'none'; });
        $all('.shtx-preview-block').forEach(function(el) { el.style.display = visible ? 'block' : 'none'; });
        $all('.shtx-preview-container').forEach(function(el) { el.style.display = visible ? 'grid' : 'none'; });
    }
    function removeEmptyPreview(container) {
        if (!container || container.querySelector('img')) return;
        var wrapper = container.closest('.shtx-preview-row, .shtx-preview-block');
        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
        } else if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }
    function renderPreview(thread, imageUrls) {
        var anchor = getPreviewMountNode(thread.link);
        if (!anchor || getPreviewContainerForAnchor(anchor, thread.tid)) return;
        var container = document.createElement('div');
        container.className = 'shtx-preview-container';
        container.setAttribute('data-tid', thread.tid);
        if (!STATE.previewVisible) container.style.display = 'none';
        if (imageUrls.length > 0) {
            imageUrls.forEach(function(url) {
                var wrapper = document.createElement('a');
                wrapper.href = ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(thread.tid);
                wrapper.target = '_blank';
                var img = document.createElement('img');
                img.loading = 'lazy';
                img.addEventListener('error', function() {
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                    removeEmptyPreview(container);
                });
                img.src = url;
                wrapper.appendChild(img);
                container.appendChild(wrapper);
            });
        }
        if (!container.children.length) return;
        insertPreviewAfterAnchor(anchor, thread.tid, container);
        if (!STATE.previewVisible) setPreviewVisibility(false);
        if (isSearchResultPage()) applySearchFilter();
    }
    function loadAllPreviews() {
        if (!isPreviewToolPage() || STATE.previewRunning) return Promise.resolve();
        if (!STATE.previewVisible) return Promise.resolve();
        STATE.previewRunning = true;
        cleanupLegacyPanels();
        refreshThreads();
        var pending = STATE.threads.filter(function(t) {
            var anchor = getPreviewMountNode(t.link);
            return anchor && !getPreviewContainerForAnchor(anchor, t.tid);
        });
        if (pending.length === 0) {
            STATE.previewRunning = false;
            return Promise.resolve();
        }
        function batch(i) {
            if (i >= pending.length) {
                STATE.previewRunning = false;
                dedupePreviewContainers();
                updateListStatus();
                return Promise.resolve();
            }
            updateListStatus('预览加载 ' + Math.min(i + CONFIG.CONCURRENCY, pending.length) + '/' + pending.length);
            return Promise.all(pending.slice(i, i + CONFIG.CONCURRENCY).map(function(thread) {
                return fetchImages(thread.tid).then(function(urls) { renderPreview(thread, urls); });
            })).then(function() {
                return batch(i + CONFIG.CONCURRENCY);
            });
        }
        return batch(0);
    }
    function buildListPageUrl(page) {
        if (isFavoritePage()) {
            var uid = getUid();
            return ORIGIN + '/home.php?mod=space&uid=' + encodeURIComponent(uid) + '&do=favorite&view=me&page=' + page;
        }
        var url = new URL(location.href);
        url.searchParams.set('page', page);
        return url.href;
    }

    function openSearchDialog() {
        var dlg = createDialog(isFavoritePage() ? '收藏搜索' : '用户主题搜索', '720px');
        dlg.body.innerHTML =
            '<div class="shtx-row"><label>关键词：</label><input id="shtx-search-kw" class="shtx-input" style="flex:1;" placeholder="输入搜索关键词"></div>' +
            '<div class="shtx-row"><label>页码范围：</label><input id="shtx-search-start" class="shtx-input" type="number" min="1" value="1" style="width:64px;"><span>至</span><input id="shtx-search-end" class="shtx-input" type="number" min="1" value="' + (STATE.listMaxPage || CONFIG.ALL_PAGES) + '" style="width:64px;"></div>' +
            '<div id="shtx-search-results" style="min-height:100px;"><div style="text-align:center;padding:30px;color:#ccc;font-size:13px;">设置关键词和页码范围后点击“开始搜索”</div></div>';
        var footer = document.createElement('div');
        footer.className = 'shtx-status';
        dlg.foot.appendChild(footer);
        var startBtn = makeButton('开始搜索', 'red', function() {
            var keyword = $('#shtx-search-kw').value.trim();
            var start = parseInt($('#shtx-search-start').value, 10) || 1;
            var end = parseInt($('#shtx-search-end').value, 10) || STATE.listMaxPage || CONFIG.ALL_PAGES;
            if (!keyword) { toast('请输入关键词'); return; }
            if (start > end) { var tmp = start; start = end; end = tmp; }
            runSearch(keyword, start, end, $('#shtx-search-results'), footer, startBtn);
        });
        var cancelBtn = makeButton('取消', 'gray', function() { STATE.searchCancelled = true; dlg.close(); });
        dlg.foot.appendChild(startBtn);
        dlg.foot.appendChild(cancelBtn);
    }
    function runSearch(keyword, start, end, resultsDiv, footer, startBtn) {
        STATE.searchCancelled = false;
        startBtn.disabled = true;
        startBtn.textContent = '搜索中...';
        resultsDiv.innerHTML = '';
        var total = 0;
        var kwLower = keyword.toLowerCase();
        function page(p) {
            if (p > end || STATE.searchCancelled) {
                footer.textContent = STATE.searchCancelled ? '已取消，找到 ' + total + ' 个匹配' : '搜索完成，找到 ' + total + ' 个匹配';
                if (total === 0 && !STATE.searchCancelled) {
                    resultsDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#999;">未找到匹配“' + escapeHtml(keyword) + '”的主题</div>';
                }
                startBtn.disabled = false;
                startBtn.textContent = '开始搜索';
                return;
            }
            footer.textContent = '正在搜索第 ' + p + ' 页...';
            fetch(buildListPageUrl(p), { credentials: 'include' })
                .then(function(resp) { return resp.text(); })
                .then(function(html) {
                    var doc = new DOMParser().parseFromString(html, 'text/html');
                    getThreadsWithLinks(doc).forEach(function(thread) {
                        if (thread.title.toLowerCase().indexOf(kwLower) === -1) return;
                        total++;
                        var row = document.createElement('div');
                        row.className = 'shtx-result-row';
                        row.innerHTML = '<a target="_blank" href="' + ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(thread.tid) + '">' + highlightKeyword(thread.title, keyword) + '</a><span class="shtx-status">第' + p + '页</span>';
                        resultsDiv.appendChild(row);
                    });
                    footer.textContent = '已搜索 ' + (p - start + 1) + '/' + (end - start + 1) + ' 页，找到 ' + total + ' 个';
                })
                .catch(function() {})
                .then(function() { setTimeout(function() { page(p + 1); }, 120); });
        }
        page(start);
    }
    function highlightKeyword(text, keyword) {
        return escapeHtml(text).replace(new RegExp('(' + escapeRegExp(escapeHtml(keyword)) + ')', 'gi'), '<span style="background:#ffd54f;padding:0 2px;">$1</span>');
    }

    function openExportDialog() {
        refreshThreads();
        var threads = getThreadsWithLinks(document);
        if (threads.length === 0) { toast('当前页没有主题'); return; }
        var dlg = createDialog('导出资源链接', '520px');
        dlg.body.innerHTML =
            '<div class="shtx-row"><label>输出格式：</label><select id="shtx-export-format" class="shtx-select" style="flex:1;"><option value="full">标题 + 链接</option><option value="url">纯链接</option><option value="csv">CSV</option></select></div>' +
            '<div class="shtx-row"><label>输出方式：</label><select id="shtx-export-mode" class="shtx-select" style="flex:1;"><option value="copy">复制到剪贴板</option><option value="download">下载文件</option></select></div>' +
            '<div class="shtx-status">当前页 ' + threads.length + ' 个主题</div>';
        var progress = document.createElement('div');
        progress.className = 'shtx-status';
        dlg.foot.appendChild(progress);
        var cancelled = false;
        var startBtn = makeButton('开始导出', 'green', function() {
            if (startBtn.disabled) return;
            startBtn.disabled = true;
            startBtn.textContent = '导出中...';
            var format = $('#shtx-export-format').value;
            var mode = $('#shtx-export-mode').value;
            runExport(threads, format, progress, function(text) {
                var timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                if (mode === 'copy') copyToClipboard(text);
                else downloadAsFile(text, 'sehuatang_export_' + timestamp + (format === 'csv' ? '.csv' : '.txt'), format === 'csv' ? 'text/csv;charset=utf-8' : undefined);
                progress.textContent = '已完成';
                startBtn.textContent = '已完成';
            }, function() { return cancelled; });
        });
        var stopBtn = makeButton('停止', 'gray', function() { cancelled = true; });
        dlg.foot.appendChild(startBtn);
        dlg.foot.appendChild(stopBtn);
    }
    function extractResourceLinks(tid, title) {
        return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid), { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(function(html) { return extractResourcesFromHtml(html, tid, title); })
            .catch(function() { return { title: title, tid: tid, ed2k: [], magnet: [], attachments: [], error: '页面加载失败' }; });
    }
    function extractResourcesFromHtml(html, tid, title) {
        var result = { title: title, tid: tid, ed2k: [], magnet: [], attachments: [] };
        var match;
        var ed2kRegex = /ed2k:\/\/\|file\|[^\n"<>]+/g;
        while ((match = ed2kRegex.exec(html)) !== null) addUnique(result.ed2k, match[0].replace(/&amp;/g, '&').trim());
        var magnetRegex = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}[^"<\s]*/g;
        while ((match = magnetRegex.exec(html)) !== null) addUnique(result.magnet, match[0].replace(/&amp;/g, '&').trim());
        var attachRegex = /<a[^>]*?href\s*=\s*["']([^"']*forum\.php\?mod=attachment(?:&|&amp;)aid=\d+[^"']*)["'][^>]*?>/gi;
        var seenAttach = {};
        while ((match = attachRegex.exec(html)) !== null) {
            var href = match[1].replace(/&amp;/g, '&');
            var fullUrl = /^https?:\/\//i.test(href) ? href : ORIGIN + '/' + href.replace(/^\//, '');
            if (seenAttach[fullUrl]) continue;
            seenAttach[fullUrl] = true;
            var nameMatch = match[0].match(/>([^<]+)</);
            var name = nameMatch ? nameMatch[1].replace(/\s+/g, ' ').trim() : '附件';
            if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) continue;
            result.attachments.push({ url: fullUrl, name: name });
        }
        return result;
    }
    function addUnique(list, value) {
        if (value && list.indexOf(value) === -1) list.push(value);
    }
    function csvEscape(value) {
        return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    }
    function formatResources(results, format) {
        var lines = [], index = 0;
        if (format === 'csv') lines.push('标题,链接类型,链接');
        results.forEach(function(r) {
            var links = [];
            r.ed2k.forEach(function(url) { links.push({ type: 'ED2K', url: url }); });
            r.magnet.forEach(function(url) { links.push({ type: 'Magnet', url: url }); });
            r.attachments.forEach(function(a) { links.push({ type: '附件', url: a.url, name: a.name }); });
            if (links.length === 0) {
                if (format === 'url') return;
                if (format === 'csv') lines.push([csvEscape(r.title), csvEscape('无链接'), csvEscape('')].join(','));
                else lines.push((++index) + '. ' + r.title + '\n   ' + (r.error ? '[加载失败] ' + r.error : '[无链接]'));
                return;
            }
            if (format === 'url') links.forEach(function(l) { lines.push(l.url); });
            else if (format === 'csv') links.forEach(function(l) { lines.push([csvEscape(r.title), csvEscape(l.type + (l.name ? '(' + l.name + ')' : '')), csvEscape(l.url)].join(',')); });
            else lines.push((++index) + '. ' + r.title + '\n' + links.map(function(l) { return '  [' + l.type + (l.name ? ': ' + l.name : '') + '] ' + l.url; }).join('\n'));
        });
        return lines.join('\n');
    }
    function runExport(threads, format, progress, done, isCancelled) {
        var results = [];
        function next(i) {
            if (isCancelled()) { progress.textContent = '已停止'; return; }
            if (i >= threads.length) { done(formatResources(results, format)); return; }
            progress.textContent = '正在处理 (' + (i + 1) + '/' + threads.length + ')：' + threads[i].title.substring(0, 42);
            extractResourceLinks(threads[i].tid, threads[i].title).then(function(r) {
                results.push(r);
                setTimeout(function() { next(i + 1); }, CONFIG.EXPORT_DELAY_MS);
            });
        }
        next(0);
    }

    // ---------------- 后一页加载 ----------------
    function getCurrentPageNumber() {
        var page = parseInt(getParams().get('page'), 10);
        return isNaN(page) || page < 1 ? 1 : page;
    }
    function buildNextPageUrl(page) {
        if (isFavoritePage()) return buildListPageUrl(page);
        if (isSearchResultPage()) {
            var pageLink = $('.pg a[href*="page=' + page + '"], .pg a[href*="page%3D' + page + '"], a[href*="search.php"][href*="page=' + page + '"]');
            if (pageLink) return normalizeUrl(pageLink.getAttribute('href') || pageLink.href);
        }
        var url = new URL(location.href);
        url.searchParams.set('page', page);
        return url.href;
    }
    function getUniqueThreadTidsInNode(node) {
        var tids = {};
        if (!node || !node.querySelectorAll) return tids;
        $all('a[href*="viewthread"][href*="tid="], a[href*="thread-"]', node).forEach(function(a) {
            if (isInsideToolUi(a)) return;
            var tid = getTidFromHref(a.getAttribute('href') || a.href);
            if (tid) tids[tid] = true;
        });
        return tids;
    }
    function countMapKeys(map) {
        return Object.keys(map || {}).length;
    }
    function isDocumentShellNode(node) {
        if (!node) return true;
        var doc = node.ownerDocument || document;
        return node === doc.body || node === doc.documentElement;
    }
    function isInlineNode(node) {
        return !!(node && /^(A|SPAN|EM|I|B|STRONG|FONT|SMALL|LABEL|IMG)$/i.test(node.tagName || ''));
    }
    function isBlockedPreviewArea(el) {
        if (isInsideToolUi(el)) return true;
        if (isThreadPage()) return true;
        return !!(el && el.closest && el.closest('#postlist, .t_f, .t_fsz, .pcb, #fastpostform, #pt, .pg, .pgs'));
    }
    function isSingleThreadItemNode(node, tid) {
        if (!node || isDocumentShellNode(node)) return false;
        if (isInlineNode(node)) return false;
        if (isBlockedPreviewArea(node)) return false;
        if (node.classList && node.classList.contains('shtx-preview-container')) return false;
        var tids = getUniqueThreadTidsInNode(node);
        return !!tids[tid] && countMapKeys(tids) === 1;
    }
    function getThreadItemNode(link) {
        if (!link || !link.closest) return link ? link.parentElement : null;
        var tid = getTidFromHref(link.getAttribute('href') || link.href);
        var candidate = link.closest('tbody[id*="thread_"], tr, li, dl, .bbda');
        if (isSingleThreadItemNode(candidate, tid)) return candidate;
        var node = link.parentElement;
        while (node && !isDocumentShellNode(node)) {
            if (isSingleThreadItemNode(node, tid)) return node;
            node = node.parentElement;
        }
        return null;
    }
    function getPreviewMountNode(link) {
        if (!link || isBlockedPreviewArea(link)) return null;
        var node = getThreadItemNode(link);
        if (!node || isInlineNode(node)) return null;
        return node;
    }
    function insertAfter(reference, node) {
        if (!reference || !reference.parentNode) return;
        reference.parentNode.insertBefore(node, reference.nextSibling);
    }
    function getPreviewWrapperForAnchor(anchor, tid) {
        if (!anchor || !anchor.nextElementSibling) return null;
        var next = anchor.nextElementSibling;
        while (next && next.nodeType === 1) {
            if (!(next.classList && (next.classList.contains('shtx-preview-row') || next.classList.contains('shtx-preview-block')))) break;
            if (!tid || next.getAttribute('data-tid') === tid || (next.querySelector && next.querySelector('.shtx-preview-container[data-tid="' + tid + '"]'))) return next;
            next = next.nextElementSibling;
        }
        return null;
    }
    function getPreviewContainerForAnchor(anchor, tid) {
        var wrapper = getPreviewWrapperForAnchor(anchor, tid);
        if (wrapper && wrapper.querySelector) return wrapper.querySelector('.shtx-preview-container[data-tid="' + tid + '"]');
        return null;
    }
    function getTableColSpan(anchor) {
        var row = null;
        if (!anchor) return 8;
        if (/^TR$/i.test(anchor.tagName || '')) row = anchor;
        else if (/^TBODY$/i.test(anchor.tagName || '')) row = anchor.querySelector('tr');
        if (!row || !row.children || !row.children.length) return 8;
        var span = 0;
        forEachNode(row.children, function(cell) {
            if (/^(TD|TH)$/i.test(cell.tagName || '')) span += parseInt(cell.getAttribute('colspan'), 10) || 1;
        });
        return span || 8;
    }
    function insertPreviewAfterAnchor(anchor, tid, container) {
        if (/^TR$/i.test(anchor.tagName || '')) {
            var tr = document.createElement('tr');
            tr.className = 'shtx-preview-row';
            tr.setAttribute('data-tid', tid);
            var td = document.createElement('td');
            td.colSpan = getTableColSpan(anchor);
            td.appendChild(container);
            tr.appendChild(td);
            insertAfter(anchor, tr);
            return;
        }
        if (/^TBODY$/i.test(anchor.tagName || '')) {
            var tbody = document.createElement('tbody');
            tbody.className = 'shtx-preview-row';
            tbody.setAttribute('data-tid', tid);
            var row = document.createElement('tr');
            var cell = document.createElement('td');
            cell.colSpan = getTableColSpan(anchor);
            cell.appendChild(container);
            row.appendChild(cell);
            tbody.appendChild(row);
            insertAfter(anchor, tbody);
            return;
        }
        var block = document.createElement(/^LI$/i.test(anchor.tagName || '') ? 'li' : 'div');
        block.className = 'shtx-preview-block';
        block.setAttribute('data-tid', tid);
        block.appendChild(container);
        insertAfter(anchor, block);
    }
    function getAppendTarget() {
        var currentThreads = getThreadsWithLinks(document);
        for (var i = currentThreads.length - 1; i >= 0; i--) {
            var node = getThreadItemNode(currentThreads[i].link);
            if (node && node.parentNode) return node.parentNode;
        }
        return $('#threadlisttableid') || $('#threadlist') || $('.xld') || $('.xl') || document.body;
    }
    function createSimpleThreadNode(thread, page, target) {
        if (target && /^(TBODY|THEAD|TFOOT)$/.test(target.tagName)) {
            var tr = document.createElement('tr');
            tr.className = 'shtx-autoload-simple';
            var td = document.createElement('td');
            td.colSpan = 8;
            td.innerHTML = '<a target="_blank" href="' + ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(thread.tid) + '">' + escapeHtml(thread.title) + '</a> <span class="shtx-status">第' + page + '页</span>';
            tr.appendChild(td);
            return tr;
        }
        var div = document.createElement('div');
        div.className = 'shtx-autoload-simple';
        div.innerHTML = '<a target="_blank" href="' + ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(thread.tid) + '">' + escapeHtml(thread.title) + '</a> <span class="shtx-status">第' + page + '页</span>';
        return div;
    }
    function appendFetchedPageThreads(doc, page, seen) {
        var target = getAppendTarget();
        if (!target) return 0;
        var added = 0;
        getThreadsWithLinks(doc).forEach(function(thread) {
            if (seen[thread.tid]) return;
            seen[thread.tid] = true;
            var sourceNode = getThreadItemNode(thread.link);
            var clone = null;
            if (sourceNode && sourceNode.cloneNode && sourceNode !== doc.body && sourceNode !== doc.documentElement) {
                clone = sourceNode.cloneNode(true);
                $all('script', clone).forEach(function(script) { script.remove(); });
                $all('.shtx-preview-container', clone).forEach(function(preview) { preview.remove(); });
                if (!isSingleThreadItemNode(clone, thread.tid)) clone = null;
            }
            if (!clone) clone = createSimpleThreadNode(thread, page, target);
            clone.setAttribute('data-shtx-autoload-page', String(page));
            target.appendChild(clone);
            added++;
        });
        dedupeThreadItems();
        return added;
    }
    function afterNextPagesAppended() {
        if (isPreviewToolPage()) {
            refreshThreads();
            if (getBool(KEYS.autoPreview, true) && STATE.previewVisible) loadAllPreviews();
        }
        if (isSearchResultPage()) applySearchFilter();
    }
    function loadNextFivePages(fromAuto) {
        if (!isNextPageLoadPage()) { toast('当前页面不支持加载后一页'); return; }
        if (STATE.nextPagesLoading) { updateNextStatus('后一页加载中...'); return; }
        STATE.nextPagesLoading = true;
        var basePage = Math.max(getCurrentPageNumber(), STATE.loadedMaxPage || 1);
        var startPage = basePage + 1;
        var detectedMax = Math.max(detectMaxPage(document) || 1, STATE.listMaxPage || 1);
        if (detectedMax > getCurrentPageNumber() && startPage > detectedMax) {
            STATE.nextPagesLoading = false;
            STATE.autoScrollEnd = true;
            updateNextStatus('没有更多页面');
            if (!fromAuto) toast('没有更多页面');
            return;
        }
        var endPage = startPage + CONFIG.NEXT_PAGE_COUNT - 1;
        if (detectedMax >= startPage) endPage = Math.min(endPage, detectedMax);
        var seen = {};
        getThreadsWithLinks(document).forEach(function(thread) { seen[thread.tid] = true; });
        var totalAdded = 0;
        function finish(message) {
            STATE.nextPagesLoading = false;
            updateNextStatus(message);
            afterNextPagesAppended();
            if (fromAuto && totalAdded === 0) STATE.autoScrollEnd = true;
            if (getBool(KEYS.autoScrollPages, false) && !STATE.autoScrollEnd) scheduleAutoScrollCheck();
            if (!fromAuto) toast(message);
        }
        function loadPage(page) {
            if (page > endPage) {
                finish('后一页完成，新增 ' + totalAdded + ' 个主题');
                return;
            }
            updateNextStatus('加载第 ' + page + ' 页...');
            fetch(buildNextPageUrl(page), { credentials: 'include' })
                .then(function(resp) { return resp.text(); })
                .then(function(html) {
                    var doc = new DOMParser().parseFromString(html, 'text/html');
                    totalAdded += appendFetchedPageThreads(doc, page, seen);
                    STATE.loadedMaxPage = Math.max(STATE.loadedMaxPage || 1, page);
                    afterNextPagesAppended();
                })
                .catch(function() {
                    STATE.loadedMaxPage = Math.max(STATE.loadedMaxPage || 1, page);
                    updateNextStatus('第 ' + page + ' 页加载失败，继续下一页');
                })
                .then(function() { setTimeout(function() { loadPage(page + 1); }, CONFIG.NEXT_PAGE_DELAY_MS); });
        }
        loadPage(startPage);
    }
    function toggleAutoNextPages() {
        setAutoNextPagesEnabled(!getBool(KEYS.autoNextPages, false));
    }
    function initAutoNextPages() {
        if (!isNextPageLoadPage()) return;
        if (isListToolPage()) return;
        if (!getBool(KEYS.autoNextPages, false)) return;
        if (STATE.nextPagesAutoStarted) return;
        STATE.nextPagesAutoStarted = true;
        setTimeout(function() { loadNextFivePages(true); }, 1000);
    }

    function toggleAutoScrollPages() {
        setAutoScrollPagesEnabled(!getBool(KEYS.autoScrollPages, false));
    }

    function isNearPageBottom() {
        var doc = document.documentElement;
        var body = document.body;
        var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
        var viewport = window.innerHeight || doc.clientHeight || 0;
        var height = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0);
        return height - scrollTop - viewport < 900;
    }

    function scheduleAutoScrollCheck() {
        if (!isAutoScrollNextPage() || !getBool(KEYS.autoScrollPages, false)) return;
        if (STATE.autoScrollTimer) clearTimeout(STATE.autoScrollTimer);
        STATE.autoScrollTimer = setTimeout(function() {
            STATE.autoScrollTimer = null;
            checkAutoScrollPages();
        }, 250);
    }

    function checkAutoScrollPages() {
        if (!isAutoScrollNextPage() || !getBool(KEYS.autoScrollPages, false)) return;
        if (STATE.nextPagesLoading || STATE.autoScrollEnd) return;
        if (isNearPageBottom()) loadNextFivePages(true);
    }

    function initAutoScrollPages() {
        if (!isAutoScrollNextPage()) return;
        window.addEventListener('scroll', scheduleAutoScrollCheck, { passive: true });
        window.addEventListener('resize', scheduleAutoScrollCheck);
        if (getBool(KEYS.autoScrollPages, false)) setTimeout(scheduleAutoScrollCheck, 800);
    }

    // ---------------- 帖子全图渐进加载 ----------------
    function toggleFullImageLoad() {
        setFullImageLoadEnabled(!getBool(CONFIG.FULL_IMAGE_KEY, false));
    }
    function normalizeImageUrl(url) {
        url = String(url || '').replace(/&amp;/g, '&').trim();
        if (!url) return '';
        if (/^(javascript:|about:|data:)/i.test(url)) return '';
        if (/static\/image\/common|static\/image\/smiley|smiley|avatar|loading|blank|none\.gif|spacer/i.test(url)) return '';
        return normalizeUrl(url);
    }
    function getRealImageUrl(img) {
        var attrs = ['file', 'zoomfile', 'data-src', 'data-original', 'data-lazy-src', 'data-url', 'data-echo', 'original', 'src'];
        for (var i = 0; i < attrs.length; i++) {
            var url = normalizeImageUrl(img.getAttribute(attrs[i]));
            if (url) return url;
        }
        return '';
    }
    function collectPostImages() {
        var result = [];
        $all('#postlist img, .t_fsz img, .t_f img, .pcb img').forEach(function(img) {
            var url = getRealImageUrl(img);
            if (!url || /smiley|avatar|static\/image\/common|static\/image\/smiley|uc_server\/avatar/i.test(url)) return;
            var currentUrl = normalizeImageUrl(img.getAttribute('src') || img.src || '');
            if (img.complete && img.naturalWidth > 0 && currentUrl === url) return;
            if (img.getAttribute('data-shtx-full-started') === '1') return;
            result.push({ img: img, url: url });
        });
        return result;
    }
    function loadOnePostImage(item) {
        return new Promise(function(resolve) {
            var img = item.img;
            var url = item.url;
            var done = false;
            function finish(status) {
                if (done) return;
                done = true;
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(status);
            }
            function onLoad() { finish('loaded'); }
            function onError() { finish('error'); }
            img.loading = 'eager';
            img.decoding = 'async';
            try { img.fetchPriority = 'low'; } catch(e) {}
            img.setAttribute('data-shtx-full-started', '1');
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
            img.src = url;
            setTimeout(function() { finish('timeout'); }, CONFIG.FULL_IMAGE_TIMEOUT_MS);
        });
    }
    function startFullImageLoad() {
        if (!isThreadPage() || STATE.fullImageRunning) return;
        STATE.fullImageRunning = true;
        var token = ++STATE.fullImageCancelToken;
        var loaded = 0, failed = 0;
        function pass(passIndex) {
            if (!getBool(CONFIG.FULL_IMAGE_KEY, false) || token !== STATE.fullImageCancelToken) {
                STATE.fullImageRunning = false;
                updateFullImageStatus();
                return;
            }
            var queue = collectPostImages();
            if (queue.length === 0) {
                if (passIndex < CONFIG.FULL_IMAGE_MAX_RESCAN) {
                    updateFullImageStatus('等待新图片...');
                    setTimeout(function() { pass(passIndex + 1); }, CONFIG.FULL_IMAGE_RESCAN_MS);
                } else {
                    STATE.fullImageRunning = false;
                    updateFullImageStatus('完成 ' + loaded + ' 张，失败 ' + failed + ' 张');
                }
                return;
            }
            process(queue, 0, function() {
                setTimeout(function() { pass(passIndex + 1); }, CONFIG.FULL_IMAGE_RESCAN_MS);
            });
        }
        function process(queue, index, done) {
            if (!getBool(CONFIG.FULL_IMAGE_KEY, false) || token !== STATE.fullImageCancelToken) {
                STATE.fullImageRunning = false;
                updateFullImageStatus();
                return;
            }
            if (index >= queue.length) { done(); return; }
            var batch = queue.slice(index, index + CONFIG.FULL_IMAGE_BATCH);
            updateFullImageStatus('加载 ' + (index + 1) + '-' + Math.min(index + batch.length, queue.length) + '/' + queue.length);
            Promise.all(batch.map(loadOnePostImage)).then(function(results) {
                results.forEach(function(status) { if (status === 'loaded') loaded++; else failed++; });
                setTimeout(function() { process(queue, index + CONFIG.FULL_IMAGE_BATCH, done); }, CONFIG.FULL_IMAGE_DELAY_MS);
            });
        }
        updateFullImageStatus('扫描图片...');
        pass(0);
    }
    function stopFullImageLoad() {
        STATE.fullImageRunning = false;
        STATE.fullImageCancelToken++;
    }

    // ---------------- 原创自拍区自动回复 ----------------
    function toggleAutoReply() {
        setAutoReplyEnabled(!getBool(KEYS.autoReply, true));
    }
    function loadAutoReplyState() {
        return readJson(CONFIG.AUTO_REPLY_STATE_KEY, { repliedTids: [], sessionCount: 0, lastReplyTime: 0 });
    }
    function saveAutoReplyState(state) {
        writeJson(CONFIG.AUTO_REPLY_STATE_KEY, state);
    }
    function hasHiddenContent() {
        var bodyText = document.body.textContent || '';
        if (/回复可见|回复后可见|需要回复|回复才可以浏览|如果您要查看本帖隐藏内容请回复|以下内容需要回复才能|本帖隐藏的内容/.test(bodyText)) return true;
        return !!$all('.locked, .alert_info, [id*="locked"]').some(function(el) { return /回复/.test(textOf(el)); });
    }
    function getRandomReply() {
        var n = 1 + Math.floor(Math.random() * 2);
        return REPLY_POOL.slice().sort(function() { return Math.random() - 0.5; }).slice(0, n).join('，');
    }
    function submitReply(replyText, tid, fid, formhash) {
        var params = new URLSearchParams();
        params.append('formhash', formhash);
        params.append('message', replyText);
        params.append('replysubmit', 'yes');
        params.append('modpost', 'on');
        params.append('handlekey', 'fastpost');
        return fetch(ORIGIN + '/forum.php?mod=post&action=reply&fid=' + encodeURIComponent(fid) + '&tid=' + encodeURIComponent(tid) + '&extra=&replysubmit=yes', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
        }).catch(function() {});
    }
    function runAutoReply() {
        if (!isThreadPage() || !getBool(KEYS.autoReply, true)) return;
        var tid = getTid();
        var fid = getFid();
        if (fid !== CONFIG.AUTO_REPLY_TARGET_FID || !hasHiddenContent()) return;
        var state = loadAutoReplyState();
        if (state.repliedTids.indexOf(tid) !== -1) return;
        if ((state.sessionCount || 0) >= CONFIG.AUTO_REPLY_MAX_PER_SESSION) return;
        if (Date.now() - (state.lastReplyTime || 0) < CONFIG.AUTO_REPLY_COOLDOWN) return;
        getFormhash().then(function(formhash) {
            if (!formhash) return;
            var reply = getRandomReply();
            return submitReply(reply, tid, fid, formhash).then(function() {
                state.repliedTids.push(tid);
                if (state.repliedTids.length > 200) state.repliedTids = state.repliedTids.slice(-200);
                state.sessionCount = (state.sessionCount || 0) + 1;
                state.lastReplyTime = Date.now();
                saveAutoReplyState(state);
                toast('已自动回复：' + reply);
                setTimeout(function() { location.reload(); }, 2000);
            });
        });
    }

    function startMutationObserver() {
        if (!window.MutationObserver) return;
        var timer = null;
        var observer = new MutationObserver(function(mutations) {
            var relevant = false;
            for (var i = 0; i < mutations.length; i++) {
                var nodes = Array.prototype.slice.call(mutations[i].addedNodes || []);
                for (var j = 0; j < nodes.length; j++) {
                    if (nodes[j] && nodes[j].nodeType === 1 && !isInsideToolUi(nodes[j])) {
                        relevant = true;
                        break;
                    }
                }
                if (relevant) break;
            }
            if (!relevant) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function() {
                timer = null;
                if (isPreviewToolPage()) scheduleRefreshThreads();
                if (isThreadPage() && getBool(CONFIG.FULL_IMAGE_KEY, false) && !STATE.fullImageRunning) startFullImageLoad();
                if (isThreadPage()) scheduleThreadEnhancements();
                if (isSearchResultPage()) applySearchFilter();
                if (isAutoScrollNextPage() && getBool(KEYS.autoScrollPages, false)) scheduleAutoScrollCheck();
            }, 700);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function cleanupLegacyPanels() {
        [
            'sht-open-fav-panel',
            'sht-progressive-image-loader-panel',
            'sht-toolbar',
            'sht-user-thread-toolbar',
        ].forEach(function(id) {
            var el = document.getElementById(id);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });

        $all('.sht-preview-container, .sht-user-thread-preview').forEach(function(el) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        if (!isPreviewToolPage()) {
            $all('.shtx-preview-row, .shtx-preview-block, .shtx-preview-container').forEach(function(el) {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            });
            return;
        }
        cleanupMisplacedPreviewContainers();
        dedupeThreadItems();
        dedupePreviewContainers();
    }

    function cleanupMisplacedPreviewContainers() {
        $all('.shtx-preview-container').forEach(function(el) {
            if (el.closest('.shtx-preview-row, .shtx-preview-block')) return;
            if (el.parentNode) el.parentNode.removeChild(el);
        });
    }

    function scoreThreadItemNode(node, tid) {
        var score = 0;
        var preview = getPreviewContainerForAnchor(node, tid);
        if (preview) score += preview.querySelector('img') ? 1000 : 800;
        if (!node.getAttribute || !node.getAttribute('data-shtx-autoload-page')) score += 120;
        score -= Math.min((node.querySelectorAll ? node.querySelectorAll('*').length : 0), 80);
        return score;
    }
    function dedupeThreadItems() {
        if (!isListToolPage()) return;
        var groups = {};
        var pairs = [];
        $all('a[href*="viewthread"][href*="tid="]').forEach(function(a) {
            if (isInsideToolUi(a)) return;
            var tid = getTidFromHref(a.getAttribute('href') || a.href);
            if (!tid) return;
            var node = getThreadItemNode(a);
            if (!isSingleThreadItemNode(node, tid)) return;
            for (var i = 0; i < pairs.length; i++) {
                if (pairs[i].tid === tid && pairs[i].node === node) return;
            }
            pairs.push({ tid: tid, node: node });
            if (!groups[tid]) groups[tid] = [];
            groups[tid].push(node);
        });

        Object.keys(groups).forEach(function(tid) {
            var nodes = groups[tid];
            if (nodes.length < 2) return;
            var keep = nodes[0];
            nodes.forEach(function(node) {
                if (scoreThreadItemNode(node, tid) > scoreThreadItemNode(keep, tid)) keep = node;
            });
            nodes.forEach(function(node) {
                if (node === keep || !node.parentNode || node.contains(keep)) return;
                var wrapper = getPreviewWrapperForAnchor(node, tid);
                if (wrapper && !getPreviewWrapperForAnchor(keep, tid)) {
                    insertAfter(keep, wrapper);
                } else if (wrapper && wrapper.parentNode) {
                    wrapper.parentNode.removeChild(wrapper);
                }
                node.parentNode.removeChild(node);
            });
        });
    }

    function dedupePreviewContainers() {
        var kept = [];
        $all('.shtx-preview-container').forEach(function(el) {
            var tid = el.getAttribute('data-tid') || '';
            var parent = el.parentNode;
            if (!tid || !parent) return;
            for (var i = 0; i < kept.length; i++) {
                if (kept[i].tid === tid && kept[i].parent === parent) {
                    parent.removeChild(el);
                    return;
                }
            }
            kept.push({ tid: tid, parent: parent });
        });
    }

    function init() {
        addStyle();
        cleanupLegacyPanels();
        initOpenRegistry();
        initListTools();
        applySearchFilter();
        createToolbar();
        initThreadEnhancements();
        initAutoSign(false);
        initAutoNextPages();
        initAutoScrollPages();
        if (isThreadPage() && getBool(CONFIG.FULL_IMAGE_KEY, false)) setTimeout(startFullImageLoad, 800);
        if (isThreadPage() && getFid() === CONFIG.AUTO_REPLY_TARGET_FID && getBool(KEYS.autoReply, true)) setTimeout(runAutoReply, 1200);
        startMutationObserver();
        setInterval(cleanupLegacyPanels, 2000);
    }

    setTimeout(init, 500);
})();
