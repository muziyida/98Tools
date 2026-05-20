// ==UserScript==
// @name         98助手
// @namespace    98Helper@Never4Ever
// @version      0.6
// @description  98助手：自动签到、快捷操作、内容过滤、浏览增强
// @author       Never4Ever

// @include      https://www.sehuatang.*
// @include      https://www.weterytrtrr.*
// @include      https://www.qweqwtret.*
// @include      https://www.retreytryuyt.*
// @include      https://www.qwerwrrt.*
// @include      https://sehuatang.*
// @include      https://weterytrtrr.*
// @include      https://qweqwtret.*
// @include      https://retreytryuyt.*
// @include      https://qwerwrrt.*

// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand

// @resource     IMPORTED_CSS https://unpkg.com/view-design@4.7.0-beta.10/dist/styles/iview.css

// @require      https://unpkg.com/arrive@2.4.1/src/arrive.js
// @require      https://unpkg.com/vue@2.6.14/dist/vue.min.js
// @require      https://unpkg.com/view-design@4.7.0-beta.10/dist/iview.min.js
// @run-at document-end
// ==/UserScript==

(function () {
    'use strict';

    // ==================== CSS ====================

    GM_addStyle(GM_getResourceText("IMPORTED_CSS"));

    var _css = '\
.readThread{background:#F7F2F2}\
.dark-mode .readThread{background:#2a2525!important}\
a{color:#333;text-decoration:none}\
.ttp a{height:28px}\
#scbar_txt{height:20px}\
.pi{height:40px}\
.avt img{padding:0;border:0}\
.vertical-center-modal{display:flex;align-items:center;justify-content:center}\
\
.helper-panel{position:fixed;left:93%;top:140px;z-index:9999}\
@media(max-width:1400px){.helper-panel{left:auto;right:8px}}\
.helper-panel.collapsed .helper-btns{display:none}\
.helper-panel.collapsed .helper-toggle-btn{padding:2px 6px}\
\
.dark-mode,.dark-mode body,.dark-mode .bm,.dark-mode .bm_h,\
.dark-mode .fl_tb,.dark-mode .fl_icn_g,.dark-mode .tl,.dark-mode .th,.dark-mode .tf,\
.dark-mode #ct,.dark-mode #pt,.dark-mode .pl,.dark-mode .pls,.dark-mode .plc\
{background:#1a1a1a!important;color:#ccc!important;border-color:#333!important}\
.dark-mode a,.dark-mode .xi2,.dark-mode .xw1{color:#aaa!important}\
.dark-mode .t_f,.dark-mode .t_fsz{color:#ccc!important}\
.dark-mode #postlist .pls{background:#222!important}\
.dark-mode #postlist .plc{background:#1a1a1a!important;border-color:#333!important}\
.dark-mode .pct .pcb{border-color:#333!important}\
.dark-mode blockquote{background:#222!important;border-color:#444!important}\
.dark-mode input,.dark-mode textarea,.dark-mode select{background:#2a2a2a!important;color:#ccc!important;border-color:#444!important}\
\
.helper-lightbox-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out}\
.helper-lightbox-overlay img{max-width:95vw;max-height:95vh;object-fit:contain;box-shadow:0 0 40px rgba(0,0,0,0.5)}\
.helper-lightbox-nav{position:fixed;top:50%;transform:translateY(-50%);z-index:100000;color:#fff;font-size:48px;cursor:pointer;user-select:none;padding:20px;opacity:0.6;transition:opacity 0.2s}\
.helper-lightbox-nav:hover{opacity:1}\
.helper-lightbox-prev{left:10px}\
.helper-lightbox-next{right:10px}\
.helper-lightbox-close{position:fixed;top:15px;right:25px;z-index:100000;color:#fff;font-size:36px;cursor:pointer;opacity:0.6}\
.helper-lightbox-close:hover{opacity:1}\
\
.helper-keyword-hl{background:#ffeb3b;color:#000;padding:1px 2px;border-radius:2px}\
.dark-mode .helper-keyword-hl{background:#5d5200;color:#fff}\
.helper-blocked-row{display:none!important}\
.helper-filtered-post{display:none!important}\
.helper-batch-cb{margin-right:6px;vertical-align:middle}\
.helper-sig-hidden .sign,.helper-sig-hidden .signature{display:none!important}\
\
.helper-page-jump{display:inline-block;margin-left:8px}\
.helper-page-jump input{width:50px;height:24px;text-align:center;border:1px solid #ccc;border-radius:3px}\
.helper-page-jump button{margin-left:4px;height:24px;padding:0 8px;font-size:12px;cursor:pointer}\
\
.helper-reply-templates{margin-bottom:6px}\
.helper-reply-templates span{display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;font-size:12px;background:#f0f0f0;border:1px solid #ddd;border-radius:3px;cursor:pointer;user-select:none}\
.helper-reply-templates span:hover{background:#e0e0e0}\
.dark-mode .helper-reply-templates span{background:#333;border-color:#555;color:#ccc}\
.dark-mode .helper-reply-templates span:hover{background:#444}\
\
.helper-link-list{max-height:400px;overflow-y:auto}\
.helper-link-list .link-row{display:flex;align-items:center;padding:4px 8px;margin:2px 0;background:#f9f9f9;border-radius:4px}\
.dark-mode .helper-link-list .link-row{background:#2a2a2a}\
.helper-link-list .link-row .link-url{flex:1;word-break:break-all;font-size:13px;margin-right:8px}\
.helper-link-list .link-row .link-label{background:#e8f4fd;color:#2d8cf0;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:6px;flex-shrink:0}\
.helper-stats-bar{font-size:12px;color:#999;margin-top:4px}\
';
    GM_addStyle(_css);

    // ==================== Config ====================

    GM_registerMenuCommand("设置", showSetting);
    GM_registerMenuCommand("签到", doSignMenu);
    GM_registerMenuCommand("提取链接", showLinkExtract);
    GM_registerMenuCommand("切换暗黑", toggleDarkFromMenu);

    var CK = {
        lastSignDate: "98+LastSignDate",
        quickJumpUrl: "98+QuickJumpUrl",
        ignoredIDs: "98+IgnoredIDs",
        readThreads: "98+ReadThreads",
        showImages: "98+ShowImages",
        setOrder: "98+SetOrder",
        darkMode: "98+DarkMode",
        signCount: "98+SignCount",
        signStreak: "98+SignStreak",
        isPanelCollapsed: "98+isPanelCollapsed",

        f_lightbox: "98+f_lightbox",
        f_signature: "98+f_signature",
        f_pageJump: "98+f_pageJump",
        f_scrollLatest: "98+f_scrollLatest",
        f_browseStats: "98+f_browseStats",

        f_keywordHighlight: "98+f_keywordHighlight",
        f_keywordWords: "98+f_keywordWords",
        f_authorBlock: "98+f_authorBlock",
        f_authorBlockList: "98+f_authorBlockList",
        f_titleBlock: "98+f_titleBlock",
        f_titleBlockWords: "98+f_titleBlockWords",
        f_userFilter: "98+f_userFilter",
        f_userFilterList: "98+f_userFilterList",

        f_linkExtract: "98+f_linkExtract",
        f_replyTemplate: "98+f_replyTemplate",
        f_replyTemplateTexts: "98+f_replyTemplateTexts",
        f_batchOpen: "98+f_batchOpen",

        f_autoRefresh: "98+f_autoRefresh",
        f_autoRefreshInterval: "98+f_autoRefreshInterval",
        f_autoReply155: "98+f_autoReply155",
        f_smartAutoReply155: "98+f_smartAutoReply155",
        autoRepliedTids: "98+autoRepliedTids",

        stats_pageViews: "98+stats_pageViews",
        stats_rateCount: "98+stats_rateCount",
    };

    var C = {
        get: function (k, d) { var v = GM_getValue(k); return v !== undefined ? v : d; },
        set: GM_setValue,
        getByUID: function (uid, k, d) { return C.get(uid + "+" + k, d); },
        setByUID: function (uid, k, v) { C.set(uid + "+" + k, v); }
    };

    // helpers
    function parseList(s) { if (!s || !s.trim()) return []; return s.split(/[,，、\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
    function joinList(arr) { return (arr || []).join(", "); }

    // ==================== siteMap ====================

    var siteMap = { "每日合集": 106, "国产原创": 2, "亚洲无码原创": 36, "亚洲有码原创": 37, "高清中文字幕": 103, "三级写真": 107, "素人有码系列": 104, "欧美无码": 38, "4K原版": 151, "韩国主播": 152, "动漫原创": 39, "国产自拍": 41, "中文字幕": 109, "日韩无码": 42, "日韩有码": 43, "欧美风情": 44, "卡通动漫": 45, "剧情三级": 46, "自提字幕区": 145, "自译字幕区": 146, "字幕分享区": 121, "分享新区": 159, "原创自拍区": 155, "转贴自拍": 125, "华人街拍区": 50, "亚洲性爱": 48, "欧美性爱": 49, "原创人生": 154, "乱伦人妻": 135, "青春校园": 137, "武侠虚幻": 138, "激情都市": 136, "TXT小说下载": 139, "综合讨论区": 95, "色花视频自拍": 124, "网友原创区": 141, "转帖交流区": 142, "求片问答悬赏区": 143, "投诉建议区": 96, "禁言申诉区": 150, "资源出售区": 97, "投稿送邀请码": 157 };

    var siteItemsCache = null;
    function getSiteItems() {
        if (siteItemsCache) return siteItemsCache;
        siteItemsCache = [];
        for (var s in siteMap) siteItemsCache.push({ name: s, id: siteMap[s] });
        return siteItemsCache;
    }

    function safeEval(expr) {
        expr = expr.trim();
        var m = expr.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/);
        if (!m) return NaN;
        var a = parseFloat(m[1]), op = m[2], b = parseFloat(m[3]);
        switch (op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b !== 0 ? a / b : NaN; default: return NaN; }
    }

    // ==================== Vue Template ====================

    var template = '\
<div class="helper-panel" :class="{ collapsed: isPanelCollapsed }">\
  <Row style="text-align:right;margin-bottom:2px">\
    <Button class="helper-toggle-btn" size="small" type="text" @click="togglePanel" :title="isPanelCollapsed?\'展开\':\'折叠\'">{{isPanelCollapsed?"▶":"◀"}}</Button>\
  </Row>\
  <div class="helper-btns">\
    <Row v-if="!isPanelCollapsed">\
      <Button :style="btnStyle" :type="signText===\'已签到\'?\'success\':\'error\'" size="small" @click="signClick" :title="signTitle">{{signText}}</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && settingInfo.isShowPinnedItemButton">\
      <Button :style="btnStyle" title="快速跳转" @click="quickJump" type="info" size="small">快速跳转</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowDarkModeButton">\
      <Button :style="btnStyle" @click="darkModeClick" type="warning" size="small">{{isDarkMode?"🌙 亮色":"☀ 暗黑"}}</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowTimeOrderButton">\
      <Button :style="btnStyle" @click="orderClick" type="warning" size="small">{{getOrderButtonText}}</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowImageButton">\
      <Button :style="btnStyle" @click="imageClick" type="warning" size="small">{{getImageButtonText}}</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowCopyCodeButton">\
      <Button :style="btnStyle" @click="copyCodes" type="info" size="small">复制代码</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowSignatureButton">\
      <Button :style="btnStyle" @click="signatureClick" type="warning" size="small">{{signatureHidden?"显示签名":"隐藏签名"}}</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowLinkExtractButton">\
      <Button :style="btnStyle" @click="openLinkExtract" type="info" size="small">提取链接</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowRateButton">\
      <Button :style="btnStyle" title="直接最高评分+通知作者" @click="rate" type="info" size="small">评分</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowStarButton">\
      <Button :style="btnStyle" title="收藏帖子" @click="star" type="info" size="small">收藏</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowTwoButton">\
      <Button :style="btnStyle" title="一键收藏+评分+通知作者" @click="twoAction" type="info" size="small">一键二连</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowScrollLatestButton">\
      <Button :style="btnStyle" @click="scrollToLatest" type="info" size="small">最新回复</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && isShowBatchOpenButton">\
      <Button :style="btnStyle" @click="batchOpenSelected" type="info" size="small">批量打开</Button>\
    </Row>\
    <Row v-if="!isPanelCollapsed && featureStats">\
      <div class="helper-stats-bar">本日浏览:{{statsPageViews}} | 评分:{{statsRateCount}}</div>\
    </Row>\
  </div>\
\
  <Modal v-model="settingInfo.isShow" title="98助手设置" :closable="false" :mask-closable="false" width="800" @on-ok="settingModalConfirm">\
    <Tabs v-model="activeTab">\
      <TabPane label="基础" name="tab1">\
        <p>设置"快速跳转"链接（为空则不显示按钮）：</p>\
        <Input v-model="settingInfo.pinnedItemUrl" placeholder="如：/forum.php?mod=viewthread&tid=717385" style="width:500px"/>\
        <Divider />\
        <p>忽略助手排序的板块：</p>\
        <CheckboxGroup v-model="settingInfo.ignoredItems">\
          <Checkbox v-for="item in settingInfo.siteItems" :label="item.id" :key="item.id" style="margin-top:4px" border>{{item.name}}</Checkbox>\
        </CheckboxGroup>\
      </TabPane>\
      <TabPane label="浏览增强" name="tab2">\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_lightbox"/></Col><Col span="18">图片灯箱（点击帖内图片全屏查看）</Col></Row>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_signature"/></Col><Col span="18">签名开关（显示/隐藏所有用户签名档）</Col></Row>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_pageJump"/></Col><Col span="18">页码快速跳转（在翻页区域添加输入框）</Col></Row>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_scrollLatest"/></Col><Col span="18">滚动到最新回复按钮</Col></Row>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_browseStats"/></Col><Col span="18">浏览统计（记录今日看帖/评分次数）</Col></Row>\
      </TabPane>\
      <TabPane label="内容过滤" name="tab3">\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_keywordHighlight"/></Col><Col span="18">关键词高亮（帖子列表中高亮匹配标题）</Col></Row>\
        <p v-if="settingInfo.f_keywordHighlight" style="margin-left:24px">关键词（逗号分隔）：</p>\
        <Input v-if="settingInfo.f_keywordHighlight" v-model="settingInfo.f_keywordWords" placeholder="例如：汉语,国产,高清" type="textarea" :rows="2" style="width:500px;margin-left:24px"/>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_authorBlock"/></Col><Col span="18">作者屏蔽（帖子列表中隐藏指定作者）</Col></Row>\
        <p v-if="settingInfo.f_authorBlock" style="margin-left:24px">作者名（逗号分隔）：</p>\
        <Input v-if="settingInfo.f_authorBlock" v-model="settingInfo.f_authorBlockList" placeholder="例如：用户名1,用户名2" type="textarea" :rows="2" style="width:500px;margin-left:24px"/>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_titleBlock"/></Col><Col span="18">标题屏蔽（帖子列表中隐藏包含指定词的标题）</Col></Row>\
        <p v-if="settingInfo.f_titleBlock" style="margin-left:24px">屏蔽词（逗号分隔）：</p>\
        <Input v-if="settingInfo.f_titleBlock" v-model="settingInfo.f_titleBlockWords" placeholder="例如：广告,推广" type="textarea" :rows="2" style="width:500px;margin-left:24px"/>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_userFilter"/></Col><Col span="18">只看指定用户（帖子内只显示指定用户的回复）</Col></Row>\
        <p v-if="settingInfo.f_userFilter" style="margin-left:24px">用户名（逗号分隔）：</p>\
        <Input v-if="settingInfo.f_userFilter" v-model="settingInfo.f_userFilterList" placeholder="例如：楼主,用户名1" type="textarea" :rows="2" style="width:500px;margin-left:24px"/>\
      </TabPane>\
      <TabPane label="操作效率" name="tab4">\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_linkExtract"/></Col><Col span="18">提取链接（一键提取磁力/网盘链接）</Col></Row>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_replyTemplate"/></Col><Col span="18">快速回复模板（回复框上方添加预设回复按钮）</Col></Row>\
        <p v-if="settingInfo.f_replyTemplate" style="margin-left:24px">模板（每行一条）：</p>\
        <Input v-if="settingInfo.f_replyTemplate" v-model="settingInfo.f_replyTemplateTexts" placeholder="感谢分享，楼主辛苦了\\n漂亮，支持一下\\n很喜欢，收下了" type="textarea" :rows="4" style="width:500px;margin-left:24px"/>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_batchOpen"/></Col><Col span="18">批量开帖（帖子列表勾选后一键打开）</Col></Row>\
      </TabPane>\
      <TabPane label="自动化" name="tab5">\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_autoRefresh"/></Col><Col span="18">自动刷新页面</Col></Row>\
        <div v-if="settingInfo.f_autoRefresh" style="margin-left:24px">\
          <span>刷新间隔（秒）：</span>\
          <InputNumber v-model="settingInfo.f_autoRefreshInterval" :min="10" :max="600" :step="5" style="width:120px;margin-left:8px"/>\
          <span style="margin-left:4px;color:#999">当前页面将每 {{settingInfo.f_autoRefreshInterval}}秒自动刷新</span>\
        </div>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_autoReply155"/></Col><Col span="18">原创自拍区自动回复"感谢分享"（所有帖子均自动回复）</Col></Row>\
        <Row style="margin:8px 0"><Col span="6"><Switch v-model="settingInfo.f_smartAutoReply155"/></Col><Col span="18">原创自拍区智能回复（仅检测到"回复可见"内容时才自动回复"感谢分享"）</Col></Row>\
      </TabPane>\
    </Tabs>\
  </Modal>\
\
  <Modal v-model="linkExtractModal" title="提取链接" width="700" :footer-hide="true">\
    <div class="helper-link-list">\
      <div v-for="(link,idx) in extractedLinks" :key="idx" class="link-row">\
        <span class="link-label">{{link.type}}</span>\
        <span class="link-url">{{link.text}}</span>\
        <Button size="small" type="primary" @click="copySingleLink(link.text)">复制</Button>\
      </div>\
      <p v-if="extractedLinks.length===0" style="color:#999">未找到链接</p>\
    </div>\
    <div style="margin-top:12px;text-align:right" v-if="extractedLinks.length>0">\
      <Button type="success" @click="copyAllLinks">一键全部复制</Button>\
    </div>\
  </Modal>\
</div>';

    // ==================== Vue App ====================

    var signFetchUrl = 'https://' + window.location.host + '/plugin.php?id=dd_sign&mod=sign&infloat=yes&handlekey=pc_click_ddsign&inajax=1&ajaxtarget=fwin_content_pc_click_ddsign';
    var jumpUrl = 'https://' + window.location.host + '/plugin.php?id=dd_sign:index';
    var refreshTimer = null;

    var scrolltop = document.getElementById("scrolltop");
    if (!scrolltop) return;
    var div = document.createElement('div');
    div.id = "mydivcommon";
    scrolltop.insertAdjacentElement("beforebegin", div);

    var _arriveLock = {};
    var _imgList = [];
    var _imgIdx = 0;
    var _lightboxEl = null;
    var _tplLock = false;

    var appVue = new Vue({
        el: '#mydivcommon',
        template: template,
        data: function () {
            return {
                userID: "",
                signText: "签到",
                signTitle: "点击自动签到",
                isShowCopyCodeButton: false,
                isShowImageButton: false,
                isShowRateButton: false,
                isShowStarButton: false,
                isShowTwoButton: false,
                isShowSignatureButton: false,
                isShowLinkExtractButton: false,
                isShowScrollLatestButton: false,
                isShowBatchOpenButton: false,
                isShowDarkModeButton: true,
                isImagesShows: true,
                isDarkMode: false,
                isShowTimeOrderButton: false,
                isSetOrder: false,
                isPanelCollapsed: false,
                activeTab: "tab1",
                signatureHidden: false,
                featureStats: false,
                statsPageViews: 0,
                statsRateCount: 0,
                linkExtractModal: false,
                extractedLinks: [],
                btnStyle: "width:80px;margin:1px",
                settingInfo: {
                    isShow: false,
                    ignoredItems: [],
                    siteItems: getSiteItems(),
                    pinnedItemUrl: "",
                    isShowPinnedItemButton: false,
                    f_lightbox: true,
                    f_signature: false,
                    f_pageJump: true,
                    f_scrollLatest: true,
                    f_browseStats: true,
                    f_keywordHighlight: false,
                    f_keywordWords: "",
                    f_authorBlock: false,
                    f_authorBlockList: "",
                    f_titleBlock: false,
                    f_titleBlockWords: "",
                    f_userFilter: false,
                    f_userFilterList: "",
                    f_linkExtract: true,
                    f_replyTemplate: false,
                    f_replyTemplateTexts: "感谢分享，楼主辛苦了\n漂亮的资源，支持一下\n很喜欢，收下了",
                    f_batchOpen: false,
                    f_autoRefresh: false,
                    f_autoRefreshInterval: 30,
                    f_autoReply155: false,
                    f_smartAutoReply155: true,
                }
            };
        },
        computed: {
            getOrderButtonText: function () { return this.isSetOrder ? "关*发帖时间" : "开*发帖时间"; },
            getImageButtonText: function () { return this.isImagesShows ? "隐藏图片" : "显示图片"; }
        },
        methods: {
            // --- 面板折叠 ---
            togglePanel: function () { this.isPanelCollapsed = !this.isPanelCollapsed; C.set(CK.isPanelCollapsed, this.isPanelCollapsed); },

            // --- 快速跳转 ---
            quickJump: function () { GM_openInTab('https://' + window.location.host + this.settingInfo.pinnedItemUrl, false); },

            // --- 设置 ---
            _loadSettings: function () {
                var si = this.settingInfo;
                si.f_lightbox = C.get(CK.f_lightbox, true);
                si.f_signature = C.get(CK.f_signature, false);
                si.f_pageJump = C.get(CK.f_pageJump, true);
                si.f_scrollLatest = C.get(CK.f_scrollLatest, true);
                si.f_browseStats = C.get(CK.f_browseStats, true);
                si.f_keywordHighlight = C.get(CK.f_keywordHighlight, false);
                si.f_keywordWords = C.get(CK.f_keywordWords, "");
                si.f_authorBlock = C.get(CK.f_authorBlock, false);
                si.f_authorBlockList = C.get(CK.f_authorBlockList, "");
                si.f_titleBlock = C.get(CK.f_titleBlock, false);
                si.f_titleBlockWords = C.get(CK.f_titleBlockWords, "");
                si.f_userFilter = C.get(CK.f_userFilter, false);
                si.f_userFilterList = C.get(CK.f_userFilterList, "");
                si.f_linkExtract = C.get(CK.f_linkExtract, true);
                si.f_replyTemplate = C.get(CK.f_replyTemplate, false);
                si.f_replyTemplateTexts = C.get(CK.f_replyTemplateTexts, "感谢分享，楼主辛苦了\n漂亮的资源，支持一下\n很喜欢，收下了");
                si.f_batchOpen = C.get(CK.f_batchOpen, false);
                si.f_autoRefresh = C.get(CK.f_autoRefresh, false);
                si.f_autoRefreshInterval = C.get(CK.f_autoRefreshInterval, 30);
                si.f_autoReply155 = C.get(CK.f_autoReply155, false);
                si.f_smartAutoReply155 = C.get(CK.f_smartAutoReply155, true);
                var qj = C.get(CK.quickJumpUrl, '');
                if (qj) { si.pinnedItemUrl = qj; si.isShowPinnedItemButton = true; }
            },
            settingModalShow: function () {
                this.settingInfo.isShow = true;
                this._loadSettings();
                this.settingInfo.siteItems = getSiteItems();
                this.settingInfo.ignoredItems = [];
                var ids = C.get(CK.ignoredIDs, []);
                for (var i = 0; i < this.settingInfo.siteItems.length; i++) {
                    if (ids.indexOf(this.settingInfo.siteItems[i].id) != -1) {
                        this.settingInfo.ignoredItems.push(this.settingInfo.siteItems[i].id);
                    }
                }
            },
            settingModalConfirm: function () {
                var si = this.settingInfo;
                if (si.pinnedItemUrl) { si.isShowPinnedItemButton = true; C.set(CK.quickJumpUrl, si.pinnedItemUrl); }
                else { si.isShowPinnedItemButton = false; C.set(CK.quickJumpUrl, ""); }
                C.set(CK.ignoredIDs, si.ignoredItems);
                C.set(CK.f_lightbox, si.f_lightbox);
                C.set(CK.f_signature, si.f_signature);
                C.set(CK.f_pageJump, si.f_pageJump);
                C.set(CK.f_scrollLatest, si.f_scrollLatest);
                C.set(CK.f_browseStats, si.f_browseStats);
                C.set(CK.f_keywordHighlight, si.f_keywordHighlight);
                C.set(CK.f_keywordWords, si.f_keywordWords);
                C.set(CK.f_authorBlock, si.f_authorBlock);
                C.set(CK.f_authorBlockList, si.f_authorBlockList);
                C.set(CK.f_titleBlock, si.f_titleBlock);
                C.set(CK.f_titleBlockWords, si.f_titleBlockWords);
                C.set(CK.f_userFilter, si.f_userFilter);
                C.set(CK.f_userFilterList, si.f_userFilterList);
                C.set(CK.f_linkExtract, si.f_linkExtract);
                C.set(CK.f_replyTemplate, si.f_replyTemplate);
                C.set(CK.f_replyTemplateTexts, si.f_replyTemplateTexts);
                C.set(CK.f_batchOpen, si.f_batchOpen);
                C.set(CK.f_autoRefresh, si.f_autoRefresh);
                C.set(CK.f_autoRefreshInterval, si.f_autoRefreshInterval);
                C.set(CK.f_autoReply155, si.f_autoReply155);
                C.set(CK.f_smartAutoReply155, si.f_smartAutoReply155);
                this._applyFeatures();
            },

            // --- 应用功能开关 ---
            _applyFeatures: function () {
                var si = this.settingInfo;
                this.isShowLinkExtractButton = si.f_linkExtract && this.isShowTwoButton;
                this.isShowScrollLatestButton = si.f_scrollLatest && this.isShowTwoButton;
                this.isShowBatchOpenButton = si.f_batchOpen;
                this.isShowSignatureButton = si.f_signature;
                this.featureStats = si.f_browseStats;

                if (si.f_signature) { this._applySignature(); }
                if (si.f_batchOpen) { this._addBatchCheckboxes(); }
                if (si.f_keywordHighlight || si.f_authorBlock || si.f_titleBlock) { this._applyThreadFilters(); }
                if (si.f_userFilter) { this._applyUserFilter(); }
                if (si.f_pageJump) { this._addPageJump(); }
                if (si.f_replyTemplate) { this._addReplyTemplates(); }
                if (si.f_lightbox) { this._bindLightbox(); }
                if (si.f_autoRefresh) { this._startAutoRefresh(); } else { this._stopAutoRefresh(); }
                if (si.f_autoReply155 || si.f_smartAutoReply155) { this._autoReply155(); }
            },

            // --- 签到 ---
            getUserID: function () {
                var avtLink = document.querySelector("div.avt > a");
                if (!avtLink) return "";
                var params = new URLSearchParams(avtLink.href);
                var uid = params.get("uid");
                if (!uid && avtLink.href.indexOf("uid-") != -1) { var m = avtLink.href.match(/uid-(\d+)/); if (m) uid = m[1]; }
                this.userID = uid || "";
                return this.userID;
            },
            fetchSignInfo: async function () {
                var xmlString = await fetch(signFetchUrl).then(function (r) { return r.text(); });
                var xml = new DOMParser().parseFromString(xmlString, 'text/xml');
                var rootEl = xml.getElementsByTagName('root')[0];
                if (!rootEl) return null;
                var doc = new DOMParser().parseFromString(rootEl.textContent, 'text/html');
                var fh = doc.querySelector('input[name="formhash"]');
                var st = doc.querySelector('input[name="signtoken"]');
                var sf = doc.querySelector('form[name="login"]');
                if (!fh || !st || !sf) return null;
                return { formhash: fh.value, signtoken: st.value, signhash: sf.getAttribute('id').replace('signform_', '') };
            },
            fetchValidateText: async function () {
                var t = await fetch('/misc.php?mod=secqaa&action=update&idhash=qSAxcb0').then(function (r) { return r.text(); });
                var txt = t.replace("sectplcode[2] + '", "前").replace("' + sectplcode[3]", "后");
                var m = txt.match(/前([\w\W]+?)后/);
                return m ? m[1] : "";
            },
            doSign: async function () {
                var si = await this.fetchSignInfo();
                if (!si) { this.showTip("抱歉，获取签到信息失败，请手动签到"); return false; }
                var expr = await this.fetchValidateText();
                if (!expr) { this.showTip("抱歉，获取验证信息失败，请手动签到"); return false; }
                var ans = safeEval(expr.replace("= ?", ""));
                if (isNaN(ans)) { this.showTip("抱歉，签到验证计算失败，请手动签到"); return false; }
                var data = new URLSearchParams();
                data.append('formhash', si.formhash);
                data.append('signtoken', si.signtoken);
                data.append('secqaahash', 'qSAxcb0');
                data.append('secanswer', String(ans));
                var u = '/plugin.php?id=dd_sign&mod=sign&signsubmit=yes&handlekey=pc_click_ddsign&signhash=' + si.signhash + '&inajax=1';
                var resp = await fetch(u, { method: 'post', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data }).then(function (r) { return r.text(); });
                if (resp.indexOf('已经签到过') != -1) { this.showTip('已经签到过啦，请明天再来！'); return true; }
                else if (resp.indexOf('签到成功') != -1) { this.showTip('签到成功，金钱+2，明天记得来哦。'); return true; }
                else { this.showTip('抱歉，签到出现了未知错误！'); return false; }
            },
            signClick: function () {
                if (this.signText === "已签到") { GM_openInTab(jumpUrl, false); return; }
                this._doAutoSign();
            },
            _doAutoSign: async function () {
                var self = this;
                self.signText = "签到中...";
                var signed = await self.doSign();
                if (signed) {
                    self.signText = "已签到"; self.signTitle = "今日已签到";
                    var date = new Date();
                    var ds = date.toLocaleDateString("zh-CN");
                    var uid = self.userID || self.getUserID() || "0";
                    var oldDate = C.getByUID(uid, CK.lastSignDate, "");
                    C.setByUID(uid, CK.lastSignDate, ds);
                    var cnt = C.getByUID(uid, CK.signCount, 0) + 1;
                    C.setByUID(uid, CK.signCount, cnt);
                    var yest = new Date(date); yest.setDate(yest.getDate() - 1);
                    if (oldDate === yest.toLocaleDateString("zh-CN") || !oldDate) {
                        var strk = C.getByUID(uid, CK.signStreak, 0) + 1;
                        C.setByUID(uid, CK.signStreak, strk);
                        self.signTitle = "已签到 | 累计签" + cnt + "天 | 连续签" + strk + "天";
                    } else {
                        C.setByUID(uid, CK.signStreak, 1);
                        self.signTitle = "已签到 | 累计签" + cnt + "天 | 连续签1天";
                    }
                } else { self.signText = "签到"; self.signTitle = "签到失败，点击重试"; }
            },
            checkSign: function () {
                var uid = this.userID || this.getUserID(); if (!uid) return;
                var ds = new Date().toLocaleDateString("zh-CN");
                var rec = C.getByUID(uid, CK.lastSignDate, "");
                if (rec === ds) {
                    this.signText = "已签到";
                    this.signTitle = "已签到 | 累计签" + C.getByUID(uid, CK.signCount, 0) + "天 | 连续签" + C.getByUID(uid, CK.signStreak, 0) + "天";
                } else if (window.location.href.indexOf('dd_sign') != -1) { this._doAutoSign(); }
            },

            // --- 图片显示/暗黑 ---
            showImages: function (dom, isShow) {
                var nodes = dom.querySelectorAll('.t_fsz img');
                for (var i = 0; i < nodes.length; i++) nodes[i].style.display = isShow ? "inline" : "none";
            },
            imageClick: function () {
                this.isImagesShows = !this.isImagesShows; this.showImages(document, this.isImagesShows);
                C.set(CK.showImages, this.isImagesShows);
                this.showTip("已经记住设置：" + (this.isImagesShows ? "显示图片" : "隐藏图片"));
            },
            darkModeClick: function () { this.isDarkMode = !this.isDarkMode; C.set(CK.darkMode, this.isDarkMode); this._applyDarkMode(); this.showTip(this.isDarkMode ? "已切换到暗黑模式" : "已切换到亮色模式"); },
            _applyDarkMode: function () { if (this.isDarkMode) document.documentElement.classList.add("dark-mode"); else document.documentElement.classList.remove("dark-mode"); },

            // --- 复制代码 ---
            copyCodes: function () {
                var nodes = document.querySelectorAll('.blockcode li');
                if (nodes && nodes.length > 0) {
                    var t = Array.prototype.slice.call(nodes).map(function (li) { return li.innerText.replace(/\n/g, ""); }).join("\r\n");
                    GM_setClipboard(t); this.showTip("已经复制" + nodes.length + "条到剪贴板！");
                } else this.showTip("抱歉，未找到代码块！");
            },

            // --- 排序 ---
            checkOrder: function () {
                var sp = new URLSearchParams(window.location.search);
                if (window.location.href.indexOf("fid=") != -1 && sp.get("mod") === "forumdisplay") this.isShowTimeOrderButton = true; else return;
                var wanted = sp.get('filter') === "author" && sp.get('orderby') === "dateline";
                this.isSetOrder = C.get(CK.setOrder, false);
                if (this.isSetOrder && !wanted) this.setOrder();
            },
            setOrder: function () {
                var sp = new URLSearchParams(window.location.search);
                sp.set('filter', 'author'); sp.set('orderby', 'dateline');
                var fid = parseInt(sp.get("fid"));
                if (sp.get("mod") === "forumdisplay") {
                    var ignores = C.get(CK.ignoredIDs, []);
                    if (ignores.indexOf(fid) != -1) this.showTip("此板块助手排序已被您忽略，有需要在\"设置\"中重新设置");
                    else window.location.search = sp.toString();
                }
            },
            orderClick: function () {
                this.isSetOrder = !this.isSetOrder; C.set(CK.setOrder, this.isSetOrder);
                this.showTip("已经记住设置：" + (this.isSetOrder ? "强制按发帖时间排序" : "不强制按发帖时间排序"));
                var sp = new URLSearchParams(window.location.search);
                if (!(sp.get('filter') === "author" && sp.get('orderby') === "dateline") && this.isSetOrder) this.setOrder();
            },

            // --- 签名开关 ---
            signatureClick: function () {
                this.signatureHidden = !this.signatureHidden;
                if (this.signatureHidden) document.documentElement.classList.add("helper-sig-hidden");
                else document.documentElement.classList.remove("helper-sig-hidden");
                this.showTip(this.signatureHidden ? "已隐藏签名" : "已显示签名");
            },
            _applySignature: function () { if (this.signatureHidden) document.documentElement.classList.add("helper-sig-hidden"); },

            // --- 滚动到最新回复 ---
            scrollToLatest: function () {
                var last = document.querySelector('#postlist .plc:last-of-type');
                if (last) { last.scrollIntoView({ behavior: 'smooth', block: 'center' }); this.showTip("已滚动到最新回复"); }
                else this.showTip("未找到帖子列表");
            },

            // --- 图片灯箱 ---
            _lightboxShow: function (url) {
                var self = this;
                if (_lightboxEl) _lightboxEl.remove();
                var ov = document.createElement('div'); ov.className = 'helper-lightbox-overlay';
                var img = document.createElement('img'); img.src = url; ov.appendChild(img);
                var prevBtn = document.createElement('div'); prevBtn.className = 'helper-lightbox-nav helper-lightbox-prev';
                prevBtn.textContent = '❮'; prevBtn.title = '上一张';
                var nextBtn = document.createElement('div'); nextBtn.className = 'helper-lightbox-nav helper-lightbox-next';
                nextBtn.textContent = '❯'; nextBtn.title = '下一张';
                var closeBtn = document.createElement('div'); closeBtn.className = 'helper-lightbox-close';
                closeBtn.textContent = '✕'; closeBtn.title = '关闭';
                ov.appendChild(prevBtn); ov.appendChild(nextBtn); ov.appendChild(closeBtn);
                ov.onclick = function (e) { if (e.target === ov || e.target === closeBtn) self._lightboxClose(); };
                prevBtn.onclick = function (e) { e.stopPropagation(); self._lightboxNav(-1); };
                nextBtn.onclick = function (e) { e.stopPropagation(); self._lightboxNav(1); };
                document.body.appendChild(ov);
                _lightboxEl = ov;
                document.addEventListener('keydown', self._kbLightbox);
            },
            _lightboxClose: function () {
                if (_lightboxEl) { _lightboxEl.remove(); _lightboxEl = null; }
                document.removeEventListener('keydown', this._kbLightbox);
            },
            _lightboxNav: function (delta) {
                _imgIdx += delta;
                if (_imgIdx < 0) _imgIdx = _imgList.length - 1;
                if (_imgIdx >= _imgList.length) _imgIdx = 0;
                var img = _lightboxEl.querySelector('img');
                if (img && _imgList[_imgIdx]) img.src = _imgList[_imgIdx];
            },
            _kbLightbox: function (e) {
                if (e.key === 'Escape') appVue._lightboxClose();
                if (e.key === 'ArrowLeft') appVue._lightboxNav(-1);
                if (e.key === 'ArrowRight') appVue._lightboxNav(1);
            },
            _bindLightbox: function () {
                var self = this;
                var imgs = document.querySelectorAll('.t_fsz img');
                _imgList = [];
                for (var i = 0; i < imgs.length; i++) {
                    var src = imgs[i].src || imgs[i].getAttribute('file') || '';
                    if (src && src.indexOf('http') === 0 && imgs[i].naturalWidth > 50) {
                        _imgList.push(src);
                        imgs[i].style.cursor = 'zoom-in';
                        imgs[i].title = '点击查看大图（方向键切换，Esc关闭）';
                    }
                }
                if (!self._clickBound) {
                    self._clickBound = true;
                    document.addEventListener('click', function (e) {
                        if (e.target.tagName === 'IMG' && e.target.closest('.t_fsz')) {
                            var src = e.target.src || e.target.getAttribute('file') || '';
                            if (src) {
                                var idx = _imgList.indexOf(src);
                                if (idx === -1 && e.target.getAttribute('zoomfile')) src = e.target.getAttribute('zoomfile');
                                idx = _imgList.indexOf(src);
                                _imgIdx = idx !== -1 ? idx : 0;
                                if (_imgList.length > 0) self._lightboxShow(_imgList[_imgIdx]);
                            }
                        }
                    });
                }
            },

            // --- 链接提取 ---
            openLinkExtract: function () { this.extractedLinks = this._extractLinks(); this.linkExtractModal = true; },
            _extractLinks: function () {
                var links = [];
                var blockcodes = document.querySelectorAll('.blockcode');
                for (var i = 0; i < blockcodes.length; i++) {
                    var txt = blockcodes[i].textContent || blockcodes[i].innerText || "";
                    var magnetRe = /magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s]*/gi;
                    var ms = txt.match(magnetRe);
                    if (ms) for (var j = 0; j < ms.length; j++) links.push({ type: '磁力链接', text: ms[j] });
                    var urlRe = /(https?:\/\/[^\s]{10,})/gi;
                    var us = txt.match(urlRe);
                    if (us) {
                        for (var k = 0; k < us.length; k++) {
                            var u = us[k];
                            var label = '链接';
                            if (u.indexOf('pan.baidu') != -1) label = '百度网盘';
                            else if (u.indexOf('aliyundrive') != -1 || u.indexOf('alipan') != -1) label = '阿里云盘';
                            else if (u.indexOf('115.') != -1 || u.indexOf('115.com') != -1) label = '115网盘';
                            else if (u.indexOf('quark') != -1) label = '夸克网盘';
                            else if (u.indexOf('xunlei') != -1) label = '迅雷';
                            else if (u.indexOf('ed2k') != -1) label = '电驴链接';
                            links.push({ type: label, text: u });
                        }
                    }
                }
                return links;
            },
            copySingleLink: function (t) { GM_setClipboard(t); this.showTip("已复制"); },
            copyAllLinks: function () {
                var t = this.extractedLinks.map(function (l) { return l.text; }).join("\r\n");
                GM_setClipboard(t); this.showTip("已复制" + this.extractedLinks.length + "条链接");
            },

            // --- 批量开帖 ---
            _addBatchCheckboxes: function () {
                var self = this;
                var rows = document.querySelectorAll('tbody[id*="thread_"]');
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].querySelector('.helper-batch-cb')) continue;
                    var td = rows[i].querySelector('td:first-child');
                    if (!td) continue;
                    var cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'helper-batch-cb';
                    cb.dataset.tid = rows[i].id.split('_')[1];
                    td.insertBefore(cb, td.firstChild);
                }
            },
            batchOpenSelected: function () {
                var cbs = document.querySelectorAll('.helper-batch-cb:checked');
                if (cbs.length === 0) { this.showTip("请先勾选帖子"); return; }
                for (var i = 0; i < cbs.length; i++) {
                    var tid = cbs[i].dataset.tid;
                    if (tid) { var u = 'https://' + window.location.host + '/forum.php?mod=viewthread&tid=' + tid; GM_openInTab(u, false); }
                }
                this.showTip("已打开" + cbs.length + "个帖子");
            },

            // --- 快速回复模板 ---
            _addReplyTemplates: function () {
                if (_tplLock) return; _tplLock = true;
                var self = this;
                var ta = document.querySelector('#fastpostmessage') || document.querySelector('textarea[name="message"]');
                if (!ta) { _tplLock = false; return; }
                if (ta.parentNode.querySelector('.helper-reply-templates')) return;
                var tpls = parseList(this.settingInfo.f_replyTemplateTexts);
                if (tpls.length === 0) { _tplLock = false; return; }
                var div = document.createElement('div'); div.className = 'helper-reply-templates';
                for (var i = 0; i < tpls.length; i++) {
                    (function (t) {
                        var sp = document.createElement('span');
                        sp.textContent = t.length > 20 ? t.substring(0, 20) + '...' : t;
                        sp.title = t;
                        sp.onclick = function () { ta.value = t; ta.focus(); };
                        div.appendChild(sp);
                    })(tpls[i]);
                }
                ta.parentNode.insertBefore(div, ta);
                _tplLock = false;
            },

            // --- 页码快速跳转 ---
            _addPageJump: function () {
                var self = this;
                var pg = document.querySelector('.pg');
                if (!pg || pg.querySelector('.helper-page-jump')) return;
                var sp = new URLSearchParams(window.location.search);
                var curPage = parseInt(sp.get('page')) || 1;
                var maxPage = 1;
                var lastLink = pg.querySelector('.last');
                if (lastLink) { var m = lastLink.href.match(/page=(\d+)/); if (m) maxPage = parseInt(m[1]); }
                var div = document.createElement('span'); div.className = 'helper-page-jump';
                var inp = document.createElement('input'); inp.type = 'text'; inp.value = curPage; inp.title = '输入页码按回车跳转';
                var btn = document.createElement('button'); btn.textContent = '跳转';
                inp.onkeydown = function (e) { if (e.key === 'Enter') btn.click(); };
                btn.onclick = function () {
                    var p = parseInt(inp.value);
                    if (isNaN(p) || p < 1) p = 1;
                    if (p > maxPage) p = maxPage;
                    sp.set('page', p);
                    window.location.search = sp.toString();
                };
                div.appendChild(inp); div.appendChild(btn);
                pg.appendChild(div);
            },

            // --- 帖子过滤 ---
            _applyThreadFilters: function () {
                var hWords = parseList(this.settingInfo.f_keywordHighlight ? this.settingInfo.f_keywordWords : "");
                var aList = parseList(this.settingInfo.f_authorBlock ? this.settingInfo.f_authorBlockList : "");
                var tWords = parseList(this.settingInfo.f_titleBlock ? this.settingInfo.f_titleBlockWords : "");
                var rows = document.querySelectorAll('tbody[id*="thread_"]');
                for (var i = 0; i < rows.length; i++) {
                    var thEl = rows[i].querySelector('th .xst, th a[href*="thread"]');
                    var titleText = thEl ? (thEl.textContent || thEl.innerText || "") : "";
                    var blocked = false;
                    for (var k = 0; k < tWords.length; k++) {
                        if (tWords[k] && titleText.indexOf(tWords[k]) != -1) { blocked = true; break; }
                    }
                    for (var j = 0; j < aList.length; j++) {
                        var authorCell = rows[i].querySelector('td:nth-child(3)');
                        if (authorCell && aList[j] && (authorCell.textContent || authorCell.innerText || "").indexOf(aList[j]) != -1) { blocked = true; break; }
                    }
                    if (blocked) { rows[i].classList.add('helper-blocked-row'); continue; }
                    else rows[i].classList.remove('helper-blocked-row');
                    if (hWords.length > 0 && thEl) {
                        var ht = titleText;
                        for (var m = 0; m < hWords.length; m++) {
                            if (hWords[m] && ht.indexOf(hWords[m]) != -1) {
                                rows[i].querySelector('th').style.background = '#fff9c4';
                                break;
                            }
                        }
                    }
                }
            },

            // --- 只看特定用户 ---
            _applyUserFilter: function () {
                var ulist = parseList(this.settingInfo.f_userFilterList);
                if (ulist.length === 0) return;
                var posts = document.querySelectorAll('#postlist > div, #postlist > table');
                for (var i = 0; i < posts.length; i++) {
                    var authEl = posts[i].querySelector('.authi, .pi a');
                    var auth = authEl ? (authEl.textContent || authEl.innerText || "") : "";
                    var match = false;
                    for (var j = 0; j < ulist.length; j++) {
                        if (auth.indexOf(ulist[j]) != -1) { match = true; break; }
                    }
                    if (!match) posts[i].classList.add('helper-filtered-post');
                    else posts[i].classList.remove('helper-filtered-post');
                }
            },

            // --- 自动刷新 ---
            _startAutoRefresh: function () { this._stopAutoRefresh(); var self = this; refreshTimer = setInterval(function () { window.location.reload(); }, self.settingInfo.f_autoRefreshInterval * 1000); },
            _stopAutoRefresh: function () { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } },

            // --- 检测回复可见内容 ---
            _hasReplyToViewContent: function () {
                var bodyText = document.body.innerText || document.body.textContent || "";
                var patterns = [
                    "回复可见", "回复后可见", "需要回复",
                    "回复才可以浏览", "如果您要查看本帖隐藏内容请回复",
                    "以下内容回复可见", "本帖隐藏的内容", "回复查看隐藏内容",
                    "游客，如果您要查看本帖隐藏内容请回复"
                ];
                for (var i = 0; i < patterns.length; i++) {
                    if (bodyText.indexOf(patterns[i]) != -1) return true;
                }
                var lockedEls = document.querySelectorAll('.locked, .alert_info, [id*="locked"]');
                for (var j = 0; j < lockedEls.length; j++) {
                    var t = lockedEls[j].innerText || lockedEls[j].textContent || "";
                    if (t.indexOf("回复") != -1) return true;
                }
                return false;
            },

            // --- 原创自拍区自动回复 ---
            _autoReply155: function () {
                if (!this.settingInfo.f_autoReply155 && !this.settingInfo.f_smartAutoReply155) return;
                var sp = new URLSearchParams(window.location.search);
                var tid = sp.get("tid");
                if (!tid) return;
                var fid = sp.get("fid");
                if (!fid) {
                    var nv = document.querySelectorAll('#pt a');
                    for (var i = 0; i < nv.length; i++) { var m = nv[i].href.match(/fid=(\d+)/); if (m) { fid = m[1]; break; } }
                }
                if (fid != "155") return;
                if (this.settingInfo.f_smartAutoReply155 && !this.settingInfo.f_autoReply155 && !this._hasReplyToViewContent()) return;
                var replied = C.get(CK.autoRepliedTids, []);
                if (replied.indexOf(tid) != -1) return;
                var self = this;
                setTimeout(function () {
                    var ta = document.querySelector('#fastpostmessage');
                    var btn = document.querySelector('#fastpostsubmit');
                    if (!ta || !btn) return;
                    ta.value = "感谢分享";
                    replied.push(tid);
                    if (replied.length > 200) replied = replied.slice(-200);
                    C.set(CK.autoRepliedTids, replied);
                    self.showTip("自动回复：感谢分享");
                    btn.click();
                    setTimeout(function () { window.location.reload(); }, 3000);
                }, 1500);
            },

            // --- 浏览统计 ---
            _updateStats: function () {
                if (!this.settingInfo.f_browseStats) return;
                var v = C.get(CK.stats_pageViews, 0) + 1;
                C.set(CK.stats_pageViews, v);
                this.statsPageViews = v;
                this.statsRateCount = C.get(CK.stats_rateCount, 0);
            },

            // --- 评分/收藏 ---
            getPidFromPage: function () { var ts = document.querySelectorAll('table[id^="pid"]'); return ts.length > 0 ? ts[0].id.replace("pid", "") : null; },
            getPid: async function () {
                var p = this.getPidFromPage(); if (p) return p;
                var mu = new URL(window.location.href); mu.searchParams.set('page', 1);
                var r = await fetch(mu.href).then(function (r) { return r.text(); });
                var doc = new DOMParser().parseFromString(r, 'text/html');
                var ts = doc.querySelectorAll('table[id^="pid"]');
                return ts[0] ? ts[0].id.replace("pid", "") : "";
            },
            getRateInfo: async function (pid, tid, timestamp) {
                var info = { state: false, max: 0, left: 0, formHash: '', referer: '', handleKey: '', error: '' };
                try {
                    var u = '/forum.php?mod=misc&action=rate&tid=' + tid + '&pid=' + pid + '&infloat=yes&handlekey=rate&t=' + timestamp + '&inajax=1&ajaxtarget=fwin_content_rate';
                    var t = await fetch(u).then(function (r) { return r.text(); });
                    var xml = new DOMParser().parseFromString(t, 'text/xml');
                    var rootEl = xml.getElementsByTagName('root')[0];
                    if (!rootEl) { info.error = "抱歉，获取评分信息失败"; return info; }
                    var c = rootEl.textContent;
                    if (c.indexOf('抱歉') != -1) { info.error = "抱歉，您不能对同一个帖子重复评分或者对自己发表的帖子评分"; return info; }
                    var doc = new DOMParser().parseFromString(c, 'text/html');
                    var li8 = doc.querySelector('#scoreoption8 li');
                    var td1 = doc.querySelector('.dt.mbm td:last-child');
                    var fhi = doc.querySelector('input[name="formhash"]');
                    if (!li8 || !td1 || !fhi) { info.error = "抱歉，获取评分信息失败"; return info; }
                    info.max = parseInt(li8.innerText.replace("+", ""));
                    info.left = parseInt(td1.innerText);
                    info.formHash = fhi.value;
                    var ri = doc.querySelector('input[name="referer"]'); if (ri) info.referer = ri.value;
                    var hk = doc.querySelector('input[name="handlekey"]'); if (hk) info.handleKey = hk.value;
                    if (info.max > info.left) info.max = info.left;
                    info.state = true;
                } catch (e) { console.error("getRateInfo", e); }
                return info;
            },
            rate: async function () {
                var pid = await this.getPid();
                var tid = new URLSearchParams(window.location.search).get("tid");
                var ts = new Date().getTime();
                var ri = await this.getRateInfo(pid, tid, ts);
                if (!ri.state) { this.showTip(ri.error); return; }
                var data = new URLSearchParams();
                data.append('formhash', ri.formHash); data.append('tid', tid); data.append('pid', pid);
                data.append('referer', ri.referer); data.append('handlekey', ri.handleKey);
                data.append('score8', '+' + ri.max); data.append('reason', ''); data.append('sendreasonpm', 'on');
                var req = new Request('/forum.php?mod=misc&action=rate&ratesubmit=yes&infloat=yes&inajax=1', { method: 'post', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data });
                fetch(req).then(function (r) { return r.text(); }).then(function (r) {
                    if (r.indexOf('感谢您的参与') != -1) {
                        appVue.showTip('+' + ri.max + ' 评分成功，并通知了楼主!');
                        if (appVue.settingInfo.f_browseStats) {
                            var rc = C.get(CK.stats_rateCount, 0) + 1;
                            C.set(CK.stats_rateCount, rc);
                            appVue.statsRateCount = rc;
                        }
                    } else appVue.showTip("抱歉，评分失败！");
                });
            },
            star: async function () {
                var tid = new URLSearchParams(window.location.search).get("tid");
                var fh = document.querySelector('input[name="formhash"]');
                if (!fh) { this.showTip("抱歉，获取formhash失败"); return; }
                var u = '/home.php?mod=spacecp&ac=favorite&type=thread&id=' + tid + '&formhash=' + fh.value + '&infloat=yes&handlekey=k_favorite&inajax=1&ajaxtarget=fwin_content_k_favorite';
                var t = await fetch(u).then(function (r) { return r.text(); });
                if (t.indexOf("您已收藏") != -1) this.showTip("抱歉，您已收藏，请勿重复收藏");
                else if (t.indexOf("收藏成功") != -1) this.showTip("信息收藏成功");
                else this.showTip("信息收藏出现问题！！！");
            },
            twoAction: async function () { await this.star(); await this.rate(); },

            // --- 提示 ---
            showTip: function (msg) { if (msg.indexOf("抱歉") != -1) this.$Message.error({ background: true, content: msg }); else this.$Message.success({ background: true, content: msg }); },

            // --- 初始化 ---
            checkAll: function () {
                if (window.location.href.indexOf('member.php') != -1) return;
                this.getUserID();
                this.checkOrder();
                this.checkSign();
                this.isImagesShows = C.get(CK.showImages, true);
                this.showImages(document, this.isImagesShows);
                this.isDarkMode = C.get(CK.darkMode, false);
                this._applyDarkMode();
                this.isPanelCollapsed = C.get(CK.isPanelCollapsed, false);
                this._loadSettings();
                this._applyFeatures();
                this._updateStats();
            }
        }
    });

    appVue.checkAll();

    // ==================== 全局函数 ====================

    function showSetting() { appVue.settingModalShow(); }
    function doSignMenu() { appVue._doAutoSign(); }
    function showLinkExtract() { appVue.openLinkExtract(); }
    function toggleDarkFromMenu() { appVue.darkModeClick(); }

    // ==================== DOM 钩子 ====================

    function addReadItem() {
        var tid = new URLSearchParams(window.location.search).get("tid");
        if (tid) {
            var threads = C.get(CK.readThreads, []);
            threads = threads.filter(function (t) { return t !== tid; });
            threads.unshift(tid);
            threads = threads.slice(0, 98);
            C.set(CK.readThreads, threads);
        }
    }
    addReadItem();

    var fnArriveBlock = function () {
        if (_arriveLock._block) return;
        _arriveLock._block = true;
        appVue.isShowTwoButton = true;
        appVue.isShowRateButton = true;
        appVue.isShowLinkExtractButton = C.get(CK.f_linkExtract, true);
        appVue.isShowScrollLatestButton = C.get(CK.f_scrollLatest, true);
        appVue.isShowSignatureButton = C.get(CK.f_signature, false);

        var codes = this.querySelectorAll('.blockcode');
        if (codes && codes.length > 0) appVue.isShowCopyCodeButton = true;
        for (var i = 0; i < codes.length; i++) {
            (function (code) {
                var btn = document.createElement("button");
                btn.className = "ivu-btn ivu-btn-info ivu-btn-small";
                btn.textContent = "复制代码";
                code.insertAdjacentElement("afterbegin", btn);
                btn.onclick = function () {
                    var lis = Array.prototype.slice.call(code.getElementsByTagName("li"));
                    GM_setClipboard(lis.map(function (li) { return li.innerText.replace(/\n/g, ""); }).join("\r\n"));
                    appVue.showTip("已经复制" + lis.length + "条到剪贴板！");
                };
            })(codes[i]);
        }

        var imgs = this.querySelectorAll('img');
        if (imgs && imgs.length > 0) appVue.isShowImageButton = true;

        if (C.get(CK.f_lightbox, true)) appVue._bindLightbox();
        if (C.get(CK.f_replyTemplate, false)) appVue._addReplyTemplates();
        if (C.get(CK.f_userFilter, false)) appVue._applyUserFilter();
    };

    document.arrive('.t_fsz', { existing: true }, fnArriveBlock);

    document.arrive('tbody[id*="thread_"]', { existing: true }, function () {
        var tid = this.id.split('_')[1];
        var tids = C.get(CK.readThreads, []);
        if (tids.indexOf(tid) != -1) this.classList.add("readThread");
    });

    var _threadHookRun = false;
    document.arrive('#threadlist', { existing: true }, function () {
        if (_threadHookRun) return;
        _threadHookRun = true;
        setTimeout(function () {
            var fil = C.get(CK.f_keywordHighlight, false) || C.get(CK.f_authorBlock, false) || C.get(CK.f_titleBlock, false);
            if (fil) appVue._applyThreadFilters();
            if (C.get(CK.f_batchOpen, false)) appVue._addBatchCheckboxes();
            if (C.get(CK.f_pageJump, true)) appVue._addPageJump();
            appVue.isShowBatchOpenButton = C.get(CK.f_batchOpen, false);
        }, 300);
    });

    // ==================== 键盘快捷键 ====================

    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            if (!(e.ctrlKey && e.key === 'Enter')) return;
        }
        if (e.ctrlKey && e.key === 'Enter') {
            if (appVue.isShowTwoButton) { e.preventDefault(); appVue.twoAction(); }
        } else if (e.ctrlKey && e.key === 'q') {
            if (appVue.settingInfo.isShowPinnedItemButton) { e.preventDefault(); appVue.quickJump(); }
        } else if (e.ctrlKey && e.key === 'ArrowRight') {
            var nxt = document.querySelector('.nxt');
            if (nxt) { e.preventDefault(); window.location.href = nxt.href; }
        } else if (e.ctrlKey && e.key === 'ArrowLeft') {
            var prv = document.querySelector('.pg .prev');
            if (prv) { e.preventDefault(); window.location.href = prv.href; }
        }
    });

})();
