// ==UserScript==
// @name         M85 Yahoo Finance Stock Assistant V16.1
// @namespace    https://greasyfork.org/users/1636459
// @version      16.1
// @description  Accurate Yahoo price display, session status, crossing alerts, per-alert controls, and backup
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        *://finance.yahoo.com/quote/*
// @match        *://*.finance.yahoo.com/quote/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
=========================================================================
 M85 Yahoo Finance Stock Assistant V16.1

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 يمنع حذف أو تغيير بيانات المصمم وحقوقه عند إعادة نشر السكربت.
=========================================================================
*/

(function () {
  'use strict';

  const CARD_ID = 'm85-yahoo-stock-card';
  const STYLE_ID = 'm85-yahoo-stock-style-v16';
  const PRIMARY_PREFIX = 'm85_yahoo_stock_data_v15_';
  const NEAR_PERCENT = 1;

  const PRIORITY = {
    Overnight: 100,
    'After-hours': 95,
    'Pre-market': 90,
    'Regular Market': 80,
    'At close': 50,
    Unknown: 10
  };

  const state = {
    currentSymbol: '',
    hydratedSymbol: '',
    currentPrice: null,
    currentDisplayPrice: '',
    currentLabel: '',
    previousPrices: {},
    saveTimer: null,
    isHydrating: false,
    soundEnabled: false,
    audioCtx: null,
    titleTimer: null,
    originalTitle: document.title,
    tickTimer: null,
    lastSuccessfulReadAt: 0,
    lastPriceChangeAt: 0
  };

  function getSymbol() {
    const match = location.pathname.match(/\/quote\/([^/?#]+)/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).replace(/[^A-Z0-9.\-]/gi, '').toUpperCase();
    }
    const titleMatch = document.title.match(/\(([A-Z0-9.\-]+)\)/i);
    return titleMatch ? titleMatch[1].toUpperCase() : '';
  }

  function storageKey(symbol) {
    return `${PRIMARY_PREFIX}${symbol}`;
  }

  function allStorageKeys(symbol) {
    return [
      `m85_yahoo_stock_data_v15_${symbol}`,
      `m85_yahoo_stock_data_v16_${symbol}`,
      `m85_yahoo_stock_data_v14_${symbol}`,
      `m85_yahoo_stock_data_v13_${symbol}`,
      `m85_yahoo_stock_data_${symbol}`,
      `m85_yahoo_${symbol}`
    ];
  }

  function isNonEmpty(value) {
    return String(value ?? '').trim() !== '';
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function emptyStockData() {
    return {
      shares: '', avg: '', alerts: '', triggered: {}, nearTriggered: {}, disabled: {}, savedAt: ''
    };
  }

  function loadStockData(symbol) {
    if (!symbol) return emptyStockData();
    const merged = emptyStockData();

    allStorageKeys(symbol).forEach(key => {
      const data = readJson(key);
      if (!data || typeof data !== 'object') return;
      if (!isNonEmpty(merged.shares) && isNonEmpty(data.shares)) merged.shares = String(data.shares);
      if (!isNonEmpty(merged.avg) && isNonEmpty(data.avg)) merged.avg = String(data.avg);
      if (!isNonEmpty(merged.alerts) && isNonEmpty(data.alerts)) merged.alerts = String(data.alerts);
      if (data.triggered && typeof data.triggered === 'object') merged.triggered = { ...data.triggered, ...merged.triggered };
      if (data.nearTriggered && typeof data.nearTriggered === 'object') merged.nearTriggered = { ...data.nearTriggered, ...merged.nearTriggered };
      if (data.disabled && typeof data.disabled === 'object') merged.disabled = { ...data.disabled, ...merged.disabled };
      if (!merged.savedAt && data.savedAt) merged.savedAt = data.savedAt;
    });
    return merged;
  }

  function saveStockData(symbol, patch = {}, options = {}) {
    if (!symbol || symbol !== getSymbol()) return false;
    const allowBlank = !!options.allowBlank;
    const oldData = loadStockData(symbol);
    const nextData = { ...oldData };

    ['shares', 'avg', 'alerts'].forEach(field => {
      if (!Object.prototype.hasOwnProperty.call(patch, field)) return;
      const incoming = String(patch[field] ?? '');
      if (!allowBlank && incoming.trim() === '' && isNonEmpty(oldData[field])) return;
      nextData[field] = incoming;
    });

    ['triggered', 'nearTriggered', 'disabled'].forEach(field => {
      if (patch[field] && typeof patch[field] === 'object') nextData[field] = patch[field];
    });

    nextData.savedAt = new Date().toISOString();
    localStorage.setItem(storageKey(symbol), JSON.stringify(nextData));
    updateSavedAt(nextData.savedAt);
    return true;
  }

  function clearStockData(symbol) {
    if (!symbol) return;
    allStorageKeys(symbol).forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  function cleanText(value) {
    return String(value || '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function parseNumber(value) {
    const n = Number(String(value || '').replace(/[−]/g, '-').replace(/,/g, '').replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function money(value) {
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  function fallbackStockPrice(value) {
    if (!Number.isFinite(value)) return '—';
    const digits = value < 1 ? 4 : value < 10 ? 3 : 2;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 6 }).format(value);
  }

  function percent(value) {
    return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function timeText(value = Date.now()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
  }

  function normalizeLabel(label) {
    const text = String(label || '').toLowerCase();
    if (/overnight/.test(text)) return 'Overnight';
    if (/after|post/.test(text)) return 'After-hours';
    if (/pre/.test(text)) return 'Pre-market';
    if (/close/.test(text)) return 'At close';
    if (/regular|market open|nasdaq|nyse/.test(text)) return 'Regular Market';
    return 'Unknown';
  }

  function sessionArabic(label) {
    return ({
      Overnight: 'التداول الليلي',
      'After-hours': 'بعد الإغلاق',
      'Pre-market': 'قبل الافتتاح',
      'Regular Market': 'السوق مفتوح',
      'At close': 'سعر الإغلاق',
      Unknown: 'جلسة غير محددة'
    })[label] || 'جلسة غير محددة';
  }

  function getHeaderElement() {
    return document.querySelector('[data-testid="quote-hdr"]') || null;
  }

  function elementMatchesSymbol(el, symbol) {
    const ownSymbol = String(el?.getAttribute?.('data-symbol') || '').toUpperCase();
    return !ownSymbol || ownSymbol === symbol;
  }

  function readCandidatesFromFields() {
    const root = getHeaderElement();
    const symbol = getSymbol();
    if (!root || !symbol) return [];
    const fields = [
      ['overnightMarketPrice', 'Overnight'],
      ['postMarketPrice', 'After-hours'],
      ['preMarketPrice', 'Pre-market'],
      ['regularMarketPrice', 'Regular Market']
    ];
    const candidates = [];

    fields.forEach(([field, label]) => {
      const el = root.querySelector(`fin-streamer[data-field="${field}"], [data-field="${field}"]`);
      if (!el || !elementMatchesSymbol(el, symbol)) return;
      const displayPrice = cleanText(el.textContent).match(/\d{1,6}(?:,\d{3})*(?:\.\d+)?/)?.[0] || '';
      const price = parseNumber(displayPrice);
      if (Number.isFinite(price) && price > 0) {
        candidates.push({ price, displayPrice, label, priority: PRIORITY[label], sourceRank: 2, symbol });
      }
    });
    return candidates;
  }

  function readCandidatesFromHeaderText() {
    const header = getHeaderElement();
    const symbol = getSymbol();
    if (!header || !symbol) return [];
    const text = cleanText(header.innerText || header.textContent);
    const candidates = [];
    const priceBlocks = [];
    const regex = /(\d{1,6}(?:,\d{3})*(?:\.\d{1,6})?)\s+[+\-−]?\d{1,6}(?:,\d{3})*(?:\.\d{1,6})?\s+\([+\-−]?\d{1,3}(?:\.\d+)?%\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      priceBlocks.push({
        displayPrice: match[1],
        price: parseNumber(match[1]),
        start: match.index,
        end: match.index + match[0].length
      });
    }

    priceBlocks.forEach((block, index) => {
      if (!Number.isFinite(block.price) || block.price <= 0) return;

      // Yahoo places the session caption directly after its own price block.
      // Stop before the next price block so its caption cannot relabel this price.
      const nextStart = priceBlocks[index + 1]?.start ?? text.length;
      const ownCaption = text.slice(block.end, nextStart);
      let label = 'Regular Market';

      if (/Overnight/i.test(ownCaption)) label = 'Overnight';
      else if (/After-hours|After hours|Post Market|post-market/i.test(ownCaption)) label = 'After-hours';
      else if (/Pre-market|Premarket/i.test(ownCaption)) label = 'Pre-market';
      else if (/At close|Previous Close/i.test(ownCaption)) label = 'At close';

      label = normalizeLabel(label);

      candidates.push({
        price: block.price,
        displayPrice: block.displayPrice,
        label,
        priority: PRIORITY[label],
        sourceRank: 1,
        symbol
      });
    });

    return candidates;
  }

  function getActivePriceInfo() {
    const header = getHeaderElement();
    const symbol = getSymbol();
    if (!header || !symbol) return null;
    const candidates = [...readCandidatesFromFields(), ...readCandidatesFromHeaderText()]
      .filter(c => c.symbol === symbol && Number.isFinite(c.price) && c.price > 0);
    if (!candidates.length) return null;
    const unique = [];
    const seen = new Set();
    candidates.forEach(c => {
      const key = `${c.label}:${c.displayPrice}`;
      if (!seen.has(key)) { seen.add(key); unique.push(c); }
    });
    unique.sort((a, b) => b.priority - a.priority || b.sourceRank - a.sourceRank);
    return unique[0];
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CARD_ID}{direction:rtl!important;font-family:Tahoma,Arial,sans-serif!important;margin:14px 0 16px!important;padding:14px!important;border-radius:18px!important;background:linear-gradient(135deg,#111827,#0f172a)!important;color:#fff!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 18px 45px rgba(0,0,0,.20)!important;max-width:760px!important;box-sizing:border-box!important}
      #${CARD_ID}.m85-collapsed .m85-body{display:none!important}
      #${CARD_ID} .m85-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin-bottom:12px!important}
      #${CARD_ID} .m85-title{font-weight:900!important;font-size:15px!important} #${CARD_ID} .m85-sub{font-size:11px!important;color:rgba(255,255,255,.55)!important;margin-top:4px!important}
      #${CARD_ID} .m85-symbol,#${CARD_ID} .m85-session{font-size:12px!important;font-weight:900!important;background:rgba(255,255,255,.10)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:999px!important;padding:6px 10px!important}
      #${CARD_ID} .m85-symbol{direction:ltr!important} #${CARD_ID} .m85-session{color:#bfdbfe!important}
      #${CARD_ID} .m85-main-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;margin:10px 0!important}
      #${CARD_ID} .m85-price-box,#${CARD_ID} .m85-pl-box{background:rgba(255,255,255,.07)!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:15px!important;padding:12px!important;box-sizing:border-box!important}
      #${CARD_ID} .m85-label{font-size:11px!important;color:rgba(255,255,255,.55)!important;margin-bottom:6px!important}
      #${CARD_ID} .m85-price{font-size:34px!important;line-height:1!important;font-weight:900!important;direction:ltr!important;text-align:right!important}
      #${CARD_ID} .m85-source{font-size:12px!important;color:#93c5fd!important;margin-top:7px!important;line-height:1.6!important}
      #${CARD_ID} .m85-health{display:inline-block!important;width:8px!important;height:8px!important;border-radius:50%!important;margin-left:5px!important;background:#f59e0b!important} #${CARD_ID} .m85-health.good{background:#22c55e!important} #${CARD_ID} .m85-health.bad{background:#ef4444!important}
      #${CARD_ID} .m85-pl{font-size:30px!important;line-height:1!important;font-weight:900!important;direction:ltr!important;text-align:right!important} #${CARD_ID} .m85-pl.good{color:#86efac!important} #${CARD_ID} .m85-pl.bad{color:#fecaca!important}
      #${CARD_ID} .m85-inputs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important;margin:10px 0!important}
      #${CARD_ID} input,#${CARD_ID} textarea{width:100%!important;box-sizing:border-box!important;border-radius:12px!important;border:1px solid rgba(255,255,255,.14)!important;background:#0b1220!important;color:#fff!important;padding:9px 10px!important;outline:none!important;font-family:Consolas,Tahoma,Arial,sans-serif!important}
      #${CARD_ID} input{direction:ltr!important;font-size:14px!important} #${CARD_ID} textarea{direction:ltr!important;min-height:74px!important;resize:vertical!important;font-size:13px!important}
      #${CARD_ID} input:focus,#${CARD_ID} textarea:focus{border-color:#38bdf8!important;box-shadow:0 0 0 3px rgba(56,189,248,.16)!important}
      #${CARD_ID} .m85-help{font-size:11px!important;color:rgba(255,255,255,.52)!important;line-height:1.6!important;margin:6px 0!important}
      #${CARD_ID} .m85-buttons{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin-top:10px!important} #${CARD_ID} button{border:0!important;border-radius:999px!important;padding:8px 11px!important;color:#fff!important;font-size:12px!important;font-weight:800!important;cursor:pointer!important}
      #${CARD_ID} .primary{background:#2563eb!important} #${CARD_ID} .success{background:#059669!important} #${CARD_ID} .warning{background:#d97706!important} #${CARD_ID} .danger{background:#dc2626!important} #${CARD_ID} .dark{background:#374151!important}
      #${CARD_ID} .m85-status{margin-top:9px!important;border-radius:12px!important;padding:8px 10px!important;font-size:12px!important;line-height:1.6!important;background:rgba(255,255,255,.07)!important;color:rgba(255,255,255,.72)!important} #${CARD_ID} .m85-status.good{background:rgba(16,185,129,.16)!important;color:#a7f3d0!important} #${CARD_ID} .m85-status.bad{background:rgba(239,68,68,.16)!important;color:#fecaca!important} #${CARD_ID} .m85-status.info{background:rgba(59,130,246,.16)!important;color:#bfdbfe!important}
      #${CARD_ID} .m85-chips{display:flex!important;flex-direction:column!important;gap:6px!important;margin-top:8px!important} #${CARD_ID} .m85-chip{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;font-size:11px!important;color:rgba(255,255,255,.80)!important;background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:10px!important;padding:6px 8px!important} #${CARD_ID} .m85-chip.off{opacity:.55!important} #${CARD_ID} .m85-chip-actions{display:flex!important;gap:4px!important;flex-shrink:0!important} #${CARD_ID} .m85-chip-actions button{padding:4px 7px!important;font-size:10px!important}
      #${CARD_ID} .m85-saved{font-size:11px!important;color:rgba(255,255,255,.55)!important;margin-top:7px!important} #${CARD_ID}.m85-flash{animation:m85Flash .35s alternate 12!important}@keyframes m85Flash{from{filter:brightness(1)}to{filter:brightness(1.45)}}
      @media(max-width:760px){#${CARD_ID} .m85-main-grid,#${CARD_ID} .m85-inputs{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function createCard() {
    installStyle();
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.innerHTML = `
      <div class="m85-head"><div><div class="m85-title">M85 Stock Assistant</div><div class="m85-sub">داخل الصفحة + حفظ آمن + تنبيهات</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="m85-session" id="m85-session">بانتظار الجلسة</div><div class="m85-symbol" id="m85-stock-symbol">—</div><button class="dark" id="m85-collapse-btn" title="تصغير">−</button></div></div>
      <div class="m85-body">
        <div class="m85-main-grid">
          <div class="m85-price-box"><div class="m85-label">السعر الفعّال الحالي</div><div class="m85-price" id="m85-active-price">—</div><div class="m85-source"><span class="m85-health" id="m85-health"></span><span id="m85-price-source">بانتظار قراءة السعر...</span><br><span id="m85-update-time">آخر تحديث: —</span></div></div>
          <div class="m85-pl-box"><div class="m85-label">الربح / الخسارة الحالية</div><div class="m85-pl" id="m85-current-pl">—</div><div class="m85-source" id="m85-current-pl-sub">أدخل عدد الأسهم ومتوسط الشراء</div></div>
        </div>
        <div class="m85-inputs"><div><div class="m85-label">عدد الأسهم</div><input id="m85-shares-input" type="number" step="any" placeholder="مثال: 6"></div><div><div class="m85-label">متوسط سعر الشراء / التعادل</div><input id="m85-avg-input" type="number" step="any" placeholder="مثال: 206.45"></div></div>
        <div><div class="m85-label">التنبيهات السعرية</div><textarea id="m85-alerts-textarea" placeholder="مثال:\n207\n208\n>= 220 بيع\n<= 200 وقف خسارة"></textarea><div class="m85-help">يصدر تنبيه الاقتراب عند دخول نطاق 1%، والتنبيه الأساسي عند عبور السعر للهدف فعليًا.</div><div class="m85-chips" id="m85-alert-chips"></div></div>
        <div class="m85-buttons"><button class="success" id="m85-save-now-btn">حفظ الآن</button><button class="primary" id="m85-restore-btn">استرجاع</button><button class="warning" id="m85-enable-sound-btn">تفعيل الصوت</button><button class="dark" id="m85-test-alert-btn">اختبار</button><button class="dark" id="m85-reset-alerts-btn">إعادة كل التنبيهات</button><button class="primary" id="m85-export-btn">تصدير نسخة احتياطية</button><button class="primary" id="m85-import-btn">استيراد نسخة</button><button class="danger" id="m85-clear-stock-btn">مسح السهم</button><input id="m85-import-file" type="file" accept="application/json,.json" hidden></div>
        <div class="m85-saved" id="m85-saved-at">آخر حفظ: —</div><div class="m85-status info" id="m85-stock-status">جاهز. تتم قراءة السعر فقط من هيدر السهم الرسمي في Yahoo.</div>
      </div>`;
    bindCardEvents(card);
    return card;
  }

  function bindCardEvents(card) {
    const sharesInput = card.querySelector('#m85-shares-input');
    const avgInput = card.querySelector('#m85-avg-input');
    const alertsTextarea = card.querySelector('#m85-alerts-textarea');
    [sharesInput, avgInput, alertsTextarea].forEach(el => {
      el.addEventListener('input', () => {
        if (state.isHydrating) return;
        scheduleSafeSave(); updateProfitDisplay(); renderAlertChips();
      });
      el.addEventListener('change', () => {
        if (state.isHydrating) return;
        saveInputsNow({ allowBlank: false, announce: true }); updateProfitDisplay(); renderAlertChips();
      });
    });

    card.querySelector('#m85-collapse-btn').addEventListener('click', () => {
      card.classList.toggle('m85-collapsed');
      card.querySelector('#m85-collapse-btn').textContent = card.classList.contains('m85-collapsed') ? '+' : '−';
    });
    card.querySelector('#m85-save-now-btn').addEventListener('click', () => saveInputsNow({ allowBlank: false, announce: true }));
    card.querySelector('#m85-restore-btn').addEventListener('click', () => {
      hydrateInputsForSymbol(getSymbol(), { force: true }); updateProfitDisplay(); renderAlertChips(); setStatus('تم استرجاع بيانات السهم من التخزين.', 'good');
    });
    card.querySelector('#m85-enable-sound-btn').addEventListener('click', enableSound);
    card.querySelector('#m85-test-alert-btn').addEventListener('click', () => fireAlert({ target: state.currentPrice || 0, label: 'اختبار التنبيه' }, state.currentPrice || 0, false));
    card.querySelector('#m85-reset-alerts-btn').addEventListener('click', resetAllAlerts);
    card.querySelector('#m85-export-btn').addEventListener('click', exportBackup);
    card.querySelector('#m85-import-btn').addEventListener('click', () => card.querySelector('#m85-import-file').click());
    card.querySelector('#m85-import-file').addEventListener('change', importBackup);
    card.querySelector('#m85-alert-chips').addEventListener('click', handleChipAction);
    card.querySelector('#m85-clear-stock-btn').addEventListener('click', () => {
      const symbol = getSymbol();
      if (!confirm(`هل تريد مسح بيانات ${symbol} بالكامل؟\nسيتم مسح عدد الأسهم، متوسط الشراء، والتنبيهات.`)) return;
      clearStockData(symbol);
      state.isHydrating = true; sharesInput.value = ''; avgInput.value = ''; alertsTextarea.value = ''; state.isHydrating = false;
      renderAlertChips(); updateProfitDisplay(); updateSavedAt(''); setStatus(`تم مسح بيانات ${symbol}.`, 'bad');
    });
  }

  function mountInlineCard() {
    installStyle();
    const header = getHeaderElement();
    const symbol = getSymbol();
    if (!header || !symbol) return;
    let card = document.getElementById(CARD_ID);
    if (!card) card = createCard();
    if (!card.isConnected || card.parentElement !== header.parentElement || card.previousElementSibling !== header) header.insertAdjacentElement('afterend', card);
    const symbolEl = document.getElementById('m85-stock-symbol');
    if (symbolEl) symbolEl.textContent = symbol;
    if (state.hydratedSymbol !== symbol) hydrateInputsForSymbol(symbol, { force: true });
  }

  function hydrateInputsForSymbol(symbol, options = {}) {
    if (!symbol) return;
    const sharesInput = document.getElementById('m85-shares-input');
    const avgInput = document.getElementById('m85-avg-input');
    const alertsTextarea = document.getElementById('m85-alerts-textarea');
    if (!sharesInput || !avgInput || !alertsTextarea) return;
    const needsHydrate = options.force || state.hydratedSymbol !== symbol || sharesInput.dataset.m85Symbol !== symbol;
    if (!needsHydrate) return;
    const data = loadStockData(symbol);
    state.isHydrating = true;
    sharesInput.value = data.shares || ''; avgInput.value = data.avg || ''; alertsTextarea.value = data.alerts || '';
    [sharesInput, avgInput, alertsTextarea].forEach(el => { el.dataset.m85Symbol = symbol; });
    state.hydratedSymbol = symbol; state.currentSymbol = symbol; state.currentPrice = null; state.currentDisplayPrice = '';
    state.isHydrating = false;
    updateSavedAt(data.savedAt); renderAlertChips(); updateProfitDisplay();
    setStatus(isNonEmpty(data.shares) || isNonEmpty(data.avg) || isNonEmpty(data.alerts) ? `تم تحميل بيانات ${symbol} المحفوظة.` : `لا توجد بيانات محفوظة لـ ${symbol} بعد.`, isNonEmpty(data.shares) ? 'good' : 'info');
  }

  function scheduleSafeSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => saveInputsNow({ allowBlank: false, announce: false }), 700);
  }

  function saveInputsNow(options = {}) {
    const symbol = getSymbol();
    const sharesInput = document.getElementById('m85-shares-input');
    const avgInput = document.getElementById('m85-avg-input');
    const alertsTextarea = document.getElementById('m85-alerts-textarea');
    if (!symbol || symbol !== state.currentSymbol || !sharesInput || !avgInput || !alertsTextarea) return;
    if ([sharesInput, avgInput, alertsTextarea].some(el => el.dataset.m85Symbol !== symbol)) return;
    const oldData = loadStockData(symbol);
    const saved = saveStockData(symbol, { shares: sharesInput.value, avg: avgInput.value, alerts: alertsTextarea.value, triggered: oldData.triggered, nearTriggered: oldData.nearTriggered, disabled: oldData.disabled }, { allowBlank: !!options.allowBlank });
    if (saved && options.announce) setStatus(`تم حفظ بيانات ${symbol} الساعة ${timeText()}.`, 'good');
  }

  function updateSavedAt(savedAt) {
    const el = document.getElementById('m85-saved-at');
    if (el) el.textContent = `آخر حفظ: ${savedAt ? timeText(savedAt) : '—'}`;
  }

  function updatePriceDisplay(priceInfo) {
    const priceEl = document.getElementById('m85-active-price');
    const sourceEl = document.getElementById('m85-price-source');
    const timeEl = document.getElementById('m85-update-time');
    const sessionEl = document.getElementById('m85-session');
    if (!priceEl || !sourceEl || priceInfo.symbol !== getSymbol()) return;

    const oldPrice = state.currentPrice;
    state.currentPrice = priceInfo.price;
    state.currentDisplayPrice = priceInfo.displayPrice;
    state.currentLabel = priceInfo.label;
    state.lastSuccessfulReadAt = Date.now();
    if (!Number.isFinite(oldPrice) || oldPrice !== priceInfo.price) state.lastPriceChangeAt = Date.now();

    priceEl.textContent = priceInfo.displayPrice || fallbackStockPrice(priceInfo.price);
    sourceEl.textContent = `${sessionArabic(priceInfo.label)} - السعر الفعّال الحالي`;
    if (timeEl) timeEl.textContent = `آخر تحديث: ${timeText(state.lastSuccessfulReadAt)}`;
    if (sessionEl) sessionEl.textContent = sessionArabic(priceInfo.label);
    updateConnectionState(); updateProfitDisplay(); checkAlerts(priceInfo.price);
  }

  function updateConnectionState() {
    const health = document.getElementById('m85-health');
    if (!health) return;
    const age = Date.now() - state.lastSuccessfulReadAt;
    health.className = `m85-health ${!state.lastSuccessfulReadAt || age > 15000 ? 'bad' : age <= 5000 ? 'good' : ''}`;
    health.title = !state.lastSuccessfulReadAt ? 'لم تتم قراءة السعر' : age > 15000 ? 'تعذر تحديث قراءة السعر' : age > 5000 ? 'تأخر تحديث القراءة' : 'قراءة السعر تعمل';
  }

  function updateProfitDisplay() {
    const plEl = document.getElementById('m85-current-pl');
    const subEl = document.getElementById('m85-current-pl-sub');
    if (!plEl || !subEl) return;
    const shares = parseNumber(document.getElementById('m85-shares-input')?.value);
    const avg = parseNumber(document.getElementById('m85-avg-input')?.value);
    const price = state.currentPrice;
    if (!Number.isFinite(price) || !Number.isFinite(shares) || !Number.isFinite(avg) || shares <= 0 || avg <= 0) {
      plEl.textContent = '—'; plEl.className = 'm85-pl'; subEl.textContent = 'أدخل عدد الأسهم ومتوسط الشراء'; return;
    }
    const pl = (price - avg) * shares;
    const pct = ((price - avg) / avg) * 100;
    const total = price * shares;
    plEl.textContent = `${pl >= 0 ? '+' : ''}$${money(pl)}`;
    plEl.className = `m85-pl ${pl >= 0 ? 'good' : 'bad'}`;
    subEl.textContent = `${percent(pct)} | قيمة المركز: $${money(total)} | التعادل: ${fallbackStockPrice(avg)}`;
  }

  function parseAlerts() {
    const text = document.getElementById('m85-alerts-textarea')?.value || '';
    return text.split(/\r?\n/).map((line, index) => ({ line: line.trim(), index })).filter(x => x.line).map(({ line, index }) => {
      let direction = 'up'; let cleaned = line; let label = 'هدف بيع';
      if (/^<=|^=<|^≤/.test(cleaned)) { direction = 'down'; cleaned = cleaned.replace(/^<=|^=<|^≤/, '').trim(); label = 'وقف / هبوط'; }
      else if (/^>=|^=>|^≥/.test(cleaned)) { cleaned = cleaned.replace(/^>=|^=>|^≥/, '').trim(); }
      const numberMatch = cleaned.match(/\d+(?:\.\d+)?/);
      const target = numberMatch ? Number(numberMatch[0]) : null;
      const targetText = numberMatch?.[0] || '';
      const customLabel = cleaned.replace(/\d+(?:\.\d+)?/, '').trim();
      if (customLabel) label = customLabel;
      if (!Number.isFinite(target)) return null;
      return { raw: line, target, targetText, direction, label, index, key: `${direction}:${target}` };
    }).filter(Boolean);
  }

  function renderAlertChips() {
    const el = document.getElementById('m85-alert-chips');
    if (!el) return;
    const data = loadStockData(getSymbol());
    const alerts = parseAlerts();
    if (!alerts.length) { el.innerHTML = '<span class="m85-chip">لا توجد تنبيهات</span>'; return; }
    el.innerHTML = alerts.map(alert => {
      const disabled = !!data.disabled[alert.key];
      const hit = !!data.triggered[alert.key];
      const near = !!data.nearTriggered[`near:${alert.key}`];
      const arrow = alert.direction === 'down' ? '↓' : '↑';
      const expected = calculateExpectedProfit(alert.target);
      const status = disabled ? 'معطل' : hit ? 'تم العبور' : near ? 'تم الاقتراب' : 'نشط';
      return `<div class="m85-chip ${disabled ? 'off' : ''}"><span>${arrow} ${escapeHtml(alert.targetText)} - ${escapeHtml(alert.label)} - ${status}${expected}</span><span class="m85-chip-actions"><button class="dark" data-action="toggle" data-key="${escapeHtml(alert.key)}">${disabled ? 'تفعيل' : 'تعطيل'}</button><button class="warning" data-action="reset" data-key="${escapeHtml(alert.key)}">إعادة</button><button class="danger" data-action="delete" data-index="${alert.index}">حذف</button></span></div>`;
    }).join('');
  }

  function calculateExpectedProfit(target) {
    const shares = parseNumber(document.getElementById('m85-shares-input')?.value);
    const avg = parseNumber(document.getElementById('m85-avg-input')?.value);
    if (!Number.isFinite(shares) || !Number.isFinite(avg) || shares <= 0 || avg <= 0) return '';
    const result = (target - avg) * shares;
    return ` | المتوقع: ${result >= 0 ? '+' : ''}$${money(result)}`;
  }

  function handleChipAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const symbol = getSymbol();
    const data = loadStockData(symbol);
    const action = button.dataset.action;
    const key = button.dataset.key;
    const alertBeforeDelete = action === 'delete'
      ? parseAlerts().find(a => a.index === Number(button.dataset.index))
      : null;
    if (action === 'toggle' && key) data.disabled[key] = !data.disabled[key];
    if (action === 'reset' && key) { delete data.triggered[key]; delete data.nearTriggered[`near:${key}`]; }
    if (action === 'delete') {
      const textarea = document.getElementById('m85-alerts-textarea');
      const lines = textarea.value.split(/\r?\n/);
      lines.splice(Number(button.dataset.index), 1);
      textarea.value = lines.join('\n');
      if (alertBeforeDelete) {
        delete data.triggered[alertBeforeDelete.key];
        delete data.nearTriggered[`near:${alertBeforeDelete.key}`];
        delete data.disabled[alertBeforeDelete.key];
      }
      data.alerts = textarea.value;
    }
    saveStockData(symbol, data, { allowBlank: true }); renderAlertChips();
    setStatus(action === 'delete' ? 'تم حذف التنبيه.' : action === 'reset' ? 'تمت إعادة تفعيل التنبيه.' : 'تم تغيير حالة التنبيه.', 'good');
  }

  function resetAllAlerts() {
    const symbol = getSymbol();
    saveStockData(symbol, { triggered: {}, nearTriggered: {} }, { allowBlank: false });
    delete state.previousPrices[symbol]; renderAlertChips(); setStatus('تمت إعادة جميع تنبيهات هذا السهم.', 'good');
  }

  function checkAlerts(price) {
    if (!Number.isFinite(price)) return;
    const symbol = getSymbol();
    if (!symbol || symbol !== state.currentSymbol) return;
    const previous = state.previousPrices[symbol];
    state.previousPrices[symbol] = price;
    if (!Number.isFinite(previous) || previous === price) return;
    const data = loadStockData(symbol);
    let changed = false;

    parseAlerts().forEach(alert => {
      if (data.disabled[alert.key]) return;
      const crossed = alert.direction === 'up' ? previous < alert.target && price >= alert.target : previous > alert.target && price <= alert.target;
      if (crossed && !data.triggered[alert.key]) {
        data.triggered[alert.key] = { price, target: alert.target, direction: alert.direction, label: alert.label, at: new Date().toISOString() };
        changed = true; fireAlert(alert, price, false); return;
      }
      const nearKey = `near:${alert.key}`;
      if (data.nearTriggered[nearKey] || data.triggered[alert.key]) return;
      const zone = alert.target * (NEAR_PERCENT / 100);
      const enteredNear = alert.direction === 'up'
        ? price < alert.target && price >= alert.target - zone && previous < alert.target - zone
        : price > alert.target && price <= alert.target + zone && previous > alert.target + zone;
      if (enteredNear) {
        data.nearTriggered[nearKey] = { price, target: alert.target, at: new Date().toISOString() };
        changed = true; fireAlert({ ...alert, label: `اقترب من ${alert.label}` }, price, true);
      }
    });
    if (changed) { saveStockData(symbol, { triggered: data.triggered, nearTriggered: data.nearTriggered }, { allowBlank: false }); renderAlertChips(); }
  }

  function collectSymbols() {
    const symbols = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const match = key.match(/^m85_yahoo_stock_data_(?:v\d+_)?([A-Z0-9.\-]+)$/i);
      if (match) symbols.add(match[1].toUpperCase());
    }
    return [...symbols];
  }

  function exportBackup() {
    saveInputsNow({ allowBlank: false, announce: false });
    const stocks = {};
    collectSymbols().forEach(symbol => { stocks[symbol] = loadStockData(symbol); });
    const payload = { app: 'M85 Yahoo Stock Assistant', version: 16, exportedAt: new Date().toISOString(), stocks };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `M85-Stocks-Backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`تم تصدير نسخة احتياطية تشمل ${Object.keys(stocks).length} سهم.`, 'good');
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!payload || payload.app !== 'M85 Yahoo Stock Assistant' || !payload.stocks || typeof payload.stocks !== 'object') throw new Error('invalid');
      let count = 0;
      Object.entries(payload.stocks).forEach(([rawSymbol, incoming]) => {
        const symbol = rawSymbol.replace(/[^A-Z0-9.\-]/gi, '').toUpperCase();
        if (!symbol || !incoming || typeof incoming !== 'object') return;
        const current = loadStockData(symbol);
        const merged = { ...current, ...incoming, triggered: { ...current.triggered, ...(incoming.triggered || {}) }, nearTriggered: { ...current.nearTriggered, ...(incoming.nearTriggered || {}) }, disabled: { ...current.disabled, ...(incoming.disabled || {}) }, savedAt: new Date().toISOString() };
        localStorage.setItem(storageKey(symbol), JSON.stringify(merged)); count++;
      });
      hydrateInputsForSymbol(getSymbol(), { force: true });
      setStatus(`تم استيراد بيانات ${count} سهم بنجاح.`, 'good');
    } catch (_) {
      setStatus('تعذر الاستيراد: الملف ليس نسخة احتياطية صحيحة للسكربت.', 'bad');
    }
  }

  function enableSound() {
    try {
      state.audioCtx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
      state.soundEnabled = true;
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      playBeep(); setStatus('تم تفعيل الصوت والتنبيهات.', 'good');
    } catch (_) { state.soundEnabled = true; setStatus('تم تفعيل التنبيه، لكن المتصفح قد يمنع الصوت حتى تتفاعل مع الصفحة.', 'info'); }
  }

  function playBeep() {
    try {
      const ctx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)(); state.audioCtx = ctx; const now = ctx.currentTime;
      [0, .18, .36].forEach((offset, index) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = index % 2 === 0 ? 880 : 660;
        gain.gain.setValueAtTime(.0001, now + offset); gain.gain.exponentialRampToValueAtTime(.35, now + offset + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + offset + .14);
        osc.connect(gain); gain.connect(ctx.destination); osc.start(now + offset); osc.stop(now + offset + .15);
      });
    } catch (_) {}
  }

  function fireAlert(alert, price, isNear) {
    const symbol = getSymbol();
    const shownPrice = state.currentDisplayPrice || fallbackStockPrice(price);
    const targetText = alert.targetText || fallbackStockPrice(alert.target);
    const msg = `${symbol}: ${alert.label} عند ${targetText} | السعر الحالي ${shownPrice}`;
    setStatus(`${isNear ? 'تنبيه اقتراب' : 'تنبيه'}: ${msg}`, isNear ? 'info' : 'bad');
    const card = document.getElementById(CARD_ID);
    if (card) { card.classList.remove('m85-flash'); void card.offsetWidth; card.classList.add('m85-flash'); }
    if (state.soundEnabled) {
      playBeep();
      try { speechSynthesis.cancel(); const utter = new SpeechSynthesisUtterance(`تنبيه سهم ${symbol}. ${alert.label}. السعر الحالي ${shownPrice}`); utter.lang = 'ar-SA'; utter.rate = 1; speechSynthesis.speak(utter); } catch (_) {}
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(`M85 Stock Alert - ${symbol}`, { body: msg }); } catch (_) {}
    }
    try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (_) {}
    flashTitle(symbol);
  }

  function flashTitle(symbol) {
    clearInterval(state.titleTimer); let on = false; let count = 0; const oldTitle = state.originalTitle || document.title;
    state.titleTimer = setInterval(() => { on = !on; count++; document.title = on ? `تنبيه ${symbol}` : oldTitle; if (count > 16) { clearInterval(state.titleTimer); document.title = oldTitle; } }, 600);
  }

  function setStatus(message, type = 'info') {
    const el = document.getElementById('m85-stock-status');
    if (el) { el.className = `m85-status ${type}`; el.textContent = message; }
  }

  function tick() {
    mountInlineCard();
    const symbol = getSymbol();
    if (symbol && symbol !== state.currentSymbol) {
      state.currentSymbol = symbol; state.hydratedSymbol = ''; state.lastSuccessfulReadAt = 0; delete state.previousPrices[symbol]; hydrateInputsForSymbol(symbol, { force: true });
    }
    const priceInfo = getActivePriceInfo();
    if (priceInfo && priceInfo.symbol === symbol) updatePriceDisplay(priceInfo);
    else updateConnectionState();
  }

  function scheduleTick() {
    clearTimeout(state.tickTimer); state.tickTimer = setTimeout(tick, 250);
  }

  function start() {
    tick(); [700, 1500, 3000, 5000].forEach(delay => setTimeout(tick, delay)); setInterval(tick, 1500);
    const observer = new MutationObserver(scheduleTick); observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => saveInputsNow({ allowBlank: false, announce: false }));
    window.addEventListener('beforeunload', () => saveInputsNow({ allowBlank: false, announce: false }));
  }

  start();
})();
