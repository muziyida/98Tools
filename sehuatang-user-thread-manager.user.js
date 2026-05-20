// ==UserScript==
// @name         色花堂用户主题页 · 预览 + 导出
// @namespace    https://sehuatang.net/
// @version      1.0.0
// @description  用户主题页图片预览、全主题搜索、导出资源链接（ED2K/Magnet/附件）
// @author       米波
// @match        https://sehuatang.net/home.php*
// @match        https://www.sehuatang.net/home.php*
// @match        https://sehuatang.org/home.php*
// @match        https://www.sehuatang.org/home.php*
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    var CONFIG = {
        IMAGE_HEIGHT: 200,
        IMAGE_WIDTH: 240,
        MAX_IMAGES: 5,
        CONCURRENCY: 3,
        DEFAULT_MAX_PAGES: 120,
        EXPORT_DELAY_MS: 500,
        DEBUG: false,
    };

    var ORIGIN = location.origin;
    var gThreads = [];
    var gExpanded = true;
    var gSearchCancelled = false;
    var gUID = '';
    var gMaxPage = 1;
    var gRefreshTimer = null;
    var gObserver = null;

    function log() {
        if (CONFIG.DEBUG) {
            console.log.apply(console, ['[用户主题管理]'].concat([].slice.call(arguments)));
        }
    }

    function warn() {
        if (CONFIG.DEBUG) {
            console.warn.apply(console, ['[用户主题管理]'].concat([].slice.call(arguments)));
        }
    }

    function isUserThreadPage() {
        var params = new URLSearchParams(location.search);
        var mod = params.get('mod');
        return params.get('do') === 'thread' && (!mod || mod === 'space');
    }

    function forEachNode(nodes, fn) {
        for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
    }

    function getUID() {
        var params = new URLSearchParams(location.search);
        var uid = params.get('uid') || '';
        if (!uid) {
            var link = document.querySelector('a[href*="mod=space&uid="]');
            if (link) {
                var m = link.href.match(/[?&]uid=(\d+)/);
                if (m) uid = m[1];
            }
        }
        return uid;
    }

    function getTidFromHref(href) {
        var m = String(href || '').match(/[?&]tid=(\d+)/);
        return m ? m[1] : '';
    }

    function cleanText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function titleScore(a, title) {
        var score = title ? title.length : 0;
        if (/\bxst\b/.test(a.className || '')) score += 1000;
        if (!title || /^\d+$/.test(title)) score -= 500;
        return score;
    }

    function getThreadsWithLinks(root) {
        root = root || document;
        var links = root.querySelectorAll('a[href*="viewthread"][href*="tid="]');
        var map = {};
        forEachNode(links, function(a) {
            var tid = getTidFromHref(a.getAttribute('href') || a.href);
            if (!tid) return;
            var title = cleanText(a.textContent || a.innerText || '');
            var item = {
                tid: tid,
                link: a,
                title: title || ('tid=' + tid),
                score: titleScore(a, title),
            };
            if (!map[tid] || item.score > map[tid].score) map[tid] = item;
        });

        return Object.keys(map).map(function(tid) {
            return {
                tid: tid,
                link: map[tid].link,
                title: map[tid].title,
            };
        });
    }

    function refreshThreads() {
        var prevCount = gThreads.length;
        gThreads = getThreadsWithLinks();
        gMaxPage = Math.max(gMaxPage || 1, detectMaxPage());
        var status = document.getElementById('sht-user-thread-status');
        if (status) status.textContent = '当前页 ' + gThreads.length + ' 个主题';
        if (gThreads.length !== prevCount && getAutoPreviewSetting() && gExpanded) {
            loadAllPreviews();
        }
    }

    function scheduleRefresh() {
        if (gRefreshTimer) clearTimeout(gRefreshTimer);
        gRefreshTimer = setTimeout(function() {
            gRefreshTimer = null;
            refreshThreads();
        }, 500);
    }

    function buildThreadPageUrl(page) {
        var url = new URL(location.href);
        url.searchParams.set('page', page);
        return url.href;
    }

    function detectMaxPage(root) {
        root = root || document;
        var max = 1;
        var params = new URLSearchParams(location.search);
        var cur = parseInt(params.get('page'), 10);
        if (!isNaN(cur) && cur > max) max = cur;

        var links = root.querySelectorAll('.pg a[href*="page="], a.last[href*="page="]');
        forEachNode(links, function(a) {
            var m = (a.getAttribute('href') || a.href || '').match(/[?&]page=(\d+)/);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return max || 1;
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
            if (!src || seen[src] || /static\/image|smiley/i.test(src)) continue;
            seen[src] = true;
            if (/^https?:\/\//i.test(src)) urls.push(src);
            else if (src.indexOf('//') === 0) urls.push('https:' + src);
            else if (src.indexOf('/') === 0) urls.push(ORIGIN + src);
            else urls.push(ORIGIN + '/' + src);
        }
        return urls.slice(0, CONFIG.MAX_IMAGES);
    }

    function renderPreviews(thread, imageUrls) {
        var parent = thread.link.parentElement || thread.link.parentNode;
        if (!parent || parent.querySelector('.sht-user-thread-preview')) return;

        var container = document.createElement('div');
        container.className = 'sht-user-thread-preview';
        container.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';

        if (imageUrls.length === 0) {
            var empty = document.createElement('span');
            empty.textContent = '(无图片)';
            empty.style.cssText = 'color:#999;font-size:11px;';
            container.appendChild(empty);
        } else {
            imageUrls.forEach(function(url) {
                var wrapper = document.createElement('a');
                wrapper.href = ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(thread.tid);
                wrapper.target = '_blank';
                wrapper.style.cssText = 'display:inline-block;';

                var img = document.createElement('img');
                img.src = url;
                img.loading = 'lazy';
                img.style.cssText = 'height:' + CONFIG.IMAGE_HEIGHT + 'px;width:' + CONFIG.IMAGE_WIDTH + 'px;object-fit:cover;border-radius:3px;border:1px solid #ddd;background:#f0f0f0;display:block;';
                wrapper.appendChild(img);
                container.appendChild(wrapper);
            });
        }
        parent.appendChild(container);
    }

    var AUTO_PREVIEW_KEY = 'sht_user_thread_auto_preview';
    function getAutoPreviewSetting() {
        var val = localStorage.getItem(AUTO_PREVIEW_KEY);
        if (val === null) return true;
        return val === 'true';
    }
    function setAutoPreviewSetting(val) {
        localStorage.setItem(AUTO_PREVIEW_KEY, val ? 'true' : 'false');
    }

    function createToolbar() {
        var autoPreviewOn = getAutoPreviewSetting();
        gExpanded = autoPreviewOn;

        var old = document.getElementById('sht-user-thread-toolbar');
        if (old) old.remove();

        var bar = document.createElement('div');
        bar.id = 'sht-user-thread-toolbar';
        bar.style.cssText = 'position:fixed;top:50%;left:0;z-index:99999;transform:translateY(-50%);display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:12px 10px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:0 8px 8px 0;box-shadow:2px 2px 10px rgba(0,0,0,0.15);max-width:200px;';

        var toggleLabel = document.createElement('label');
        toggleLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:#555;cursor:pointer;white-space:nowrap;';
        var toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = autoPreviewOn;
        toggleInput.style.cssText = 'margin:0;cursor:pointer;';
        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(document.createTextNode('自动预览'));

        var previewBtn = document.createElement('button');
        previewBtn.id = 'sht-user-thread-toggle-btn';
        previewBtn.textContent = autoPreviewOn ? '收起预览' : '展开预览';
        previewBtn.style.cssText = 'padding:6px 16px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;white-space:nowrap;';
        if (!autoPreviewOn) previewBtn.style.opacity = '0.65';

        var searchBtn = document.createElement('button');
        searchBtn.textContent = '搜全部主题';
        searchBtn.style.cssText = 'padding:6px 12px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;';

        var exportBtn = document.createElement('button');
        exportBtn.textContent = '导出资源';
        exportBtn.style.cssText = 'padding:6px 12px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;';

        var status = document.createElement('span');
        status.id = 'sht-user-thread-status';
        status.textContent = '当前页 ' + gThreads.length + ' 个主题';
        status.style.cssText = 'color:#666;font-size:12px;white-space:nowrap;';

        bar.appendChild(toggleLabel);
        bar.appendChild(previewBtn);
        bar.appendChild(searchBtn);
        bar.appendChild(exportBtn);
        bar.appendChild(status);
        document.body.appendChild(bar);

        toggleInput.addEventListener('change', function() {
            var on = toggleInput.checked;
            setAutoPreviewSetting(on);
            if (on) {
                previewBtn.textContent = '收起预览';
                previewBtn.style.opacity = '1';
                gExpanded = true;
                forEachNode(document.querySelectorAll('.sht-user-thread-preview'), function(el) { el.style.display = 'flex'; });
                if (hasPendingPreviews()) loadAllPreviews();
            } else {
                previewBtn.textContent = '展开预览';
                previewBtn.style.opacity = '0.65';
                gExpanded = false;
                forEachNode(document.querySelectorAll('.sht-user-thread-preview'), function(el) { el.style.display = 'none'; });
            }
        });

        previewBtn.addEventListener('click', function() {
            if (gExpanded) {
                gExpanded = false;
                previewBtn.textContent = '展开预览';
                forEachNode(document.querySelectorAll('.sht-user-thread-preview'), function(el) { el.style.display = 'none'; });
                return;
            }

            gExpanded = true;
            previewBtn.textContent = '加载中...';
            previewBtn.disabled = true;
            previewBtn.style.opacity = '0.65';
            forEachNode(document.querySelectorAll('.sht-user-thread-preview'), function(el) { el.style.display = 'flex'; });
            loadAllPreviews().then(function() {
                previewBtn.textContent = '收起预览';
                previewBtn.disabled = false;
                previewBtn.style.opacity = '1';
            });
        });

        searchBtn.addEventListener('click', openSearchDialog);
        exportBtn.addEventListener('click', openExportDialog);
    }

    function hasPendingPreviews() {
        for (var i = 0; i < gThreads.length; i++) {
            var parent = gThreads[i].link.parentElement;
            if (parent && !parent.querySelector('.sht-user-thread-preview')) return true;
        }
        return false;
    }

    function loadAllPreviews() {
        var pending = [];
        gThreads.forEach(function(t) {
            var parent = t.link.parentElement;
            if (!parent || parent.querySelector('.sht-user-thread-preview')) return;
            pending.push(t);
        });
        if (pending.length === 0) return Promise.resolve();

        var status = document.getElementById('sht-user-thread-status');
        function processBatch(index) {
            if (index >= pending.length) {
                if (status) status.textContent = '当前页 ' + gThreads.length + ' 个主题';
                return Promise.resolve();
            }
            var batch = pending.slice(index, index + CONFIG.CONCURRENCY);
            return Promise.all(batch.map(function(thread) {
                return fetchImages(thread.tid).then(function(urls) { renderPreviews(thread, urls); });
            })).then(function() {
                if (status) status.textContent = '加载中 ' + Math.min(index + CONFIG.CONCURRENCY, pending.length) + '/' + pending.length;
                return processBatch(index + CONFIG.CONCURRENCY);
            });
        }
        return processBatch(0);
    }

    function showToast(msg) {
        var el = document.createElement('div');
        el.textContent = msg;
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:#333;color:#fff;border-radius:6px;z-index:999999;font-size:14px;opacity:0;transition:opacity 0.3s;';
        document.body.appendChild(el);
        setTimeout(function() { el.style.opacity = '1'; }, 10);
        setTimeout(function() {
            el.style.opacity = '0';
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
        }, 2200);
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function openSearchDialog() {
        var old = document.getElementById('sht-user-thread-search-dialog');
        if (old) old.remove();

        var dlg = document.createElement('div');
        dlg.id = 'sht-user-thread-search-dialog';
        dlg.style.cssText = 'display:flex;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:720px;max-height:80vh;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;overflow:hidden;flex-direction:column;';

        var header = document.createElement('div');
        header.style.cssText = 'padding:14px 16px;background:#f8f9fa;border-bottom:1px solid #ddd;';
        header.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong>用户主题搜索</strong><button id="sht-user-thread-search-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#999;line-height:1;">&times;</button></div>';

        var kwRow = document.createElement('div');
        kwRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
        kwRow.innerHTML = '<label style="font-size:13px;color:#555;white-space:nowrap;">关键词：</label>';
        var kwInput = document.createElement('input');
        kwInput.type = 'text';
        kwInput.placeholder = '输入搜索关键词...';
        kwInput.style.cssText = 'flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;';
        kwRow.appendChild(kwInput);
        header.appendChild(kwRow);

        var pageRow = document.createElement('div');
        pageRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        pageRow.innerHTML = '<label style="font-size:13px;color:#555;">页码范围：</label>';
        var startInput = document.createElement('input');
        startInput.type = 'number';
        startInput.min = 1;
        startInput.value = 1;
        startInput.style.cssText = 'width:64px;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;';
        pageRow.appendChild(startInput);
        pageRow.appendChild(document.createTextNode('至'));
        var endInput = document.createElement('input');
        endInput.type = 'number';
        endInput.min = 1;
        endInput.value = gMaxPage || CONFIG.DEFAULT_MAX_PAGES;
        endInput.style.cssText = 'width:64px;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;';
        pageRow.appendChild(endInput);

        var startBtn = document.createElement('button');
        startBtn.textContent = '开始搜索';
        startBtn.style.cssText = 'padding:6px 16px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;margin-left:auto;';
        pageRow.appendChild(startBtn);
        header.appendChild(pageRow);
        dlg.appendChild(header);

        var results = document.createElement('div');
        results.id = 'sht-user-thread-search-results';
        results.style.cssText = 'flex:1;overflow-y:auto;padding:10px 16px;min-height:100px;';
        results.innerHTML = '<div style="text-align:center;padding:30px;color:#ccc;font-size:13px;">设置关键词和页码范围后点击“开始搜索”</div>';
        dlg.appendChild(results);

        var footer = document.createElement('div');
        footer.style.cssText = 'padding:8px 16px;border-top:1px solid #eee;font-size:12px;color:#999;';
        dlg.appendChild(footer);
        document.body.appendChild(dlg);

        document.getElementById('sht-user-thread-search-close').onclick = function(e) {
            e.stopPropagation();
            gSearchCancelled = true;
            if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        };
        kwInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startBtn.click(); });
        startInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startBtn.click(); });
        endInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startBtn.click(); });

        startBtn.onclick = function() {
            var keyword = kwInput.value.trim();
            var start = parseInt(startInput.value, 10) || 1;
            var end = parseInt(endInput.value, 10) || gMaxPage || CONFIG.DEFAULT_MAX_PAGES;
            if (!keyword) {
                kwInput.style.borderColor = '#e74c3c';
                setTimeout(function() { kwInput.style.borderColor = '#ddd'; }, 1000);
                return;
            }
            if (start < 1) start = 1;
            if (end < 1) end = 1;
            if (start > end) { var tmp = start; start = end; end = tmp; }

            gSearchCancelled = false;
            startBtn.disabled = true;
            startBtn.style.opacity = '0.65';
            startBtn.textContent = '搜索中...';
            results.innerHTML = '';
            footer.textContent = '开始搜索第 ' + start + ' 页到第 ' + end + ' 页...';
            var totalFound = 0;
            var kwLower = keyword.toLowerCase();

            function searchPage(page) {
                if (page > end || gSearchCancelled) {
                    footer.textContent = gSearchCancelled ? '已取消，找到 ' + totalFound + ' 个匹配' : '搜索完成，找到 ' + totalFound + ' 个匹配';
                    if (totalFound === 0 && !gSearchCancelled) {
                        results.innerHTML = '<div style="text-align:center;padding:30px;color:#999;">未找到匹配“' + escapeHtml(keyword) + '”的主题</div>';
                    }
                    startBtn.disabled = false;
                    startBtn.style.opacity = '1';
                    startBtn.textContent = '开始搜索';
                    return;
                }

                fetch(buildThreadPageUrl(page), { credentials: 'include' })
                    .then(function(resp) { return resp.text(); })
                    .then(function(html) {
                        var doc = new DOMParser().parseFromString(html, 'text/html');
                        var threads = getThreadsWithLinks(doc);
                        threads.forEach(function(thread) {
                            if (thread.title.toLowerCase().indexOf(kwLower) === -1) return;
                            totalFound++;
                            var item = document.createElement('div');
                            item.style.cssText = 'padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;';
                            item.innerHTML = '<div style="display:flex;align-items:flex-start;gap:8px;">' +
                                '<a href="' + ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(thread.tid) + '" target="_blank" style="color:#e74c3c;text-decoration:none;flex:1;word-break:break-all;line-height:1.4;">' + highlightKeyword(thread.title, keyword) + '</a>' +
                                '<span style="color:#999;font-size:11px;white-space:nowrap;flex-shrink:0;margin-top:2px;">第' + page + '页</span>' +
                                '<button class="sht-user-thread-goto" data-page="' + page + '" style="padding:2px 8px;background:#3498db;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;flex-shrink:0;">跳转</button></div>';
                            item.querySelector('.sht-user-thread-goto').onclick = function() {
                                location.href = buildThreadPageUrl(this.dataset.page);
                            };
                            results.appendChild(item);
                        });
                        footer.textContent = '已搜索 ' + (page - start + 1) + '/' + (end - start + 1) + ' 页，找到 ' + totalFound + ' 个';
                    })
                    .catch(function(e) { warn('搜索失败:', e); })
                    .then(function() {
                        setTimeout(function() { searchPage(page + 1); }, 120);
                    });
            }

            searchPage(start);
        };
    }

    function highlightKeyword(text, keyword) {
        var safeText = escapeHtml(text);
        var safeKw = escapeRegExp(escapeHtml(keyword));
        return safeText.replace(new RegExp('(' + safeKw + ')', 'gi'), '<span style="background:#ffd54f;padding:0 2px;">$1</span>');
    }

    function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() { showToast('已复制到剪贴板'); })
                .catch(function() { fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast('已复制到剪贴板'); }
        catch(e) { showToast('复制失败'); }
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
        showToast('文件已下载');
    }

    function extractResourceLinks(tid, title) {
        return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + encodeURIComponent(tid), { credentials: 'include' })
            .then(function(resp) { return resp.text(); })
            .then(function(html) {
                var result = { title: title, tid: tid, ed2k: [], magnet: [], attachments: [] };
                var match;

                var ed2kRegex = /ed2k:\/\/\|file\|[^\n"<>]+/g;
                while ((match = ed2kRegex.exec(html)) !== null) {
                    addUnique(result.ed2k, match[0].replace(/&amp;/g, '&').trim());
                }

                var magnetRegex = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}[^"<\s]*/g;
                while ((match = magnetRegex.exec(html)) !== null) {
                    addUnique(result.magnet, match[0].replace(/&amp;/g, '&').trim());
                }

                var attachRegex = /<a[^>]*?href\s*=\s*["']([^"']*forum\.php\?mod=attachment(?:&|&amp;)aid=\d+[^"']*)["'][^>]*?>/gi;
                var seenAttach = {};
                while ((match = attachRegex.exec(html)) !== null) {
                    var href = match[1].replace(/&amp;/g, '&');
                    var fullUrl = /^https?:\/\//i.test(href) ? href : ORIGIN + '/' + href.replace(/^\//, '');
                    if (seenAttach[fullUrl]) continue;
                    seenAttach[fullUrl] = true;
                    var nameMatch = match[0].match(/>([^<]+)</);
                    var name = nameMatch ? cleanText(nameMatch[1]) : '附件';
                    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) continue;
                    result.attachments.push({ url: fullUrl, name: name });
                }
                return result;
            })
            .catch(function() {
                return { title: title, tid: tid, ed2k: [], magnet: [], attachments: [], error: '页面加载失败' };
            });
    }

    function addUnique(list, value) {
        if (value && list.indexOf(value) === -1) list.push(value);
    }

    function csvEscape(value) {
        return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    }

    function formatOutput(results, format) {
        var lines = [];
        var index = 0;
        if (format === 'csv') lines.push('标题,链接类型,链接');

        results.forEach(function(r) {
            var links = [];
            r.ed2k.forEach(function(url) { links.push({ type: 'ED2K', url: url }); });
            r.magnet.forEach(function(url) { links.push({ type: 'Magnet', url: url }); });
            r.attachments.forEach(function(item) { links.push({ type: '附件', url: item.url, name: item.name }); });

            if (links.length === 0) {
                if (format === 'url') return;
                if (format === 'csv') {
                    lines.push([csvEscape(r.title), csvEscape('无链接'), csvEscape('')].join(','));
                    return;
                }
                lines.push((++index) + '. ' + r.title + '\n   ' + (r.error ? '[加载失败] ' + r.error : '[无链接]'));
                return;
            }

            if (format === 'url') {
                links.forEach(function(link) { lines.push(link.url); });
            } else if (format === 'csv') {
                links.forEach(function(link) {
                    var label = link.type + (link.name ? '(' + link.name + ')' : '');
                    lines.push([csvEscape(r.title), csvEscape(label), csvEscape(link.url)].join(','));
                });
            } else {
                lines.push((++index) + '. ' + r.title + '\n' + links.map(function(link) {
                    var label = link.type + (link.name ? ': ' + link.name : '');
                    return '  [' + label + '] ' + link.url;
                }).join('\n'));
            }
        });
        return lines.join('\n');
    }

    function openExportDialog() {
        var threads = getThreadsWithLinks();
        if (threads.length === 0) {
            showToast('当前页没有主题');
            return;
        }

        var old = document.getElementById('sht-user-thread-export-dialog');
        if (old) old.remove();

        var dlg = document.createElement('div');
        dlg.id = 'sht-user-thread-export-dialog';
        dlg.style.cssText = 'display:flex;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;max-width:90vw;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;overflow:hidden;flex-direction:column;';

        var header = document.createElement('div');
        header.style.cssText = 'padding:14px 16px;background:#f8f9fa;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;';
        header.innerHTML = '<span style="font-weight:bold;font-size:14px;">导出资源链接</span><span style="font-size:12px;color:#999;">当前页 ' + threads.length + ' 个主题</span>';
        dlg.appendChild(header);

        var body = document.createElement('div');
        body.style.cssText = 'padding:16px;';
        body.innerHTML = '<div style="margin-bottom:12px;"><label style="font-size:13px;color:#555;display:block;margin-bottom:6px;">输出格式：</label>' +
            '<select id="sht-user-thread-export-format" style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;">' +
            '<option value="full">标题 + 链接</option><option value="url">纯链接（ED2K/Magnet/附件URL）</option></select></div>' +
            '<div style="margin-bottom:12px;"><label style="font-size:13px;color:#555;display:block;margin-bottom:6px;">输出方式：</label>' +
            '<select id="sht-user-thread-export-mode" style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;">' +
            '<option value="copy">复制到剪贴板</option><option value="download">下载为 .txt 文件</option><option value="csv">下载为 .csv 文件</option></select></div>' +
            '<div style="font-size:12px;color:#999;margin-bottom:12px;line-height:1.6;">导出当前页主题资源，依次提取 ED2K、Magnet 和非图片附件链接。</div>' +
            '<div id="sht-user-thread-export-progress" style="font-size:13px;color:#666;margin-bottom:8px;min-height:20px;"></div>';

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';
        var startBtn = document.createElement('button');
        startBtn.textContent = '开始导出';
        startBtn.style.cssText = 'flex:1;padding:8px 0;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;';
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:8px 16px;background:#95a5a6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;';
        cancelBtn.onclick = function() { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
        btnRow.appendChild(startBtn);
        btnRow.appendChild(cancelBtn);
        body.appendChild(btnRow);
        dlg.appendChild(body);
        document.body.appendChild(dlg);

        var isRunning = false;
        var cancelled = false;
        startBtn.onclick = function() {
            if (isRunning) return;
            isRunning = true;
            cancelled = false;
            startBtn.disabled = true;
            startBtn.textContent = '导出中...';
            cancelBtn.textContent = '停止';
            cancelBtn.onclick = function() { cancelled = true; };

            var format = document.getElementById('sht-user-thread-export-format').value;
            var mode = document.getElementById('sht-user-thread-export-mode').value;
            if (mode === 'csv') format = 'csv';
            var progress = document.getElementById('sht-user-thread-export-progress');
            var results = [];

            function processThread(index) {
                if (index >= threads.length || cancelled) {
                    if (cancelled) {
                        progress.textContent = '已停止';
                        startBtn.disabled = false;
                        startBtn.textContent = '重新导出';
                        isRunning = false;
                        cancelBtn.textContent = '关闭';
                        cancelBtn.onclick = function() { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
                        return;
                    }

                    var totalED2K = 0, totalMagnet = 0, totalAttach = 0;
                    results.forEach(function(r) {
                        totalED2K += r.ed2k.length;
                        totalMagnet += r.magnet.length;
                        totalAttach += r.attachments.length;
                    });
                    var total = totalED2K + totalMagnet + totalAttach;
                    progress.textContent = '处理完成：' + threads.length + ' 个主题，共提取 ' + total + ' 个链接';

                    var text = formatOutput(results, format);
                    var timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    if (mode === 'copy') copyToClipboard(text);
                    else if (mode === 'csv') downloadAsFile(text, 'sehuatang_user_threads_' + timestamp + '.csv', 'text/csv;charset=utf-8');
                    else downloadAsFile(text, 'sehuatang_user_threads_' + timestamp + '.txt');

                    startBtn.textContent = '已完成';
                    isRunning = false;
                    cancelBtn.textContent = '关闭';
                    cancelBtn.onclick = function() { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
                    return;
                }

                progress.textContent = '正在处理 (' + (index + 1) + '/' + threads.length + ')：' + threads[index].title.substring(0, 42);
                extractResourceLinks(threads[index].tid, threads[index].title).then(function(result) {
                    results.push(result);
                    setTimeout(function() { processThread(index + 1); }, CONFIG.EXPORT_DELAY_MS);
                });
            }

            processThread(0);
        };
    }

    function main() {
        if (!isUserThreadPage()) return;
        gUID = getUID();
        gThreads = getThreadsWithLinks();
        gMaxPage = detectMaxPage();
        if (gThreads.length === 0) {
            log('未找到主题');
            return;
        }

        createToolbar();
        if (getAutoPreviewSetting()) loadAllPreviews();

        if (!gObserver && window.MutationObserver) {
            gObserver = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
                        scheduleRefresh();
                        break;
                    }
                }
            });
            gObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    setTimeout(main, 500);
})();
