// ==UserScript==
// @name         M85 Noor Grades Assistant V2.4
// @namespace    https://greasyfork.org/users/1636459
// @version      2.4
// @description  مساعد تعبئة درجات نظام نور بزر استدعاء، وضع كامل/جزئي، نسخ تقرير، انتقال للأخطاء، أسماء الطلاب، وتجاهل الصفر اليساري
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://noor.moe.gov.sa/*
// @match        https://*.noor.moe.gov.sa/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
=========================================================================
 M85 Noor Grades Assistant V2.4

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

  const APP_ID = 'm85-noor-grades-assistant';
  const LAUNCHER_ID = 'm85-noor-launcher-btn';
  const STYLE_ID = 'm85-noor-grades-style-v24';
  const ROW_STYLE_ID = 'm85-noor-row-highlight-style-v24';
  const STORAGE_KEY = 'm85_noor_last_pasted_data_v24';
  const MODE_KEY = 'm85_noor_mode_v24';

  const DIGITS_RE = /\d{8,14}/;

  const FIXED_NOOR_LAYOUT = {
    colID: 0,
    colName: 1,
    col40: 3,
    col60: 5
  };

  const state = {
    ctx: null,
    preview: null,
    originals: [],
    navIndex: -1
  };

  function toLatinDigits(value) {
    return String(value || '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  }

  function digitsOnly(value) {
    return toLatinDigits(value).replace(/\D/g, '');
  }

  function normalizeStudentId(value) {
    const digits = digitsOnly(value);
    if (!digits) return '';

    const normalized = digits.replace(/^0+/, '');
    return normalized || '0';
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeGrade(value) {
    let s = toLatinDigits(value)
      .replace(/[٫]/g, '.')
      .replace(/[،]/g, '.')
      .trim();

    s = s.replace(/[^\d.,\-]/g, '');

    if (s.includes('.') && s.includes(',')) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }

    return s;
  }

  function asNumber(value) {
    const n = Number(normalizeGrade(value));
    return Number.isFinite(n) ? n : null;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function all(selector, root = document) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function visible(el) {
    if (!el) return false;

    const win = el.ownerDocument.defaultView || window;
    const style = win.getComputedStyle(el);

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      el.getClientRects().length > 0
    );
  }

  function getRoots() {
    const roots = [document];

    all('iframe').forEach(frame => {
      try {
        if (frame.contentDocument) {
          roots.push(frame.contentDocument);
        }
      } catch (_) {}
    });

    return roots;
  }

  function getCells(row) {
    return all('td,th', row);
  }

  function isGradeInput(input) {
    if (!input || !visible(input)) return false;

    const tag = input.tagName.toLowerCase();
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    const className = input.className || '';

    if (!['input', 'textarea'].includes(tag)) return false;
    if (['hidden', 'button', 'submit', 'reset', 'checkbox', 'radio'].includes(type)) return false;
    if (/select2-hidden-accessible/i.test(className)) return false;

    return true;
  }

  function getGradeInputs(root) {
    return all('input,textarea', root).filter(isGradeInput);
  }

  function findIdCell(row) {
    const cells = getCells(row);

    return cells.find(cell => {
      const d = digitsOnly(cell.textContent || '');
      return DIGITS_RE.test(d);
    }) || null;
  }

  function getRowStudentId(row, colID) {
    const cells = getCells(row);

    if (colID >= 0 && cells[colID]) {
      const rawId = digitsOnly(cells[colID].textContent || '');
      if (DIGITS_RE.test(rawId)) return normalizeStudentId(rawId);
    }

    for (const cell of cells) {
      const rawId = digitsOnly(cell.textContent || '');
      if (DIGITS_RE.test(rawId)) return normalizeStudentId(rawId);
    }

    return '';
  }

  function getRowStudentName(row, colName) {
    const cells = getCells(row);

    if (colName >= 0 && cells[colName]) {
      const name = cleanText(cells[colName].innerText || cells[colName].textContent || '');

      if (name && !DIGITS_RE.test(digitsOnly(name))) {
        return name;
      }
    }

    for (let i = 0; i < cells.length; i++) {
      if (i === FIXED_NOOR_LAYOUT.colID) continue;

      const text = cleanText(cells[i].innerText || cells[i].textContent || '');
      const hasArabic = /[\u0600-\u06FF]/.test(text);
      const hasInput = getGradeInputs(cells[i]).length > 0;
      const looksLikeId = DIGITS_RE.test(digitsOnly(text));

      if (hasArabic && !hasInput && !looksLikeId && text.length >= 4) {
        return text;
      }
    }

    return '';
  }

  function getGradeInputAtColumn(row, colIndex) {
    const cells = getCells(row);
    const cell = cells[colIndex];

    if (!cell) return null;

    return getGradeInputs(cell)[0] || null;
  }

  function getInputValueAtColumn(row, colIndex) {
    const input = getGradeInputAtColumn(row, colIndex);
    return input ? input.value : '';
  }

  function ensureRowStyle(root) {
    const doc = root || document;
    if (!doc.head || doc.getElementById(ROW_STYLE_ID)) return;

    const style = doc.createElement('style');
    style.id = ROW_STYLE_ID;

    style.textContent = `
      tr.m85-noor-row-match,
      tr.m85-noor-row-missing,
      tr.m85-noor-row-filled,
      tr.m85-noor-row-focus {
        outline-offset: -3px !important;
      }

      tr.m85-noor-row-match {
        outline: 3px solid #10b981 !important;
      }

      tr.m85-noor-row-match > td,
      tr.m85-noor-row-match > th {
        background: rgba(16,185,129,.22) !important;
        box-shadow:
          inset 0 2px 0 rgba(16,185,129,.75),
          inset 0 -2px 0 rgba(16,185,129,.75) !important;
      }

      tr.m85-noor-row-filled {
        outline: 3px solid #059669 !important;
      }

      tr.m85-noor-row-filled > td,
      tr.m85-noor-row-filled > th {
        background: rgba(5,150,105,.28) !important;
        box-shadow:
          inset 0 2px 0 rgba(5,150,105,.85),
          inset 0 -2px 0 rgba(5,150,105,.85) !important;
      }

      tr.m85-noor-row-missing {
        outline: 3px solid #ef4444 !important;
      }

      tr.m85-noor-row-missing > td,
      tr.m85-noor-row-missing > th {
        background: rgba(239,68,68,.22) !important;
        box-shadow:
          inset 0 2px 0 rgba(239,68,68,.75),
          inset 0 -2px 0 rgba(239,68,68,.75) !important;
      }

      tr.m85-noor-row-focus {
        outline: 5px solid #facc15 !important;
        animation: m85NoorFocusPulse 0.45s alternate 8 !important;
      }

      @keyframes m85NoorFocusPulse {
        from { filter: brightness(1); }
        to { filter: brightness(1.25); }
      }
    `;

    doc.head.appendChild(style);
  }

  function clearRowHighlights() {
    if (!state.ctx) return;

    state.ctx.rows.forEach(row => {
      row.classList.remove(
        'm85-noor-row-match',
        'm85-noor-row-missing',
        'm85-noor-row-filled',
        'm85-noor-row-focus'
      );
      row.style.outline = '';
      row.style.background = '';
    });
  }

  function clearFocusRows() {
    if (!state.ctx) return;

    state.ctx.rows.forEach(row => {
      row.classList.remove('m85-noor-row-focus');
    });
  }

  function isLikelyMarksPage() {
    const url = location.href;
    const title = document.title || '';
    const hasKnownGrid = !!document.getElementById('ctl00_PlaceHolderMain_DynamicGrid');

    return (
      /StudentSectionsMarks/i.test(url) ||
      /ادخال الدرجات|إدخال الدرجات|الدرجات/i.test(title) ||
      hasKnownGrid
    );
  }

  function detectTable() {
    const roots = getRoots();
    const candidates = [];

    for (const root of roots) {
      let tables = all('table', root);

      const preferred =
        root.getElementById &&
        root.getElementById('ctl00_PlaceHolderMain_DynamicGrid');

      if (preferred) {
        tables = [preferred, ...tables.filter(t => t !== preferred)];
      }

      for (const table of tables) {
        const rows = all('tbody tr, tr', table).filter(visible);

        if (!rows.length) continue;

        let score = 0;

        for (const row of rows) {
          const idCell = findIdCell(row);
          const gradeInputs = getGradeInputs(row);

          if (idCell && gradeInputs.length >= 2) {
            score++;
          }
        }

        if (score <= 0) continue;

        const sampleRow = rows.find(row =>
          findIdCell(row) && getGradeInputs(row).length >= 2
        );

        const sampleIdCell = sampleRow ? findIdCell(sampleRow) : null;

        if (!sampleRow || !sampleIdCell) continue;

        candidates.push({
          root,
          table,
          rows,
          score,
          sampleRow,
          sampleIdCell
        });
      }
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const aPreferred =
        a.table.id === 'ctl00_PlaceHolderMain_DynamicGrid' ? 1000 : 0;
      const bPreferred =
        b.table.id === 'ctl00_PlaceHolderMain_DynamicGrid' ? 1000 : 0;

      return (b.score + bPreferred) - (a.score + aPreferred);
    });

    const best = candidates[0];

    const colID = FIXED_NOOR_LAYOUT.colID;
    const colName = FIXED_NOOR_LAYOUT.colName;
    const col40 = FIXED_NOOR_LAYOUT.col40;
    const col60 = FIXED_NOOR_LAYOUT.col60;

    const dataRows = best.rows.filter(row => getRowStudentId(row, colID));

    ensureRowStyle(best.root);

    return {
      root: best.root,
      table: best.table,
      rows: best.rows,
      dataRows,
      colID,
      colName,
      col40,
      col60,
      score: best.score,
      tableId: best.table.id || '',
      tableClassName: best.table.className || ''
    };
  }

  function splitLine(line) {
    const clean = line.trim();

    if (!clean) return [];

    if (clean.includes('\t')) return clean.split('\t').map(x => x.trim());
    if (clean.includes(',')) return clean.split(',').map(x => x.trim());
    if (clean.includes(';')) return clean.split(';').map(x => x.trim());

    return clean.split(/\s+/).map(x => x.trim());
  }

  function parsePastedData(raw) {
    const rows = [];
    const errors = [];
    const duplicates = new Set();
    const seen = new Set();

    raw.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;

      const parts = splitLine(line);
      const idIndex = parts.findIndex(part =>
        DIGITS_RE.test(digitsOnly(part))
      );

      if (idIndex < 0) {
        errors.push(`السطر ${index + 1}: لا يوجد رقم طالب واضح`);
        return;
      }

      const rawId = digitsOnly(parts[idIndex] || '');
      const id = normalizeStudentId(rawId);
      const afterId = parts.slice(idIndex + 1);

      const numericAfterId = afterId
        .map(x => normalizeGrade(x))
        .filter(x => x !== '' && Number.isFinite(Number(x)));

      const v40 = numericAfterId[0] || '';
      const v60 = numericAfterId[1] || '';

      if (seen.has(id)) duplicates.add(id);
      seen.add(id);

      const n40 = asNumber(v40);
      const n60 = asNumber(v60);
      const rowErrors = [];

      if (v40 === '') {
        rowErrors.push('درجة 40 فارغة أو غير واضحة');
      } else if (n40 === null || n40 < 0 || n40 > 40) {
        rowErrors.push('درجة 40 غير صحيحة');
      }

      if (v60 === '') {
        rowErrors.push('درجة 60 فارغة أو غير واضحة');
      } else if (n60 === null || n60 < 0 || n60 > 60) {
        rowErrors.push('درجة 60 غير صحيحة');
      }

      rows.push({
        line: index + 1,
        rawLine: line,
        id,
        rawId,
        v40,
        v60,
        n40,
        n60,
        errors: rowErrors
      });
    });

    return {
      rows,
      errors,
      duplicates: Array.from(duplicates)
    };
  }

  function getTableStudents(ctx) {
    return ctx.dataRows.map(row => ({
      id: getRowStudentId(row, ctx.colID),
      name: getRowStudentName(row, ctx.colName),
      row,
      current40: getInputValueAtColumn(row, ctx.col40),
      current60: getInputValueAtColumn(row, ctx.col60)
    })).filter(x => x.id);
  }

  function getMode() {
    const checked = document.querySelector('input[name="m85-noor-mode"]:checked');
    return checked ? checked.value : 'full';
  }

  function isFullMode() {
    return getMode() === 'full';
  }

  function saveMode() {
    try {
      localStorage.setItem(MODE_KEY, getMode());
    } catch (_) {}
  }

  function loadMode() {
    try {
      return localStorage.getItem(MODE_KEY) || 'full';
    } catch (_) {
      return 'full';
    }
  }

  function applyPreviewHighlights(preview) {
    if (!preview || !preview.ok) return;

    preview.matched.forEach(item => {
      item.row.classList.add('m85-noor-row-match');
    });

    if (isFullMode()) {
      preview.tableOnly.forEach(item => {
        item.row.classList.add('m85-noor-row-missing');
      });
    }
  }

  function buildPreview() {
    if (!state.ctx) {
      state.ctx = detectTable();
    }

    if (!state.ctx) {
      return {
        ok: false,
        message: 'لم أتعرف على جدول الدرجات. تأكد أنك داخل شاشة إدخال الدرجات في نظام نور.'
      };
    }

    clearRowHighlights();
    state.navIndex = -1;

    const textarea = document.getElementById('m85-noor-data');
    const raw = textarea ? textarea.value : '';
    const parsed = parsePastedData(raw);

    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch (_) {}

    const validRows = parsed.rows.filter(row => row.errors.length === 0);
    const dataMap = new Map();

    validRows.forEach(row => {
      dataMap.set(row.id, row);
    });

    const tableStudents = getTableStudents(state.ctx);
    const tableMap = new Map(tableStudents.map(item => [item.id, item]));

    const matched = [];
    const tableOnly = [];

    tableStudents.forEach(student => {
      if (dataMap.has(student.id)) {
        matched.push({
          ...student,
          data: dataMap.get(student.id)
        });
      } else {
        tableOnly.push(student);
      }
    });

    const notFound = validRows
      .filter(row => !tableMap.has(row.id))
      .map(row => ({ ...row }));

    const preview = {
      ok: true,
      mode: getMode(),
      parsed,
      tableStudents,
      matched,
      tableOnly,
      notFound,
      invalidRows: parsed.rows.filter(row => row.errors.length > 0),
      dataMap,
      tableMap
    };

    state.preview = preview;
    applyPreviewHighlights(preview);

    return preview;
  }

  function setInputValue(input, value) {
    if (!input) return '';

    const oldValue = input.value;
    const win = input.ownerDocument.defaultView || window;

    try {
      const proto = input.tagName.toLowerCase() === 'textarea'
        ? win.HTMLTextAreaElement.prototype
        : win.HTMLInputElement.prototype;

      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(input, value);
    } catch (_) {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return oldValue;
  }

  function fillGrades() {
    const preview = state.preview || buildPreview();

    if (!preview.ok) {
      setStatus(preview.message, 'bad');
      return;
    }

    if (preview.invalidRows.length) {
      setStatus('يوجد درجات غير صحيحة. صححها قبل التعبئة.', 'bad');
      renderPreview(preview);
      return;
    }

    if (!preview.matched.length) {
      setStatus('لا يوجد طلاب مطابقون للتعبئة.', 'bad');
      renderPreview(preview);
      return;
    }

    state.originals = [];

    let filled = 0;
    let skipped = 0;

    preview.matched.forEach(item => {
      const row = item.row;
      const data = item.data;

      const input40 = getGradeInputAtColumn(row, state.ctx.col40);
      const input60 = getGradeInputAtColumn(row, state.ctx.col60);

      const original = {
        row,
        input40,
        input60,
        old40: input40 ? input40.value : '',
        old60: input60 ? input60.value : ''
      };

      let didFill = false;

      if (input40 && data.v40 !== '') {
        setInputValue(input40, data.v40);
        didFill = true;
      }

      if (input60 && data.v60 !== '') {
        setInputValue(input60, data.v60);
        didFill = true;
      }

      if (didFill) {
        state.originals.push(original);
        filled++;
        row.classList.remove('m85-noor-row-match');
        row.classList.add('m85-noor-row-filled');
      } else {
        skipped++;
      }
    });

    setStatus(
      `تمت التعبئة. المطابق: ${filled} | المتخطى: ${skipped}. راجع الدرجات ثم اضغط حفظ بنفسك داخل نور.`,
      'good'
    );

    renderPreview(buildPreview());
  }

  function undoFill() {
    if (!state.originals.length) {
      setStatus('لا توجد تعبئة سابقة للتراجع عنها.', 'bad');
      return;
    }

    state.originals.forEach(item => {
      if (item.input40) setInputValue(item.input40, item.old40);
      if (item.input60) setInputValue(item.input60, item.old60);

      if (item.row) {
        item.row.classList.remove(
          'm85-noor-row-filled',
          'm85-noor-row-match',
          'm85-noor-row-missing',
          'm85-noor-row-focus'
        );
      }
    });

    const count = state.originals.length;
    state.originals = [];

    setStatus(`تم التراجع عن آخر تعبئة لعدد ${count} طالب.`, 'good');

    const preview = buildPreview();
    renderPreview(preview);
  }

  function renderDetectionInfo() {
    const el = document.getElementById('m85-noor-detect-info');

    if (!el) return;

    if (!state.ctx) {
      el.innerHTML = '<span class="m85-muted">لم يتم فحص الجدول بعد.</span>';
      return;
    }

    el.innerHTML = `
      <div class="m85-chip">جدول: ${escapeHtml(state.ctx.tableId || 'غير محدد')}</div>
      <div class="m85-chip">طلاب في نور: ${state.ctx.dataRows.length}</div>
      <div class="m85-chip">عمود الرقم: ${state.ctx.colID + 1}</div>
      <div class="m85-chip">عمود الاسم: ${state.ctx.colName + 1}</div>
      <div class="m85-chip">عمود 40: ${state.ctx.col40 + 1}</div>
      <div class="m85-chip">عمود 60: ${state.ctx.col60 + 1}</div>
      <div class="m85-chip">الوضع: ${isFullMode() ? 'كامل' : 'جزئي'}</div>
    `;
  }

  function smallTable(title, headers, rowsHtml, emptyText) {
    return `
      <div class="m85-report-section">
        <div class="m85-section-title">${title}</div>
        <table class="m85-preview-table">
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="${headers.length}">${emptyText || 'لا توجد بيانات'}</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPreview(preview) {
    const out = document.getElementById('m85-noor-output');

    if (!out) return;

    if (!preview.ok) {
      out.innerHTML = `<div class="m85-alert bad m85-report-issue">${escapeHtml(preview.message)}</div>`;
      return;
    }

    const invalid = preview.invalidRows;
    const notFound = preview.notFound;
    const duplicates = preview.parsed.duplicates;

    const matchedRows = preview.matched.map(item => `
      <tr>
        <td>${escapeHtml(item.name || '—')}</td>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.current40)}</td>
        <td>${escapeHtml(item.data.v40)}</td>
        <td>${escapeHtml(item.current60)}</td>
        <td>${escapeHtml(item.data.v60)}</td>
        <td class="good">مطابق</td>
      </tr>
    `).join('');

    const tableOnlyRows = preview.tableOnly.map(item => `
      <tr class="m85-report-issue">
        <td>${escapeHtml(item.name || '—')}</td>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.current40)}</td>
        <td>${escapeHtml(item.current60)}</td>
        <td class="badText">موجود في نور وليس في البيانات</td>
      </tr>
    `).join('');

    const notFoundRows = notFound.map(row => `
      <tr class="m85-report-issue">
        <td>${row.line}</td>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.v40)}</td>
        <td>${escapeHtml(row.v60)}</td>
        <td class="badText">غير موجود في جدول نور</td>
      </tr>
    `).join('');

    const parserErrorsHtml = preview.parsed.errors.length ? `
      <div class="m85-alert bad m85-report-issue">
        <b>أسطر لم تُقرأ:</b><br>
        ${preview.parsed.errors.map(escapeHtml).join('<br>')}
      </div>
    ` : '';

    const invalidHtml = invalid.length ? `
      <div class="m85-alert bad m85-report-issue">
        <b>درجات غير صحيحة:</b><br>
        ${invalid.slice(0, 12).map(row =>
          `سطر ${row.line} - ${row.id || 'بدون رقم'}: ${row.errors.join('، ')}`
        ).map(escapeHtml).join('<br>')}
        ${invalid.length > 12 ? '<br>...' : ''}
      </div>
    ` : '';

    const duplicatesHtml = duplicates.length ? `
      <div class="m85-alert warn m85-report-issue">
        <b>أرقام مكررة في البيانات:</b><br>
        ${escapeHtml(duplicates.slice(0, 30).join('، '))}
      </div>
    ` : '';

    const tableOnlySection = isFullMode()
      ? smallTable(
          'موجودون في نور وليسوا في البيانات - يتم تحديدهم بالأحمر في الوضع الكامل',
          ['اسم الطالب', 'رقم الطالب', '40 الحالي', '60 الحالي', 'الحالة'],
          tableOnlyRows,
          'لا يوجد طلاب ناقصون من البيانات'
        )
      : `
        <div class="m85-alert info">
          الوضع الجزئي مفعّل: لن يتم اعتبار بقية طلاب نور غير الموجودين في البيانات كأخطاء، ولن يتم تلوينهم بالأحمر.
        </div>
      `;

    out.innerHTML = `
      <div class="m85-summary">
        <div><b>${preview.tableStudents.length}</b><span>طلاب في نور</span></div>
        <div><b>${preview.parsed.rows.length}</b><span>سطر مقروء</span></div>
        <div><b>${preview.matched.length}</b><span>مطابق أخضر</span></div>
        <div><b>${preview.tableOnly.length}</b><span>${isFullMode() ? 'في نور وليس في البيانات' : 'غير محتسب جزئيًا'}</span></div>
        <div><b>${preview.notFound.length}</b><span>بيانات خارج الجدول</span></div>
        <div><b>${preview.invalidRows.length}</b><span>أخطاء</span></div>
      </div>

      ${parserErrorsHtml}
      ${invalidHtml}
      ${duplicatesHtml}

      ${smallTable(
        'المطابقون - تم تحديد صفوفهم كاملة بالأخضر',
        ['اسم الطالب', 'رقم الطالب', '40 الحالي', '40 الجديد', '60 الحالي', '60 الجديد', 'الحالة'],
        matchedRows,
        'لا توجد مطابقات'
      )}

      ${tableOnlySection}

      ${smallTable(
        'موجودون في البيانات وليسوا في جدول نور',
        ['السطر', 'رقم الطالب', 'درجة 40', 'درجة 60', 'الحالة'],
        notFoundRows,
        'كل بياناتك موجودة في جدول نور'
      )}
    `;
  }

  function buildPlainReport(preview) {
    if (!preview || !preview.ok) {
      return 'لا يوجد تقرير صالح للنسخ.';
    }

    const lines = [];

    lines.push('تقرير M85 Noor Grades Assistant');
    lines.push(`التاريخ: ${new Date().toLocaleString()}`);
    lines.push(`الوضع: ${isFullMode() ? 'كامل' : 'جزئي'}`);
    lines.push('');
    lines.push(`طلاب في نور: ${preview.tableStudents.length}`);
    lines.push(`سطور مقروءة: ${preview.parsed.rows.length}`);
    lines.push(`مطابق: ${preview.matched.length}`);
    lines.push(`في نور وليس في البيانات: ${preview.tableOnly.length}`);
    lines.push(`في البيانات وليس في نور: ${preview.notFound.length}`);
    lines.push(`أخطاء: ${preview.invalidRows.length}`);
    lines.push('');

    lines.push('=== المطابقون ===');
    if (preview.matched.length) {
      preview.matched.forEach(item => {
        lines.push(
          `${item.name || 'بدون اسم'} | ${item.id} | 40: ${item.current40} → ${item.data.v40} | 60: ${item.current60} → ${item.data.v60}`
        );
      });
    } else {
      lines.push('لا توجد مطابقات.');
    }

    if (isFullMode()) {
      lines.push('');
      lines.push('=== موجودون في نور وليسوا في البيانات ===');
      if (preview.tableOnly.length) {
        preview.tableOnly.forEach(item => {
          lines.push(
            `${item.name || 'بدون اسم'} | ${item.id} | الحالي 40: ${item.current40} | الحالي 60: ${item.current60}`
          );
        });
      } else {
        lines.push('لا يوجد.');
      }
    }

    lines.push('');
    lines.push('=== موجودون في البيانات وليسوا في جدول نور ===');
    if (preview.notFound.length) {
      preview.notFound.forEach(row => {
        lines.push(
          `سطر ${row.line} | ${row.id} | 40: ${row.v40} | 60: ${row.v60}`
        );
      });
    } else {
      lines.push('لا يوجد.');
    }

    lines.push('');
    lines.push('=== الأخطاء ===');
    if (preview.invalidRows.length) {
      preview.invalidRows.forEach(row => {
        lines.push(
          `سطر ${row.line} | ${row.id || 'بدون رقم'} | ${row.errors.join('، ')}`
        );
      });
    } else {
      lines.push('لا يوجد.');
    }

    lines.push('');
    lines.push('=== أرقام مكررة ===');
    if (preview.parsed.duplicates.length) {
      lines.push(preview.parsed.duplicates.join('، '));
    } else {
      lines.push('لا يوجد.');
    }

    return lines.join('\n');
  }

  function copyReport() {
    const preview = state.preview || buildPreview();

    if (!preview.ok) {
      setStatus(preview.message, 'bad');
      return;
    }

    const reportText = buildPlainReport(preview);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(reportText)
        .then(() => setStatus('تم نسخ التقرير إلى الحافظة.', 'good'))
        .catch(() => fallbackCopy(reportText));
    } else {
      fallbackCopy(reportText);
    }
  }

  function fallbackCopy(text) {
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.left = '-9999px';
    temp.style.top = '-9999px';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();

    try {
      document.execCommand('copy');
      setStatus('تم نسخ التقرير إلى الحافظة.', 'good');
    } catch (_) {
      setStatus('تعذر نسخ التقرير تلقائيًا.', 'bad');
    }

    temp.remove();
  }

  function getIssueElements() {
    const items = [];

    if (state.preview && state.preview.ok && isFullMode()) {
      state.preview.tableOnly.forEach(item => {
        if (item.row) {
          items.push({
            type: 'row',
            el: item.row,
            label: `${item.name || item.id} - موجود في نور وليس في البيانات`
          });
        }
      });
    }

    all(`#${APP_ID} .m85-report-issue`).forEach((el, index) => {
      items.push({
        type: 'report',
        el,
        label: `مشكلة في التقرير ${index + 1}`
      });
    });

    return items.filter(item => item.el);
  }

  function focusIssue(index) {
    const issues = getIssueElements();

    if (!issues.length) {
      setStatus('لا توجد أخطاء أو عناصر تحتاج انتقالًا حاليًا.', 'good');
      return;
    }

    const safeIndex = ((index % issues.length) + issues.length) % issues.length;
    const item = issues[safeIndex];

    clearFocusRows();

    if (item.type === 'row') {
      item.el.classList.add('m85-noor-row-focus');
    } else {
      all(`#${APP_ID} .m85-report-issue`).forEach(el => {
        el.classList.remove('m85-report-focus');
      });
      item.el.classList.add('m85-report-focus');
    }

    try {
      item.el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    } catch (_) {
      item.el.scrollIntoView();
    }

    state.navIndex = safeIndex;
    setStatus(`انتقال إلى: ${item.label} (${safeIndex + 1}/${issues.length})`, 'info');
  }

  function goFirstIssue() {
    const preview = state.preview || buildPreview();
    renderPreview(preview);
    focusIssue(0);
  }

  function goNextIssue() {
    const preview = state.preview || buildPreview();
    renderPreview(preview);

    const issues = getIssueElements();

    if (!issues.length) {
      setStatus('لا توجد أخطاء أو عناصر تحتاج انتقالًا حاليًا.', 'good');
      return;
    }

    focusIssue(state.navIndex + 1);
  }

  function setStatus(message, type = 'info') {
    const el = document.getElementById('m85-noor-status');

    if (!el) return;

    el.className = `m85-status ${type}`;
    el.textContent = message;
  }

  function installPanelStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      #${LAUNCHER_ID} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 5px !important;
        min-height: 30px !important;
        padding: 6px 10px !important;
        margin: 0 6px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: linear-gradient(135deg, #2563eb, #0f766e) !important;
        color: #fff !important;
        font-family: Tahoma, Arial, sans-serif !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        cursor: pointer !important;
        box-shadow: 0 4px 14px rgba(0,0,0,.18) !important;
        z-index: 2147483647 !important;
      }

      #${LAUNCHER_ID}.m85-floating-launcher {
        position: fixed !important;
        top: 74px !important;
        right: 18px !important;
      }

      #${APP_ID} {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 2147483647;
        width: 560px;
        max-height: 88vh;
        overflow: hidden;
        direction: rtl;
        font-family: Tahoma, Arial, sans-serif;
        background: #111827;
        color: #fff;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 18px;
        box-shadow: 0 22px 60px rgba(0,0,0,.35);
      }

      #${APP_ID}.m85-min .m85-body {
        display: none;
      }

      #${APP_ID} .m85-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 13px 15px;
        background: linear-gradient(135deg, #1f2937, #111827);
        border-bottom: 1px solid rgba(255,255,255,.10);
        cursor: move;
      }

      #${APP_ID} .m85-title {
        font-weight: 800;
        font-size: 15px;
      }

      #${APP_ID} .m85-subtitle {
        font-size: 11px;
        color: rgba(255,255,255,.55);
        margin-top: 3px;
      }

      #${APP_ID} .m85-actions {
        display: flex;
        gap: 6px;
        direction: ltr;
      }

      #${APP_ID} .m85-icon {
        width: 27px;
        height: 27px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.08);
        color: #fff;
        cursor: pointer;
      }

      #${APP_ID} .m85-body {
        padding: 14px;
        overflow: auto;
        max-height: calc(88vh - 54px);
      }

      #${APP_ID} textarea {
        width: 100%;
        min-height: 118px;
        resize: vertical;
        box-sizing: border-box;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.14);
        background: #0b1220;
        color: #fff;
        padding: 11px;
        direction: ltr;
        font-family: Consolas, monospace;
        font-size: 13px;
        outline: none;
      }

      #${APP_ID} textarea:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 3px rgba(56,189,248,.16);
      }

      #${APP_ID} .m85-help {
        font-size: 12px;
        color: rgba(255,255,255,.58);
        line-height: 1.7;
        margin: 8px 0 11px;
      }

      #${APP_ID} .m85-mode-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 8px 0 10px;
      }

      #${APP_ID} .m85-mode-card {
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06);
        border-radius: 12px;
        padding: 9px;
        font-size: 12px;
        color: rgba(255,255,255,.78);
        cursor: pointer;
        line-height: 1.5;
      }

      #${APP_ID} .m85-mode-card input {
        margin-left: 5px;
      }

      #${APP_ID} .m85-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
        margin: 10px 0;
      }

      #${APP_ID} .m85-btn {
        border: 0;
        border-radius: 11px;
        padding: 10px 11px;
        cursor: pointer;
        color: #fff;
        font-weight: 800;
        font-size: 13px;
      }

      #${APP_ID} .primary { background: #2563eb; }
      #${APP_ID} .success { background: #059669; }
      #${APP_ID} .warning { background: #d97706; }
      #${APP_ID} .danger { background: #dc2626; }
      #${APP_ID} .dark { background: #374151; }
      #${APP_ID} .purple { background: #7c3aed; }

      #${APP_ID} .m85-status {
        margin: 9px 0;
        border-radius: 11px;
        padding: 9px 10px;
        font-size: 12px;
        line-height: 1.6;
        background: rgba(255,255,255,.08);
      }

      #${APP_ID} .m85-status.good {
        background: rgba(16,185,129,.16);
        color: #a7f3d0;
      }

      #${APP_ID} .m85-status.bad {
        background: rgba(239,68,68,.16);
        color: #fecaca;
      }

      #${APP_ID} .m85-status.info {
        background: rgba(59,130,246,.16);
        color: #bfdbfe;
      }

      #${APP_ID} #m85-noor-detect-info {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 8px 0;
      }

      #${APP_ID} .m85-chip {
        font-size: 11px;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 999px;
        padding: 5px 8px;
        color: rgba(255,255,255,.78);
      }

      #${APP_ID} .m85-muted {
        font-size: 12px;
        color: rgba(255,255,255,.45);
      }

      #${APP_ID} .m85-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 7px;
        margin: 10px 0;
      }

      #${APP_ID} .m85-summary div {
        background: rgba(255,255,255,.07);
        border-radius: 11px;
        padding: 8px;
        text-align: center;
      }

      #${APP_ID} .m85-summary b {
        display: block;
        font-size: 18px;
      }

      #${APP_ID} .m85-summary span {
        display: block;
        font-size: 10px;
        color: rgba(255,255,255,.58);
        margin-top: 3px;
      }

      #${APP_ID} .m85-alert {
        border-radius: 11px;
        padding: 9px 10px;
        margin: 8px 0;
        font-size: 12px;
        line-height: 1.7;
      }

      #${APP_ID} .m85-alert.bad {
        background: rgba(239,68,68,.16);
        color: #fecaca;
      }

      #${APP_ID} .m85-alert.warn {
        background: rgba(245,158,11,.16);
        color: #fde68a;
      }

      #${APP_ID} .m85-alert.info {
        background: rgba(59,130,246,.16);
        color: #bfdbfe;
      }

      #${APP_ID} .m85-report-focus {
        outline: 3px solid #facc15;
        box-shadow: 0 0 0 4px rgba(250,204,21,.22);
      }

      #${APP_ID} .m85-report-section {
        margin-top: 12px;
      }

      #${APP_ID} .m85-section-title {
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,255,255,.78);
        margin: 8px 0;
      }

      #${APP_ID} .m85-preview-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
        overflow: hidden;
        border-radius: 12px;
        font-size: 11px;
      }

      #${APP_ID} .m85-preview-table th,
      #${APP_ID} .m85-preview-table td {
        border-bottom: 1px solid rgba(255,255,255,.08);
        padding: 7px 6px;
        text-align: center;
        vertical-align: middle;
      }

      #${APP_ID} .m85-preview-table th {
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.78);
      }

      #${APP_ID} .good {
        color: #86efac;
        font-weight: 800;
      }

      #${APP_ID} .badText {
        color: #fecaca;
        font-weight: 800;
      }

      @media (max-width: 700px) {
        #${APP_ID} {
          width: calc(100vw - 24px);
          right: 12px;
          left: 12px;
        }

        #${APP_ID} .m85-buttons,
        #${APP_ID} .m85-summary,
        #${APP_ID} .m85-mode-box {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function findHomeButtonContainer() {
    const selectors = [
      'a[href*="Home"]',
      'a[href*="home"]',
      'a[href*="Default"]',
      'a[title*="الرئيس"]',
      'a[title*="Home"]',
      'button[title*="الرئيس"]',
      '[class*="home"]',
      '[id*="Home"]',
      '[id*="home"]',
      '.fa-home'
    ];

    for (const selector of selectors) {
      const found = all(selector).find(visible);
      if (!found) continue;

      const anchor = found.closest('a,button,li,div,span') || found;
      const parent = anchor.parentElement;

      if (parent) return { parent, anchor };
    }

    return null;
  }

  function createLauncher() {
    if (document.getElementById(LAUNCHER_ID)) return;
    if (!isLikelyMarksPage()) return;

    installPanelStyle();

    const btn = document.createElement('button');
    btn.id = LAUNCHER_ID;
    btn.type = 'button';
    btn.textContent = 'M85 درجات';
    btn.title = 'فتح مساعد درجات نور';

    const home = findHomeButtonContainer();

    if (home && home.parent && home.anchor) {
      home.anchor.insertAdjacentElement('afterend', btn);
    } else {
      btn.classList.add('m85-floating-launcher');
      document.body.appendChild(btn);
    }

    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    });
  }

  function togglePanel() {
    let panel = document.getElementById(APP_ID);

    if (!panel) {
      createPanel();
      return;
    }

    panel.style.display = panel.style.display === 'none' ? '' : 'none';
  }

  function createPanel() {
    if (document.getElementById(APP_ID)) return;

    installPanelStyle();

    const panel = document.createElement('div');
    panel.id = APP_ID;

    const lastData = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) || '';
      } catch (_) {
        return '';
      }
    })();

    const savedMode = loadMode();

    panel.innerHTML = `
      <div class="m85-head">
        <div>
          <div class="m85-title">M85 Noor Grades Assistant V2.4</div>
          <div class="m85-subtitle">وضع كامل/جزئي + نسخ التقرير + الانتقال للأخطاء</div>
        </div>
        <div class="m85-actions">
          <button class="m85-icon" id="m85-min-btn" title="تصغير">−</button>
          <button class="m85-icon" id="m85-close-btn" title="إغلاق">×</button>
        </div>
      </div>

      <div class="m85-body">
        <div class="m85-help">
          الصق البيانات بهذا الشكل، سطر لكل طالب:<br>
          <b>رقم_الطالب, درجة40, درجة60</b><br>
          <span style="color:#fde68a">يتم تجاهل الصفر الزائد في بداية رقم الطالب عند المطابقة.</span><br>
          يعتمد هذا الإصدار على تخطيط صفحة نور الحالي: الرقم، الاسم، درجة 40، درجة 60.
        </div>

        <textarea id="m85-noor-data" placeholder="مثال:
1234567890, 38, 57
1234567891, 40, 60">${escapeHtml(lastData)}</textarea>

        <div class="m85-mode-box">
          <label class="m85-mode-card">
            <input type="radio" name="m85-noor-mode" value="full" ${savedMode === 'full' ? 'checked' : ''}>
            <b>وضع كامل</b><br>
            يلوّن المطابق أخضر، ومن في نور وليس في البيانات أحمر.
          </label>

          <label class="m85-mode-card">
            <input type="radio" name="m85-noor-mode" value="partial" ${savedMode === 'partial' ? 'checked' : ''}>
            <b>وضع جزئي</b><br>
            يلوّن فقط الطلاب الموجودين في البيانات، ولا يعتبر بقية الفصل خطأ.
          </label>
        </div>

        <div id="m85-noor-detect-info">
          <span class="m85-muted">لم يتم فحص الجدول بعد.</span>
        </div>

        <div class="m85-buttons">
          <button class="m85-btn primary" id="m85-detect-btn">فحص الجدول</button>
          <button class="m85-btn warning" id="m85-preview-btn">معاينة وتلوين</button>
          <button class="m85-btn success" id="m85-fill-btn">تعبئة الدرجات</button>

          <button class="m85-btn purple" id="m85-copy-report-btn">نسخ التقرير</button>
          <button class="m85-btn dark" id="m85-first-issue-btn">أول مشكلة</button>
          <button class="m85-btn dark" id="m85-next-issue-btn">التالي</button>

          <button class="m85-btn danger" id="m85-undo-btn">تراجع</button>
          <button class="m85-btn dark" id="m85-clear-highlight-btn">مسح التلوين</button>
          <button class="m85-btn dark" id="m85-clear-report-btn">مسح التقرير</button>
        </div>

        <div id="m85-noor-status" class="m85-status info">
          جاهز. ابدأ بفحص الجدول ثم الصق البيانات واعمل معاينة.
        </div>

        <div id="m85-noor-output"></div>
      </div>
    `;

    document.body.appendChild(panel);
    makePanelDraggable(panel);

    const textarea = document.getElementById('m85-noor-data');
    textarea.addEventListener('input', () => {
      try {
        localStorage.setItem(STORAGE_KEY, textarea.value || '');
      } catch (_) {}
    });

    all('input[name="m85-noor-mode"]').forEach(input => {
      input.addEventListener('change', () => {
        saveMode();

        if (state.preview) {
          clearRowHighlights();
          applyPreviewHighlights(state.preview);
          renderPreview(state.preview);
          renderDetectionInfo();
        }
      });
    });

    document.getElementById('m85-detect-btn').addEventListener('click', () => {
      state.ctx = detectTable();

      if (!state.ctx) {
        setStatus('لم أتعرف على جدول الدرجات. تأكد أنك في شاشة الإدخال وأن الجدول ظاهر.', 'bad');
      } else {
        setStatus('تم التعرف على جدول الدرجات. راجع الأعمدة المكتشفة.', 'good');
      }

      renderDetectionInfo();
    });

    document.getElementById('m85-preview-btn').addEventListener('click', () => {
      const preview = buildPreview();

      if (!preview.ok) {
        setStatus(preview.message, 'bad');
      } else {
        const hasIssue =
          preview.invalidRows.length ||
          preview.notFound.length ||
          (isFullMode() && preview.tableOnly.length);

        setStatus(
          `تمت المعاينة. مطابق: ${preview.matched.length} | في نور وليس في البيانات: ${preview.tableOnly.length} | في البيانات وليس في نور: ${preview.notFound.length} | أخطاء: ${preview.invalidRows.length}`,
          hasIssue ? 'bad' : 'good'
        );
      }

      renderDetectionInfo();
      renderPreview(preview);
    });

    document.getElementById('m85-fill-btn').addEventListener('click', fillGrades);
    document.getElementById('m85-copy-report-btn').addEventListener('click', copyReport);
    document.getElementById('m85-first-issue-btn').addEventListener('click', goFirstIssue);
    document.getElementById('m85-next-issue-btn').addEventListener('click', goNextIssue);
    document.getElementById('m85-undo-btn').addEventListener('click', undoFill);

    document.getElementById('m85-clear-highlight-btn').addEventListener('click', () => {
      clearRowHighlights();
      state.preview = null;
      state.navIndex = -1;
      setStatus('تم مسح التلوين فقط.', 'info');
    });

    document.getElementById('m85-clear-report-btn').addEventListener('click', () => {
      const out = document.getElementById('m85-noor-output');
      if (out) out.innerHTML = '';
      state.navIndex = -1;
      setStatus('تم مسح التقرير فقط.', 'info');
    });

    document.getElementById('m85-min-btn').addEventListener('click', () => {
      panel.classList.toggle('m85-min');
      document.getElementById('m85-min-btn').textContent =
        panel.classList.contains('m85-min') ? '+' : '−';
    });

    document.getElementById('m85-close-btn').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    setTimeout(() => {
      state.ctx = detectTable();
      renderDetectionInfo();

      if (state.ctx) {
        setStatus('تم التعرف على جدول الدرجات تلقائيًا.', 'good');
      }
    }, 500);
  }

  function makePanelDraggable(panel) {
    const handle = panel.querySelector('.m85-head');

    let isDown = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener('mousedown', event => {
      if (event.target.closest('button')) return;

      isDown = true;

      const rect = panel.getBoundingClientRect();

      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;

      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDown = false;
    });

    document.addEventListener('mousemove', event => {
      if (!isDown) return;

      panel.style.left = `${event.clientX - offsetX}px`;
      panel.style.top = `${event.clientY - offsetY}px`;
    });
  }

  setTimeout(createLauncher, 800);
  setTimeout(createLauncher, 2000);
})();
