// ==UserScript==
// @name         色花堂打开页 · 一键收藏
// @namespace    https://sehuatang.net/
// @version      1.0.0
// @description  记录当前浏览器中已打开的色花堂帖子页，并批量加入站内收藏
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

    var CONFIG = {
        REGISTRY_KEY: 'sht_open_thread_tabs_v1',
        TAB_ID_KEY: 'sht_open_thread_tab_id_v1',
        HEARTBEAT_MS: 10000,
        STALE_MS: 45000,
        FAVORITE_DELAY_MS: 600,
        DEBUG: false,
    };

    var ORIGIN = location.origin;
    var gCurrentTid = getTidFromUrl(location.href);

    function log() {
        if (CONFIG.DEBUG) {
            console.log.apply(console, ['[打开页收藏]'].concat([].slice.call(arguments)));
        }
    }

    function forEachNode(nodes, fn) {
        for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
    }

    function safeJsonParse(text, fallback) {
        if (!text) return fallback;
        try { return JSON.parse(text); } catch(e) { return fallback; }
    }

    function getTidFromUrl(url) {
        var m = String(url || '').match(/[?&]tid=(\d+)/);
        return m ? m[1] : '';
    }

    function getTabId() {
        var id = '';
        try { id = sessionStorage.getItem(CONFIG.TAB_ID_KEY) || ''; } catch(e) {}
        if (!id) {
            id = String(Date.now()) + '_' + Math.random().toString(16).slice(2);
            try { sessionStorage.setItem(CONFIG.TAB_ID_KEY, id); } catch(e2) {}
        }
        return id;
    }

    function cleanTitle(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .replace(/\s*[-_].*?色花堂.*$/i, '')
            .trim();
    }

    function getThreadTitle() {
        var el = document.querySelector('#thread_subject') ||
            document.querySelector('.ts span') ||
            document.querySelector('h1');
        var title = el ? cleanTitle(el.textContent || el.innerText || '') : '';
        if (!title) title = cleanTitle(document.title || '');
        return title || ('tid=' + gCurrentTid);
    }

    function getThreadUrl(tid) {
        return ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid);
    }

    function readRegistry() {
        return safeJsonParse(localStorage.getItem(CONFIG.REGISTRY_KEY), {});
    }

    function writeRegistry(registry) {
        try { localStorage.setItem(CONFIG.REGISTRY_KEY, JSON.stringify(registry)); } catch(e) {}
    }

    function cleanRegistry(registry) {
        var now = Date.now();
        Object.keys(registry).forEach(function(tabId) {
            var item = registry[tabId];
            if (!item || !item.tid || !item.updatedAt || now - item.updatedAt > CONFIG.STALE_MS) {
                delete registry[tabId];
            }
        });
        return registry;
    }

    function registerCurrentThread() {
        if (!gCurrentTid) return;
        var registry = cleanRegistry(readRegistry());
        registry[getTabId()] = {
            tid: gCurrentTid,
            title: getThreadTitle(),
            url: getThreadUrl(gCurrentTid),
            updatedAt: Date.now(),
        };
        writeRegistry(registry);
        updatePanelCount();
        log('登记帖子页', gCurrentTid);
    }

    function unregisterCurrentThread() {
        if (!gCurrentTid) return;
        var registry = readRegistry();
        delete registry[getTabId()];
        writeRegistry(registry);
    }

    function getOpenThreads() {
        var registry = cleanRegistry(readRegistry());
        writeRegistry(registry);

        var byTid = {};
        Object.keys(registry).forEach(function(tabId) {
            var item = registry[tabId];
            if (!item || !item.tid) return;
            if (!byTid[item.tid] || byTid[item.tid].updatedAt < item.updatedAt) {
                byTid[item.tid] = item;
            }
        });

        return Object.keys(byTid).map(function(tid) { return byTid[tid]; })
            .sort(function(a, b) { return b.updatedAt - a.updatedAt; });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function showToast(message) {
        var old = document.getElementById('sht-open-fav-toast');
        if (old) old.remove();

        var el = document.createElement('div');
        el.id = 'sht-open-fav-toast';
        el.textContent = message;
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:999999;padding:10px 18px;background:#333;color:#fff;border-radius:6px;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.25);opacity:0;transition:opacity .2s;';
        document.body.appendChild(el);
        setTimeout(function() { el.style.opacity = '1'; }, 10);
        setTimeout(function() {
            el.style.opacity = '0';
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
        }, 2200);
    }

    function getFormhashFromDocument(doc) {
        var input = doc.querySelector('input[name="formhash"]');
        if (input && input.value) return input.value;

        var logout = doc.querySelector('a[href*="logout"][href*="formhash="]');
        if (logout) {
            var m = logout.href.match(/formhash=([a-z0-9]+)/i);
            if (m) return m[1];
        }

        var scripts = doc.querySelectorAll('script:not([src])');
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
            .then(function(html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                return getFormhashFromDocument(doc);
            });
    }

    function parseFavoriteResponse(html) {
        var text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        if (/收藏成功|信息收藏成功|成功加入|添加收藏成功/.test(text)) {
            return { state: 'success', label: '收藏成功' };
        }
        if (/您已收藏|已经收藏|已收藏|重复收藏|请勿重复/.test(text)) {
            return { state: 'exists', label: '已收藏' };
        }
        if (/请先登录|登录后|未登录/.test(text)) {
            return { state: 'error', label: '需要登录' };
        }
        if (/formhash|表单|提交.*无效/.test(text)) {
            return { state: 'error', label: 'formhash 无效' };
        }
        return { state: 'error', label: '收藏失败' };
    }

    function favoriteThread(tid, formhash) {
        var url = ORIGIN +
            '/home.php?mod=spacecp&ac=favorite&type=thread&id=' + encodeURIComponent(tid) +
            '&formhash=' + encodeURIComponent(formhash) +
            '&infloat=yes&handlekey=k_favorite&inajax=1&ajaxtarget=fwin_content_k_favorite';

        return fetch(url, { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(parseFavoriteResponse)
            .catch(function() { return { state: 'error', label: '网络失败' }; });
    }

    function updatePanelCount() {
        var el = document.getElementById('sht-open-fav-count');
        if (!el) return;
        el.textContent = '检测到 ' + getOpenThreads().length + ' 个打开的帖子页';
    }

    function createPanel() {
        if (document.getElementById('sht-open-fav-panel')) return;

        var panel = document.createElement('div');
        panel.id = 'sht-open-fav-panel';
        panel.style.cssText = 'position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:99998;width:150px;padding:10px;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.18);font-size:12px;color:#555;';

        var btn = document.createElement('button');
        btn.textContent = '收藏打开帖子';
        btn.style.cssText = 'width:100%;padding:7px 0;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;';
        btn.addEventListener('click', openFavoriteDialog);

        var count = document.createElement('div');
        count.id = 'sht-open-fav-count';
        count.style.cssText = 'margin-top:7px;line-height:1.4;color:#777;';

        panel.appendChild(btn);
        panel.appendChild(count);
        document.body.appendChild(panel);
        updatePanelCount();
    }

    function openFavoriteDialog() {
        var threads = getOpenThreads();
        if (threads.length === 0) {
            showToast('未检测到打开的帖子页');
            return;
        }

        var old = document.getElementById('sht-open-fav-dialog');
        if (old) old.remove();

        var dlg = document.createElement('div');
        dlg.id = 'sht-open-fav-dialog';
        dlg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999999;width:640px;max-width:92vw;max-height:82vh;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.32);display:flex;flex-direction:column;overflow:hidden;font-size:13px;color:#333;';

        var header = document.createElement('div');
        header.style.cssText = 'padding:12px 14px;background:#f8f9fa;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;gap:10px;';
        header.innerHTML = '<strong>收藏打开的帖子页</strong><span style="color:#888;font-size:12px;">共 ' + threads.length + ' 个</span>';

        var close = document.createElement('button');
        close.textContent = '×';
        close.title = '关闭';
        close.style.cssText = 'border:none;background:transparent;color:#888;font-size:20px;line-height:1;cursor:pointer;padding:0 2px;';
        close.onclick = function() { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
        header.appendChild(close);
        dlg.appendChild(header);

        var list = document.createElement('div');
        list.id = 'sht-open-fav-list';
        list.style.cssText = 'padding:8px 14px;overflow-y:auto;max-height:52vh;';
        list.innerHTML = threads.map(function(item) {
            return '<div class="sht-open-fav-row" data-tid="' + escapeHtml(item.tid) + '" style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f0f0f0;">' +
                '<a href="' + escapeHtml(item.url) + '" target="_blank" style="flex:1;color:#e74c3c;text-decoration:none;word-break:break-all;line-height:1.45;">' + escapeHtml(item.title) + '</a>' +
                '<span class="sht-open-fav-status" style="width:82px;flex-shrink:0;text-align:right;color:#999;">待收藏</span>' +
            '</div>';
        }).join('');
        dlg.appendChild(list);

        var footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 14px;border-top:1px solid #eee;background:#fff;';

        var progress = document.createElement('div');
        progress.id = 'sht-open-fav-progress';
        progress.style.cssText = 'min-height:20px;margin-bottom:8px;color:#666;';

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';

        var start = document.createElement('button');
        start.textContent = '开始收藏';
        start.style.cssText = 'flex:1;padding:8px 0;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;';
        start.onclick = function() { startBatchFavorite(threads, start, progress); };

        var refresh = document.createElement('button');
        refresh.textContent = '刷新列表';
        refresh.style.cssText = 'padding:8px 14px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;';
        refresh.onclick = function() {
            dlg.remove();
            openFavoriteDialog();
        };

        btnRow.appendChild(start);
        btnRow.appendChild(refresh);
        footer.appendChild(progress);
        footer.appendChild(btnRow);
        dlg.appendChild(footer);
        document.body.appendChild(dlg);
    }

    function setRowStatus(tid, text, color) {
        var row = document.querySelector('#sht-open-fav-list [data-tid="' + tid + '"] .sht-open-fav-status');
        if (!row) return;
        row.textContent = text;
        row.style.color = color || '#999';
    }

    function startBatchFavorite(threads, startBtn, progressEl) {
        if (startBtn.disabled) return;
        startBtn.disabled = true;
        startBtn.style.opacity = '0.65';
        startBtn.textContent = '收藏中...';
        progressEl.textContent = '正在获取 formhash...';

        getFormhash().then(function(formhash) {
            if (!formhash) throw new Error('无法获取 formhash，请确认已经登录');

            var success = 0, exists = 0, failed = 0;

            function next(index) {
                if (index >= threads.length) {
                    progressEl.textContent = '完成：成功 ' + success + '，已收藏 ' + exists + '，失败 ' + failed;
                    startBtn.textContent = '已完成';
                    showToast('批量收藏完成');
                    return;
                }

                var item = threads[index];
                progressEl.textContent = '正在收藏 ' + (index + 1) + '/' + threads.length + '：' + item.title;
                setRowStatus(item.tid, '处理中', '#3498db');

                favoriteThread(item.tid, formhash).then(function(result) {
                    if (result.state === 'success') {
                        success++;
                        setRowStatus(item.tid, result.label, '#27ae60');
                    } else if (result.state === 'exists') {
                        exists++;
                        setRowStatus(item.tid, result.label, '#999');
                    } else {
                        failed++;
                        setRowStatus(item.tid, result.label, '#e74c3c');
                    }
                    setTimeout(function() { next(index + 1); }, CONFIG.FAVORITE_DELAY_MS);
                });
            }

            next(0);
        }).catch(function(err) {
            progressEl.textContent = err && err.message ? err.message : '批量收藏失败';
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            startBtn.textContent = '重新开始';
        });
    }

    function init() {
        if (gCurrentTid) {
            registerCurrentThread();
            setInterval(registerCurrentThread, CONFIG.HEARTBEAT_MS);
            window.addEventListener('beforeunload', unregisterCurrentThread);
            window.addEventListener('pagehide', unregisterCurrentThread);
            window.addEventListener('unload', unregisterCurrentThread);
            document.addEventListener('visibilitychange', function() {
                if (!document.hidden) registerCurrentThread();
            });
        }

        writeRegistry(cleanRegistry(readRegistry()));
        createPanel();
        setInterval(updatePanelCount, CONFIG.HEARTBEAT_MS);
        window.addEventListener('storage', function(e) {
            if (e.key === CONFIG.REGISTRY_KEY) updatePanelCount();
        });

        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('收藏打开的帖子页', openFavoriteDialog);
        }
    }

    setTimeout(init, 500);
})();
