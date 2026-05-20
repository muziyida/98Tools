// ==UserScript==
// @name         色花堂原创自拍区 · 自动回复可见
// @namespace    https://sehuatang.net/
// @version      1.2.1
// @description  浏览原创自拍区时，自动回复「回复可见」的隐藏内容
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
        TARGET_FID: '155',
        DEBUG: false,
        MAX_REPLY_PER_SESSION: 5,
        REPLY_COOLDOWN: 60000,
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

    function log() {
        if (CONFIG.DEBUG) {
            console.log.apply(console, ['[自动回复]'].concat([].slice.call(arguments)));
        }
    }
    function warn() {
        if (CONFIG.DEBUG) {
            console.warn.apply(console, ['[自动回复]'].concat([].slice.call(arguments)));
        }
    }

    function getTid() {
        var m = location.href.match(/tid=(\d+)/);
        return m ? m[1] : null;
    }

    function getFid() {
        var links = document.querySelectorAll('a[href*="forumdisplay&fid="]');
        for (var i = 0; i < links.length; i++) {
            var m = links[i].href.match(/fid=(\d+)/);
            if (m) return m[1];
        }
        var replyLink = document.querySelector('a[href*="action=reply"]');
        if (replyLink) {
            var m2 = replyLink.href.match(/fid=(\d+)/);
            if (m2) return m2[1];
        }
        return null;
    }

    function getFormhash() {
        var input = document.querySelector('input[name="formhash"]');
        if (input && input.value) return input.value;

        var logout = document.querySelector('a[href*="logout"]');
        if (logout) {
            var m = logout.href.match(/formhash=([a-f0-9]+)/);
            if (m) return m[1];
        }

        var scripts = document.querySelectorAll('script:not([src])');
        for (var i = 0; i < scripts.length; i++) {
            var m2 = scripts[i].textContent.match(/formhash\s*=\s*['"]([a-f0-9]+)['"]/);
            if (m2) return m2[1];
        }

        return null;
    }

    function getRandomReply() {
        var n = 1 + Math.floor(Math.random() * 2);
        var pool = REPLY_POOL.slice();
        pool.sort(function() { return Math.random() - 0.5; });
        return pool.slice(0, n).join('\uFF0C');
    }

    var STORAGE_KEY = 'sht_auto_reply';
    var ORIGIN = location.origin;

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        return { repliedTids: [], sessionCount: 0, lastReplyTime: 0 };
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch(e) {
            warn('保存状态失败:', e);
        }
    }

    function isAlreadyReplied(tid) {
        var state = loadState();
        for (var i = 0; i < state.repliedTids.length; i++) {
            if (state.repliedTids[i] === tid) return true;
        }
        return false;
    }

    function markTidReplied(tid) {
        var state = loadState();
        if (!isAlreadyReplied(tid)) {
            state.repliedTids.push(tid);
            if (state.repliedTids.length > 200) {
                state.repliedTids = state.repliedTids.slice(-200);
            }
            state.sessionCount = (state.sessionCount || 0) + 1;
            state.lastReplyTime = Date.now();
            saveState(state);
        }
    }

    function canAutoReply() {
        var state = loadState();
        if (state.sessionCount >= CONFIG.MAX_REPLY_PER_SESSION) {
            warn('本 session 已达上限 ' + CONFIG.MAX_REPLY_PER_SESSION + ' 次');
            return false;
        }
        var cooldown = CONFIG.REPLY_COOLDOWN - (Date.now() - (state.lastReplyTime || 0));
        if (cooldown > 0) {
            log('冷却中，剩余 ' + Math.ceil(cooldown / 1000) + ' 秒');
            return false;
        }
        return true;
    }

    function hasHiddenContent() {
        var bodyText = document.body.textContent || '';
        if (/\uFF0C\u5982\u679C\u60A8\u8981\u67E5\u770B\u672C\u5E16\u9690\u85CF\u5185\u5BB9\u8BF7\u56DE\u590D/.test(bodyText)) return true;
        if (/以下内容需要回复才能/.test(bodyText)) return true;
        return false;
    }

    function submitReply(replyText, tid, fid, formhash) {
        return new Promise(function(resolve) {
            var postUrl = ORIGIN + '/forum.php?mod=post&action=reply&fid=' + fid + '&tid=' + tid + '&extra=&replysubmit=yes';

            var params = new URLSearchParams();
            params.append('formhash', formhash);
            params.append('message', replyText);
            params.append('replysubmit', 'yes');
            params.append('modpost', 'on');
            params.append('handlekey', 'fastpost');

            var xhr = new XMLHttpRequest();
            xhr.open('POST', postUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.setRequestHeader('Referer', location.href);
            xhr.timeout = 10000;

            xhr.onload = function() {
                log('回复请求完成');
                resolve();
            };
            xhr.onerror = function() {
                warn('回复请求 network error');
                resolve();
            };
            xhr.ontimeout = function() {
                warn('回复请求超时');
                resolve();
            };

            log('发送回复:', replyText);
            xhr.send(params.toString());
        });
    }

    function main() {
        var tid = getTid();
        var fid = getFid();

        if (!tid) { log('未检测到 tid'); return; }
        log('帖子: tid=' + tid + ', fid=' + fid);

        if (fid !== CONFIG.TARGET_FID) { log('非目标版区'); return; }
        if (isAlreadyReplied(tid)) { log('已回复过，跳过'); return; }
        if (!canAutoReply()) return;
        if (!hasHiddenContent()) { log('未检测到隐藏内容'); return; }

        var formhash = getFormhash();
        if (!formhash) { warn('无法获取 formhash'); return; }

        var reply = getRandomReply();
        log('准备回复:', reply);

        submitReply(reply, tid, fid, formhash).then(function() {
            markTidReplied(tid);
            log('自动回复完成');
            setTimeout(function() { location.reload(); }, 2000);
        });
    }

    setTimeout(main, 1000);
})();
