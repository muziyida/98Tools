// ==UserScript==
// @name         色花堂收藏页 · 预览 + 导出
// @namespace    https://sehuatang.net/
// @version      3.0.1
// @description  收藏页图片预览、全收藏搜索、导出资源链接（ED2K/Magnet/附件）
// @author       米波
// @match        https://sehuatang.net/home.php?mod=space&*do=favorite*
// @match        https://www.sehuatang.net/home.php?mod=space&*do=favorite*
// @match        https://sehuatang.org/home.php?mod=space&*do=favorite*
// @match        https://www.sehuatang.org/home.php?mod=space&*do=favorite*
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    var CONFIG = {
        IMAGE_HEIGHT: 200,
        IMAGE_WIDTH: 240,
        MAX_IMAGES: 5,
        CONCURRENCY: 3,
        ALL_PAGES: 120,
        DEBUG: false,
    };

    var log = CONFIG.DEBUG ? function() { console.log.apply(console, ['[收藏管理]'].concat([].slice.call(arguments))); } : function() {};
    var warn = CONFIG.DEBUG ? function() { console.warn.apply(console, ['[收藏管理]'].concat([].slice.call(arguments))); } : function() {};

    var gExpanded = true;
    var gThreads = [];
    var gSearchCancelled = false;
    var gUID = (location.href.match(/uid=(\d+)/)||[])[1] || '';
    if (!gUID) {
        var spaceLink = document.querySelector('a[href*="mod=space&uid="]');
        if (spaceLink) gUID = (spaceLink.href.match(/uid=(\d+)/)||[])[1];
    }

    var AUTO_PREVIEW_KEY = 'sht_auto_preview';
    function getAutoPreviewSetting() {
        var val = localStorage.getItem(AUTO_PREVIEW_KEY);
        if (val === null) return true;
        return val === 'true';
    }
    function setAutoPreviewSetting(val) {
        localStorage.setItem(AUTO_PREVIEW_KEY, val ? 'true' : 'false');
    }

    function forEachNode(nodes, fn) {
        for (var i = 0; i < nodes.length; i++) {
            fn(nodes[i], i);
        }
    }

    function getThreadsWithLinks() {
        var links = document.querySelectorAll('a[href*="viewthread&tid="]');
        var threads = [], seen = {};
        forEachNode(links, function(a) {
            var m = a.href.match(/tid=(\d+)/);
            if (!m || seen[m[1]]) return;
            seen[m[1]] = true;
            threads.push({
                tid: m[1],
                link: a,
                title: (a.textContent || a.innerText || '').trim(),
            });
        });
        return threads;
    }

    var ORIGIN = location.origin;

    function fetchImages(tid) {
        return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + tid).then(function(resp) {
            return resp.text();
        }).then(function(html) {
            return extractImageUrls(html);
        }).catch(function() {
            return [];
        });
    }

    function extractImageUrls(html) {
        var urls = [], seen = {};
        var regex = /<img[^>]*?class\s*=\s*["'][^"']*?zoom[^"']*?["'][^>]*?>/gi;
        var match;
        while ((match = regex.exec(html)) !== null) {
            var tag = match[0];
            var src = '';
            var fileMatch = tag.match(/file\s*=\s*["']([^"']+)["']/);
            if (fileMatch) src = fileMatch[1];
            else {
                var srcMatch = tag.match(/src\s*=\s*["']([^"']+)["']/);
                if (srcMatch) src = srcMatch[1];
            }
            if (!src || seen[src]) continue;
            if (/static\/image|smiley/i.test(src)) continue;
            seen[src] = true;
            if (/^https?:\/\//.test(src)) urls.push(src);
            else if (src.indexOf('//') === 0) urls.push('https:' + src);
            else if (src.indexOf('/') === 0) urls.push(ORIGIN + src);
            else urls.push(ORIGIN + '/' + src);
        }
        return urls.slice(0, CONFIG.MAX_IMAGES);
    }

    function renderPreviews(thread, imageUrls) {
        var parent = thread.link.parentElement || thread.link.parentNode;
        if (!parent || parent.querySelector('.sht-preview-container')) return;

        var container = document.createElement('div');
        container.className = 'sht-preview-container';
        container.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';

        if (imageUrls.length === 0) {
            var noImg = document.createElement('span');
            noImg.textContent = '(无图片)';
            noImg.style.cssText = 'color:#999;font-size:11px;';
            container.appendChild(noImg);
        } else {
            imageUrls.forEach(function(url) {
                var wrapper = document.createElement('a');
                wrapper.href = ORIGIN + '/forum.php?mod=viewthread&tid=' + thread.tid;
                wrapper.target = '_blank';
                wrapper.style.cssText = 'display:inline-block;';
                var img = document.createElement('img');
                img.src = url;
                img.style.cssText = 'height:' + CONFIG.IMAGE_HEIGHT + 'px;width:' + CONFIG.IMAGE_WIDTH + 'px;object-fit:cover;border-radius:3px;border:1px solid #ddd;background:#f0f0f0;display:block;';
                wrapper.appendChild(img);
                container.appendChild(wrapper);
            });
        }
        parent.appendChild(container);
    }

    function createToolbar() {
        var autoPreviewOn = getAutoPreviewSetting();
        gExpanded = autoPreviewOn;

        var old = document.getElementById('sht-toolbar');
        if (old) old.remove();

        var bar = document.createElement('div');
        bar.id = 'sht-toolbar';
        bar.style.cssText = 'position:fixed;top:50%;left:0;z-index:99999;transform:translateY(-50%);display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:12px 10px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:0 8px 8px 0;box-shadow:2px 2px 10px rgba(0,0,0,0.15);max-width:200px;';

        var toggleLabel = document.createElement('label');
        toggleLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:#555;cursor:pointer;white-space:nowrap;';
        var toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = autoPreviewOn;
        toggleInput.style.cssText = 'margin:0;cursor:pointer;';
        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(document.createTextNode('自动预览'));

        var btn = document.createElement('button');
        btn.id = 'sht-toggle-btn';
        btn.textContent = autoPreviewOn ? '\uD83D\uDD35 \u6536\u8D77\u9884\u89C8' : '\uD83D\uDCF7 \u5C55\u5F00\u9884\u89C8';
        btn.style.cssText = 'padding:6px 16px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;white-space:nowrap;';
        if (!autoPreviewOn) btn.style.opacity = '0.6';

        var searchAllBtn = document.createElement('button');
        searchAllBtn.id = 'sht-search-all-btn';
        searchAllBtn.textContent = '\uD83D\uDCD6 \u641C\u5168\u90E8\u6536\u85CF';
        searchAllBtn.style.cssText = 'padding:6px 12px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;';

        var exportBtn = document.createElement('button');
        exportBtn.id = 'sht-export-btn';
        exportBtn.textContent = '\uD83D\uDCCB \u5BFC\u51FA\u8D44\u6E90';
        exportBtn.style.cssText = 'padding:6px 12px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;';

        var status = document.createElement('span');
        status.id = 'sht-toggle-status';
        status.textContent = '\u5171 ' + gThreads.length + ' \u4E2A\u5E16\u5B50';
        status.style.cssText = 'color:#666;font-size:12px;white-space:nowrap;';

        bar.appendChild(toggleLabel);
        bar.appendChild(btn);
        bar.appendChild(searchAllBtn);
        bar.appendChild(exportBtn);
        bar.appendChild(status);

        document.body.appendChild(bar);

        toggleInput.addEventListener('change', function() {
            var on = toggleInput.checked;
            setAutoPreviewSetting(on);
            if (on) {
                btn.textContent = '\uD83D\uDD35 \u6536\u8D77\u9884\u89C8';
                btn.style.opacity = '1';
                gExpanded = true;
                forEachNode(document.querySelectorAll('.sht-preview-container'), function(el) { el.style.display = 'flex'; });
                var hasPending = false;
                gThreads.forEach(function(t) {
                    var p = t.link.parentElement;
                    if (!p || !p.querySelector('.sht-preview-container')) hasPending = true;
                });
                if (hasPending) loadAllPreviews();
            } else {
                btn.textContent = '\uD83D\uDCF7 \u5C55\u5F00\u9884\u89C8';
                btn.style.opacity = '0.6';
                gExpanded = false;
                forEachNode(document.querySelectorAll('.sht-preview-container'), function(el) { el.style.display = 'none'; });
            }
        });

        searchAllBtn.addEventListener('click', openSearchDialog);
        exportBtn.addEventListener('click', openExportDialog);

        return { btn: btn, toggleInput: toggleInput };
    }

    function loadAllPreviews() {
        var pending = [];
        gThreads.forEach(function(t) {
            var parent = t.link.parentElement;
            if (!parent || parent.querySelector('.sht-preview-container')) return;
            pending.push(t);
        });
        if (pending.length === 0) return Promise.resolve();

        var status = document.getElementById('sht-toggle-status');

        function processBatch(i) {
            if (i >= pending.length) {
                if (status) status.textContent = '\u5171 ' + gThreads.length + ' \u4E2A\u5E16\u5B50';
                return Promise.resolve();
            }
            var batch = pending.slice(i, i + CONFIG.CONCURRENCY);
            var tasks = batch.map(function(thread) {
                return fetchImages(thread.tid).then(function(urls) {
                    renderPreviews(thread, urls);
                });
            });
            return Promise.all(tasks).then(function() {
                if (status) status.textContent = '\u52A0\u8F7D\u4E2D ' + Math.min(i + CONFIG.CONCURRENCY, pending.length) + '/' + pending.length;
                return processBatch(i + CONFIG.CONCURRENCY);
            });
        }

        return processBatch(0);
    }

    function setupToggleButton(btn) {
        btn.addEventListener('click', function() {
            if (gExpanded) {
                forEachNode(document.querySelectorAll('.sht-preview-container'), function(el) { el.style.display = 'none'; });
                btn.textContent = '\uD83D\uDCF7 \u5C55\u5F00\u9884\u89C8';
                gExpanded = false;
            } else {
                gExpanded = true;
                btn.textContent = '\uD83D\uDD35 \u6536\u8D77\u9884\u89C8';
                forEachNode(document.querySelectorAll('.sht-preview-container'), function(el) { el.style.display = 'flex'; });
                var hasPending = false;
                gThreads.forEach(function(t) {
                    var p = t.link.parentElement;
                    if (!p || !p.querySelector('.sht-preview-container')) hasPending = true;
                });
                if (hasPending) {
                    btn.textContent = '\uD83D\uDD35 \u52A0\u8F7D\u4E2D...';
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                    loadAllPreviews().then(function() {
                        btn.textContent = '\uD83D\uDD35 \u6536\u8D77\u9884\u89C8';
                        btn.disabled = false;
                        btn.style.opacity = '1';
                    });
                }
            }
        });
    }

    function openSearchDialog() {
        var old = document.getElementById('sht-search-dialog');
        if (old) old.remove();

        var dlg = document.createElement('div');
        dlg.id = 'sht-search-dialog';
        dlg.style.cssText = 'display:flex;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:700px;max-height:80vh;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:99999;overflow:hidden;flex-direction:column;';

        var header = document.createElement('div');
        header.style.cssText = 'padding:14px 16px;background:#f8f9fa;border-bottom:1px solid #ddd;';
        var titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
        titleRow.innerHTML = '<span style="font-weight:bold;font-size:14px;">\uD83D\uDCD6 \u6536\u85CF\u641C\u7D22</span>' +
            '<button id="sht-dlg-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#999;line-height:1;">&times;</button>';
        header.appendChild(titleRow);

        var kwRow = document.createElement('div');
        kwRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
        kwRow.innerHTML = '<label style="font-size:13px;color:#555;white-space:nowrap;">\u5173\u952E\u8BCD\uFF1A</label>';
        var kwInput = document.createElement('input');
        kwInput.id = 'sht-dlg-kw';
        kwInput.type = 'text';
        kwInput.placeholder = '\u8F93\u5165\u641C\u7D22\u5173\u952E\u8BCD...';
        kwInput.style.cssText = 'flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;';
        kwRow.appendChild(kwInput);
        header.appendChild(kwRow);

        var pageRow = document.createElement('div');
        pageRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        pageRow.innerHTML = '<label style="font-size:13px;color:#555;">\u9875\u7801\u8303\u56F4\uFF1A</label>';
        var startInput = document.createElement('input');
        startInput.id = 'sht-dlg-start';
        startInput.type = 'number'; startInput.min = 1; startInput.max = CONFIG.ALL_PAGES; startInput.value = 1;
        startInput.style.cssText = 'width:60px;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;';
        pageRow.appendChild(startInput);
        pageRow.innerHTML += '<span style="color:#999;">\u81F3</span>';
        var endInput = document.createElement('input');
        endInput.id = 'sht-dlg-end';
        endInput.type = 'number'; endInput.min = 1; endInput.max = CONFIG.ALL_PAGES; endInput.value = Math.min(10, CONFIG.ALL_PAGES);
        endInput.style.cssText = 'width:60px;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;';
        pageRow.appendChild(endInput);

        var startBtn = document.createElement('button');
        startBtn.id = 'sht-dlg-startbtn';
        startBtn.textContent = '\uD83D\uDE80 \u5F00\u59CB\u641C\u7D22';
        startBtn.style.cssText = 'padding:6px 16px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;margin-left:auto;';
        pageRow.appendChild(startBtn);
        header.appendChild(pageRow);
        dlg.appendChild(header);

        var resultsDiv = document.createElement('div');
        resultsDiv.id = 'sht-dlg-results';
        resultsDiv.style.cssText = 'flex:1;overflow-y:auto;padding:10px 16px;min-height:100px;';
        resultsDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#ccc;font-size:13px;">\u8BBE\u7F6E\u5173\u952E\u8BCD\u548C\u9875\u7801\u8303\u56F4\u540E\u70B9\u51FB\u300C\u5F00\u59CB\u641C\u7D22\u300D</div>';
        dlg.appendChild(resultsDiv);

        var footer = document.createElement('div');
        footer.id = 'sht-dlg-footer';
        footer.style.cssText = 'padding:8px 16px;border-top:1px solid #eee;font-size:12px;color:#999;';
        dlg.appendChild(footer);
        document.body.appendChild(dlg);

        document.getElementById('sht-dlg-close').onclick = function(e) {
            e.stopPropagation(); gSearchCancelled = true;
            if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        };

        kwInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startBtn.click(); });
        startInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startBtn.click(); });
        endInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startBtn.click(); });

        startBtn.onclick = function() {
            var keyword = kwInput.value.trim();
            var start = parseInt(startInput.value) || 1;
            var end = parseInt(endInput.value) || CONFIG.ALL_PAGES;
            if (!keyword) { kwInput.style.borderColor = '#e74c3c'; setTimeout(function() { kwInput.style.borderColor = '#ddd'; }, 1000); return; }
            if (start < 1) start = 1; if (end > CONFIG.ALL_PAGES) end = CONFIG.ALL_PAGES; if (start > end) { var t = start; start = end; end = t; }

            gSearchCancelled = false;
            startBtn.disabled = true; startBtn.style.opacity = '0.6'; startBtn.textContent = '\u23F9 \u641C\u7D22\u4E2D...';
            resultsDiv.innerHTML = '';
            footer.textContent = '\u5F00\u59CB\u641C\u7D22\u7B2C ' + start + ' \u9875 ~ \u7B2C ' + end + ' \u9875...';
            var totalFound = 0;

            function searchPage(p) {
                if (p > end || gSearchCancelled) {
                    footer.textContent = gSearchCancelled ? '\u23F9 \u5DF2\u53D6\u6D88\uFF0C\u5171\u641C\u7D22\u5230 ' + totalFound + ' \u4E2A\u5339\u914D' : '\u2705 \u641C\u7D22\u5B8C\u6210\uFF0C\u5171 ' + (end - start + 1) + ' \u9875\uFF0C\u627E\u5230 ' + totalFound + ' \u4E2A\u5339\u914D';
                    if (totalFound === 0 && !gSearchCancelled) resultsDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#999;">\u672A\u627E\u5230\u5339\u914D "' + keyword + '" \u7684\u6536\u85CF</div>';
                    startBtn.disabled = false; startBtn.style.opacity = '1'; startBtn.textContent = '\uD83D\uDE80 \u5F00\u59CB\u641C\u7D22';
                    return;
                }

                fetch(ORIGIN + '/home.php?mod=space&uid=' + gUID + '&do=favorite&view=me&page=' + p).then(function(resp) {
                    return resp.text();
                }).then(function(html) {
                    var doc = new DOMParser().parseFromString(html, 'text/html');
                    var links = doc.querySelectorAll('a[href*="viewthread&tid="]');
                    var kwLower = keyword.toLowerCase();
                    forEachNode(links, function(a) {
                        var t = (a.textContent || a.innerText || '').trim();
                        if (t.toLowerCase().indexOf(kwLower) !== -1) {
                            var m = a.href.match(/tid=(\d+)/);
                            if (!m) return;
                            totalFound++;
                            var safeKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            var hl = t.replace(new RegExp('(' + safeKw + ')', 'gi'), '<span style="background:#ffd54f;padding:0 2px;">$1</span>');
                            var item = document.createElement('div');
                            item.style.cssText = 'padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;';
                            item.innerHTML = '<div style="display:flex;align-items:flex-start;gap:8px;">' +
                                '<a href="' + ORIGIN + '/forum.php?mod=viewthread&tid=' + m[1] + '" target="_blank" style="color:#e74c3c;text-decoration:none;flex:1;word-break:break-all;line-height:1.4;">' + hl + '</a>' +
                                '<span style="color:#999;font-size:11px;white-space:nowrap;flex-shrink:0;margin-top:2px;">\u7B2C' + p + '\u9875</span>' +
                                '<button class="sht-goto-btn" data-page="' + p + '" style="padding:2px 8px;background:#3498db;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;flex-shrink:0;">\u8DF3\u8F6C</button></div>';
                            item.querySelector('.sht-goto-btn').onclick = function() {
                                location.href = ORIGIN + '/home.php?mod=space&uid=' + gUID + '&do=favorite&view=me&page=' + this.dataset.page;
                            };
                            resultsDiv.appendChild(item);
                            resultsDiv.scrollTop = resultsDiv.scrollHeight;
                        }
                    });
                    footer.textContent = '\u5DF2\u641C\u7D22 ' + (p - start + 1) + '/' + (end - start + 1) + ' \u9875 | \u5F53\u524D\u7B2C ' + p + ' \u9875 | \u5DF2\u627E\u5230 ' + totalFound + ' \u4E2A';
                }).catch(function(e) {
                    warn('\u7B2C' + p + '\u9875\u5931\u8D25:', e);
                }).then(function() {
                    if (!gSearchCancelled && p < end) {
                        setTimeout(function() { searchPage(p + 1); }, 100);
                    } else {
                        searchPage(end + 1);
                    }
                });
            }

            searchPage(start);
        };
    }

    function showToast(msg) {
        var el = document.createElement('div');
        el.textContent = msg;
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:#333;color:#fff;border-radius:6px;z-index:999999;font-size:14px;opacity:0;transition:opacity 0.3s;';
        document.body.appendChild(el);
        setTimeout(function() { el.style.opacity = '1'; }, 10);
        setTimeout(function() {
            el.style.opacity = '0';
            setTimeout(function() { el.remove(); }, 300);
        }, 2000);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() { showToast('\u2705 \u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F'); })
            .catch(function() { fallbackCopy(text); });
        } else { fallbackCopy(text); }
    }
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;top:-9999px;';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showToast('\u2705 \u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F'); } catch(e) { showToast('\u274C \u590D\u5236\u5931\u8D25'); }
        document.body.removeChild(ta);
    }
    function downloadAsFile(text, filename) {
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('\u2705 \u6587\u4EF6\u5DF2\u4E0B\u8F7D');
    }

    function extractResourceLinks(tid, title) {
        return fetch(ORIGIN + '/forum.php?mod=viewthread&tid=' + tid).then(function(resp) {
            return resp.text();
        }).then(function(html) {
            var result = { title: title, tid: tid, ed2k: [], magnet: [], attachments: [] };
            var ed2kRegex = /ed2k:\/\/\|file\|[^\n"<>]+/g;
            var match;
            while ((match = ed2kRegex.exec(html)) !== null) { var url = match[0].replace(/&amp;/g, '&').trim(); if (result.ed2k.indexOf(url) === -1) result.ed2k.push(url); }
            var magnetRegex = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}[^"<\s]*/g;
            while ((match = magnetRegex.exec(html)) !== null) { var url = match[0].replace(/&amp;/g, '&').trim(); if (result.magnet.indexOf(url) === -1) result.magnet.push(url); }
            var attachRegex = /<a[^>]*?href\s*=\s*["'](forum\.php\?mod=attachment&aid=\d+[^"']*)["'][^>]*?>/gi;
            var seenAttach = {};
            while ((match = attachRegex.exec(html)) !== null) {
                var href = match[1].replace(/&amp;/g, '&');
                var fullUrl = href.indexOf('http') === 0 ? href : ORIGIN + '/' + href;
                if (!seenAttach[fullUrl]) {
                    seenAttach[fullUrl] = true;
                    var nameMatch = match[0].match(/>([^<]+)</);
                    var name = nameMatch ? nameMatch[1].trim() : '\u9644\u4EF6';
                    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) continue;
                    result.attachments.push({ url: fullUrl, name: name });
                }
            }
            return result;
        }).catch(function() {
            return { title: title, tid: tid, ed2k: [], magnet: [], attachments: [], error: '\u9875\u9762\u52A0\u8F7D\u5931\u8D25' };
        });
    }

    function formatOutput(results, format) {
        var lines = []; var index = 0;
        if (format === 'csv') lines.push('\u6807\u9898,\u94FE\u63A5\u7C7B\u578B,\u94FE\u63A5');
        results.forEach(function(r) {
            var links = [];
            if (r.ed2k.length > 0) r.ed2k.forEach(function(url) { links.push({ type: 'ED2K', url: url }); });
            if (r.magnet.length > 0) r.magnet.forEach(function(url) { links.push({ type: 'Magnet', url: url }); });
            if (r.attachments.length > 0) r.attachments.forEach(function(a) { links.push({ type: '\u9644\u4EF6', url: a.url, name: a.name }); });
            if (links.length === 0) {
                if (format === 'url') return;
                if (format === 'csv') { lines.push('"' + r.title + '","\u65E0\u94FE\u63A5",""'); return; }
                if (format === 'full') { var errMsg = r.error ? '[\u52A0\u8F7D\u5931\u8D25] ' + r.error : '[\u65E0\u94FE\u63A5]'; lines.push((++index) + '. ' + r.title + '\n   ' + errMsg); return; }
            }
            if (format === 'url') { links.forEach(function(l) { lines.push(l.url); }); }
            else if (format === 'csv') { links.forEach(function(l) { var label = l.type + (l.name ? '(' + l.name + ')' : ''); lines.push('"' + r.title + '","' + label + '","' + l.url + '"'); }); }
            else { var linkTexts = links.map(function(l) { var label = l.type + (l.name ? ': ' + l.name : ''); return '  [' + label + '] ' + l.url; }).join('\n'); lines.push((++index) + '. ' + r.title + '\n' + linkTexts); }
        });
        return lines.join('\n');
    }

    function openExportDialog() {
        var threads = getThreadsWithLinks();
        if (threads.length === 0) { showToast('\u5F53\u524D\u9875\u6CA1\u6709\u5E16\u5B50'); return; }

        var old = document.getElementById('sht-export-dlg');
        if (old) old.remove();

        var dlg = document.createElement('div');
        dlg.id = 'sht-export-dlg';
        dlg.style.cssText = 'display:flex;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;max-width:90vw;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:99999;overflow:hidden;flex-direction:column;';

        var header = document.createElement('div');
        header.style.cssText = 'padding:14px 16px;background:#f8f9fa;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;';
        header.innerHTML = '<span style="font-weight:bold;font-size:14px;">\uD83D\uDCCB \u5BFC\u51FA\u8D44\u6E90\u94FE\u63A5</span><span style="font-size:12px;color:#999;">\u5F53\u524D\u9875 ' + threads.length + ' \u4E2A\u5E16\u5B50</span>';
        dlg.appendChild(header);

        var body = document.createElement('div');
        body.style.cssText = 'padding:16px;';
        body.innerHTML += '<div style="margin-bottom:12px;"><label style="font-size:13px;color:#555;display:block;margin-bottom:6px;">\u8F93\u51FA\u683C\u5F0F\uFF1A</label>' +
            '<select id="sht-export-format" style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;">' +
            '<option value="full">\u6807\u9898 + \u94FE\u63A5</option><option value="url">\u7EAF\u94FE\u63A5\uFF08ED2K/Magnet/\u9644\u4EF6URL\uFF09</option></select></div>';
        body.innerHTML += '<div style="margin-bottom:12px;"><label style="font-size:13px;color:#555;display:block;margin-bottom:6px;">\u8F93\u51FA\u65B9\u5F0F\uFF1A</label>' +
            '<select id="sht-export-mode" style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;outline:none;">' +
            '<option value="copy">\u590D\u5236\u5230\u526A\u8D34\u677F</option><option value="download">\u4E0B\u8F7D\u4E3A .txt \u6587\u4EF6</option><option value="csv">\u4E0B\u8F7D\u4E3A .csv \u6587\u4EF6\uFF08\u5E26\u8868\u5934\uFF09</option></select></div>';
        body.innerHTML += '<div style="font-size:12px;color:#999;margin-bottom:12px;line-height:1.6;">\u5BFC\u51FA\u903B\u8F91\uFF1A\u4F18\u5148\u63D0\u53D6 ED2K \u94FE\u63A5 \u2192 \u65E0\u5219\u63D0\u53D6 Magnet \u2192 \u65E0\u5219\u63D0\u53D6\u9644\u4EF6\u4E0B\u8F7D\u94FE\u63A5\u3002<br>\u9644\u4EF6\u4EC5\u5BFC\u51FA\u975E\u56FE\u7247\u6587\u4EF6\uFF08txt/zip/rar/7z\uFF09\u3002</div>';
        body.innerHTML += '<div id="sht-export-progress" style="font-size:13px;color:#666;margin-bottom:8px;min-height:20px;"></div>';

        var btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:8px;';
        var startBtn = document.createElement('button');
        startBtn.textContent = '\uD83D\uDE80 \u5F00\u59CB\u5BFC\u51FA';
        startBtn.style.cssText = 'flex:1;padding:8px 0;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;';
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = '\u53D6\u6D88';
        cancelBtn.style.cssText = 'padding:8px 16px;background:#95a5a6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;';
        cancelBtn.onclick = function() { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
        btnRow.appendChild(startBtn); btnRow.appendChild(cancelBtn);
        body.appendChild(btnRow);
        dlg.appendChild(body);
        document.body.appendChild(dlg);

        var isRunning = false, cancelled = false;
        startBtn.onclick = function() {
            if (isRunning) return;
            isRunning = true; cancelled = false;
            startBtn.disabled = true; startBtn.textContent = '\u23F3 \u5BFC\u51FA\u4E2D...';
            cancelBtn.textContent = '\u53D6\u6D88'; cancelBtn.onclick = function() { cancelled = true; };

            var format = document.getElementById('sht-export-format').value;
            var mode = document.getElementById('sht-export-mode').value;
            if (mode === 'csv') format = 'csv';
            var progress = document.getElementById('sht-export-progress');
            var results = [];

            function processThread(i) {
                if (i >= threads.length || cancelled) {
                    if (cancelled) {
                        progress.textContent = '\u23F9 \u5DF2\u53D6\u6D88';
                        startBtn.textContent = '\uD83D\uDE80 \u5F00\u59CB\u5BFC\u51FA'; startBtn.disabled = false; isRunning = false;
                        cancelBtn.textContent = '\u5173\u95ED'; cancelBtn.onclick = function() { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
                        return;
                    }

                    var totalED2K = 0, totalMagnet = 0, totalAttach = 0;
                    results.forEach(function(r) { totalED2K += r.ed2k.length; totalMagnet += r.magnet.length; totalAttach += r.attachments.length; });
                    var total = totalED2K + totalMagnet + totalAttach;
                    progress.innerHTML = '\u2705 \u5904\u7406\u5B8C\u6210\uFF1A' + threads.length + ' \u4E2A\u5E16\u5B50\uFF0C\u5171\u63D0\u53D6 ' + total + ' \u4E2A\u94FE\u63A5 <span style="color:#27ae60;">[ED2K:' + totalED2K + ' Magnet:' + totalMagnet + ' \u9644\u4EF6:' + totalAttach + ']</span>';

                    var text = formatOutput(results, format);
                    var timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    var ext = (mode === 'csv') ? '.csv' : '.txt';
                    var filename = 'sehuatang_export_' + timestamp + ext;

                    if (mode === 'copy') copyToClipboard(text);
                    else downloadAsFile(text, filename);

                    startBtn.textContent = '\u2705 \u5DF2\u5B8C\u6210'; isRunning = false;
                    cancelBtn.textContent = '\u5173\u95ED'; cancelBtn.onclick = function() { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
                    return;
                }

                progress.textContent = '\u6B63\u5728\u5904\u7406 (' + (i + 1) + '/' + threads.length + '): ' + threads[i].title.substring(0, 40) + '...';
                extractResourceLinks(threads[i].tid, threads[i].title).then(function(r) {
                    results.push(r);
                    var found = r.ed2k.length + r.magnet.length + r.attachments.length;
                    progress.textContent = '\u5DF2\u5904\u7406 ' + (i + 1) + '/' + threads.length + ' \u4E2A | \u5F53\u524D\u5E16\u627E\u5230 ' + found + ' \u4E2A\u94FE\u63A5';
                    if (found > 0) progress.innerHTML += ' <span style="color:#27ae60;">[ED2K:' + r.ed2k.length + ' Magnet:' + r.magnet.length + ' \u9644\u4EF6:' + r.attachments.length + ']</span>';
                    if (i < threads.length - 1 && !cancelled) {
                        setTimeout(function() { processThread(i + 1); }, 500);
                    } else {
                        processThread(i + 1);
                    }
                });
            }

            processThread(0);
        };
    }

    function main() {
        gThreads = getThreadsWithLinks();
        if (gThreads.length === 0) { log('\u672A\u627E\u5230\u5E16\u5B50'); return; }
        log('\u5171', gThreads.length, '\u4E2A\u5E16\u5B50');

        var tools = createToolbar();
        setupToggleButton(tools.btn);

        if (getAutoPreviewSetting()) {
            loadAllPreviews();
        } else {
            log('\u81EA\u52A8\u9884\u89C8\u5DF2\u5173\u95ED\uFF0C\u8DF3\u8FC7\u52A0\u8F7D');
        }
    }

    setTimeout(main, 500);
})();
