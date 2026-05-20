// ==UserScript==
// @name         色花堂帖子页 · 渐进加载全图
// @namespace    https://sehuatang.net/
// @version      1.0.0
// @description  默认关闭；开启后按批次加载帖子页所有正文图片，避免一次性加载导致卡顿
// @author       米波
// @match        https://sehuatang.net/forum.php?mod=viewthread&tid=*
// @match        https://www.sehuatang.net/forum.php?mod=viewthread&tid=*
// @match        https://sehuatang.org/forum.php?mod=viewthread&tid=*
// @match        https://www.sehuatang.org/forum.php?mod=viewthread&tid=*
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    var CONFIG = {
        ENABLED_KEY: 'sht_progressive_image_loader_enabled',
        BATCH_SIZE: 3,
        BATCH_DELAY_MS: 900,
        IMAGE_TIMEOUT_MS: 12000,
        RESCAN_DELAY_MS: 1500,
        MAX_RESCAN: 3,
        DEBUG: false,
    };

    var ORIGIN = location.origin;
    var gEnabled = getEnabled();
    var gRunning = false;
    var gCancelToken = 0;

    function log() {
        if (CONFIG.DEBUG) {
            console.log.apply(console, ['[渐进加载全图]'].concat([].slice.call(arguments)));
        }
    }

    function getEnabled() {
        return localStorage.getItem(CONFIG.ENABLED_KEY) === 'true';
    }

    function setEnabled(value) {
        gEnabled = !!value;
        localStorage.setItem(CONFIG.ENABLED_KEY, gEnabled ? 'true' : 'false');
    }

    function forEachNode(nodes, fn) {
        for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
    }

    function isPostImage(img) {
        if (!img || img.tagName !== 'IMG') return false;
        if (!img.closest('#postlist, .t_fsz, .t_f, .pcb')) return false;

        var realUrl = getRealImageUrl(img);
        if (!realUrl) return false;
        if (/smiley|avatar|static\/image\/common|static\/image\/smiley|uc_server\/avatar/i.test(realUrl)) return false;
        return true;
    }

    function getRealImageUrl(img) {
        var attrs = [
            'file',
            'zoomfile',
            'data-src',
            'data-original',
            'data-lazy-src',
            'data-url',
            'data-echo',
            'original',
            'src',
        ];

        for (var i = 0; i < attrs.length; i++) {
            var raw = img.getAttribute(attrs[i]);
            var url = normalizeImageUrl(raw);
            if (url) return url;
        }
        return '';
    }

    function normalizeImageUrl(url) {
        url = String(url || '').replace(/&amp;/g, '&').trim();
        if (!url) return '';
        if (/^(javascript:|about:|data:)/i.test(url)) return '';
        if (/static\/image\/common|static\/image\/smiley|smiley|avatar|loading|blank|none\.gif|spacer/i.test(url)) return '';

        if (/^https?:\/\//i.test(url)) return url;
        if (url.indexOf('//') === 0) return location.protocol + url;
        if (url.charAt(0) === '/') return ORIGIN + url;
        return ORIGIN + '/' + url.replace(/^\.\//, '');
    }

    function collectImages() {
        var candidates = document.querySelectorAll('#postlist img, .t_fsz img, .t_f img, .pcb img');
        var result = [];

        forEachNode(candidates, function(img) {
            if (!isPostImage(img)) return;

            var targetUrl = getRealImageUrl(img);
            if (!targetUrl) return;

            var currentUrl = normalizeImageUrl(img.getAttribute('src') || img.src || '');
            var alreadyLoaded = img.complete && img.naturalWidth > 0 && currentUrl === targetUrl;
            if (alreadyLoaded) return;
            if (img.getAttribute('data-sht-pil-started') === '1') return;

            result.push({ img: img, url: targetUrl });
        });

        return result;
    }

    function prepareImage(img) {
        img.loading = 'eager';
        img.decoding = 'async';
        try { img.fetchPriority = 'low'; } catch(e) {}
        img.removeAttribute('lazyloaded');
        img.removeAttribute('data-lazyloaded');
    }

    function loadImage(item) {
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

            prepareImage(img);
            img.setAttribute('data-sht-pil-started', '1');
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);

            var currentUrl = normalizeImageUrl(img.getAttribute('src') || img.src || '');
            if (currentUrl !== url) {
                img.src = url;
            } else if (img.complete) {
                finish(img.naturalWidth > 0 ? 'loaded' : 'error');
            } else {
                img.src = url;
            }

            setTimeout(function() { finish('timeout'); }, CONFIG.IMAGE_TIMEOUT_MS);
        });
    }

    function updatePanel(state) {
        var panel = document.getElementById('sht-progressive-image-loader-panel');
        if (!panel) return;

        var toggle = panel.querySelector('.sht-pil-toggle');
        var status = panel.querySelector('.sht-pil-status');
        var stop = panel.querySelector('.sht-pil-stop');

        toggle.textContent = gEnabled ? '全图加载：开' : '全图加载：关';
        toggle.style.background = gEnabled ? '#27ae60' : '#95a5a6';
        stop.style.display = gRunning ? 'block' : 'none';

        if (state) {
            status.textContent = state;
        } else if (gEnabled) {
            status.textContent = gRunning ? '加载中...' : '已开启';
        } else {
            status.textContent = '默认模式';
        }
    }

    function createPanel() {
        if (document.getElementById('sht-progressive-image-loader-panel')) return;

        var panel = document.createElement('div');
        panel.id = 'sht-progressive-image-loader-panel';
        panel.style.cssText = 'position:fixed;right:12px;bottom:78px;z-index:99999;width:136px;padding:8px;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.18);font-size:12px;color:#555;';

        var toggle = document.createElement('button');
        toggle.className = 'sht-pil-toggle';
        toggle.style.cssText = 'width:100%;padding:7px 0;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;';
        toggle.addEventListener('click', function() {
            setEnabled(!gEnabled);
            if (gEnabled) {
                startProgressiveLoad();
            } else {
                stopProgressiveLoad();
            }
            updatePanel();
        });

        var status = document.createElement('div');
        status.className = 'sht-pil-status';
        status.style.cssText = 'margin-top:6px;line-height:1.4;color:#777;text-align:center;';

        var stop = document.createElement('button');
        stop.className = 'sht-pil-stop';
        stop.textContent = '停止本页';
        stop.style.cssText = 'display:none;width:100%;margin-top:6px;padding:5px 0;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        stop.addEventListener('click', function() {
            stopProgressiveLoad();
            updatePanel('已停止本页');
        });

        panel.appendChild(toggle);
        panel.appendChild(status);
        panel.appendChild(stop);
        document.body.appendChild(panel);
        updatePanel();
    }

    function stopProgressiveLoad() {
        gRunning = false;
        gCancelToken++;
    }

    function startProgressiveLoad() {
        if (gRunning) return;
        gRunning = true;
        var token = ++gCancelToken;
        var loaded = 0;
        var failed = 0;

        function runPass(passIndex) {
            if (!gEnabled || token !== gCancelToken) {
                gRunning = false;
                updatePanel();
                return;
            }

            var queue = collectImages();

            if (queue.length === 0) {
                if (passIndex < CONFIG.MAX_RESCAN) {
                    updatePanel('等待新图片...');
                    setTimeout(function() { runPass(passIndex + 1); }, CONFIG.RESCAN_DELAY_MS);
                } else {
                    gRunning = false;
                    updatePanel('完成 ' + loaded + ' 张，失败 ' + failed + ' 张');
                }
                return;
            }

            log('本轮待加载', queue.length);
            processQueue(queue, 0, function() {
                setTimeout(function() { runPass(passIndex + 1); }, CONFIG.RESCAN_DELAY_MS);
            });
        }

        function processQueue(queue, index, done) {
            if (!gEnabled || token !== gCancelToken) {
                gRunning = false;
                updatePanel();
                return;
            }

            if (index >= queue.length) {
                done();
                return;
            }

            var batch = queue.slice(index, index + CONFIG.BATCH_SIZE);
            updatePanel('加载 ' + (index + 1) + '-' + Math.min(index + batch.length, queue.length) + '/' + queue.length);

            Promise.all(batch.map(loadImage)).then(function(results) {
                results.forEach(function(status) {
                    if (status === 'loaded') loaded++;
                    else failed++;
                });
                updatePanel('已处理 ' + Math.min(index + batch.length, queue.length) + '/' + queue.length);
                setTimeout(function() {
                    processQueue(queue, index + CONFIG.BATCH_SIZE, done);
                }, CONFIG.BATCH_DELAY_MS);
            });
        }

        updatePanel('扫描图片...');
        runPass(0);
    }

    function init() {
        createPanel();
        if (gEnabled) {
            setTimeout(startProgressiveLoad, 800);
        }
    }

    setTimeout(init, 500);
})();
