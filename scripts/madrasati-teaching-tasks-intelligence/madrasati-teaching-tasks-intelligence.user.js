// ==UserScript==
// @name         Madrasati Teaching Tasks Intelligence | مدير الواجبات والأنشطة والمشاريع الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      2.0.0-beta1
// @description  مدير موحد للواجبات والأنشطة والمشاريع: بحث وإحصائيات وتحليل وتقارير PDF/Excel/CSV واستيراد درجات بمعاينة وحفظ متحقق، حسب القسم.
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://schools.madrasati.sa/Teacher/Assignments/*
// @match        https://schools.madrasati.sa/Projects/Projects/*
// @match        https://schools.madrasati.sa/SchoolManagment/Actions/MyStudents*
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 =========================================================================
 Madrasati Teaching Tasks Intelligence — unified 2.0.0-beta1
 المدير الموحد للواجبات والأنشطة والمشاريع
 
 دمج محافظ لمكوّنات السكربتين في ملف واحد:
 - نواة واجبات مدرستي الثابتة v1.1.7 (commit 2c779aed)
 - تطوير مدير الواجبات v1.4.8
 - مدير الأنشطة والمشاريع v1.5.6
 تُفعَّل كل وحدة في صفحاتها فقط؛ لا تُغيَّر واجهة مدرستي الأصلية خارج النطاق.
 جميع المكوّنات مدمجة؛ لا يحتاج @require إلى سكربت منفصل.
 
 المطور: Mohammed Almalki (M0HM3D85)
 GitHub: https://github.com/M0HM3D85/teacher-userscripts
 GreasyFork: https://greasyfork.org/en/users/1636459-m0hm3d85
 X / Twitter: https://x.com/M0HM3D85
 Snapchat: https://www.snapchat.com/add/M0HM3D85
 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 ترخيص: All Rights Reserved
 =========================================================================
*/

(() => {
  'use strict';
  const UNIFIED_VERSION = '2.0.0-beta1';
  const route = String(location.pathname || '');
  const assignmentsPage = /^\/Teacher\/Assignments\//i.test(route);
  const projectsPage = /^\/Projects\/Projects\//i.test(route);
  const studentsPage = /^\/SchoolManagment\/Actions\/MyStudents/i.test(route);
  if (!assignmentsPage && !projectsPage && !studentsPage) return;

  // Prevent accidentally re-initializing the same unified userscript twice.
  if (globalThis.__M85_MADRASATI_TASKS_UNIFIED_ACTIVE) return;
  globalThis.__M85_MADRASATI_TASKS_UNIFIED_ACTIVE = true;

  if (assignmentsPage || studentsPage) {
    // Core v1.1.7 (bundled locally in this single userscript).
/*
=========================================================================
 Madrasati Assignment Intelligence | مدير الواجبات الذكي

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 يمنع حذف أو تغيير بيانات المصمم وحقوقه عند إعادة نشر السكربت.
=========================================================================
*/

(() => {
  'use strict';

  const APP = 'MAI';
  const VERSION = '1.1.7';

  const STORE = {
    registry: 'MAI_STUDENT_REGISTRY_V2',
    bridge: 'MAI_ASSIGNMENT_BRIDGE_V2',
    snapshot: 'MAI_ASSIGNMENT_SNAPSHOT_V2',
    importBackup: 'MAI_IMPORT_BACKUP_V1',
    importHistory: 'MAI_IMPORT_HISTORY_V1',
    importPrefs: 'MAI_IMPORT_PREFS_V1'
  };

  const state = {
    registry: null,
    bridge: null,
    gradeData: null,
    questions: null,
    questionAnalytics: null,
    importSession: null,
    importPreview: null,
    busy: false
  };

  // -----------------------------
  // Utilities
  // -----------------------------
  const clean = (v) =>
    String(v ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const englishDigits = (v) =>
    String(v ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

  const num = (v) => {
    const raw = englishDigits(clean(v)).replace(/[^\d.-]/g, '');
    if (!raw || raw === '-' || raw === '.' || raw === '-.') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const norm = (v) =>
    clean(v)
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/ـ/g, '')
      .replace(/[إأآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .toLowerCase();

  const esc = (s) =>
    clean(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const pct = (a, b) => b ? Number(((a / b) * 100).toFixed(2)) : 0;

  const median = (arr) => {
    const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  const stdDev = (arr) => {
    const a = arr.filter(Number.isFinite);
    if (!a.length) return null;
    const mean = a.reduce((s, x) => s + x, 0) / a.length;
    return Math.sqrt(a.reduce((s, x) => s + ((x - mean) ** 2), 0) / a.length);
  };

  const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const loadJSON = (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  };

  const currentSchoolId = () => {
    const u = new URL(location.href);
    return u.searchParams.get('SchoolId') ||
           u.searchParams.get('schoolId') ||
           location.pathname.match(/[A-F0-9]{32}/i)?.[0] ||
           '';
  };

  const toast = (message, type = 'info') => {
    let box = document.getElementById(`${APP}-toast`);
    if (!box) {
      box = document.createElement('div');
      box.id = `${APP}-toast`;
      document.body.appendChild(box);
    }
    box.className = `${APP}-toast ${type}`;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box._t);
    box._t = setTimeout(() => box.classList.remove('show'), 3200);
  };

  const setBusy = (busy, label = '') => {
    state.busy = busy;
    const el = document.getElementById(`${APP}-status`);
    if (el) {
      el.textContent = busy ? (label || 'جارٍ المعالجة…') : 'جاهز';
      el.dataset.busy = busy ? '1' : '0';
    }
    document.querySelectorAll(`[data-${APP.toLowerCase()}-action]`).forEach(btn => {
      btn.disabled = busy;
    });
  };

  const downloadText = (name, text, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;


  const normalizeAccount = (v) => clean(v)
    .replace(/^mailto:/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  const roundToStep = (value, step) => {
    const s = Number(step);
    if (!Number.isFinite(value) || !Number.isFinite(s) || s <= 0) return value;
    return Math.round(value / s) * s;
  };

  const nearlyEqual = (a, b, eps = 1e-9) =>
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;

  const todayStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // -----------------------------
  // Student registry: MyStudents
  // -----------------------------
  const parseStudentCard = (card) => {
    const text = clean(card.innerText);
    const account = text.match(/[sS]\d+@[a-z0-9.-]+\.moe\.gov\.sa/i)?.[0] || '';
    const name = clean(text.split(/اسم\s+الفصل\s*:/i)[0]);

    const className =
      text.match(/اسم\s+الفصل\s*:\s*(.+?)(?=\s+الايميل\s*:)/i)?.[1]?.trim() || '';

    const status =
      text.match(/حالة\s+الطالب\s*:\s*(.+?)(?=\s+\d+\s|ملف الإنجاز|$)/i)?.[1]?.trim() || '';

    const profile = [...card.querySelectorAll('a[href]')]
      .find(a => /\/Profile\/My/i.test(a.getAttribute('href') || ''));

    let userGuid = '';
    if (profile) {
      try {
        const u = new URL(profile.getAttribute('href'), location.origin);
        userGuid = u.searchParams.get('UserId') || u.searchParams.get('userId') || '';
      } catch {}
    }

    return {
      name,
      normalizedName: norm(name),
      className,
      normalizedClass: norm(className),
      status,
      account,
      accountNormalized: account.toLowerCase(),
      userGuid
    };
  };

  const detectTotalStudentPages = (doc) => {
    const text = clean(doc.querySelector('#pagination-container')?.innerText || '');
    const m = text.match(/من\s+(\d+)/);
    if (m) return Math.max(1, Number(m[1]) || 1);

    const nums = [...doc.querySelectorAll('.pagination a[href*="PageNumber="]')]
      .map(a => {
        try { return Number(new URL(a.href, location.origin).searchParams.get('PageNumber')); }
        catch { return 0; }
      })
      .filter(Boolean);

    return nums.length ? Math.max(...nums) : 1;
  };

  async function fetchStudentRegistry(force = false) {
    const schoolId = currentSchoolId();
    if (!schoolId) throw new Error('تعذر تحديد SchoolId.');

    const cached = loadJSON(STORE.registry);
    if (!force && cached?.schoolId === schoolId && Array.isArray(cached.students) && cached.students.length) {
      state.registry = cached;
      return cached;
    }

    const firstUrl = `/SchoolManagment/Actions/MyStudents?PageNumber=1&schoolId=${encodeURIComponent(schoolId)}`;
    const firstRes = await fetch(firstUrl, { credentials: 'same-origin' });
    if (!firstRes.ok) throw new Error(`تعذر جلب قائمة الطلاب (${firstRes.status}).`);
    const firstHtml = await firstRes.text();
    const firstDoc = new DOMParser().parseFromString(firstHtml, 'text/html');
    const totalPages = detectTotalStudentPages(firstDoc);

    const all = [];
    const pages = [];

    const parseDoc = (doc, pageNumber) => {
      const students = [...doc.querySelectorAll('#studentsDiv .card.p-3')]
        .map(parseStudentCard)
        .filter(s => s.name && s.account);
      all.push(...students);
      pages.push({ pageNumber, count: students.length, ok: true });
    };

    parseDoc(firstDoc, 1);

    for (let p = 2; p <= totalPages; p++) {
      const url = `/SchoolManagment/Actions/MyStudents?PageNumber=${p}&schoolId=${encodeURIComponent(schoolId)}`;
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(String(res.status));
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        parseDoc(doc, p);
      } catch (e) {
        pages.push({ pageNumber: p, count: 0, ok: false, error: String(e?.message || e) });
      }
    }

    const unique = new Map();
    for (const s of all) {
      const key = s.userGuid
        ? `u:${s.userGuid}`
        : s.accountNormalized
          ? `a:${s.accountNormalized}`
          : `n:${s.normalizedName}|${s.normalizedClass}`;
      if (!unique.has(key)) unique.set(key, s);
    }

    const registry = {
      schoolId,
      totalPages,
      fetchedRows: all.length,
      uniqueStudents: unique.size,
      failedPages: pages.filter(p => !p.ok),
      pages,
      students: [...unique.values()],
      savedAt: new Date().toISOString()
    };

    state.registry = registry;
    saveJSON(STORE.registry, registry);
    return registry;
  }

  // -----------------------------
  // Assignment roster / identity bridge
  // -----------------------------
  const assignmentRoster = () => {
    const select = document.querySelector('#studentsFilter');
    if (!select) return [];

    return [...select.options]
      .filter(o => o.value && /^\d+$/.test(o.value))
      .map(o => ({
        studentId: o.value,
        assignmentStudentId: o.value,
        name: clean(o.textContent),
        normalizedName: norm(o.textContent)
      }));
  };

  const currentStudentClassMap = () => {
    const out = new Map();

    const inputs = [...document.querySelectorAll('[name$=".StudentId"]')];
    for (const input of inputs) {
      const studentId = clean(input.value);
      if (!studentId) continue;

      let node = input;
      let best = '';
      for (let i = 0; i < 10 && node; i++, node = node.parentElement) {
        const t = clean(node.innerText);
        if (/الفصل\s+المدرسي\s*:/i.test(t) && t.length < 2500) {
          best = t;
          break;
        }
      }

      const cls = best.match(/الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+الدرجة|\s+الإجابة|\s+ملاحظات|$)/i)?.[1]?.trim() || '';
      if (cls) out.set(studentId, cls);
    }

    return out;
  };

  async function buildIdentityBridge(forceRegistry = false, gradeRows = []) {
    const registry = await fetchStudentRegistry(forceRegistry);
    const roster = assignmentRoster();

    const byName = new Map();
    for (const s of registry.students) {
      const key = s.normalizedName || norm(s.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(s);
    }

    // الفصل الظاهر حاليًا + الفصول المستخرجة من جلب طلاب الواجب كاملًا.
    const classHints = currentStudentClassMap();
    for (const g of gradeRows || []) {
      if (g.assignmentStudentId && g.className) {
        classHints.set(String(g.assignmentStudentId), g.className);
      }
    }

    const rows = roster.map(r => {
      const candidates = byName.get(r.normalizedName) || [];
      let winner = null;
      let method = '';

      if (candidates.length === 1) {
        winner = candidates[0];
        method = 'name';
      } else if (candidates.length > 1) {
        const hintedClass = classHints.get(r.assignmentStudentId) || '';
        if (hintedClass) {
          const exact = candidates.filter(c => norm(c.className) === norm(hintedClass));
          if (exact.length === 1) {
            winner = exact[0];
            method = 'name+class';
          }
        }
      }

      return {
        ...r,
        matched: !!winner,
        matchCount: candidates.length,
        resolutionMethod: method,
        account: winner?.account || '',
        userGuid: winner?.userGuid || '',
        className: winner?.className || '',
        candidates: candidates.map(c => ({
          className: c.className,
          account: c.account,
          userGuid: c.userGuid
        }))
      };
    });

    // الأسماء المكررة التي لم تُحسم من الصفحة الحالية:
    // نسأل خدمة الواجب عن الطالب نفسه، ثم نستخدم الفصل كعامل حسم.
    for (const row of rows.filter(x => !x.matched && x.matchCount > 1)) {
      try {
        const assignmentClass = await resolveAssignmentStudentClass(row.assignmentStudentId);
        if (!assignmentClass) continue;

        const exact = row.candidates.filter(c => norm(c.className) === norm(assignmentClass));
        if (exact.length === 1) {
          row.matched = true;
          row.matchCount = 1;
          row.resolutionMethod = 'name+class-query';
          row.account = exact[0].account || '';
          row.userGuid = exact[0].userGuid || '';
          row.className = exact[0].className || '';
          row.resolvedAssignmentClass = assignmentClass;
        }
      } catch {}
    }

    const bridge = {
      schoolId: registry.schoolId,
      total: rows.length,
      matched: rows.filter(x => x.matched).length,
      unmatched: rows.filter(x => x.matchCount === 0).length,
      ambiguous: rows.filter(x => !x.matched && x.matchCount > 1).length,
      rows,
      savedAt: new Date().toISOString()
    };
    bridge.percentage = pct(bridge.matched, bridge.total);

    state.bridge = bridge;
    saveJSON(STORE.bridge, bridge);
    return bridge;
  }

  // -----------------------------
  // GradeAssignment endpoint
  // -----------------------------
  const extractLoadStudentsParams = () => {
    const fn = globalThis.loadStudents;
    if (typeof fn !== 'function') return null;

    const src = String(fn);

    const get = (key) => {
      const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const quoted = src.match(new RegExp(`${k}\\s*:\\s*['"]([^'"]*)['"]`));
      if (quoted) return quoted[1];

      const raw = src.match(new RegExp(`${k}\\s*:\\s*([\\d.]+)`));
      return raw ? raw[1] : '';
    };

    return {
      schoolId: get('schoolId'),
      subjectId: get('subjectId'),
      teacherId: get('teacherId'),
      semesterId: get('semesterId'),
      assignmentId: get('assignmentId'),
      publishedAssignmentId: get('publishedAssignmentId'),
      lectureClassId: get('lectureClassId'),
      isGradebook: get('isGradebook'),
      isPublished: get('isPublished'),
      isCurrentTeacher: get('isCurrentTeacher'),
      isQuran: get('isQuran'),
      assigmentStarts: get('assigmentStarts'),
      grade: get('grade'),
      solvingType: get('solvingType')
    };
  };

  const postForm = (url, data) => new Promise((resolve, reject) => {
    if (globalThis.jQuery?.post) {
      globalThis.jQuery.post(url, data)
        .done(resolve)
        .fail((xhr, status, err) => reject(new Error(err || status || `HTTP ${xhr?.status || ''}`)));
      return;
    }

    fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(resolve, reject);
  });

  const responseHtml = (response) => {
    if (typeof response === 'string') return response;
    if (response && typeof response.html === 'string') return response.html;
    return String(response ?? '');
  };

  const findStudentBlock = (input) => {
    let node = input;
    let fallback = input.parentElement;

    for (let i = 0; i < 12 && node; i++, node = node.parentElement) {
      const text = clean(node.innerText);
      if (/الفصل\s+المدرسي\s*:/i.test(text) && text.length < 3500) return node;
      if (node.matches?.('.card,tr,.row,.list-group-item')) fallback = node;
    }
    return fallback;
  };

  const parseGradeStudentsHtml = (html, rosterMap) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const groups = new Map();

    [...doc.querySelectorAll('[name^="List["]')].forEach(el => {
      const m = el.name.match(/^List\[(\d+)\]\.(.+)$/);
      if (!m) return;
      const index = Number(m[1]);
      const field = m[2];
      if (!groups.has(index)) groups.set(index, {});
      groups.get(index)[field] = el.value;
    });

    const rows = [];

    for (const [index, fields] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const studentId = clean(fields.StudentId);
      if (!studentId) continue;

      const input = doc.querySelector(`[name="List[${index}].StudentId"]`);
      const block = input ? findStudentBlock(input) : null;
      const blockText = clean(block?.innerText);

      const className =
        blockText.match(/الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+الدرجة|\s+الإجابة|\s+ملاحظات|$)/i)?.[1]?.trim() || '';

      const resultLink = block
        ? [...block.querySelectorAll('a[href]')].find(a => /StudentAssignmentResult/i.test(a.href || a.getAttribute('href') || ''))
        : null;

      const hasAnswer = String(fields.hasAnswer).toLowerCase() === 'true';
      const isApproved = String(fields.IsApproved).toLowerCase() === 'true';
      const solvingType = clean(fields.SolvingType);
      const maxGrade = num(fields.TotalGrade);
      const autoGrade = num(fields.AutoGrade);
      const currentGrade = num(fields.Grade);
      const achievedGrade = currentGrade ?? (isApproved ? autoGrade : null);
      const gradeRecorded = Number.isFinite(achievedGrade) || isApproved;
      const outsideSystem = solvingType === '3';

      const submissionState = outsideSystem
        ? 'outside_unverified'
        : (hasAnswer ? 'submitted' : 'not_submitted');

      const gradeState = gradeRecorded
        ? 'recorded'
        : (!outsideSystem && hasAnswer ? 'pending' : 'none');

      const status = outsideSystem
        ? (gradeRecorded ? 'graded_outside' : 'outside_unverified')
        : (!hasAnswer ? 'not_solved' : (gradeRecorded ? 'graded' : 'submitted'));

      rows.push({
        index,
        studentId,
        assignmentStudentId: studentId,
        name: rosterMap.get(studentId)?.name || '',
        className,
        hasAnswer,
        isApproved,
        solvingType,
        recordId: clean(fields.Id),
        studentAssignmentRecordId: clean(fields.Id),
        answerText: clean(fields.AnswerText),
        feedback: clean(fields.feedBack),
        maxGrade,
        autoGradeRaw: autoGrade,
        currentGrade,
        achievedGrade,
        gradeState,
        submissionState,
        resultUrl: resultLink ? new URL(resultLink.getAttribute('href'), location.origin).href : '',
        rawFields: { ...fields },
        status
      });
    }

    return rows;
  };

  async function fetchAllGradeStudents() {
    const params = extractLoadStudentsParams();
    if (!params) throw new Error('تعذر قراءة إعدادات loadStudents من الصفحة.');

    const roster = assignmentRoster();
    const rosterMap = new Map(roster.map(r => [String(r.studentId || r.assignmentStudentId), r]));
    const merged = new Map();
    const pageSize = 200;
    let stagnantPages = 0;

    for (let p = 1; p <= 100; p++) {
      const response = await postForm('/Teacher/Assignments/GetGradeStudentsList', {
        ...params,
        pageNumber: p,
        pageSize,
        studentIds: '',
        status: '',
        sortBy: ''
      });
      const rows = parseGradeStudentsHtml(responseHtml(response), rosterMap);
      let added = 0;
      for (const r of rows) {
        const key = String(r.studentId || r.assignmentStudentId);
        if (!merged.has(key)) added++;
        merged.set(key, r);
      }

      if (roster.length && merged.size >= roster.length) break;
      if (!rows.length) break;
      if (!added) stagnantPages++; else stagnantPages = 0;
      if (stagnantPages >= 2) break;

      const declaredTotalPages = Number(response?.totalPages);
      if (Number.isFinite(declaredTotalPages) && declaredTotalPages > 0 && p >= declaredTotalPages) break;
    }

    return [...merged.values()];
  }




  async function resolveAssignmentStudentClass(studentId) {
    const params = extractLoadStudentsParams();
    if (!params || !studentId) return '';

    const response = await postForm('/Teacher/Assignments/GetGradeStudentsList', {
      ...params,
      pageNumber: 1,
      pageSize: 10,
      studentIds: [String(studentId)],
      status: '',
      sortBy: ''
    });

    const html = responseHtml(response);
    const rosterMap = new Map([[String(studentId), { name: '' }]]);
    const parsed = parseGradeStudentsHtml(html, rosterMap);
    const row = parsed.find(x => String(x.assignmentStudentId) === String(studentId));

    if (row?.className) return row.className;

    // احتياط إضافي إذا تغيرت بنية البطاقة.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = clean(doc.body?.innerText || '');
    return text.match(
      /الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+الدرجة|\s+الإجابة|\s+ملاحظات|$)/i
    )?.[1]?.trim() || '';
  }

  const detectAssignmentMode = (students = []) => {
    const pageText = clean(document.body?.innerText || '');
    const rawSolvingTypes = [...new Set(
      (students || [])
        .map(s => clean(s.solvingType))
        .filter(Boolean)
    )];

    const outsideSystem =
      /خارج\s+النظام/i.test(pageText) ||
      (students || []).some(s => /خارج\s+النظام/i.test(clean(s.answerText)));

    const hasQuestionResults =
      (students || []).some(s => !!s.resultUrl) ||
      !!document.querySelector('.dga-defualt-card,.qQuestion,input.qid');

    let key = 'unknown';
    let label = 'غير محدد بعد';

    if (outsideSystem) {
      key = 'outside_system';
      label = 'خارج النظام';
    } else if (hasQuestionResults) {
      key = 'online_questions';
      label = 'أسئلة داخل مدرستي';
    }

    return {
      key,
      label,
      rawSolvingTypes,
      evidence: {
        outsideSystemText: outsideSystem,
        hasQuestionResults
      }
    };
  };

  // -----------------------------
  // Merge + analytics
  // -----------------------------
  const mergeDataset = (gradeRows, bridge) => {
    const idMap = new Map((bridge?.rows || []).map(r => [String(r.assignmentStudentId || r.studentId), r]));

    return gradeRows.map(g => {
      const id = idMap.get(String(g.studentId || g.assignmentStudentId));
      return {
        ...g,
        account: id?.account || '',
        accountNormalized: normalizeAccount(id?.account || ''),
        userGuid: id?.userGuid || '',
        className: g.className || id?.className || '',
        identityMatched: !!id?.matched,
        identityResolutionMethod: id?.resolutionMethod || '',
        identityCandidates: id?.candidates || []
      };
    });
  };

  const getStudentStatusLabel = (s, mode) => {
    if (mode?.key === 'outside_system') {
      if (s.gradeState === 'recorded') return 'درجة مرصودة';
      return 'التسليم غير قابل للتحقق داخل مدرستي';
    }
    if (s.gradeState === 'recorded') return 'مرصود/مصحح';
    if (s.submissionState === 'submitted') return 'بانتظار رصد الدرجة';
    if (s.submissionState === 'not_submitted') return 'لم يحل';
    return 'غير محدد';
  };

  const summarizeStudents = (students, assignmentMode) => {
    const total = students.length;
    const outside = assignmentMode?.key === 'outside_system';

    const submittedRows = outside
      ? []
      : students.filter(s => s.submissionState === 'submitted');

    const gradedRows = students.filter(
      s => s.gradeState === 'recorded' &&
           Number.isFinite(s.achievedGrade) &&
           Number.isFinite(s.maxGrade) &&
           s.maxGrade > 0
    );

    const percScores = gradedRows
      .map(s => (s.achievedGrade / s.maxGrade) * 100)
      .filter(Number.isFinite);

    const avg = percScores.length
      ? percScores.reduce((a, b) => a + b, 0) / percScores.length
      : null;

    return {
      total,
      submissionVerifiable: !outside,
      solved: outside ? null : submittedRows.length,
      submittedCount: outside ? null : submittedRows.length,
      unsolved: outside ? null : total - submittedRows.length,
      notSubmittedCount: outside ? null : total - submittedRows.length,
      unverifiedSubmissionCount: outside ? total : 0,
      graded: gradedRows.length,
      pendingGrade: outside ? null : submittedRows.filter(s => s.gradeState !== 'recorded').length,
      completionRate: outside ? null : pct(submittedRows.length, total),
      submissionRate: outside ? null : pct(submittedRows.length, total),
      gradingRate: pct(gradedRows.length, total),
      gradingOfSubmittedRate: outside ? null : pct(gradedRows.length, submittedRows.length),
      averagePercent: avg == null ? null : Number(avg.toFixed(2)),
      medianPercent: median(percScores),
      minPercent: percScores.length ? Math.min(...percScores) : null,
      maxPercent: percScores.length ? Math.max(...percScores) : null,
      stdDevPercent: stdDev(percScores),
      scoredStudents: percScores.length,
      assignmentMode,
      distribution: [
        { label: '0–59', min: 0, max: 59.999, count: percScores.filter(x => x < 60).length },
        { label: '60–69', min: 60, max: 69.999, count: percScores.filter(x => x >= 60 && x < 70).length },
        { label: '70–79', min: 70, max: 79.999, count: percScores.filter(x => x >= 70 && x < 80).length },
        { label: '80–89', min: 80, max: 89.999, count: percScores.filter(x => x >= 80 && x < 90).length },
        { label: '90–100', min: 90, max: 100, count: percScores.filter(x => x >= 90).length }
      ]
    };
  };

  async function refreshAll(forceRegistry = false) {
    setBusy(true, 'جاري جمع بيانات الواجب…');
    try {
      const gradeRows = await fetchAllGradeStudents();
      const bridge = await buildIdentityBridge(forceRegistry, gradeRows);
      const students = mergeDataset(gradeRows, bridge);
      const assignmentMode = detectAssignmentMode(students);
      const summary = summarizeStudents(students, assignmentMode);

      const data = {
        schoolId: currentSchoolId(),
        pageUrl: location.href,
        title: clean(document.querySelector('h1,h2,h3,.page-title,.card-title')?.innerText) || 'الواجب',
        collectedAt: new Date().toISOString(),
        assignmentMode,
        bridge,
        summary,
        students
      };

      state.gradeData = data;
      saveJSON(STORE.snapshot, data);
      renderSummaryInline(data);
      toast(`تم جمع بيانات ${students.length} طالبًا.`, 'success');
      return data;
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------
  // Question/result parser
  // -----------------------------
  const parseQuestionCards = (doc) => {
    const cards = [...doc.querySelectorAll('.dga-defualt-card')];
    return cards.map((card, idx) => {
      const qid = card.querySelector('input.qid');
      const qtype = card.querySelector('input.qidtype');
      const questionText = clean(card.querySelector('.qQuestion')?.innerText || card.querySelector('[id="divQuestion"]')?.innerText || '');

      const headerText = clean(card.querySelector('[id="divQuestion"]')?.innerText || '');
      const maxScore =
        num(headerText.match(/(?:الدرجة|درجة|نقطة|نقاط)\s*[:：]?\s*([\d٠-٩۰-۹.]+)/i)?.[1]) ??
        num(card.innerText.match(/(?:الدرجة|درجة السؤال)\s*[:：]?\s*([\d٠-٩۰-۹.]+)/i)?.[1]);

      const options = [...card.querySelectorAll('.eldetail')].map((opt, oi) => {
        const input = opt.querySelector('input#qaid,input[type="radio"],input[type="checkbox"]');
        const cs = opt.querySelector('.cs-input') || opt;
        const cls = `${opt.className} ${cs.className}`.toLowerCase();

        return {
          index: oi + 1,
          answerId: input?.getAttribute('name') || input?.value || '',
          text: clean(opt.innerText),
          selected: !!input?.checked,
          markedCorrect: /\bsuccess\b/.test(cls),
          markedWrong: /(danger|error|wrong|incorrect)/.test(cls)
        };
      });

      const selected = options.filter(o => o.selected);
      const correct = options.filter(o => o.markedCorrect);
      const wrong = options.filter(o => o.markedWrong);

      let isCorrect = null;
      if (selected.length && correct.length) {
        const selectedIds = selected.map(o => o.answerId || norm(o.text)).sort();
        const correctIds = correct.map(o => o.answerId || norm(o.text)).sort();
        isCorrect = JSON.stringify(selectedIds) === JSON.stringify(correctIds);
      } else if (selected.length && wrong.length) {
        isCorrect = false;
      }

      return {
        number: idx + 1,
        questionId: qid?.getAttribute('name') || qid?.value || '',
        type: qtype?.getAttribute('name') || qtype?.value || '',
        text: questionText,
        maxScore,
        options,
        selectedText: selected.map(o => o.text).join('، '),
        correctText: correct.map(o => o.text).join('، '),
        isCorrect
      };
    });
  };

  const parseResultDocument = (doc, meta = {}) => {
    const questions = parseQuestionCards(doc);
    const pageText = clean(doc.body?.innerText || '');

    const studentGrade =
      num(pageText.match(/(?:درجة الطالب|الدرجة)\s*[:：]?\s*([\d٠-٩۰-۹.]+)/i)?.[1]);

    const totalMaxScore =
      questions.map(q => q.maxScore).filter(Number.isFinite).reduce((a, b) => a + b, 0) || null;

    return {
      ...meta,
      studentGrade,
      totalMaxScore,
      questions
    };
  };

  const findDetailsUrl = () => {
    const a = [...document.querySelectorAll('a[href]')]
      .find(x => /تفاصيل\s+الواجب/i.test(clean(x.innerText)));
    return a ? new URL(a.getAttribute('href'), location.origin).href : '';
  };

  async function getQuestionTemplate() {
    if (state.questions?.length) return state.questions;

    const solvedWithLink = state.gradeData?.students?.find(s => s.resultUrl);
    if (solvedWithLink) {
      const res = await fetch(solvedWithLink.resultUrl, { credentials: 'same-origin' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const parsed = parseResultDocument(doc);
      if (parsed.questions.length) {
        state.questions = parsed.questions;
        return state.questions;
      }
    }

    const detailsUrl = findDetailsUrl();
    if (detailsUrl) {
      const res = await fetch(detailsUrl, { credentials: 'same-origin' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const questions = parseQuestionCards(doc);
      if (questions.length) {
        state.questions = questions;
        return questions;
      }
    }

    const current = parseQuestionCards(document);
    if (current.length) {
      state.questions = current;
      return current;
    }

    throw new Error('لم أتمكن من العثور على بنية الأسئلة في الصفحات المتاحة.');
  }

  async function runDeepQuestionAnalysis() {
    if (!state.gradeData) await refreshAll(false);

    const candidates = state.gradeData.students.filter(s => s.resultUrl);
    if (!candidates.length) throw new Error('لا توجد روابط نتائج طلاب متاحة للتحليل العميق في هذا الواجب.');

    setBusy(true, `تحليل إجابات ${candidates.length} طالبًا…`);
    try {
      const results = [];
      for (const s of candidates) {
        try {
          const res = await fetch(s.resultUrl, { credentials: 'same-origin' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          results.push(parseResultDocument(doc, {
            assignmentStudentId: s.assignmentStudentId,
            name: s.name,
            account: s.account
          }));
        } catch (e) {
          results.push({
            assignmentStudentId: s.assignmentStudentId,
            name: s.name,
            error: String(e?.message || e),
            questions: []
          });
        }
      }

      const questionMap = new Map();

      for (const r of results) {
        for (const q of r.questions || []) {
          const key = q.questionId || `n:${q.number}:${norm(q.text)}`;
          if (!questionMap.has(key)) {
            questionMap.set(key, {
              questionId: q.questionId,
              number: q.number,
              text: q.text,
              type: q.type,
              maxScore: q.maxScore,
              correctText: q.correctText,
              attempts: 0,
              correct: 0,
              incorrect: 0,
              unknown: 0
            });
          }
          const agg = questionMap.get(key);
          agg.attempts++;
          if (q.isCorrect === true) agg.correct++;
          else if (q.isCorrect === false) agg.incorrect++;
          else agg.unknown++;
        }
      }

      const questions = [...questionMap.values()].map(q => ({
        ...q,
        correctRate: pct(q.correct, q.attempts),
        incorrectRate: pct(q.incorrect, q.attempts),
        difficulty:
          q.attempts === 0 ? 'غير محدد' :
          pct(q.correct, q.attempts) < 50 ? 'صعب' :
          pct(q.correct, q.attempts) < 75 ? 'متوسط' : 'سهل'
      }));

      state.questionAnalytics = { results, questions };
      if (!state.questions?.length && results[0]?.questions?.length) state.questions = results[0].questions;
      toast(`تم تحليل ${results.filter(r => !r.error).length} نتيجة طالب.`, 'success');
      return state.questionAnalytics;
    } finally {
      setBusy(false);
    }
  }


  // -----------------------------
  // Smart Grade Importer (XLSX / CSV)
  // -----------------------------
  const HEADER_ALIASES = {
    account: [
      'حساب الطالب','حساب','البريد','البريد الالكتروني','البريد الإلكتروني','الايميل','الإيميل',
      'email','e-mail','account','username','student account','student email','user name'
    ],
    studentId: [
      'studentid','student id','معرف الطالب','رقم الطالب','student number','student no'
    ],
    userGuid: [
      'userguid','user guid','userid','user id','معرف المستخدم'
    ],
    name: [
      'اسم الطالب','الطالب','الاسم','student name','name','full name'
    ],
    className: [
      'الفصل','الفصل المدرسي','الشعبة','class','classroom','section','grade class'
    ],
    score: [
      'الدرجة','درجة الطالب','الدرجه','النتيجة','النقاط','score','grade','points','total score','student score'
    ],
    feedback: [
      'ملاحظة','ملاحظات','ملاحظات المعلم','التغذية الراجعة','تعليق','feedback','comment','comments','teacher feedback'
    ],
    submissionStatus: [
      'الحالة','حالة التسليم','حالة الواجب','حالة الطالب','التسليم','submission status','status','submission','turn in status'
    ]
  };

  const normHeader = (v) => norm(v)
    .replace(/[()\[\]{}:：|/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const headerKind = (value) => {
    const h = normHeader(value);
    if (!h) return '';
    for (const [kind, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(a => {
        const n = normHeader(a);
        return h === n || h.includes(n) || n.includes(h);
      })) return kind;
    }
    return '';
  };

  const detectHeaderRow = (aoa) => {
    let best = { index: 0, score: -1 };
    for (let i = 0; i < Math.min(20, aoa.length); i++) {
      const row = aoa[i] || [];
      const kinds = new Set(row.map(headerKind).filter(Boolean));
      let score = kinds.size * 3;
      if (kinds.has('score')) score += 4;
      if (kinds.has('account') || kinds.has('studentId') || kinds.has('name')) score += 4;
      const nonEmpty = row.filter(x => clean(x) !== '').length;
      score += Math.min(nonEmpty, 8) * .1;
      if (score > best.score) best = { index: i, score };
    }
    return best.index;
  };

  const detectColumns = (headers) => {
    const out = { account: -1, studentId: -1, userGuid: -1, name: -1, className: -1, score: -1, feedback: -1, submissionStatus: -1 };
    headers.forEach((h, i) => {
      const k = headerKind(h);
      if (k && out[k] === -1) out[k] = i;
    });
    return out;
  };

  const parseCsv = (text) => {
    const sample = String(text || '').split(/\r?\n/).find(x => clean(x)) || '';
    const delimiter = [',',';','\t']
      .map(d => [d, sample.split(d).length - 1])
      .sort((a,b) => b[1] - a[1])[0]?.[0] || ',';

    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else {
        if (ch === '"') quoted = true;
        else if (ch === delimiter) { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
        else cell += ch;
      }
    }
    row.push(cell.replace(/\r$/, ''));
    if (row.some(x => clean(x) !== '')) rows.push(row);
    return rows;
  };

  const parseScoreCell = (value) => {
    let text = englishDigits(clean(value));
    if (!text) return { value: null, total: null };
    // دعم الفاصلة العشرية في ملفات CSV الأوروبية (8,5 -> 8.5).
    text = text.replace(/(-?\d+),(\d+)/g, '$1.$2');

    const frac = text.match(/(-?\d+(?:\.\d+)?)\s*(?:\/|من|of)\s*(\d+(?:\.\d+)?)/i);
    if (frac) return { value: Number(frac[1]), total: Number(frac[2]) };

    const n = num(text);
    return { value: n, total: null };
  };

  const targetTotalGrade = () => {
    const params = extractLoadStudentsParams();
    const fromParams = num(params?.grade);
    if (Number.isFinite(fromParams) && fromParams > 0) return fromParams;
    const vals = (state.gradeData?.students || []).map(s => s.maxGrade).filter(v => Number.isFinite(v) && v > 0);
    return vals.length ? Math.max(...vals) : null;
  };

  const modalRefs = () => ({
    modal: document.getElementById(`${APP}-modal`),
    body: document.getElementById(`${APP}-modal-body`),
    title: document.getElementById(`${APP}-modal-title`)
  });

  const showMainModal = (title, html) => {
    const { modal, body, title: titleEl } = modalRefs();
    if (titleEl) titleEl.textContent = title;
    if (body) body.innerHTML = html;
    if (modal) modal.hidden = false;
  };

  const getIdentityMaps = () => {
    const students = state.gradeData?.students || [];
    const registry = state.registry?.students || [];

    const byStudentId = new Map();
    const byAccount = new Map();
    const byUserGuid = new Map();
    const byNameClass = new Map();
    const byName = new Map();

    const addMulti = (map, key, item) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };

    for (const s of students) {
      byStudentId.set(String(s.studentId || s.assignmentStudentId), s);
      addMulti(byAccount, normalizeAccount(s.account), s);
      addMulti(byUserGuid, clean(s.userGuid).toLowerCase(), s);
      addMulti(byNameClass, `${norm(s.name)}|${norm(s.className)}`, s);
      addMulti(byName, norm(s.name), s);
    }

    // إذا كانت خريطة الواجب لا تحتوي الحساب مباشرة، نستخدم سجل المدرسة كجسر account -> userGuid.
    const registryAccountToGuid = new Map();
    for (const r of registry) {
      const a = normalizeAccount(r.account);
      const g = clean(r.userGuid).toLowerCase();
      if (a && g) registryAccountToGuid.set(a, g);
    }

    return { byStudentId, byAccount, byUserGuid, byNameClass, byName, registryAccountToGuid };
  };

  const singleMatch = (arr) => Array.isArray(arr) && arr.length === 1 ? arr[0] : null;

  const matchImportedIdentity = (raw, maps, allowUniqueName) => {
    const studentId = clean(raw.studentId);
    if (studentId && maps.byStudentId.has(studentId)) {
      return { student: maps.byStudentId.get(studentId), method: 'StudentId', confidence: 'exact' };
    }

    const account = normalizeAccount(raw.account);
    if (account) {
      const direct = singleMatch(maps.byAccount.get(account));
      if (direct) return { student: direct, method: 'الحساب', confidence: 'exact' };

      const guid = maps.registryAccountToGuid.get(account);
      if (guid) {
        const bridged = singleMatch(maps.byUserGuid.get(guid));
        if (bridged) return { student: bridged, method: 'الحساب → UserGuid', confidence: 'exact' };
      }
      const arr = maps.byAccount.get(account);
      if (arr?.length > 1) return { student: null, method: 'الحساب', confidence: 'ambiguous', candidates: arr };
    }

    const userGuid = clean(raw.userGuid).toLowerCase();
    if (userGuid) {
      const direct = singleMatch(maps.byUserGuid.get(userGuid));
      if (direct) return { student: direct, method: 'UserGuid', confidence: 'exact' };
      const arr = maps.byUserGuid.get(userGuid);
      if (arr?.length > 1) return { student: null, method: 'UserGuid', confidence: 'ambiguous', candidates: arr };
    }

    const name = norm(raw.name);
    const cls = norm(raw.className);
    if (name && cls) {
      const arr = maps.byNameClass.get(`${name}|${cls}`) || [];
      if (arr.length === 1) return { student: arr[0], method: 'الاسم + الفصل', confidence: 'exact' };
      if (arr.length > 1) return { student: null, method: 'الاسم + الفصل', confidence: 'ambiguous', candidates: arr };
    }

    if (name) {
      const arr = maps.byName.get(name) || [];
      if (arr.length === 1) {
        return { student: arr[0], method: 'اسم فريد', confidence: allowUniqueName ? 'exact' : 'review' };
      }
      if (arr.length > 1) return { student: null, method: 'اسم مكرر', confidence: 'ambiguous', candidates: arr };
    }

    return { student: null, method: 'غير مطابق', confidence: 'none' };
  };

  const importCell = (row, index) => index >= 0 ? row[index] : '';

  // ملاحظات تلقائية مبنية على نسبة درجة الطالب من الدرجة الكلية للواجب.
  // الاختيار بين العبارات حتمي لكل طالب حتى لا تتغير الملاحظة كلما أُعيدت المعاينة.
  const AUTO_FEEDBACK_BANDS = [
    {
      min: 90,
      label: 'متميز',
      phrases: [
        'أداء متميز، أحسنت وواصل تميزك.',
        'ممتاز، إتقان واضح للمهارات، استمر بهذا التميز.',
        'عمل رائع ومستوى متميز، واصل تقدمك.',
        'أداء متقن، بارك الله في جهودك وواصل التألق.'
      ]
    },
    {
      min: 80,
      label: 'رائع',
      phrases: [
        'أداء رائع، استمر بهذا المستوى.',
        'مستوى رائع وجهد واضح، واصل التقدم.',
        'أحسنت، أداء قوي وقريب من التميز.',
        'نتيجة رائعة، استمر في المراجعة للحفاظ على هذا المستوى.'
      ]
    },
    {
      min: 70,
      label: 'جيد',
      phrases: [
        'أداء جيد، وبمزيد من المراجعة ستكون أفضل.',
        'نتيجة جيدة، واصل التدريب لرفع مستوى الإتقان.',
        'أحسنت، لديك أساس جيد ويحتاج إلى مزيد من المراجعة.',
        'مستوى جيد، ركز على النقاط التي تحتاج تعزيزًا.'
      ]
    },
    {
      min: 60,
      label: 'مقبول',
      phrases: [
        'أداء مقبول، تحتاج إلى مراجعة بعض المهارات.',
        'لديك تقدم جيد، وراجع المهارات التي لم تتقنها بعد.',
        'واصل المحاولة، مع مزيد من المراجعة سيتحسن أداؤك.',
        'نتيجة مقبولة، ركز على مراجعة الدرس والتدرب أكثر.'
      ]
    },
    {
      min: 50,
      label: 'يحتاج تعزيز',
      phrases: [
        'بداية جيدة، ركز على مراجعة الدرس وتدرب أكثر.',
        'تحتاج إلى تعزيز بعض المهارات، والمراجعة ستساعدك على التحسن.',
        'واصل التدريب ولا تتوقف، لديك فرصة جيدة لرفع مستواك.',
        'راجع الأفكار الأساسية وحاول حل تدريبات إضافية.'
      ]
    },
    {
      min: -Infinity,
      label: 'يحتاج مراجعة',
      phrases: [
        'تحتاج إلى مزيد من المراجعة والتدريب، وتستطيع التحسن.',
        'راجع الدرس من جديد وركز على المهارات الأساسية ثم أعد التدريب.',
        'تحتاج إلى تدريب إضافي، واصل المحاولة وستتحسن نتائجك.',
        'ركز على فهم الأساسيات واطلب المساعدة في النقاط غير الواضحة.'
      ]
    }
  ];


  // توحيد حالة التسليم القادمة من Excel/CSV.
  // لا نستنتج "لم يسلّم" من الدرجة صفر؛ نعتمد على عمود الحالة إن كان موجودًا.
  const normalizeSubmissionStatus = (value) => {
    const s = norm(value);
    if (!s) return { code: 'unknown', label: '' };

    if (
      /لم\s*يسلم|لم\s*يتم\s*التسليم|غير\s*مسلم|بدون\s*تسليم|not\s*submitted|not\s*turned\s*in|missing|no\s*submission/.test(s)
    ) {
      return { code: 'not_submitted', label: clean(value) };
    }

    if (
      /تسليم\s*مبكر|سلم\s*مبكر|early\s*submission|submitted\s*early|turned\s*in\s*early/.test(s)
    ) {
      return { code: 'early', label: clean(value) };
    }

    if (
      /تم\s*التسليم|تم\s*تسليم|مسلم|submitted|turned\s*in|complete|completed/.test(s)
    ) {
      return { code: 'submitted', label: clean(value) };
    }

    return { code: 'other', label: clean(value) };
  };

  // مفتاح ثابت لقرار المعلم حول درجة الصفر عند غياب حالة التسليم.
  const zeroDecisionKeyForRow = (sourceRowNumber, studentId = '', account = '', name = '') =>
    [sourceRowNumber, clean(studentId), normalizeAccount(account), norm(name)].join('|');

  const getManualZeroDecision = (session, key) => {
    const value = session?.zeroDecisions?.[key];
    return value === 'submitted' || value === 'not_submitted' ? value : '';
  };

  const effectiveSubmissionState = (session, rawStatus, newGrade, zeroDecisionKey) => {
    const parsed = normalizeSubmissionStatus(rawStatus);
    const isZero = Number.isFinite(newGrade) && nearlyEqual(newGrade, 0);

    // الحالات الواضحة القادمة من الملف لها الأولوية ولا نطلب قراراً يدوياً.
    if (parsed.code === 'not_submitted' || parsed.code === 'submitted' || parsed.code === 'early') {
      return {
        code: parsed.code,
        label: parsed.label,
        source: 'file',
        needsDecision: false,
        decision: ''
      };
    }

    // الدرجة غير الصفرية لا تحتاج قرار تسليم حتى لو لم يوجد عمود حالة.
    if (!isZero) {
      return {
        code: parsed.code,
        label: parsed.label,
        source: parsed.label ? 'file-unknown' : 'none',
        needsDecision: false,
        decision: ''
      };
    }

    // الصفر دون حالة واضحة لا نسمح بتمريره للتطبيق حتى يقرر المعلم.
    const manual = getManualZeroDecision(session, zeroDecisionKey);
    if (manual) {
      return {
        code: manual,
        label: manual === 'submitted' ? 'تم التسليم — قرار المعلم' : 'لم يسلّم — قرار المعلم',
        source: 'teacher',
        needsDecision: false,
        decision: manual
      };
    }

    return {
      code: 'unknown',
      label: parsed.label,
      source: 'none',
      needsDecision: true,
      decision: ''
    };
  };

  const ZERO_SUBMITTED_FEEDBACK = [
    'تم تسليم الواجب، لكن الإجابات تحتاج إلى مراجعة شاملة.',
    'تم تسليم الواجب، ولم تحقق الإجابات درجات صحيحة؛ راجع الدرس وحاول من جديد.',
    'أكملت التسليم، لكن تحتاج إلى مراجعة المفاهيم الأساسية والتدرب عليها أكثر.',
    'تم التسليم، ونحتاج الآن إلى مراجعة الإجابات وفهم الأخطاء قبل المحاولة القادمة.'
  ];

  const NOT_SUBMITTED_FEEDBACK = [
    'لم يتم تسليم الواجب.',
    'لم يتم تسليم الواجب، احرص على متابعة المهام وتسليمها في الوقت المحدد.',
    'الواجب غير مسلّم حتى الآن؛ احرص على استكمال المهام القادمة في موعدها.'
  ];

  const stableTextHash = (value) => {
    const text = String(value ?? '');
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const autoFeedbackForGrade = (grade, total, studentKey = '', submissionCode = 'unknown') => {
    if (!Number.isFinite(grade) || !Number.isFinite(total) || total <= 0) {
      return { text: '', percentage: null, band: '', reason: '' };
    }

    const percentage = Math.max(0, Math.min(100, (grade / total) * 100));

    // "لم يسلّم" حالة مستقلة عن مستوى الأداء.
    if (submissionCode === 'not_submitted') {
      const seed = `${studentKey}|not_submitted`;
      const phrase = NOT_SUBMITTED_FEEDBACK[stableTextHash(seed) % NOT_SUBMITTED_FEEDBACK.length];
      return {
        text: phrase,
        percentage: Number(percentage.toFixed(1)),
        band: 'لم يسلّم',
        reason: 'submission'
      };
    }

    // الصفر بعد تسليم فعلي يعني أن الواجب سُلّم لكن الإجابات لم تحقق درجات.
    if ((submissionCode === 'submitted' || submissionCode === 'early') && nearlyEqual(grade, 0)) {
      const seed = `${studentKey}|submitted_zero|${submissionCode}`;
      const phrase = ZERO_SUBMITTED_FEEDBACK[stableTextHash(seed) % ZERO_SUBMITTED_FEEDBACK.length];
      return {
        text: phrase,
        percentage: 0,
        band: 'سلّم بدرجة صفر',
        reason: 'submitted-zero'
      };
    }

    const band = AUTO_FEEDBACK_BANDS.find(x => percentage >= x.min) || AUTO_FEEDBACK_BANDS[AUTO_FEEDBACK_BANDS.length - 1];
    const seed = `${studentKey}|${Number(grade).toFixed(4)}|${Number(total).toFixed(4)}|${band.label}`;
    const phrase = band.phrases[stableTextHash(seed) % band.phrases.length];

    return {
      text: phrase,
      percentage: Number(percentage.toFixed(1)),
      band: band.label,
      reason: 'percentage'
    };
  };

  const buildImportPreview = (session) => {
    const maps = getIdentityMaps();
    const targetTotal = session.targetTotal;
    const sourceTotalControl = num(session.sourceTotal);
    const rows = [];

    for (let i = session.headerRow + 1; i < session.aoa.length; i++) {
      const sourceRow = session.aoa[i] || [];
      if (!sourceRow.some(x => clean(x) !== '')) continue;

      const raw = {
        account: importCell(sourceRow, session.mapping.account),
        studentId: importCell(sourceRow, session.mapping.studentId),
        userGuid: importCell(sourceRow, session.mapping.userGuid),
        name: importCell(sourceRow, session.mapping.name),
        className: importCell(sourceRow, session.mapping.className),
        score: importCell(sourceRow, session.mapping.score),
        feedback: importCell(sourceRow, session.mapping.feedback),
        submissionStatus: importCell(sourceRow, session.mapping.submissionStatus)
      };

      const identity = matchImportedIdentity(raw, maps, session.allowUniqueName);
      const parsed = parseScoreCell(raw.score);
      const rowSourceTotal = parsed.total || sourceTotalControl;
      let newGrade = parsed.value;
      let issue = '';

      if (!Number.isFinite(newGrade)) issue = 'درجة غير صالحة';
      if (!Number.isFinite(targetTotal) || targetTotal <= 0) issue = issue || 'تعذر تحديد درجة الواجب';

      if (!issue && session.scale && Number.isFinite(rowSourceTotal) && rowSourceTotal > 0 && !nearlyEqual(rowSourceTotal, targetTotal)) {
        newGrade = (newGrade / rowSourceTotal) * targetTotal;
      }

      if (!issue && session.roundStep > 0) newGrade = roundToStep(newGrade, session.roundStep);
      if (Number.isFinite(newGrade)) newGrade = Number(newGrade.toFixed(4));

      if (!issue && (newGrade < 0 || newGrade > targetTotal + 1e-9)) {
        issue = newGrade < 0 ? 'درجة سالبة' : `تتجاوز درجة الواجب (${targetTotal})`;
      }

      const student = identity.student;
      const zeroDecisionKey = zeroDecisionKeyForRow(
        i + 1,
        student?.studentId || student?.assignmentStudentId || raw.studentId,
        student?.account || raw.account,
        student?.name || raw.name
      );
      const submission = effectiveSubmissionState(session, raw.submissionStatus, newGrade, zeroDecisionKey);

      if (!issue && submission.code === 'not_submitted' && Number.isFinite(newGrade) && newGrade > 0) {
        issue = 'تعارض: الحالة «لم يسلّم» لكن الدرجة أكبر من صفر';
      }

      const existingGrade = student?.currentGrade ?? student?.achievedGrade ?? null;
      const existingFeedback = clean(student?.feedback || '');
      const importedFeedback = clean(raw.feedback);
      const studentFeedbackKey = student
        ? String(student.studentId || student.assignmentStudentId || student.account || student.name || i)
        : String(raw.studentId || raw.account || raw.name || i);
      const generatedFeedback = session.autoFeedback
        ? autoFeedbackForGrade(newGrade, targetTotal, studentFeedbackKey, submission.code)
        : { text: '', percentage: null, band: '', reason: '' };
      const nextFeedback = importedFeedback !== ''
        ? importedFeedback
        : (session.autoFeedback && generatedFeedback.text
            ? generatedFeedback.text
            : existingFeedback);
      const feedbackSource = importedFeedback !== ''
        ? 'file'
        : (session.autoFeedback && generatedFeedback.text ? 'auto' : (existingFeedback ? 'existing' : 'none'));

      let status = 'unmatched';
      let applicable = false;
      let changed = false;

      if (identity.confidence === 'ambiguous') status = 'ambiguous';
      else if (identity.confidence === 'review') status = 'review';
      else if (!student) status = 'unmatched';
      else if (issue) status = 'invalid';
      else if (submission.needsDecision) status = 'zeroDecision';
      else {
        const gradeSame = Number.isFinite(existingGrade) && nearlyEqual(existingGrade, newGrade);
        const feedbackSame = nextFeedback === existingFeedback;
        if (gradeSame && feedbackSame) status = 'unchanged';
        else {
          changed = Number.isFinite(existingGrade);
          status = changed ? 'changed' : 'ready';
          applicable = true;
        }
      }

      rows.push({
        sourceRowNumber: i + 1,
        raw,
        identity,
        student,
        sourceScore: parsed.value,
        sourceTotal: rowSourceTotal,
        targetTotal,
        newGrade,
        existingGrade,
        existingFeedback,
        nextFeedback,
        feedbackSource,
        feedbackPercentage: generatedFeedback.percentage,
        feedbackBand: generatedFeedback.band,
        feedbackReason: generatedFeedback.reason,
        submissionStatusRaw: clean(raw.submissionStatus),
        submissionStatusCode: submission.code,
        submissionStatusLabel: submission.label,
        submissionStatusSource: submission.source,
        zeroDecisionKey,
        zeroDecisionRequired: !!submission.needsDecision,
        zeroDecision: submission.decision,
        issue,
        status,
        applicable,
        changed
      });
    }

    // كشف تكرار الطالب نفسه داخل الملف بعد المطابقة.
    const targetGroups = new Map();
    for (const r of rows) {
      const sid = r.student ? String(r.student.studentId || r.student.assignmentStudentId) : '';
      if (!sid) continue;
      if (!targetGroups.has(sid)) targetGroups.set(sid, []);
      targetGroups.get(sid).push(r);
    }
    for (const group of targetGroups.values()) {
      if (group.length <= 1) continue;
      for (const r of group) {
        r.status = 'duplicate';
        r.applicable = false;
        r.issue = 'الطالب مكرر داخل ملف الاستيراد';
      }
    }

    const counts = {
      totalRows: rows.length,
      ready: rows.filter(r => r.status === 'ready').length,
      changed: rows.filter(r => r.status === 'changed').length,
      unchanged: rows.filter(r => r.status === 'unchanged').length,
      review: rows.filter(r => r.status === 'review').length,
      ambiguous: rows.filter(r => r.status === 'ambiguous').length,
      unmatched: rows.filter(r => r.status === 'unmatched').length,
      duplicate: rows.filter(r => r.status === 'duplicate').length,
      invalid: rows.filter(r => r.status === 'invalid').length,
      zeroDecision: rows.filter(r => r.status === 'zeroDecision').length,
      notSubmitted: rows.filter(r => r.submissionStatusCode === 'not_submitted').length,
      submittedZero: rows.filter(r => (r.submissionStatusCode === 'submitted' || r.submissionStatusCode === 'early') && Number.isFinite(r.newGrade) && nearlyEqual(r.newGrade, 0)).length,
      applicable: rows.filter(r => r.applicable).length
    };

    return { rows, counts, targetTotal };
  };

  const STATUS_META = {
    ready: ['🟢', 'جاهز'],
    changed: ['🟠', 'درجة مختلفة'],
    unchanged: ['🔵', 'لا تغيير'],
    review: ['🟡', 'مطابقة تحتاج مراجعة'],
    ambiguous: ['🟣', 'اسم/هوية مكررة'],
    unmatched: ['🔴', 'غير مطابق'],
    duplicate: ['🟣', 'مكرر في الملف'],
    invalid: ['🔴', 'درجة غير صالحة'],
    zeroDecision: ['🟡', 'حدد حالة درجة الصفر']
  };

  const columnSelectHtml = (key, label, session) => {
    const options = ['<option value="-1">— غير مستخدم —</option>']
      .concat(session.headers.map((h, i) => `<option value="${i}" ${session.mapping[key] === i ? 'selected' : ''}>${esc(h || `عمود ${i + 1}`)}</option>`))
      .join('');
    return `<label class="${APP}-field"><span>${label}</span><select data-import-col="${key}">${options}</select></label>`;
  };

  const syncImportSettingsFromUI = () => {
    const s = state.importSession;
    if (!s) return;
    document.querySelectorAll('[data-import-col]').forEach(el => {
      s.mapping[el.dataset.importCol] = Number(el.value);
    });
    s.sourceTotal = document.getElementById(`${APP}-source-total`)?.value || '';
    s.scale = !!document.getElementById(`${APP}-scale`)?.checked;
    s.roundStep = Number(document.getElementById(`${APP}-round`)?.value || 0);
    s.allowUniqueName = !!document.getElementById(`${APP}-unique-name`)?.checked;
    s.autoFeedback = !!document.getElementById(`${APP}-auto-feedback`)?.checked;
    saveJSON(STORE.importPrefs, {
      scale: s.scale,
      roundStep: s.roundStep,
      allowUniqueName: s.allowUniqueName,
      autoFeedback: s.autoFeedback
    });
  };

  const zeroDecisionHtml = (r) => {
    if (!r.zeroDecisionRequired) {
      if (r.submissionStatusSource === 'teacher') {
        return `<div>${esc(r.submissionStatusLabel || '—')}</div><div class="${APP}-tiny">قرار المعلم</div>`;
      }
      return esc(r.submissionStatusRaw || r.submissionStatusLabel || '—');
    }

    return `
      <div class="${APP}-zero-decision">
        <div class="${APP}-tiny ${APP}-danger-text" style="margin-bottom:6px">درجة صفر بدون حالة تسليم. اختر قبل التطبيق:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="${APP}-btn" style="padding:5px 9px"
            data-${APP.toLowerCase()}-action="zeroDecision"
            data-zero-key="${esc(r.zeroDecisionKey)}"
            data-zero-value="submitted">سلّم</button>
          <button type="button" class="${APP}-btn" style="padding:5px 9px"
            data-${APP.toLowerCase()}-action="zeroDecision"
            data-zero-key="${esc(r.zeroDecisionKey)}"
            data-zero-value="not_submitted">لم يسلّم</button>
        </div>
      </div>`;
  };

  const setZeroDecision = (key, value) => {
    const s = state.importSession;
    if (!s || !key || !['submitted','not_submitted'].includes(value)) return;
    s.zeroDecisions = s.zeroDecisions || {};
    s.zeroDecisions[key] = value;
    renderImportPreview();
  };

  const setAllPendingZeroDecisions = (value) => {
    const s = state.importSession;
    const preview = state.importPreview;
    if (!s || !preview || !['submitted','not_submitted'].includes(value)) return;
    s.zeroDecisions = s.zeroDecisions || {};
    for (const r of preview.rows || []) {
      if (r.zeroDecisionRequired && r.zeroDecisionKey) {
        s.zeroDecisions[r.zeroDecisionKey] = value;
      }
    }
    renderImportPreview();
  };

  const renderImportPreview = () => {
    const s = state.importSession;
    if (!s) return;
    const preview = buildImportPreview(s);
    state.importPreview = preview;

    const counts = preview.counts;
    const rowsHtml = preview.rows.map(r => {
      const meta = STATUS_META[r.status] || ['', r.status];
      const student = r.student;
      const candidates = r.identity?.candidates || [];
      const matchText = student
        ? `${esc(student.name)}<div class="${APP}-tiny">${esc(student.className)} · ${esc(student.account)}</div>`
        : candidates.length
          ? candidates.map(c => `${esc(c.name)} — ${esc(c.className)} — ${esc(c.account)}`).join('<br>')
          : '—';
      return `<tr data-status="${r.status}">
        <td>${r.sourceRowNumber}</td>
        <td>${esc(r.raw.name || r.raw.account || r.raw.studentId || '—')}</td>
        <td>${zeroDecisionHtml(r)}</td>
        <td>${matchText}</td>
        <td>${esc(r.identity?.method || '—')}</td>
        <td>${r.existingGrade ?? '—'}</td>
        <td><b>${Number.isFinite(r.newGrade) ? r.newGrade : '—'}</b>${r.sourceTotal && r.sourceTotal !== r.targetTotal ? `<div class="${APP}-tiny">المصدر: ${r.sourceScore}/${r.sourceTotal}</div>` : ''}</td>
        <td>${esc(r.nextFeedback)}${r.feedbackSource === 'auto' ? `<div class="${APP}-tiny">${r.feedbackReason === 'submission' ? 'تلقائية حسب حالة التسليم' : r.feedbackReason === 'submitted-zero' ? 'تلقائية: تم التسليم بدرجة صفر' : Number.isFinite(r.feedbackPercentage) ? `تلقائية حسب ${r.feedbackPercentage}% · ${esc(r.feedbackBand)}` : 'ملاحظة تلقائية'}</div>` : r.feedbackSource === 'file' ? `<div class="${APP}-tiny">من ملف الاستيراد</div>` : ''}</td>
        <td><span class="${APP}-status-pill ${APP}-${r.status}">${meta[0]} ${meta[1]}</span>${r.issue ? `<div class="${APP}-tiny ${APP}-danger-text">${esc(r.issue)}</div>` : ''}</td>
      </tr>`;
    }).join('');

    const box = document.getElementById(`${APP}-import-preview`);
    if (!box) return;
    box.innerHTML = `
      <div class="${APP}-import-stats">
        <div><b>${counts.applicable}</b><span>جاهز للتطبيق</span></div>
        <div><b>${counts.changed}</b><span>درجات مختلفة</span></div>
        <div><b>${counts.unchanged}</b><span>لا تغيير</span></div>
        <div><b>${counts.review + counts.ambiguous}</b><span>تحتاج مراجعة</span></div>
        <div><b>${counts.unmatched}</b><span>غير مطابق</span></div>
        <div><b>${counts.duplicate + counts.invalid}</b><span>تعارض/خطأ</span></div>
        <div><b>${counts.zeroDecision}</b><span>أصفار تنتظر قرارك</span></div>
        <div><b>${counts.notSubmitted}</b><span>لم يسلّم</span></div>
        <div><b>${counts.submittedZero}</b><span>سلّم بدرجة صفر</span></div>
      </div>
      <div class="${APP}-table-wrap">
        <table class="${APP}-table">
          <thead><tr><th>صف</th><th>من الملف</th><th>حالة التسليم</th><th>مطابقة مدرستي</th><th>طريقة المطابقة</th><th>الحالية</th><th>الجديدة</th><th>الملاحظة</th><th>الحالة</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${counts.zeroDecision ? `
      <div class="${APP}-card ${APP}-notice" style="margin-top:12px">
        <b>⚠️ يوجد ${counts.zeroDecision} طالبًا درجتهم صفر ولا توجد لهم حالة تسليم واضحة.</b>
        <div class="${APP}-sub">لن يسمح السكربت بالتطبيق حتى تحدد لكل واحد: «سلّم» أو «لم يسلّم». يمكنك الحسم من الصف نفسه، أو استخدام قرار جماعي ثم تعديل أي طالب بشكل فردي.</div>
        <div class="${APP}-toolbar" style="margin-top:8px">
          <button type="button" class="${APP}-btn" data-${APP.toLowerCase()}-action="zeroDecisionAll" data-zero-value="submitted">اعتبر كل الأصفار: سلّموا</button>
          <button type="button" class="${APP}-btn" data-${APP.toLowerCase()}-action="zeroDecisionAll" data-zero-value="not_submitted">اعتبر كل الأصفار: لم يسلّموا</button>
        </div>
      </div>` : ''}
      <div class="${APP}-toolbar" style="margin-top:14px">
        <button class="${APP}-btn ${APP}-primary" id="${APP}-apply-import" data-${APP.toLowerCase()}-action="applyImport" ${(counts.applicable && !counts.zeroDecision) ? '' : 'disabled'}>${counts.zeroDecision ? `احسم ${counts.zeroDecision} درجة صفر أولًا` : `تطبيق ${counts.applicable} تغييرًا مؤكدًا`}</button>
        <button class="${APP}-btn" id="${APP}-export-import-preview">تصدير المعاينة Excel</button>
        <button class="${APP}-btn" id="${APP}-show-backup">آخر نسخة احتياطية</button>
      </div>`;

    document.getElementById(`${APP}-export-import-preview`)?.addEventListener('click', exportImportPreview);
    document.getElementById(`${APP}-show-backup`)?.addEventListener('click', showLastImportBackup);
  };

  const renderImportSession = () => {
    const s = state.importSession;
    if (!s) return;
    const { body, title } = modalRefs();
    if (title) title.textContent = 'استيراد درجات Excel / CSV';

    body.innerHTML = `
      <div class="${APP}-card ${APP}-notice">
        <b>المطابقة الآمنة</b>
        <div class="${APP}-sub">الأولوية: StudentId ← حساب الطالب ← UserGuid ← الاسم + الفصل. الاسم الفريد وحده لا يطبّق تلقائيًا إلا إذا سمحت به.</div>
      </div>
      <div class="${APP}-grid ${APP}-import-grid" style="margin-top:10px">
        ${columnSelectHtml('account', 'حساب/بريد الطالب', s)}
        ${columnSelectHtml('studentId', 'StudentId', s)}
        ${columnSelectHtml('userGuid', 'UserGuid', s)}
        ${columnSelectHtml('name', 'اسم الطالب', s)}
        ${columnSelectHtml('className', 'الفصل', s)}
        ${columnSelectHtml('score', 'الدرجة', s)}
        ${columnSelectHtml('submissionStatus', 'حالة التسليم', s)}
        ${columnSelectHtml('feedback', 'الملاحظة', s)}
        <label class="${APP}-field"><span>درجة الملف من</span><input id="${APP}-source-total" type="number" min="0" step="0.01" value="${esc(s.sourceTotal)}" placeholder="مثال: 20"></label>
        <label class="${APP}-field"><span>درجة الواجب في مدرستي</span><input type="text" value="${esc(s.targetTotal ?? 'غير محدد')}" readonly></label>
        <label class="${APP}-field"><span>التقريب</span><select id="${APP}-round"><option value="0" ${s.roundStep === 0 ? 'selected' : ''}>بدون تقريب</option><option value="0.25" ${s.roundStep === .25 ? 'selected' : ''}>إلى 0.25</option><option value="0.5" ${s.roundStep === .5 ? 'selected' : ''}>إلى 0.5</option><option value="1" ${s.roundStep === 1 ? 'selected' : ''}>إلى عدد صحيح</option></select></label>
      </div>
      <div class="${APP}-checks">
        <label><input id="${APP}-scale" type="checkbox" ${s.scale ? 'checked' : ''}> تحويل النسبة تلقائيًا إذا اختلف مجموع الملف عن درجة الواجب</label>
        <label><input id="${APP}-auto-feedback" type="checkbox" ${s.autoFeedback ? 'checked' : ''}> إنشاء ملاحظات تلقائية حسب نسبة الدرجة عند عدم وجود ملاحظة في الملف</label>
        <label><input id="${APP}-unique-name" type="checkbox" ${s.allowUniqueName ? 'checked' : ''}> السماح بالمطابقة التلقائية بالاسم الفريد فقط</label>
        <span class="${APP}-sub">أولوية الملاحظة: ملاحظة Excel ← حالة التسليم (إن وجدت) ← قرار المعلم للصفر عند غياب الحالة ← نسبة الدرجة ← الملاحظة الحالية في مدرستي. إذا كانت درجة الطالب صفرًا ولا توجد حالة تسليم واضحة فلن يسمح السكربت بالتطبيق حتى تحدد هل سلّم أم لم يسلّم.</span>
        <span class="${APP}-sub">الملف: ${esc(s.fileName)} · ورقة: ${esc(s.sheetName)} · صف العناوين: ${s.headerRow + 1}</span>
      </div>
      <div class="${APP}-toolbar"><button class="${APP}-btn ${APP}-primary" id="${APP}-rebuild-preview">تحديث المعاينة</button></div>
      <div id="${APP}-import-preview"></div>`;

    document.getElementById(`${APP}-rebuild-preview`)?.addEventListener('click', () => {
      syncImportSettingsFromUI();
      renderImportPreview();
    });
    renderImportPreview();
  };

  const readGradeFile = async (file) => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let aoa = [];
    let sheetName = 'Sheet1';

    if (ext === 'csv') {
      const text = await file.text();
      aoa = parseCsv(text.replace(/^\uFEFF/, ''));
      sheetName = 'CSV';
    } else {
      if (!globalThis.XLSX) throw new Error('مكتبة Excel لم تُحمّل. أعد تحميل الصفحة ثم جرّب مرة أخرى.');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('ملف Excel لا يحتوي أوراقًا قابلة للقراءة.');
      aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
    }

    if (!aoa.length) throw new Error('الملف فارغ.');
    const headerRow = detectHeaderRow(aoa);
    const headers = (aoa[headerRow] || []).map((x, i) => clean(x) || `عمود ${i + 1}`);
    const mapping = detectColumns(headers);
    if (mapping.score < 0) throw new Error('لم أتعرف على عمود الدرجة. يمكنك إعادة تسمية العمود إلى «الدرجة» أو Score.');

    const denominators = [];
    for (let i = headerRow + 1; i < Math.min(aoa.length, headerRow + 100); i++) {
      const p = parseScoreCell(importCell(aoa[i] || [], mapping.score));
      if (Number.isFinite(p.total) && p.total > 0) denominators.push(p.total);
    }
    const denomCounts = new Map();
    denominators.forEach(x => denomCounts.set(x, (denomCounts.get(x) || 0) + 1));
    const dominantDenom = [...denomCounts.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] || '';
    const headerDenom = num(String(headers[mapping.score] || '').match(/(?:\/|من|of)\s*(\d+(?:[.,]\d+)?)/i)?.[1]?.replace(',', '.'));
    const prefs = loadJSON(STORE.importPrefs, {});
    const targetTotal = targetTotalGrade();

    state.importSession = {
      fileName: file.name,
      sheetName,
      aoa,
      headerRow,
      headers,
      mapping,
      sourceTotal: dominantDenom || headerDenom || targetTotal || '',
      targetTotal,
      scale: prefs.scale ?? (!!dominantDenom && !!targetTotal && !nearlyEqual(dominantDenom, targetTotal)),
      roundStep: Number(prefs.roundStep || 0),
      allowUniqueName: !!prefs.allowUniqueName,
      autoFeedback: prefs.autoFeedback ?? true,
      zeroDecisions: {}
    };

    renderImportSession();
  };

  const openImportWizard = async () => {
    if (!state.gradeData) await refreshAll(false);
    if (!state.registry) await fetchStudentRegistry(false);
    if (!state.bridge) state.bridge = state.gradeData?.bridge || await buildIdentityBridge(false, state.gradeData?.students || []);

    showMainModal('استيراد درجات Excel / CSV', `
      <div class="${APP}-card ${APP}-notice">
        <b>استيراد ذكي وآمن</b>
        <div class="${APP}-sub">يدعم XLSX / XLS / CSV. لا تُكتب أي درجة قبل المعاينة والتأكيد. إذا وجد «حالة التسليم» في الملف يستخدمها لتمييز عدم التسليم عن التسليم بدرجة صفر. وإذا لم توجد حالة واضحة لأي طالب درجته صفر، يتوقف التطبيق حتى يقرر المعلم هل سلّم أم لم يسلّم. المطابقة بالحساب أو StudentId هي الأعلى ثقة، والأسماء المكررة لا تُحسم تلقائيًا.</div>
      </div>
      <div class="${APP}-drop" id="${APP}-drop">
        <input id="${APP}-grade-file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
        <b>اختر ملف الدرجات</b>
        <span>Excel أو CSV</span>
      </div>
      <div class="${APP}-toolbar"><button class="${APP}-btn" id="${APP}-show-backup">آخر نسخة احتياطية</button></div>`);

    const input = document.getElementById(`${APP}-grade-file`);
    input?.addEventListener('change', async () => {
      try {
        setBusy(true, 'جاري قراءة ملف الدرجات…');
        await readGradeFile(input.files?.[0]);
      } catch (e) {
        toast(String(e?.message || e), 'error');
      } finally {
        setBusy(false);
      }
    });
    document.getElementById(`${APP}-show-backup`)?.addEventListener('click', showLastImportBackup);
  };

  const globalGradeFormFields = () => {
    const form = document.querySelector('form#GradeAssignment');
    const out = [];
    if (!form) return out;

    [...form.elements].forEach(el => {
      if (!el.name || /^List\[/i.test(el.name)) return;
      if (el.disabled || ['button','submit','reset','file'].includes(el.type)) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      out.push([el.name, el.value ?? '']);
    });

    // مدرستي تضيف الحقول المخفية الموجودة في الصفحة عند الحفظ عبر AJAX.
    // نضيف الحقول العامة فقط ونستبعد List الحالية حتى لا تتعارض مع دفعة الاستيراد.
    document.querySelectorAll('input[type="hidden"][name]').forEach(el => {
      if (!el.name || /^List\[/i.test(el.name) || el.disabled) return;
      out.push([el.name, el.value ?? '']);
    });

    return out;
  };

  const buildGradePostData = (rows) => {
    const params = new URLSearchParams();
    globalGradeFormFields().forEach(([k,v]) => params.append(k, v));

    const preferred = ['AutoGrade','StudentId','TotalGrade','hasAnswer','SolvingType','Id','IsApproved','AnswerText','IsOutSideSystem','Grade','feedBack'];
    rows.forEach((row, index) => {
      const fields = { ...(row.rawFields || {}) };
      fields.StudentId = String(row.studentId || row.assignmentStudentId || fields.StudentId || '');
      fields.Id = row.studentAssignmentRecordId || row.recordId || fields.Id || '';
      fields.TotalGrade = Number.isFinite(row.maxGrade) ? row.maxGrade : (fields.TotalGrade ?? '');
      fields.Grade = Number.isFinite(row.currentGrade) ? row.currentGrade : '';
      fields.feedBack = row.feedback ?? fields.feedBack ?? '';

      const keys = [...new Set([...preferred, ...Object.keys(fields)])];
      keys.forEach(key => {
        if (!(key in fields)) return;
        const value = fields[key];
        if (value === undefined || value === null) return;
        params.append(`List[${index}].${key}`, String(value));
      });
    });
    return params;
  };

  const IMPORT_TRACE_KEY = 'MAI_GRADE_IMPORT_TRACE_V2';

  const safePostSummary = (url, body, rows) => {
    const entries = [];
    for (const [key, value] of body.entries()) {
      if (/RequestVerificationToken/i.test(key)) continue;
      if (/^List\[\d+\]\.(StudentId|Id|Grade|TotalGrade|AutoGrade|hasAnswer|IsApproved|SolvingType|feedBack|AnswerText)$/i.test(key) ||
          /^(SchoolId|Published|pageNumber|PublishedEndTime|hSchoolId)$/i.test(key)) {
        entries.push([key, String(value ?? '')]);
      }
    }
    return {
      at: new Date().toISOString(),
      url,
      rowCount: rows.length,
      students: rows.map(r => ({
        studentId: String(r.studentId || r.assignmentStudentId || ''),
        recordId: String(r.studentAssignmentRecordId || r.recordId || ''),
        grade: Number.isFinite(r.currentGrade) ? r.currentGrade : null,
        feedback: r.feedback || ''
      })),
      entries
    };
  };

  const appendGradeImportTrace = (event) => {
    let trace = [];
    try { trace = JSON.parse(sessionStorage.getItem(IMPORT_TRACE_KEY) || '[]'); } catch {}
    if (!Array.isArray(trace)) trace = [];
    trace.push(event);
    trace = trace.slice(-60);
    sessionStorage.setItem(IMPORT_TRACE_KEY, JSON.stringify(trace));
    globalThis.MAI_GRADE_IMPORT_TRACE = trace;
  };

  const postGradeRows = async (rows) => {
    // مهم: الحفظ اليدوي الحقيقي في مدرستي يرسل إلى location.href كاملاً
    // بما في ذلك SchoolId و published في query string. form.action لا يحتفظ بهما دائماً.
    const url = `${location.origin}${location.pathname}${location.search || ''}`;
    const body = buildGradePostData(rows);

    appendGradeImportTrace({ type: 'POST_PREPARED', ...safePostSummary(url, body, rows) });

    if (globalThis.jQuery?.ajax) {
      return new Promise((resolve, reject) => {
        globalThis.jQuery.ajax({
          url,
          method: 'POST',
          data: body.toString(),
          contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
          success: (data, textStatus, xhr) => {
            appendGradeImportTrace({
              type: 'POST_COMPLETE',
              at: new Date().toISOString(),
              url,
              status: xhr?.status || 200,
              responseLength: typeof data === 'string' ? data.length : JSON.stringify(data ?? '').length
            });
            resolve(data);
          },
          error: (xhr, status, err) => {
            appendGradeImportTrace({
              type: 'POST_ERROR',
              at: new Date().toISOString(),
              url,
              status: xhr?.status || 0,
              error: String(err || status || '')
            });
            reject(new Error(err || status || `HTTP ${xhr?.status || ''}`));
          }
        });
      });
    }

    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: body.toString()
    });
    const text = await res.text();
    appendGradeImportTrace({
      type: res.ok ? 'POST_COMPLETE' : 'POST_ERROR',
      at: new Date().toISOString(),
      url,
      status: res.status,
      responseLength: text.length
    });
    if (!res.ok) throw new Error(`فشل حفظ الدرجات (HTTP ${res.status}).`);
    return text;
  };

  async function fetchGradeRowsByStudentIds(studentIds) {
    const params = extractLoadStudentsParams();
    if (!params) throw new Error('تعذر قراءة إعدادات رصد الدرجات من الصفحة.');

    const ids = [...new Set((studentIds || []).map(String).filter(Boolean))].slice(0, 10);
    if (!ids.length) return [];

    const roster = assignmentRoster();
    const rosterMap = new Map(roster.map(r => [String(r.studentId || r.assignmentStudentId), r]));

    const response = await postForm('/Teacher/Assignments/GetGradeStudentsList', {
      ...params,
      pageNumber: 1,
      pageSize: 10,
      studentIds: ids,
      status: 'All',
      sortBy: 'name_asc'
    });

    return parseGradeStudentsHtml(responseHtml(response), rosterMap);
  }

  const chunkArray = (arr, size = 10) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const patchVisibleGradeFields = (changes) => {
    let patched = 0;
    for (const ch of changes) {
      const sid = String(ch.student.studentId || ch.student.assignmentStudentId || '');
      if (!sid) continue;

      const gradeInput = [...document.querySelectorAll('.gradeAssignment[data-student-id]')]
        .find(el => String(el.dataset.studentId || '') === sid);

      let index = null;
      if (gradeInput) {
        gradeInput.value = String(ch.newGrade);
        gradeInput.dispatchEvent(new Event('input', { bubbles: true }));
        gradeInput.dispatchEvent(new Event('change', { bubbles: true }));
        index = gradeInput.name?.match(/^List\[(\d+)\]\.Grade$/)?.[1] ?? null;
        patched++;
      } else {
        const hiddenStudent = [...document.querySelectorAll('input[type="hidden"][name$=".StudentId"]')]
          .find(el => String(el.value || '') === sid);
        index = hiddenStudent?.name?.match(/^List\[(\d+)\]\.StudentId$/)?.[1] ?? null;
      }

      if (index !== null && index !== undefined) {
        const feedback = document.querySelector(`[name="List[${index}].feedBack"]`);
        if (feedback && ch.nextFeedback !== undefined) {
          feedback.value = ch.nextFeedback ?? '';
          feedback.dispatchEvent(new Event('input', { bubbles: true }));
          feedback.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    return patched;
  };

  const saveImportBackup = (rows, changes, fileName) => {
    const ids = new Set(changes.map(c => String(c.student.studentId || c.student.assignmentStudentId)));
    const before = rows.filter(r => ids.has(String(r.studentId || r.assignmentStudentId))).map(r => ({
      studentId: String(r.studentId || r.assignmentStudentId),
      recordId: r.studentAssignmentRecordId || r.recordId || '',
      name: r.name,
      className: r.className,
      account: r.account,
      grade: r.currentGrade,
      feedback: r.feedback,
      isApproved: r.isApproved,
      maxGrade: r.maxGrade
    }));
    const backup = {
      version: VERSION,
      createdAt: new Date().toISOString(),
      pageUrl: location.href,
      assignment: extractLoadStudentsParams(),
      sourceFile: fileName,
      before
    };
    saveJSON(STORE.importBackup, backup);
    return backup;
  };

  const appendImportHistory = (entry) => {
    const history = loadJSON(STORE.importHistory, []);
    history.unshift(entry);
    saveJSON(STORE.importHistory, history.slice(0, 20));
  };

  // لا نستخدم window.confirm هنا لأن مدرستي قد تستبدله بنافذة غير متزامنة
  // ترجع undefined فوراً؛ وهذا كان يجعل applyImportPreview تنتهي قبل ضغط "نعم".
  const confirmImportApply = (message) => new Promise((resolve) => {
    const old = document.getElementById(`${APP}-import-confirm`);
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = `${APP}-import-confirm`;
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'background:rgba(17,24,39,.55)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:18px',
      'direction:rtl'
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'width:min(700px,96vw)',
      'background:#fff',
      'border-radius:18px',
      'box-shadow:0 24px 80px rgba(0,0,0,.3)',
      'padding:24px',
      'font-family:Tahoma,Arial,sans-serif',
      'color:#1f2937'
    ].join(';');

    const text = document.createElement('div');
    text.style.cssText = 'white-space:pre-line;font-size:16px;line-height:1.9;text-align:center;margin-bottom:22px';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:center;gap:12px';

    const yes = document.createElement('button');
    yes.type = 'button';
    yes.textContent = 'نعم';
    yes.style.cssText = 'border:0;border-radius:9px;padding:11px 28px;background:#198754;color:#fff;font-weight:700;cursor:pointer;font-size:16px';

    const no = document.createElement('button');
    no.type = 'button';
    no.textContent = 'لا';
    no.style.cssText = 'border:0;border-radius:9px;padding:11px 28px;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;font-size:16px';

    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };

    yes.addEventListener('click', () => finish(true), { once: true });
    no.addEventListener('click', () => finish(false), { once: true });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) finish(false);
    });

    actions.append(yes, no);
    box.append(text, actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    yes.focus();
  });

  async function applyImportPreview() {
    const preview = state.importPreview;
    const session = state.importSession;
    if (!preview || !session) return;

    if (preview.counts?.zeroDecision > 0) {
      return toast(`يوجد ${preview.counts.zeroDecision} طالبًا بدرجة صفر يحتاجون قرار «سلّم / لم يسلّم» قبل التطبيق.`, 'error');
    }

    const changes = preview.rows.filter(r => r.applicable);
    if (!changes.length) return toast('لا توجد تغييرات مؤكدة للتطبيق.', 'info');

    // نسجل دخول الدالة فوراً حتى يكون التشخيص واضحاً حتى قبل أي طلب شبكي.
    appendGradeImportTrace({
      type: 'APPLY_ENTER',
      at: new Date().toISOString(),
      changes: changes.length,
      visibleInputs: document.querySelectorAll('.gradeAssignment[data-student-id]').length
    });

    const changedCount = changes.filter(r => r.status === 'changed').length;
    appendGradeImportTrace({
      type: 'CONFIRM_OPEN',
      at: new Date().toISOString(),
      changes: changes.length
    });

    const ok = await confirmImportApply(
      `سيتم تطبيق ${changes.length} تغييرًا فقط من الصفوف المؤكدة.\n` +
      `${changedCount ? `منها ${changedCount} درجة ستتغير عن قيمة موجودة.\n` : ''}` +
      `سيتم حفظ نسخة احتياطية أولاً. بعد الموافقة ستظهر الدرجات والملاحظات في الخانات الظاهرة فورًا، ثم يبدأ الحفظ على مدرستي.\n\nمتابعة؟`
    );

    appendGradeImportTrace({
      type: 'CONFIRM_RESULT',
      at: new Date().toISOString(),
      confirmed: !!ok
    });
    if (!ok) return;

    // نظهر الدرجات في الصفحة الحالية أولاً وبشكل متزامن.
    // هذا السلوك مثبت بالفحص المباشر ويعطي المستخدم دليلاً فورياً أن المطابقة صحيحة.
    sessionStorage.setItem(IMPORT_TRACE_KEY, '[]');
    globalThis.MAI_GRADE_IMPORT_TRACE = [];
    appendGradeImportTrace({
      type: 'APPLY_CONFIRMED',
      at: new Date().toISOString(),
      changes: changes.length
    });
    const visiblePatched = patchVisibleGradeFields(changes);
    appendGradeImportTrace({
      type: 'VISIBLE_PATCH',
      at: new Date().toISOString(),
      patched: visiblePatched
    });

    setBusy(true, 'جاري تجهيز وحفظ درجات مدرستي…');
    try {
      const latest = await fetchAllGradeStudents();
      saveImportBackup(latest, changes, session.fileName);

      const changeBatches = chunkArray(changes, 10);
      const skipped = [];
      const batchErrors = [];
      let postedRowsCount = 0;

      for (let i = 0; i < changeBatches.length; i++) {
        const batchChanges = changeBatches[i];
        const ids = batchChanges
          .map(ch => String(ch.student.studentId || ch.student.assignmentStudentId || ''))
          .filter(Boolean);

        setBusy(true, `قراءة دفعة ${i + 1} من ${changeBatches.length} من مدرستي…`);

        // لا نبني List[] من بيانات مخزنة؛ نقرأ صفوف هؤلاء الطلاب مباشرة من endpoint
        // حتى تكون Id/StudentId/hasAnswer/IsApproved/SolvingType مطابقة للحظة الحفظ.
        const serverRows = await fetchGradeRowsByStudentIds(ids);
        const byId = new Map(serverRows.map(r => [String(r.studentId || r.assignmentStudentId), r]));
        const rowsToPost = [];

        for (const ch of batchChanges) {
          const sid = String(ch.student.studentId || ch.student.assignmentStudentId || '');
          const original = byId.get(sid);

          if (!original) {
            skipped.push({ sid, name: ch.student.name, reason: 'لم يرجع الطالب من GetGradeStudentsList لحظة الحفظ.' });
            continue;
          }

          const row = {
            ...original,
            rawFields: { ...(original.rawFields || {}) },
            currentGrade: ch.newGrade,
            achievedGrade: ch.newGrade,
            feedback: ch.nextFeedback ?? original.feedback ?? ''
          };

          row.rawFields.Grade = String(ch.newGrade);
          row.rawFields.feedBack = row.feedback;
          rowsToPost.push(row);
        }

        if (!rowsToPost.length) continue;

        setBusy(true, `حفظ دفعة ${i + 1} من ${changeBatches.length}…`);
        try {
          await postGradeRows(rowsToPost);
          postedRowsCount += rowsToPost.length;
        } catch (e) {
          batchErrors.push({ batch: i + 1, error: String(e?.message || e) });
          break;
        }
      }

      if (!postedRowsCount) {
        throw new Error('لم تصل أي دفعة قابلة للحفظ إلى مدرستي.');
      }

      setBusy(true, 'التحقق من الدرجات بعد الحفظ…');
      const verify = await fetchAllGradeStudents();
      const verifyMap = new Map(verify.map(r => [String(r.studentId || r.assignmentStudentId), r]));
      const mismatches = [];

      for (const ch of changes) {
        const sid = String(ch.student.studentId || ch.student.assignmentStudentId || '');
        const actual = verifyMap.get(sid)?.currentGrade ?? verifyMap.get(sid)?.achievedGrade ?? null;
        if (!Number.isFinite(actual) || !nearlyEqual(actual, ch.newGrade, 1e-4)) {
          mismatches.push({ sid, name: ch.student.name, expected: ch.newGrade, actual });
        }
      }

      appendGradeImportTrace({
        type: 'VERIFY',
        at: new Date().toISOString(),
        requested: changes.length,
        postedRowsCount,
        verified: changes.length - mismatches.length,
        mismatches
      });

      appendImportHistory({
        createdAt: new Date().toISOString(),
        sourceFile: session.fileName,
        attempted: changes.length,
        postedRowsCount,
        verified: changes.length - mismatches.length,
        visiblePatched,
        batches: changeBatches.length,
        skipped,
        batchErrors,
        mismatches
      });

      await refreshAll(false);
      patchVisibleGradeFields(changes.filter(ch => {
        const sid = String(ch.student.studentId || ch.student.assignmentStudentId || '');
        const actual = verifyMap.get(sid)?.currentGrade ?? verifyMap.get(sid)?.achievedGrade ?? null;
        return Number.isFinite(actual) && nearlyEqual(actual, ch.newGrade, 1e-4);
      }));

      if (batchErrors.length || skipped.length || mismatches.length) {
        showMainModal('نتيجة استيراد الدرجات', `
          <div class="${APP}-card"><b>اكتملت محاولة الحفظ مع وجود عناصر تحتاج مراجعة.</b>
            <div>المطلوب: ${changes.length}</div>
            <div>أُرسلت للسيرفر: ${postedRowsCount}</div>
            <div>تم التحقق من: ${changes.length - mismatches.length}</div>
            <div>غير متطابق بعد القراءة: ${mismatches.length}</div>
            <div>لم يرجع من خدمة الرصد: ${skipped.length}</div>
          </div>
          ${batchErrors.length ? `<div class="${APP}-danger-box"><b>خطأ في دفعة الحفظ:</b><div>${esc(batchErrors[0].error)}</div></div>` : ''}
          ${mismatches.length ? `<table class="${APP}-table"><thead><tr><th>الطالب</th><th>المتوقع</th><th>المقروء بعد الحفظ</th></tr></thead><tbody>
            ${mismatches.map(x => `<tr><td>${esc(x.name)}</td><td>${x.expected}</td><td>${x.actual ?? '—'}</td></tr>`).join('')}
          </tbody></table>` : ''}
          <div class="${APP}-toolbar"><button class="${APP}-btn" id="${APP}-copy-import-trace">نسخ سجل تشخيص الحفظ</button></div>`);

        document.getElementById(`${APP}-copy-import-trace`)?.addEventListener('click', async () => {
          const txt = sessionStorage.getItem(IMPORT_TRACE_KEY) || '[]';
          try { await navigator.clipboard.writeText(txt); toast('تم نسخ سجل التشخيص.', 'success'); }
          catch { prompt('انسخ السجل:', txt); }
        });
        toast('بعض الدرجات لم تُثبت؛ راجع نتيجة الاستيراد.', 'info');
      } else {
        showMainModal('تم استيراد الدرجات', `
          <div class="${APP}-success-box"><b>تم تطبيق والتحقق من ${changes.length} تغييرًا بنجاح.</b>
            <div>المصدر: ${esc(session.fileName)}</div>
            <div>أُرسلت ${postedRowsCount} خانة درجة/تغيير للسيرفر.</div>
            <div>الحفظ تم على ${changeBatches.length} دفعة/دفعات.</div>
            <div>حُفظت نسخة احتياطية قبل العملية.</div>
          </div>`);
        toast(`تم استيراد ${changes.length} درجة/تغيير بنجاح.`, 'success');
      }
    } catch (e) {
      appendGradeImportTrace({
        type: 'APPLY_ERROR',
        at: new Date().toISOString(),
        error: String(e?.message || e)
      });
      // لا نمسح القيم التي ظهرت في خانات الصفحة الحالية؛ يمكن للمستخدم حينها
      // حفظها بزر مدرستي الأصلي كخطة احتياطية بينما نعرض سبب فشل الحفظ الآلي.
      showMainModal('تعذر تطبيق درجات Excel', `
        <div class="${APP}-danger-box"><b>لم تكتمل عملية الحفظ.</b><div>${esc(String(e?.message || e))}</div></div>
        <div class="${APP}-card">تم الاحتفاظ بالمعاينة والنسخة الاحتياطية وسجل تشخيص الحفظ.</div>
        <div class="${APP}-toolbar"><button class="${APP}-btn" id="${APP}-copy-import-trace">نسخ سجل تشخيص الحفظ</button></div>`);

      document.getElementById(`${APP}-copy-import-trace`)?.addEventListener('click', async () => {
        const txt = sessionStorage.getItem(IMPORT_TRACE_KEY) || '[]';
        try { await navigator.clipboard.writeText(txt); toast('تم نسخ سجل التشخيص.', 'success'); }
        catch { prompt('انسخ السجل:', txt); }
      });
      toast(String(e?.message || e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const exportImportPreview = () => {
    const p = state.importPreview;
    if (!p) return;
    const data = p.rows.map(r => ({
      'صف الملف': r.sourceRowNumber,
      'اسم/هوية من الملف': clean(r.raw.name || r.raw.account || r.raw.studentId),
      'الطالب في مدرستي': r.student?.name || '',
      'الفصل': r.student?.className || '',
      'الحساب': r.student?.account || '',
      'StudentId': r.student?.studentId || r.student?.assignmentStudentId || '',
      'طريقة المطابقة': r.identity?.method || '',
      'الدرجة الحالية': r.existingGrade ?? '',
      'الدرجة الجديدة': r.newGrade ?? '',
      'حالة التسليم من الملف': r.submissionStatusRaw || '',
      'تصنيف التسليم': r.submissionStatusCode || '',
      'الملاحظة': r.nextFeedback || '',
      'مصدر الملاحظة': r.feedbackReason === 'submission' ? 'حالة التسليم' : r.feedbackReason === 'submitted-zero' ? 'تسليم بدرجة صفر' : r.feedbackSource === 'auto' ? 'نسبة الدرجة' : r.feedbackSource === 'file' ? 'ملف الاستيراد' : '',
      'الحالة': STATUS_META[r.status]?.[1] || r.status,
      'التنبيه': r.issue || ''
    }));
    if (globalThis.XLSX) {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Import Preview');
      XLSX.writeFile(wb, `madrasati-import-preview-${todayStamp()}.xlsx`);
    } else {
      const headers = Object.keys(data[0] || {});
      const lines = [headers.map(csvCell).join(','), ...data.map(r => headers.map(h => csvCell(r[h])).join(','))];
      downloadText(`madrasati-import-preview-${todayStamp()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8');
    }
  };

  const showLastImportBackup = () => {
    const b = loadJSON(STORE.importBackup);
    if (!b) return toast('لا توجد نسخة احتياطية محفوظة بعد.', 'info');
    showMainModal('آخر نسخة احتياطية قبل الاستيراد', `
      <div class="${APP}-card"><b>${esc(b.sourceFile || '—')}</b><div class="${APP}-sub">${esc(b.createdAt || '')} · ${b.before?.length || 0} طالب</div></div>
      <table class="${APP}-table"><thead><tr><th>الطالب</th><th>الفصل</th><th>الحساب</th><th>الدرجة السابقة</th><th>الملاحظة السابقة</th></tr></thead><tbody>
        ${(b.before || []).map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.className)}</td><td>${esc(x.account)}</td><td>${x.grade ?? '—'}</td><td>${esc(x.feedback)}</td></tr>`).join('')}
      </tbody></table>
      <div class="${APP}-toolbar"><button class="${APP}-btn" id="${APP}-download-backup">تنزيل النسخة JSON</button></div>`);
    document.getElementById(`${APP}-download-backup`)?.addEventListener('click', () => {
      downloadText(`madrasati-grade-backup-${todayStamp()}.json`, JSON.stringify(b, null, 2), 'application/json;charset=utf-8');
    });
  };

  // -----------------------------
  // Print / export
  // -----------------------------
  const printWindow = (title, bodyHtml) => {
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) throw new Error('المتصفح منع نافذة الطباعة.');

    w.document.write(`<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111827;margin:28px}
  h1,h2,h3{margin:0 0 14px}
  .meta{color:#6b7280;margin-bottom:20px}
  .q{border:1px solid #d1d5db;border-radius:12px;padding:16px;margin:14px 0;break-inside:avoid}
  .qhead{display:flex;justify-content:space-between;gap:12px;font-weight:700}
  .opts{margin:12px 0 0;padding:0;list-style:none}
  .opts li{padding:5px 0}
  .correct{font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #d1d5db;padding:7px;text-align:right}
  th{background:#f3f4f6}
  @media print{body{margin:12mm}.noprint{display:none}}
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">مدرستي — ${new Date().toLocaleString('en-GB')}</div>
${bodyHtml}
<script>window.onload=()=>window.print();<\/script>
</body>
</html>`);
    w.document.close();
  };

  async function printQuestions(answerKey = false) {
    const questions = await getQuestionTemplate();
    const html = questions.map(q => `
      <section class="q">
        <div class="qhead">
          <span>السؤال ${q.number}: ${esc(q.text)}</span>
          <span>${Number.isFinite(q.maxScore) ? `${q.maxScore} درجة` : ''}</span>
        </div>
        ${q.options?.length ? `
          <ul class="opts">
            ${q.options.map(o => `
              <li class="${answerKey && o.markedCorrect ? 'correct' : ''}">
                ${answerKey && o.markedCorrect ? '✓ ' : '○ '}${esc(o.text)}
              </li>`).join('')}
          </ul>` : ''}
        ${answerKey && q.correctText ? `<div class="correct">الإجابة الصحيحة: ${esc(q.correctText)}</div>` : ''}
      </section>`).join('');

    printWindow(answerKey ? 'نموذج إجابة الواجب' : 'أسئلة الواجب', html);
  }

  function printStudentsReport() {
    if (!state.gradeData) throw new Error('حدّث بيانات الواجب أولًا.');
    const mode = state.gradeData.assignmentMode;

    const rows = state.gradeData.students.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(s.name)}</td>
        <td>${esc(s.className)}</td>
        <td>${esc(s.account)}</td>
        <td>${esc(getStudentStatusLabel(s, mode))}</td>
        <td>${s.achievedGrade ?? ''}</td>
        <td>${s.maxGrade ?? ''}</td>
        <td>${s.gradeState === 'recorded' ? 'مرصود' : 'غير مرصود'}</td>
      </tr>`).join('');

    printWindow('تقرير طلاب الواجب', `
      <table>
        <thead><tr>
          <th>#</th><th>الطالب</th><th>الفصل</th><th>الحساب</th>
          <th>الحالة</th><th>الدرجة</th><th>من</th><th>الرصد</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  const exportRows = () => {
    if (!state.gradeData) throw new Error('حدّث بيانات الواجب أولًا.');
    const mode = state.gradeData.assignmentMode;
    return state.gradeData.students.map(s => {
      const percent = Number.isFinite(s.achievedGrade) && Number.isFinite(s.maxGrade) && s.maxGrade > 0
        ? Number(((s.achievedGrade / s.maxGrade) * 100).toFixed(2))
        : '';
      return {
        'الطالب': s.name,
        'الفصل': s.className,
        'حساب الطالب': s.account,
        'UserGuid': s.userGuid,
        'StudentId': s.studentId || s.assignmentStudentId,
        'StudentAssignmentRecordId': s.studentAssignmentRecordId || s.recordId,
        'الحالة': getStudentStatusLabel(s, mode),
        'حالة الرصد': s.gradeState === 'recorded' ? 'مرصود' : 'غير مرصود',
        'الدرجة': s.achievedGrade ?? '',
        'الدرجة الكلية': s.maxGrade ?? '',
        'النسبة': percent,
        'الملاحظة': s.feedback || '',
        'طريقة ربط الهوية': s.identityResolutionMethod || ''
      };
    });
  };

  function exportCSV() {
    const data = exportRows();
    const headers = Object.keys(data[0] || {});
    const lines = [headers.map(csvCell).join(',')];
    data.forEach(r => lines.push(headers.map(h => csvCell(r[h])).join(',')));
    downloadText(`madrasati-assignment-${todayStamp()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function exportExcel() {
    const data = exportRows();
    if (!globalThis.XLSX) {
      exportCSV();
      toast('تعذر تحميل مكتبة XLSX؛ تم التصدير CSV بدلًا منها.', 'info');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `madrasati-assignment-${todayStamp()}.xlsx`);
  }

  // -----------------------------
  // UI
  // -----------------------------
  const addStyles = () => {
    if (document.getElementById(`${APP}-style`)) return;
    const style = document.createElement('style');
    style.id = `${APP}-style`;
    style.textContent = `
      #${APP}-panel{direction:rtl;font-family:Tahoma,Arial,sans-serif;background:#fff;border:1px solid #e5e7eb;border-radius:16px;margin:16px 0;padding:16px;box-shadow:0 6px 22px rgba(0,0,0,.06)}
      #${APP}-panel *,.${APP}-modal *{box-sizing:border-box}
      .${APP}-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .${APP}-title{font-size:18px;font-weight:800;color:#111827}
      .${APP}-sub,.${APP}-tiny{font-size:12px;color:#6b7280;margin-top:3px}.${APP}-tiny{font-size:10px}
      .${APP}-status{font-size:12px;padding:6px 10px;border-radius:999px;background:#f3f4f6;color:#374151}
      .${APP}-status[data-busy="1"]{background:#fff7ed;color:#9a3412}
      .${APP}-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      .${APP}-btn{border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:10px;padding:8px 11px;font-size:12px;font-weight:700;cursor:pointer}
      .${APP}-btn:hover{background:#f9fafb}.${APP}-btn:disabled{opacity:.55;cursor:not-allowed}
      .${APP}-primary{background:#111827;color:#fff;border-color:#111827}.${APP}-primary:hover{background:#1f2937}
      #${APP}-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:14px}
      .${APP}-metric{border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fafafa}.${APP}-metric b{display:block;font-size:18px;color:#111827}.${APP}-metric span{font-size:11px;color:#6b7280}
      .${APP}-modal{position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px}
      .${APP}-modal[hidden]{display:none}.${APP}-dialog{direction:rtl;width:min(1280px,97vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      .${APP}-dialog-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.${APP}-close{border:0;background:#f3f4f6;border-radius:10px;padding:8px 12px;cursor:pointer}
      .${APP}-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.${APP}-card{border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:#fff}
      .${APP}-notice{background:#f8fafc}.${APP}-success-box{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:14px;padding:18px;line-height:1.9}
      .${APP}-table-wrap{max-height:52vh;overflow:auto;border:1px solid #e5e7eb;border-radius:12px;margin-top:10px}
      .${APP}-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}.${APP}-table-wrap .${APP}-table{margin-top:0}
      .${APP}-table th,.${APP}-table td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;vertical-align:top}.${APP}-table th{position:sticky;top:0;background:#f9fafb;z-index:1}
      .${APP}-bar{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:5px}.${APP}-bar>i{display:block;height:100%;background:currentColor}.${APP}-pill{display:inline-block;padding:3px 7px;border-radius:999px;background:#f3f4f6;font-size:10px}
      .${APP}-field{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700}.${APP}-field input,.${APP}-field select{width:100%;border:1px solid #d1d5db;border-radius:9px;padding:8px;background:#fff;font:12px Tahoma,Arial}
      .${APP}-checks{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:12px 0;padding:10px;border:1px dashed #d1d5db;border-radius:12px}.${APP}-checks label{font-size:12px;font-weight:700}
      .${APP}-drop{border:2px dashed #cbd5e1;border-radius:16px;padding:28px;text-align:center;margin-top:14px;position:relative;background:#f8fafc}.${APP}-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}.${APP}-drop b,.${APP}-drop span{display:block}.${APP}-drop span{font-size:12px;color:#64748b;margin-top:5px}
      .${APP}-import-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:12px}.${APP}-import-stats>div{border:1px solid #e5e7eb;border-radius:10px;padding:9px;background:#fafafa}.${APP}-import-stats b{display:block;font-size:18px}.${APP}-import-stats span{font-size:10px;color:#6b7280}
      .${APP}-status-pill{display:inline-block;border-radius:999px;padding:4px 7px;font-size:10px;white-space:nowrap}.${APP}-ready{background:#dcfce7}.${APP}-changed{background:#ffedd5}.${APP}-unchanged{background:#dbeafe}.${APP}-review{background:#fef9c3}.${APP}-ambiguous,.${APP}-duplicate{background:#f3e8ff}.${APP}-unmatched,.${APP}-invalid{background:#fee2e2}.${APP}-danger-text{color:#b91c1c}
      .${APP}-rights{border-top:1px solid #e5e7eb;margin-top:14px;padding-top:10px;font-size:10px;color:#6b7280;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.${APP}-rights a{color:inherit;text-decoration:none}
      #${APP}-toast{position:fixed;left:20px;bottom:20px;z-index:2147483647;opacity:0;transform:translateY(10px);transition:.2s;background:#111827;color:#fff;border-radius:10px;padding:10px 14px;font:12px Tahoma,Arial}
      #${APP}-toast.show{opacity:1;transform:none}#${APP}-toast.success{background:#065f46}#${APP}-toast.error{background:#991b1b}
      @media(max-width:1000px){#${APP}-summary,.${APP}-grid,.${APP}-import-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){#${APP}-summary,.${APP}-grid,.${APP}-import-stats{grid-template-columns:1fr}.${APP}-modal{padding:8px}}
    `;
    document.head.appendChild(style);
  };

  const findMount = () =>
    document.querySelector('main .container-fluid,main .container,main,.container-fluid,.container') || document.body;

  const renderSummaryInline = (data) => {
    const el = document.getElementById(`${APP}-summary`);
    if (!el) return;

    const s = data.summary;
    const mode = data.assignmentMode || s.assignmentMode || { key: 'unknown', label: 'غير محدد', rawSolvingTypes: [] };
    const fmt = v => v == null ? '—' : String(Number(v.toFixed ? v.toFixed(2) : v));
    const rawType = mode.rawSolvingTypes?.length ? ` | SolvingType: ${mode.rawSolvingTypes.join(', ')}` : '';

    if (mode.key === 'outside_system') {
      el.innerHTML = `
        <div class="${APP}-metric"><b>${s.total}</b><span>الطلاب</span></div>
        <div class="${APP}-metric"><b>${s.unverifiedSubmissionCount}</b><span>التسليم غير قابل للتحقق</span></div>
        <div class="${APP}-metric"><b>${s.graded}</b><span>درجات مرصودة</span></div>
        <div class="${APP}-metric"><b>${s.gradingRate}%</b><span>نسبة رصد الدرجات</span></div>
        <div class="${APP}-metric"><b>${fmt(s.averagePercent)}${s.averagePercent == null ? '' : '%'}</b><span>متوسط الدرجات المرصودة</span></div>
        <div class="${APP}-metric"><b>${data.bridge?.percentage ?? 0}%</b><span>ربط الهوية</span></div>
        <div class="${APP}-metric"><b style="font-size:13px">${esc(mode.label)}</b><span>نوع الواجب${esc(rawType)}</span></div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="${APP}-metric"><b>${s.total}</b><span>الطلاب</span></div>
      <div class="${APP}-metric"><b>${s.submittedCount ?? '—'}</b><span>تم الحل/التسليم</span></div>
      <div class="${APP}-metric"><b>${s.notSubmittedCount ?? '—'}</b><span>لم يحل</span></div>
      <div class="${APP}-metric"><b>${s.submissionRate ?? '—'}${s.submissionRate == null ? '' : '%'}</b><span>نسبة الإنجاز</span></div>
      <div class="${APP}-metric"><b>${s.graded}</b><span>درجات مرصودة</span></div>
      <div class="${APP}-metric"><b>${fmt(s.averagePercent)}${s.averagePercent == null ? '' : '%'}</b><span>متوسط الدرجات المرصودة</span></div>
      <div class="${APP}-metric"><b>${data.bridge?.percentage ?? 0}%</b><span>ربط الهوية</span></div>
      <div class="${APP}-metric"><b style="font-size:13px">${esc(mode.label)}</b><span>نوع الواجب${esc(rawType)}</span></div>
    `;
  };

  const openDashboard = () => {
    if (!state.gradeData) throw new Error('حدّث بيانات الواجب أولًا.');

    const s = state.gradeData.summary;
    const mode = state.gradeData.assignmentMode;
    const distMax = Math.max(1, ...s.distribution.map(x => x.count));
    const submissionCard = mode?.key === 'outside_system'
      ? `<div class="${APP}-card"><b>حالة التسليم</b><div style="font-size:20px;font-weight:800">غير قابلة للتحقق</div><div class="${APP}-sub">لا نستخدم hasAnswer في واجب خارج النظام.</div></div>`
      : `<div class="${APP}-card"><b>نسبة الإنجاز</b><div style="font-size:28px;font-weight:800">${s.submissionRate ?? '—'}%</div></div>`;

    const cards = `
      <div class="${APP}-grid">
        <div class="${APP}-card"><b>نوع الواجب</b><div style="font-size:15px;font-weight:800">${esc(mode?.label || 'غير محدد')}</div><div class="${APP}-sub">SolvingType: ${esc((mode?.rawSolvingTypes || []).join(', ') || '—')}</div></div>
        ${submissionCard}
        <div class="${APP}-card"><b>نسبة الدرجات المرصودة</b><div style="font-size:28px;font-weight:800">${s.gradingRate}%</div></div>
        <div class="${APP}-card"><b>متوسط الدرجات المرصودة</b><div style="font-size:28px;font-weight:800">${s.averagePercent == null ? '—' : `${s.averagePercent}%`}</div></div>
        <div class="${APP}-card"><b>الوسيط</b><div style="font-size:28px;font-weight:800">${s.medianPercent == null ? '—' : Number(s.medianPercent.toFixed(2))}%</div></div>
        <div class="${APP}-card"><b>الانحراف المعياري</b><div style="font-size:28px;font-weight:800">${s.stdDevPercent == null ? '—' : Number(s.stdDevPercent.toFixed(2))}</div></div>
      </div>
      <div class="${APP}-card" style="margin-top:10px">
        <b>توزيع الدرجات المرصودة</b>
        ${s.distribution.map(d => `<div style="margin-top:9px"><div style="display:flex;justify-content:space-between"><span>${d.label}%</span><span>${d.count}</span></div><div class="${APP}-bar"><i style="width:${(d.count / distMax) * 100}%"></i></div></div>`).join('')}
      </div>`;

    const tableRows = state.gradeData.students.map((st, i) => {
      const p = Number.isFinite(st.achievedGrade) && Number.isFinite(st.maxGrade) && st.maxGrade > 0
        ? Number(((st.achievedGrade / st.maxGrade) * 100).toFixed(2))
        : null;
      return `<tr data-search="${esc(norm(`${st.name} ${st.className} ${st.account} ${getStudentStatusLabel(st, mode)}`))}">
        <td>${i + 1}</td><td>${esc(st.name)}</td><td>${esc(st.className)}</td><td>${esc(st.account)}</td>
        <td>${esc(getStudentStatusLabel(st, mode))}</td><td>${st.achievedGrade ?? '—'} / ${st.maxGrade ?? '—'}</td><td>${p == null ? '—' : `${p}%`}</td><td>${esc(st.identityResolutionMethod || '—')}</td>
      </tr>`;
    }).join('');

    showMainModal('لوحة مدير الواجبات', `${cards}
      <div class="${APP}-toolbar"><input id="${APP}-dash-search" style="min-width:260px;border:1px solid #d1d5db;border-radius:10px;padding:8px" placeholder="بحث باسم الطالب أو الحساب أو الفصل"></div>
      <div class="${APP}-table-wrap"><table class="${APP}-table"><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحساب</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>ربط الهوية</th></tr></thead><tbody id="${APP}-dash-body">${tableRows}</tbody></table></div>`);

    document.getElementById(`${APP}-dash-search`)?.addEventListener('input', e => {
      const q = norm(e.target.value);
      document.querySelectorAll(`#${APP}-dash-body tr`).forEach(tr => {
        tr.hidden = q && !String(tr.dataset.search || '').includes(q);
      });
    });
  };

  const openQuestionAnalytics = async () => {
    const data = state.questionAnalytics || await runDeepQuestionAnalysis();
    const modal = document.getElementById(`${APP}-modal`);
    const body = document.getElementById(`${APP}-modal-body`);

    const rows = data.questions.map(q => `<tr>
      <td>${q.number}</td>
      <td>${esc(q.text)}</td>
      <td>${esc(q.type)}</td>
      <td>${q.attempts}</td>
      <td>${q.correct}</td>
      <td>${q.incorrect}</td>
      <td>${q.correctRate}%</td>
      <td>${q.difficulty}</td>
      <td>${esc(q.correctText)}</td>
    </tr>`).join('');

    body.innerHTML = `
      <div class="${APP}-card">
        <b>تحليل مستوى الأسئلة</b>
        <div class="${APP}-sub">الأسئلة ذات نسبة صحة أقل من 50% تستحق المراجعة وإعادة التدريس.</div>
      </div>
      <table class="${APP}-table">
        <thead><tr>
          <th>#</th><th>السؤال</th><th>النوع</th><th>المحاولات</th>
          <th>صحيح</th><th>خطأ</th><th>نسبة الصحة</th><th>الصعوبة</th><th>الإجابة الصحيحة</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    modal.hidden = false;
  };

  const injectUI = () => {
    if (document.getElementById(`${APP}-panel`)) return;
    addStyles();

    const panel = document.createElement('section');
    panel.id = `${APP}-panel`;
    panel.innerHTML = `
      <div class="${APP}-head">
        <div>
          <div class="${APP}-title">مدير الواجبات الذكي</div>
          <div class="${APP}-sub">هوية دقيقة + استيراد Excel/CSV + درجات + تقارير + تحليل — v${VERSION}</div>
        </div>
        <div id="${APP}-status" class="${APP}-status">جاهز</div>
      </div>

      <div class="${APP}-toolbar">
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="refresh">تحديث البيانات</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="identity">مزامنة الهوية</button>
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="importGrades">استيراد درجات Excel / CSV</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="dashboard">لوحة التحليل</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="questions">تحليل الأسئلة</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="printQuestions">طباعة الأسئلة</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="answerKey">نموذج الإجابة</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="printStudents">تقرير الطلاب</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="csv">CSV</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="excel">Excel</button>
      </div>

      <div id="${APP}-summary"></div>
      <div class="${APP}-rights">
        <span>تصميم وتطوير: <b>Mohammed Almalki (M0HM3D85)</b> · © 2026</span>
        <span><a href="https://greasyfork.org/en/users/1636459-m0hm3d85" target="_blank">GreasyFork</a> · <a href="https://x.com/M0HM3D85" target="_blank">X</a> · <a href="https://www.snapchat.com/add/M0HM3D85" target="_blank">Snapchat</a></span>
      </div>
    `;

    const mount = findMount();
    mount.insertBefore(panel, mount.firstChild);

    const modal = document.createElement('div');
    modal.id = `${APP}-modal`;
    modal.className = `${APP}-modal`;
    modal.hidden = true;
    modal.innerHTML = `
      <div class="${APP}-dialog">
        <div class="${APP}-dialog-head">
          <div class="${APP}-title" id="${APP}-modal-title">لوحة مدير الواجبات</div>
          <button class="${APP}-close" id="${APP}-close">إغلاق</button>
        </div>
        <div id="${APP}-modal-body"></div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', async e => {
      if (e.target === modal) {
        modal.hidden = true;
        return;
      }

      // تفويض أحداث أزرار النوافذ المتغيرة. هذا يمنع ضياع مستمع زر
      // تطبيق الدرجات عندما يعاد بناء HTML الخاص بالمعاينة.
      const btn = e.target.closest?.(`[data-${APP.toLowerCase()}-action]`);
      if (!btn || state.busy) return;

      const action = btn.dataset[`${APP.toLowerCase()}Action`];

      if (action === 'zeroDecision') {
        e.preventDefault();
        setZeroDecision(btn.dataset.zeroKey || '', btn.dataset.zeroValue || '');
        return;
      }

      if (action === 'zeroDecisionAll') {
        e.preventDefault();
        setAllPendingZeroDecisions(btn.dataset.zeroValue || '');
        return;
      }

      if (action === 'applyImport') {
        e.preventDefault();
        try {
          await applyImportPreview();
        } catch (err) {
          toast(String(err?.message || err), 'error');
        }
      }
    });
    document.getElementById(`${APP}-close`).onclick = () => { modal.hidden = true; };

    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest(`[data-${APP.toLowerCase()}-action]`);
      if (!btn || state.busy) return;
      const action = btn.dataset[`${APP.toLowerCase()}Action`];

      try {
        if (action === 'refresh') await refreshAll(false);
        else if (action === 'identity') {
          setBusy(true, 'جاري مزامنة جميع طلاب المدرسة…');
          try {
            const b = await buildIdentityBridge(true, state.gradeData?.students || []);
            toast(`تم ربط ${b.matched}/${b.total} طالبًا (${b.percentage}%).`, b.percentage === 100 ? 'success' : 'info');
          } finally {
            setBusy(false);
          }
        }
        else if (action === 'importGrades') await openImportWizard();
        else if (action === 'dashboard') openDashboard();
        else if (action === 'questions') await openQuestionAnalytics();
        else if (action === 'printQuestions') await printQuestions(false);
        else if (action === 'answerKey') await printQuestions(true);
        else if (action === 'printStudents') printStudentsReport();
        else if (action === 'csv') exportCSV();
        else if (action === 'excel') exportExcel();
      } catch (err) {
        toast(String(err?.message || err), 'error');
      }
    });

    const cached = loadJSON(STORE.snapshot);
    if (cached?.pageUrl === location.href) {
      state.gradeData = cached;
      state.bridge = cached.bridge || null;
      renderSummaryInline(cached);
    }
  };

  // -----------------------------
  // Auto behavior per page
  // -----------------------------
  const isGradeAssignment = /\/Teacher\/Assignments\/GradeAssignment\//i.test(location.pathname);
  const isMyStudents = /\/SchoolManagment\/Actions\/MyStudents/i.test(location.pathname);

  if (isGradeAssignment) {
    injectUI();
  }

  // On MyStudents we quietly preserve the current page registry fragment.
  // Full registry is fetched from GradeAssignment when needed.
  if (isMyStudents) {
    const cards = [...document.querySelectorAll('#studentsDiv .card.p-3')];
    if (cards.length) {
      globalThis.MADRASATI_STUDENT_PAGE = cards.map(parseStudentCard);
    }
  }

  // Expose safe inspection helpers.
  globalThis.MadrasatiAssignmentIntelligence = {
    version: VERSION,
    state,
    fetchStudentRegistry,
    buildIdentityBridge,
    fetchAllGradeStudents,
    detectAssignmentMode,
    resolveAssignmentStudentClass,
    refreshAll,
    getQuestionTemplate,
    runDeepQuestionAnalysis,
    openImportWizard,
    buildImportPreview,
    applyImportPreview,
    showLastImportBackup
  };
})();

    // Assignment intelligence v1.4.8 (search, analysis and report features).
/*
=========================================================================
 Madrasati Assignment Intelligence | مدير الواجبات الذكي — v1.4.8

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 هذا الإصدار يبني طبقة التحليل المتقدمة فوق النواة المستقرة v1.1.7
 المثبتة على commit محدد لضمان عدم تغير السلوك الأساسي دون قصد.

 v1.4.8:
 - إصلاح اسم الواجب في تقرير صفحة GradeAssignment بالاعتماد على عنوان بطاقة الواجب المرئي مباشرة وقت الطباعة.
 - تمرير اسم الواجب المحقق صراحة إلى رأس التقرير وعنوان نافذة الطباعة بدل الاعتماد على قيمة حالة قديمة.

 v1.4.6:
 - إصلاح نهائي لربط الفصل بالطالب باستخدام checkStudent-<StudentId> المؤكد من بنية مدرستي.
 - منع التقاط حاوية جميع الطلاب وتكرار أول فصل على الجميع.
 - تطبيق الفصل الصحيح على جدول الطلاب، فلتر الفصل، البطاقات، PDF، Excel وCSV.
 - إبطال كاش التحليل السابق حتى تُعاد قراءة الفصول الصحيحة مباشرة.

 v1.4.5:
 - إصلاح إسناد الفصل لكل طالب من صفه الفعلي في استجابة رصد الدرجات بدل التقاط فصل واحد للجميع.
 - إضافة تصفية حسب الفصل، مع دعم الواجب المسند لأكثر من فصل.
 - البطاقات ومستويات الطلاب وتقرير PDF وCSV وExcel تتبع التصفية الحالية.
 - تحليل الأسئلة في التقرير يتبع مجموعة الطلاب المفلترة عندما تتوفر نتائج الأسئلة.

 v1.4.4:
 - تصفية جدول الطلاب حسب حالة التسليم: سلّم / لم يسلّم / غير محسوم.
 - تصفية الطلاب حسب التقدير: ممتاز / جيد جدًا / جيد / مقبول / ضعيف / بدون تقدير.
 - فرز تفاعلي حسب الاسم، حالة التسليم، أو التقدير من الأعلى/الأدنى.
 - الإبقاء على الترتيب الأبجدي الافتراضي من أ إلى ي، مع زر لإعادة الضبط.

 v1.4.3:
 - تحليل واجبات خارج النظام اعتمادًا على الدرجة + ملاحظة المعلم بدل hasAnswer.
 - تمييز «سلّم وأخذ صفر» عن «لم يسلّم وأخذ صفر».
 - إظهار نسبة التسليم، لم يسلّم، وغير محسوم في اللوحة والتقارير.
 - فرز الطلاب أبجديًا من أ إلى ي في الشاشة والطباعة والتصدير.

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
=========================================================================
*/

(() => {
  'use strict';

  const APP = 'MAI';
  const VERSION = '2.0.0-beta1';
  const BASE_REQUIRED_VERSION = '1.1.7';
  const ENHANCED_CACHE_KEY = 'MAI_ENHANCED_ANALYSIS_V5';
  const PANEL_COLLAPSE_KEY = 'MAI_PANEL_COLLAPSED_V1';
  const INDEX_COLLAPSE_KEY = 'MAI_INDEX_PANEL_COLLAPSED_V1';
  const INDEX_PUBLICATIONS_CACHE_KEY = 'MAI_INDEX_PUBLICATIONS_V5';
  const INDEX_DEEP_CACHE_KEY = 'MAI_INDEX_DEEP_ANALYSIS_V7';
  const isGradeAssignment = /\/Teacher\/Assignments\/GradeAssignment\//i.test(location.pathname);
  const isAssignmentsIndex = /\/Teacher\/Assignments\/Index\//i.test(location.pathname);
  const isMyStudents = /\/SchoolManagment\/Actions\/MyStudents/i.test(location.pathname);

  const base = globalThis.MadrasatiAssignmentIntelligence || null;

  // صفحة GradeAssignment تعتمد على النواة المستقرة v1.1.7.
  // أما صفحة Index فلها لوحة مستقلة، لذلك لا نمنع تشغيلها إذا تعذر تحميل النواة لأي سبب.
  if (!base && isGradeAssignment) {
    console.error('[MAI v1.4.8] Base v1.1.7 was not loaded on GradeAssignment.');
    return;
  }

  // الصفحات الأخرى تكتفي بالنواة إن كانت متاحة.
  if (!isGradeAssignment && !isAssignmentsIndex) {
    try { if (base) base.version = VERSION; } catch {}
    return;
  }

  const state = base?.state || {};
  const clean = (v) => String(v ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const norm = (v) => clean(v)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase();
  const esc = (s) => clean(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const num = (v) => {
    const raw = String(v ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[^\d.-]/g, '');
    if (!raw || raw === '-' || raw === '.' || raw === '-.') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const pct = (a, b) => b ? Number(((a / b) * 100).toFixed(2)) : 0;
  const fmt = (v, digits = 2) => {
    if (!Number.isFinite(v)) return '—';
    return Number(v.toFixed(digits)).toString();
  };
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // -----------------------------
  // حالة نشر الواجب من نفس صفحة GradeAssignment
  // -----------------------------
  // مدرستي يضع وقت الخادم ووقت نهاية نشر الواجب في حقول مخفية:
  // #ServerDateTime و #PublishedEndTime.
  // نعتمد وقت الخادم بدل ساعة جهاز المعلم حتى لا تتأثر النتيجة بإعدادات الجهاز.
  const parseMadrasatiDateTime = (value) => {
    const raw = clean(value);
    if (!raw) return null;

    // الصيغة المرصودة في مدرستي: MM/DD/YYYY HH:mm:ss مع احتمال AM/PM.
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (m) {
      const month = Number(m[1]);
      const day = Number(m[2]);
      const year = Number(m[3]);
      let hour = Number(m[4]);
      const minute = Number(m[5]);
      const second = Number(m[6] || 0);
      const ampm = String(m[7] || '').toUpperCase();

      if (ampm === 'AM' && hour === 12) hour = 0;
      if (ampm === 'PM' && hour < 12) hour += 12;

      const d = new Date(year, month - 1, day, hour, minute, second, 0);
      if (
        d.getFullYear() === year &&
        d.getMonth() === month - 1 &&
        d.getDate() === day &&
        d.getHours() === hour &&
        d.getMinutes() === minute
      ) return d;
    }

    const fallback = new Date(raw);
    return Number.isFinite(fallback.getTime()) ? fallback : null;
  };

  const getDocumentInputValue = (doc, selector) => {
    const el = doc?.querySelector?.(selector);
    return clean(el?.value ?? el?.getAttribute?.('value') ?? '');
  };

  const getGradePublicationTiming = (doc = document) => {
    const serverRaw = getDocumentInputValue(doc, '#ServerDateTime');
    const endRaw = getDocumentInputValue(doc, '#PublishedEndTime');
    const serverDate = parseMadrasatiDateTime(serverRaw);
    const endDate = parseMadrasatiDateTime(endRaw);

    if (!serverDate || !endDate) {
      return {
        status: 'unknown',
        serverRaw,
        endRaw,
        serverDate,
        endDate,
        isEnded: null,
        remainingMs: null
      };
    }

    const isEnded = serverDate.getTime() >= endDate.getTime();
    return {
      status: isEnded ? 'ended' : 'receiving',
      serverRaw,
      endRaw,
      serverDate,
      endDate,
      isEnded,
      remainingMs: endDate.getTime() - serverDate.getTime()
    };
  };

  const formatGradeTimingDate = (date) => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '—';
    try {
      return date.toLocaleString('ar-SA-u-nu-latn', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return date.toLocaleString();
    }
  };

  const gradeReportGate = (doc = document) => {
    const timing = getGradePublicationTiming(doc);
    if (timing.status === 'ended') {
      return {
        ready: true,
        status: 'ended',
        timing,
        label: 'منتهي',
        message: 'انتهى وقت استقبال الحلول، والتقرير النهائي متاح.'
      };
    }

    if (timing.status === 'receiving') {
      return {
        ready: false,
        status: 'receiving',
        timing,
        label: 'قيد الاستقبال',
        message: `الواجب ما زال قيد استقبال الحلول حتى ${formatGradeTimingDate(timing.endDate)}. التقرير النهائي مؤجل حتى انتهاء الوقت.`
      };
    }

    return {
      ready: false,
      status: 'unknown',
      timing,
      label: 'غير متحقق',
      message: 'تعذر التحقق من وقت نهاية نشر الواجب من صفحة مدرستي؛ لن يتم إنشاء تقرير نهائي لتجنب بيانات غير مكتملة.'
    };
  };

  const assertFinalReportReady = () => {
    const gate = gradeReportGate(document);
    if (!gate.ready) throw new Error(gate.message);
    return gate;
  };

  const toast = (message, type = 'info') => {
    let box = document.getElementById(`${APP}-toast`);
    if (!box) {
      box = document.createElement('div');
      box.id = `${APP}-toast`;
      document.body.appendChild(box);
    }
    box.className = `${APP}-toast ${type}`;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box._maiTimer);
    box._maiTimer = setTimeout(() => box.classList.remove('show'), 3500);
  };

  const setStatus = (text, busy = false) => {
    const el = document.getElementById(`${APP}-status`);
    if (!el) return;
    el.textContent = text || 'جاهز';
    el.dataset.busy = busy ? '1' : '0';
  };

  const safeJSONParse = (text, fallback = null) => {
    try { return JSON.parse(text); } catch { return fallback; }
  };

  const loadEnhancedCache = () => {
    const cached = safeJSONParse(localStorage.getItem(ENHANCED_CACHE_KEY), null);
    if (!cached || cached.pageUrl !== location.href) return null;
    return cached;
  };

  const saveEnhancedCache = (analytics) => {
    try {
      const compact = {
        pageUrl: location.href,
        savedAt: new Date().toISOString(),
        analytics
      };
      localStorage.setItem(ENHANCED_CACHE_KEY, JSON.stringify(compact));
    } catch {}
  };

  const getMode = () => state.gradeData?.assignmentMode || { key: 'unknown', label: 'غير محدد', rawSolvingTypes: [] };
  const isOutsideSystem = () => getMode()?.key === 'outside_system' || (getMode()?.rawSolvingTypes || []).map(String).includes('3');
  const isOnlineQuestions = () => getMode()?.key === 'online_questions' || (getMode()?.rawSolvingTypes || []).map(String).includes('4') || (state.gradeData?.students || []).some(s => !!s.resultUrl || String(s.solvingType) === '4');

  const EPS = 1e-9;
  const nearlyEqual = (a, b, eps = EPS) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;

  // ترتيب عربي ثابت لجدول الطلاب والتقارير: أ ← ي.
  const arabicNameCollator = new Intl.Collator('ar-SA', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
    ignorePunctuation: true
  });

  const compareArabicNames = (a, b) => {
    const ak = norm(a);
    const bk = norm(b);
    const byNormalized = arabicNameCollator.compare(ak, bk);
    if (byNormalized) return byNormalized;
    return arabicNameCollator.compare(clean(a), clean(b));
  };

  // في SolvingType=3 لا تصلح hasAnswer لتمييز التسليم بعد الرصد؛
  // فقد أعاد الاختبار hasAnswer=true لجميع الطلاب حتى غير المسلّمين.
  // لذلك نعتمد الدرجة المباشرة + ملاحظة المعلم، مع إبقاء الحالات الملتبسة منفصلة.
  const outsideNotSubmittedFeedback = (value) => {
    const text = norm(value).replace(/[^\p{L}\p{N}\s]/gu, ' ');
    return /(?:لم\s*(?:يتم\s*)?تسليم|غير\s*مسلم|لم\s*يسلم|بدون\s*تسليم|لم\s*يؤد|لم\s*ينفذ|not\s*submitted|not\s*turned\s*in|no\s*submission|missing)/i.test(text);
  };

  const outsideSubmittedFeedback = (value) => {
    const text = norm(value).replace(/[^\p{L}\p{N}\s]/gu, ' ');
    if (!text || outsideNotSubmittedFeedback(text)) return false;
    return /(?:تم\s*التسليم|تم\s*تسليم|اكملت\s*التسليم|سلم\s*الواجب|submitted|turned\s*in|completed)/i.test(text);
  };

  const outsideDirectGrade = (student) => {
    const candidates = [
      student?.currentGrade,
      student?.gradeFieldValue,
      student?.resolvedGrade,
      student?.achievedGrade
    ];
    for (const value of candidates) {
      const n = num(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  const classifyOutsideSubmission = (student) => {
    const grade = outsideDirectGrade(student);
    const feedback = clean(student?.feedback ?? student?.rawFields?.feedBack ?? '');

    // الدرجة الموجبة دليل أقوى على إنجاز المهمة حتى لو كانت الملاحظة قديمة أو متعارضة.
    if (Number.isFinite(grade) && grade > 0) {
      return { key: 'submitted', label: 'سلّم', reason: 'positive_grade', grade, feedback };
    }

    // الصفر لا يعني عدم التسليم؛ نستخدم الملاحظة التي حُسمت عند الاستيراد.
    if (outsideNotSubmittedFeedback(feedback)) {
      return { key: 'not_submitted', label: 'لم يسلّم', reason: 'feedback_not_submitted', grade, feedback };
    }

    if (Number.isFinite(grade) && nearlyEqual(grade, 0)) {
      if (feedback) {
        return { key: 'submitted', label: 'سلّم وأخذ صفر', reason: 'zero_with_feedback', grade, feedback };
      }
      return { key: 'unknown', label: 'غير محسوم', reason: 'zero_without_feedback', grade, feedback };
    }

    if (outsideSubmittedFeedback(feedback)) {
      return { key: 'submitted', label: 'سلّم', reason: 'feedback_submitted', grade, feedback };
    }

    return { key: 'unknown', label: 'غير محسوم', reason: 'insufficient_evidence', grade, feedback };
  };

  const resolvedAchievedGrade = (student) => {
    const resultGrade = num(student?.resultGrade);
    if (Number.isFinite(resultGrade)) return resultGrade;
    return num(student?.achievedGrade);
  };

  const resolvedMaxGrade = (student) => {
    const resultMax = num(student?.resultMaxGrade);
    if (Number.isFinite(resultMax) && resultMax > 0) return resultMax;
    return num(student?.maxGrade);
  };

  const studentPercent = (student) => {
    const achieved = resolvedAchievedGrade(student);
    const total = resolvedMaxGrade(student);
    if (!Number.isFinite(achieved) || !Number.isFinite(total) || total <= 0) return null;
    return Number(((achieved / total) * 100).toFixed(2));
  };

  const computeEnhancedSummary = (sourceRows = null) => {
    const students = Array.isArray(sourceRows)
      ? sourceRows.map(row => row?.student || row).filter(Boolean)
      : (state.gradeData?.students || []);
    const outside = isOutsideSystem();
    const total = students.length;

    const outsideStates = outside
      ? students.map(s => ({ student: s, state: classifyOutsideSubmission(s) }))
      : [];

    const submitted = outside
      ? outsideStates.filter(x => x.state.key === 'submitted').map(x => x.student)
      : students.filter(s => s.submissionState === 'submitted' || s.hasAnswer === true);

    const notSubmittedCount = outside
      ? outsideStates.filter(x => x.state.key === 'not_submitted').length
      : Math.max(0, total - submitted.length);

    const unknownSubmissionCount = outside
      ? outsideStates.filter(x => x.state.key === 'unknown').length
      : 0;

    // نبقي متوسط الأداء متوافقًا مع الرصد: كل درجة مرصودة تدخل المتوسط،
    // بينما تصنيف «لم يسلّم» يظهر مستقلًا ولا يُخلط مع «سلّم وأخذ صفر».
    const scored = students
      .map(s => ({ s, achieved: resolvedAchievedGrade(s), max: resolvedMaxGrade(s) }))
      .filter(x => Number.isFinite(x.achieved) && Number.isFinite(x.max) && x.max > 0);

    const percents = scored.map(x => (x.achieved / x.max) * 100).filter(Number.isFinite);
    const averagePercent = percents.length ? percents.reduce((a,b) => a+b, 0) / percents.length : null;
    const discrepancies = students.filter(s => s.gradeDiscrepancy === true);

    return {
      total,
      submittedCount: submitted.length,
      notSubmittedCount,
      unknownSubmissionCount,
      submissionRate: pct(submitted.length, total),
      submissionAvailable: outside ? (submitted.length + notSubmittedCount > 0) : true,
      submissionMethod: outside ? 'grade_feedback_inference' : 'hasAnswer',
      graded: scored.length,
      gradingRate: pct(scored.length, total),
      averagePercent: Number.isFinite(averagePercent) ? Number(averagePercent.toFixed(2)) : null,
      highestPercent: percents.length ? Math.max(...percents) : null,
      lowestPercent: percents.length ? Math.min(...percents) : null,
      discrepancyCount: discrepancies.length
    };
  };

  const studentLevel = (student, mode = getMode()) => {
    const outside = mode?.key === 'outside_system';

    if (outside) {
      const submission = classifyOutsideSubmission(student);
      if (submission.key === 'not_submitted') {
        return { key: 'not-solved', label: 'لم يسلّم', rank: 7 };
      }
    } else if (student?.submissionState === 'not_submitted') {
      return { key: 'not-solved', label: 'لم يحل', rank: 7 };
    }

    const percent = studentPercent(student);
    if (!Number.isFinite(percent)) {
      if (outside) return { key: 'unverified', label: 'غير محسوم', rank: 8 };
      return { key: 'pending', label: 'بانتظار الرصد', rank: 8 };
    }

    if (percent >= 90) return { key: 'excellent', label: 'ممتاز', rank: 1 };
    if (percent >= 80) return { key: 'very-good', label: 'جيد جدًا', rank: 2 };
    if (percent >= 70) return { key: 'good', label: 'جيد', rank: 3 };
    if (percent > 50) return { key: 'acceptable', label: 'مقبول', rank: 4 };
    return { key: 'weak', label: 'ضعيف', rank: 5 };
  };

  const levelOrder = [
    ['excellent', 'ممتاز'],
    ['very-good', 'جيد جدًا'],
    ['good', 'جيد'],
    ['acceptable', 'مقبول'],
    ['weak', 'ضعيف'],
    ['not-solved', 'لم يحل'],
    ['pending', 'بانتظار الرصد'],
    ['unverified', 'غير مرصود']
  ];

  const computeStudentLevels = () => {
    const students = state.gradeData?.students || [];
    const mode = getMode();
    const counts = Object.fromEntries(levelOrder.map(([k]) => [k, 0]));
    const rows = students.map(s => {
      const level = studentLevel(s, mode);
      counts[level.key] = (counts[level.key] || 0) + 1;
      return { student: s, percent: studentPercent(s), level };
    });
    return { counts, rows, total: students.length };
  };

  const cleanOptionText = (text) => clean(text)
    .replace(/(?:الإجابة|الاجابة)\s+الصحيحة/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // -----------------------------
  // Parser v1.2.1: السؤال = أصغر حاوية محلية تحتوي qid واحدًا
  // ويعتمد StudentAssignmentResult على checked + success/fail + شارة الإجابة الصحيحة.
  // -----------------------------
  const findQuestionRootEnhanced = (qid) => {
    let node = qid?.parentElement || null;
    while (node) {
      const qidCount = node.querySelectorAll?.('input.qid')?.length || 0;
      const answerCount = node.querySelectorAll?.('input[id="qaid"],input.qaid')?.length || 0;
      if (qidCount === 1 && answerCount > 0) return node;
      node = node.parentElement;
    }
    return null;
  };

  const findOptionRootEnhanced = (aid, questionRoot) => {
    let node = aid?.parentElement || null;
    let best = node;
    while (node && node !== questionRoot) {
      const aidCount = node.querySelectorAll?.('input[id="qaid"],input.qaid')?.length || 0;
      const hasChoice = !!node.querySelector?.('input[type="radio"],input[type="checkbox"]');
      if (aidCount !== 1) break;
      if (hasChoice) best = node;
      node = node.parentElement;
    }
    return best;
  };

  const parseQuestionCardsEnhanced = (doc) => {
    const qids = [...doc.querySelectorAll('input.qid')];

    return qids.map((qid, index) => {
      const root = findQuestionRootEnhanced(qid);
      if (!root) return null;

      const qtype = root.querySelector('input.qidtype');
      const questionText = clean(
        root.querySelector('#divQuestion .eldetail')?.innerText ||
        root.querySelector('.qQuestion')?.innerText ||
        root.querySelector('#divQuestion')?.innerText ||
        ''
      );

      const rootText = clean(root.innerText || '');
      const maxScore =
        num(rootText.match(/درجة\s+السؤال\s*[:：]?\s*([\d٠-٩۰-۹.,]+)/i)?.[1]) ??
        num(rootText.match(/(?:الدرجة|درجة|نقطة|نقاط)\s*[:：]?\s*([\d٠-٩۰-۹.,]+)/i)?.[1]);

      const aids = [...root.querySelectorAll('input[id="qaid"],input.qaid')];
      const options = aids.map((aid, oi) => {
        const opt = findOptionRootEnhanced(aid, root) || aid.parentElement;
        const choiceInput = opt?.querySelector?.('input[type="radio"],input[type="checkbox"]') || null;
        const cs = opt?.querySelector?.('.cs-input') || opt;
        const classes = `${opt?.className || ''} ${cs?.className || ''}`.toLowerCase();
        const rawText = clean(opt?.innerText || cs?.innerText || '');
        const correctAnswerMarker =
          /(?:الإجابة|الاجابة)\s+الصحيحة/i.test(rawText) ||
          !!opt?.querySelector?.('.badge.status-4') ||
          [...(opt?.querySelectorAll?.('.badge,[class*="status-"]') || [])]
            .some(el => /(?:الإجابة|الاجابة)\s+الصحيحة/i.test(clean(el.innerText)));
        const selected = !!choiceInput?.checked;
        const selectedCorrect = selected && /\bsuccess\b/.test(classes);
        const selectedWrong = selected && /\bfail\b/.test(classes);

        return {
          index: oi + 1,
          answerId: clean(aid?.value || aid?.getAttribute?.('name') || ''),
          text: cleanOptionText(rawText),
          selected,
          selectedCorrect,
          selectedWrong,
          correctAnswerMarker,
          markedCorrect: correctAnswerMarker || selectedCorrect,
          markedWrong: selectedWrong,
          choiceType: choiceInput?.type || ''
        };
      });

      const selected = options.filter(o => o.selected);
      const correct = options.filter(o => o.markedCorrect);
      const answered = selected.length > 0;
      const typeValue = clean(qtype?.value || qtype?.getAttribute?.('name') || '');
      const reliableSingleChoice = ['0', '2', 'multiplechoice', 'truefalse'].includes(norm(typeValue));

      let isCorrect = null;
      if (!answered) {
        isCorrect = null;
      } else if (selected.some(o => o.selectedWrong)) {
        isCorrect = false;
      } else if (selected.length && selected.every(o => o.selectedCorrect)) {
        isCorrect = true;
      } else if (reliableSingleChoice && correct.length) {
        const identity = o => o.answerId || norm(o.text);
        const selectedIds = selected.map(identity).filter(Boolean).sort();
        const correctIds = correct.map(identity).filter(Boolean).sort();
        isCorrect = selectedIds.length === correctIds.length && JSON.stringify(selectedIds) === JSON.stringify(correctIds);
      }

      return {
        number: index + 1,
        questionId: clean(qid?.value || qid?.getAttribute?.('name') || ''),
        type: typeValue,
        text: questionText,
        maxScore,
        options,
        answered,
        selectedOptions: selected,
        correctOptions: correct,
        selectedText: selected.map(o => o.text).filter(Boolean).join('، '),
        correctText: correct.map(o => o.text).filter(Boolean).join('، '),
        isCorrect
      };
    }).filter(Boolean);
  };

  const parseResultSummaryEnhanced = (doc) => {
    const text = clean(doc?.body?.innerText || '');
    const scoreMatch = text.match(/درجة\s+الطالب\s*[:：]?\s*([\d٠-٩۰-۹.,]+)\s*من\s*([\d٠-٩۰-۹.,]+)/i);
    return {
      resultScore: num(scoreMatch?.[1]),
      resultMaxScore: num(scoreMatch?.[2]),
      resultCorrectCount: num(text.match(/عدد\s+الإجابات\s+الصحيحة\s*[:：]?\s*([\d٠-٩۰-۹]+)/i)?.[1]),
      resultWrongCount: num(text.match(/عدد\s+الإجابات\s+الخاطئة\s*[:：]?\s*([\d٠-٩۰-۹]+)/i)?.[1]),
      resultQuestionCount: num(text.match(/إجمالي\s+عدد\s+الأسئلة\s*[:：]?\s*([\d٠-٩۰-۹]+)/i)?.[1])
    };
  };

  const parseResultDocumentEnhanced = (doc, meta = {}) => ({
    ...meta,
    ...parseResultSummaryEnhanced(doc),
    questions: parseQuestionCardsEnhanced(doc)
  });

  const fetchTextDocument = async (url) => {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  };

  const extractLoadStudentsParamsEnhanced = () => {
    const fn = globalThis.loadStudents;
    if (typeof fn !== 'function') return null;
    const src = String(fn);
    const get = (key) => {
      const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return src.match(new RegExp(`${k}\\s*:\\s*['"]([^'"]*)['"]`))?.[1] ??
        src.match(new RegExp(`${k}\\s*:\\s*([\\d.]+)`))?.[1] ?? '';
    };
    return {
      schoolId: get('schoolId'), subjectId: get('subjectId'), teacherId: get('teacherId'), semesterId: get('semesterId'),
      assignmentId: get('assignmentId'), publishedAssignmentId: get('publishedAssignmentId'), lectureClassId: get('lectureClassId'),
      isGradebook: get('isGradebook'), isPublished: get('isPublished'), isCurrentTeacher: get('isCurrentTeacher'), isQuran: get('isQuran'),
      assigmentStarts: get('assigmentStarts'), grade: get('grade'), solvingType: get('solvingType')
    };
  };

  const postFormEnhanced = (url, data) => new Promise((resolve, reject) => {
    if (globalThis.jQuery?.post) {
      globalThis.jQuery.post(url, data).done(resolve).fail((xhr, status, err) => reject(new Error(err || status || `HTTP ${xhr?.status || ''}`)));
      return;
    }
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(data || {})) {
      if (Array.isArray(value)) value.forEach(v => body.append(key, v));
      else body.append(key, value ?? '');
    }
    fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); const text = await r.text(); try { resolve(JSON.parse(text)); } catch { resolve(text); } })
      .catch(reject);
  });

  const responseHtmlEnhanced = (response) => typeof response === 'string' ? response : (response?.html || '');

  // v1.4.6 — ربط الفصل بالطالب عبر checkStudent-<StudentId>.
  // فحص البنية الفعلية أثبت أن حقول List[index] قد تكون داخل حاوية مشتركة تضم كل الطلاب،
  // بينما checkbox الخاص بالطالب موجود داخل كتلة مرئية دقيقة لا تضم إلا طالبًا واحدًا.
  // لذلك نعتمد StudentId نفسه للوصول إلى checkStudent-<StudentId> ثم نصعد حتى أول كتلة
  // تحتوي «الفصل المدرسي» وبداخلها checkbox واحد فقط. هذا يمنع تكرار أول فصل على الجميع.
  const findStudentCheckboxEnhanced = (doc, studentId) => {
    const id = `checkStudent-${clean(studentId)}`;
    const byId = doc.getElementById(id);
    if (byId) return byId;

    // احتياط إذا تغير شكل id مع بقاء القيمة.
    return [...doc.querySelectorAll('input[id^="checkStudent-"]')]
      .find(el => clean(el.value) === clean(studentId)) || null;
  };

  const findGradeStudentVisualBlockEnhanced = (doc, index, studentId) => {
    const checkbox = findStudentCheckboxEnhanced(doc, studentId);

    // المسار الدقيق المؤكد بالفحص: checkbox الطالب -> كتلة الطالب المرئية.
    if (checkbox) {
      let node = checkbox;
      for (let depth = 0; depth < 15 && node; depth++, node = node.parentElement) {
        const text = clean(node.innerText || node.textContent || '');
        const checkboxesInside = node.querySelectorAll('input[id^="checkStudent-"]').length;
        if (checkboxesInside === 1 && /الفصل\s+المدرسي\s*:/i.test(text)) {
          return node;
        }
      }
    }

    // احتياط لبنى أخرى/قديمة: نعود لحقول List[index] لكن لا نقبل إلا حاوية لطالب واحد.
    const selectors = [
      `[name="List[${index}].Grade"]`,
      `[name="List[${index}].feedBack"]`,
      `[name="List[${index}].AnswerText"]`,
      `[name="List[${index}].StudentId"]`
    ];

    for (const selector of selectors) {
      const anchor = doc.querySelector(selector);
      if (!anchor) continue;
      let node = anchor;
      for (let depth = 0; depth < 14 && node; depth++, node = node.parentElement) {
        const text = clean(node.innerText || node.textContent || '');
        if (!/الفصل\s+المدرسي\s*:/i.test(text)) continue;

        const studentIdFields = node.querySelectorAll('[name^="List["][name$=".StudentId"]').length;
        const checkboxesInside = node.querySelectorAll('input[id^="checkStudent-"]').length;
        if (studentIdFields === 1 || checkboxesInside === 1) return node;
      }
    }

    return null;
  };

  const parseGradeStudentClassRowsEnhanced = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const groups = new Map();

    for (const el of doc.querySelectorAll('[name^="List["]')) {
      const m = el.name?.match(/^List\[(\d+)\]\.(.+)$/);
      if (!m) continue;
      const index = Number(m[1]);
      if (!groups.has(index)) groups.set(index, {});
      groups.get(index)[m[2]] = el.value;
    }

    const rows = [];
    for (const [index, fields] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const studentId = clean(fields.StudentId);
      if (!studentId) continue;

      const block = findGradeStudentVisualBlockEnhanced(doc, index, studentId);
      const blockText = clean(block?.innerText || block?.textContent || '');
      const className = blockText.match(
        /الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+الدرجة\s*:|\s+الإجابة\s*:|\s+ملاحظات|$)/i
      )?.[1]?.trim() || '';

      rows.push({
        index,
        studentId,
        className,
        classResolvedBy: block ? 'student-checkbox' : ''
      });
    }

    return rows;
  };

  async function repairStudentClassesEnhanced() {
    const students = state.gradeData?.students || [];
    if (!students.length) return { changed: 0, resolved: 0, classes: [] };

    const params = extractLoadStudentsParamsEnhanced();
    if (!params) return { changed: 0, resolved: 0, classes: [] };

    const classByStudent = new Map();
    let stagnant = 0;
    for (let pageNumber = 1; pageNumber <= 100; pageNumber++) {
      const response = await postFormEnhanced('/Teacher/Assignments/GetGradeStudentsList', {
        ...params,
        pageNumber,
        pageSize: 200,
        studentIds: '',
        status: '',
        sortBy: ''
      });
      const rows = parseGradeStudentClassRowsEnhanced(responseHtmlEnhanced(response));
      let added = 0;
      for (const row of rows) {
        if (!row.studentId || !row.className) continue;
        if (!classByStudent.has(String(row.studentId))) added++;
        classByStudent.set(String(row.studentId), row.className);
      }

      if (!rows.length) break;
      if (!added) stagnant++; else stagnant = 0;
      if (stagnant >= 2) break;
      const totalPages = Number(response?.totalPages);
      if (Number.isFinite(totalPages) && totalPages > 0 && pageNumber >= totalPages) break;
      if (rows.length < 200) break;
    }

    let changed = 0;
    let resolved = 0;
    for (const student of students) {
      const key = String(student.assignmentStudentId || student.studentId || '');
      const parsedClass = clean(classByStudent.get(key) || '');
      if (!parsedClass) continue;
      resolved++;
      if (norm(student.className || '') !== norm(parsedClass)) changed++;
      student.className = parsedClass;
      student.classNameSource = 'grade-row';
    }

    const classes = [...new Set(students.map(s => clean(s.className)).filter(Boolean))]
      .sort(compareArabicNames);

    return { changed, resolved, classes };
  }

  const resolveSingleStudentResultLink = async (student, params) => {
    const studentId = clean(student?.assignmentStudentId || student?.studentId || '');
    if (!studentId) return '';
    const response = await postFormEnhanced('/Teacher/Assignments/GetGradeStudentsList', {
      ...params, pageNumber: 1, pageSize: 10, studentIds: [studentId], status: '', sortBy: ''
    });
    const doc = new DOMParser().parseFromString(responseHtmlEnhanced(response), 'text/html');
    const link = doc.querySelector('a[href*="StudentAssignmentResult"]');
    return link ? new URL(link.getAttribute('href'), location.origin).href : '';
  };

  const resolveAccurateResultLinks = async (students) => {
    const params = extractLoadStudentsParamsEnhanced();
    if (!params) return students.filter(s => !!s.resultUrl);
    const submitted = students.filter(s => s.submissionState === 'submitted' || s.hasAnswer === true);
    const concurrency = 4;
    for (let i = 0; i < submitted.length; i += concurrency) {
      const batch = submitted.slice(i, i + concurrency);
      const links = await Promise.all(batch.map(async s => {
        try { return await resolveSingleStudentResultLink(s, params); }
        catch (e) { console.warn('[MAI v1.4.8] Could not resolve student result link:', e); return ''; }
      }));
      batch.forEach((s, j) => {
        if (links[j]) {
          s.resultUrl = links[j];
          s.resultUrlVerified = true;
        } else {
          s.resultUrlVerified = false;
          s.resultUrl = '';
        }
      });
    }
    return submitted.filter(s => !!s.resultUrl);
  };

  const fetchResultBatch = async (students, offset, total) => {
    const tasks = students.map(async (s, localIndex) => {
      const current = offset + localIndex + 1;
      setStatus(`تحليل إجابات الطلاب ${current}/${total}…`, true);
      try {
        const doc = await fetchTextDocument(s.resultUrl);
        return parseResultDocumentEnhanced(doc, {
          assignmentStudentId: String(s.assignmentStudentId || s.studentId || ''),
          name: s.name || '',
          className: s.className || '',
          achievedGrade: s.achievedGrade,
          maxGrade: s.maxGrade,
          resultUrl: s.resultUrl
        });
      } catch (e) {
        return {
          assignmentStudentId: String(s.assignmentStudentId || s.studentId || ''),
          name: s.name || '',
          className: s.className || '',
          error: String(e?.message || e),
          questions: []
        };
      }
    });
    return Promise.all(tasks);
  };

  const applyResultGradesToStudents = (results) => {
    const students = state.gradeData?.students || [];
    const byId = new Map(students.map(s => [String(s.assignmentStudentId || s.studentId || ''), s]));

    for (const result of results || []) {
      if (result?.error) continue;
      const student = byId.get(String(result.assignmentStudentId || ''));
      if (!student) continue;

      const resultGrade = num(result.resultScore);
      const resultMax = num(result.resultMaxScore);
      const pageGrade = num(student.currentGrade ?? student.achievedGrade);

      if (Number.isFinite(resultGrade)) {
        student.resultGrade = resultGrade;
        student.resultGradeSource = 'StudentAssignmentResult';
        student.achievedGrade = resultGrade;
        student.gradeState = 'recorded';
        if (student.submissionState === 'submitted') student.status = 'graded';
      }
      if (Number.isFinite(resultMax) && resultMax > 0) {
        student.resultMaxGrade = resultMax;
        student.maxGrade = resultMax;
      }

      student.resultCorrectCount = num(result.resultCorrectCount);
      student.resultWrongCount = num(result.resultWrongCount);
      student.resultQuestionCount = num(result.resultQuestionCount) ?? (result.questions || []).length;
      student.gradeFieldValue = pageGrade;
      student.gradeDiscrepancy = Number.isFinite(resultGrade) && Number.isFinite(pageGrade) && !nearlyEqual(resultGrade, pageGrade);
    }
  };

  const aggregateDeepAnalysis = (results) => {
    const questionMap = new Map();
    const studentMap = new Map();

    for (const result of results) {
      let detailCorrect = 0;
      let detailIncorrect = 0;
      let detailUnanswered = 0;
      let detailUnknown = 0;

      for (const q of result.questions || []) {
        const key = q.questionId || `n:${q.number}:${norm(q.text)}`;
        if (!questionMap.has(key)) {
          questionMap.set(key, {
            questionId: q.questionId,
            number: q.number,
            text: q.text,
            type: q.type,
            maxScore: q.maxScore,
            correctText: q.correctText,
            correctAnswerIds: new Set((q.correctOptions || []).map(o => o.answerId).filter(Boolean)),
            participants: 0,
            answered: 0,
            unanswered: 0,
            correct: 0,
            incorrect: 0,
            unknown: 0,
            wrongChoices: new Map()
          });
        }

        const agg = questionMap.get(key);
        if (!agg.text && q.text) agg.text = q.text;
        if (!agg.type && q.type) agg.type = q.type;
        if (!Number.isFinite(agg.maxScore) && Number.isFinite(q.maxScore)) agg.maxScore = q.maxScore;
        for (const option of q.correctOptions || []) if (option.answerId) agg.correctAnswerIds.add(option.answerId);
        if (!agg.correctText && q.correctText) agg.correctText = q.correctText;

        agg.participants++;
        if (q.answered) agg.answered++; else agg.unanswered++;

        if (q.isCorrect === true) {
          agg.correct++;
          detailCorrect++;
        } else if (q.isCorrect === false) {
          agg.incorrect++;
          detailIncorrect++;
          for (const option of q.selectedOptions || []) {
            if (option.selectedCorrect || option.correctAnswerMarker) continue;
            const optionKey = option.answerId || norm(option.text) || `unknown-${option.index}`;
            const current = agg.wrongChoices.get(optionKey) || { text: option.text || 'إجابة غير محددة', count: 0 };
            current.count++;
            agg.wrongChoices.set(optionKey, current);
          }
        } else if (!q.answered) {
          detailUnanswered++;
        } else {
          agg.unknown++;
          detailUnknown++;
        }
      }

      const summaryCorrect = num(result.resultCorrectCount);
      const summaryWrong = num(result.resultWrongCount);
      const summaryTotal = num(result.resultQuestionCount) ?? (result.questions || []).length;
      const useSummary = Number.isFinite(summaryCorrect) && Number.isFinite(summaryWrong);
      const correctCount = useSummary ? summaryCorrect : detailCorrect;
      const incorrectCount = useSummary ? summaryWrong : detailIncorrect;
      const unansweredCount = useSummary && Number.isFinite(summaryTotal)
        ? Math.max(0, summaryTotal - correctCount - incorrectCount)
        : detailUnanswered;

      studentMap.set(String(result.assignmentStudentId || ''), {
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        unknown: detailUnknown,
        totalQuestions: Number.isFinite(summaryTotal) ? summaryTotal : (result.questions || []).length,
        resultScore: num(result.resultScore),
        resultMaxScore: num(result.resultMaxScore),
        error: result.error || ''
      });
    }

    const questions = [...questionMap.values()].map(q => {
      const wrongList = [...q.wrongChoices.values()].sort((a, b) => b.count - a.count);
      const knownAnswered = q.correct + q.incorrect;
      const correctRate = pct(q.correct, knownAnswered);
      const masteryRate = pct(q.correct, q.participants);
      const correctAnswerIds = [...q.correctAnswerIds];
      return {
        questionId: q.questionId,
        number: q.number,
        text: q.text,
        type: q.type,
        maxScore: q.maxScore,
        correctText: q.correctText,
        correctAnswerIds,
        participants: q.participants,
        answered: q.answered,
        knownAnswered,
        unanswered: q.unanswered,
        correct: q.correct,
        incorrect: q.incorrect,
        unknown: q.unknown,
        correctRate,
        masteryRate,
        difficulty:
          knownAnswered === 0 ? 'غير محدد' :
          correctRate < 50 ? 'صعب' :
          correctRate < 75 ? 'متوسط' : 'سهل',
        mostCommonWrong: wrongList[0] || null,
        wrongChoices: wrongList
      };
    }).sort((a, b) => a.number - b.number);

    const answeredResponses = questions.reduce((sum, q) => sum + q.knownAnswered, 0);
    const correctResponses = questions.reduce((sum, q) => sum + q.correct, 0);
    const incorrectResponses = questions.reduce((sum, q) => sum + q.incorrect, 0);
    const unansweredResponses = questions.reduce((sum, q) => sum + q.unanswered, 0);
    const unknownResponses = questions.reduce((sum, q) => sum + q.unknown, 0);
    const known = questions.filter(q => q.knownAnswered > 0);
    const easiest = known.slice().sort((a, b) => b.correctRate - a.correctRate)[0] || null;
    const hardest = known.slice().sort((a, b) => a.correctRate - b.correctRate)[0] || null;

    return {
      generatedAt: new Date().toISOString(),
      results,
      questions,
      studentMap: Object.fromEntries(studentMap),
      summary: {
        resultStudents: results.filter(r => !r.error).length,
        failedResults: results.filter(r => !!r.error).length,
        questionCount: questions.length,
        answeredResponses,
        correctResponses,
        incorrectResponses,
        unansweredResponses,
        unknownResponses,
        correctRate: pct(correctResponses, answeredResponses),
        incorrectRate: pct(incorrectResponses, answeredResponses),
        responseRate: pct(answeredResponses, answeredResponses + unansweredResponses + unknownResponses),
        easiest,
        hardest
      }
    };
  };

  async function runDeepQuestionAnalysisEnhanced({ silent = false } = {}) {
    if (!state.gradeData) await base.refreshAll(false);
    const allStudents = state.gradeData?.students || [];
    const submitted = allStudents.filter(s => s.submissionState === 'submitted' || s.hasAnswer === true);
    if (!submitted.length) throw new Error('لا توجد نتائج طلاب قابلة لتحليل الأسئلة في هذا الواجب حتى الآن.');

    if (!silent) setStatus(`جاري تثبيت روابط نتائج ${submitted.length} طالب…`, true);
    const students = await resolveAccurateResultLinks(allStudents);
    if (!students.length) throw new Error('لم أتمكن من العثور على روابط نتائج الطلاب المحلين لهذا الواجب.');

    if (!silent) setStatus(`جاري تحليل ${students.length} نتيجة طالب…`, true);
    const results = [];
    const concurrency = 4;

    try {
      for (let i = 0; i < students.length; i += concurrency) {
        const batch = students.slice(i, i + concurrency);
        const part = await fetchResultBatch(batch, i, students.length);
        results.push(...part);
      }

      applyResultGradesToStudents(results);
      const analytics = aggregateDeepAnalysis(results);
      state.enhancedQuestionAnalytics = analytics;
      state.questionAnalytics = analytics;
      const first = results.find(r => !r.error && r.questions?.length);
      if (first) state.questions = first.questions;
      saveEnhancedCache(analytics);
      if (!silent) toast(`تم تحليل ${analytics.summary.resultStudents} نتيجة و${analytics.summary.questionCount} سؤال.`, 'success');
      return analytics;
    } finally {
      setStatus('جاهز', false);
    }
  }

  const getQuestionAnalytics = () => state.enhancedQuestionAnalytics || null;

  const findDetailsUrlEnhanced = () => {
    const a = [...document.querySelectorAll('a[href]')]
      .find(x => /تفاصيل\s+الواجب/i.test(clean(x.innerText || '')));
    return a ? new URL(a.getAttribute('href'), location.origin).href : '';
  };

  // -----------------------------
  // Assignment identity / title
  // -----------------------------
  // v1.1.7 used the first generic h1/h2/h3 on the page. Madrasati can keep
  // unrelated hidden/modal headings before the actual assignment title, which
  // is why text such as "نعم، أنا ولي أمر..." could leak into printed output.
  // Here we resolve the assignment name semantically and reject generic UI text.
  let assignmentNameCache = '';

  const cleanAssignmentNameCandidate = (value) => clean(value)
    .replace(/^(?:اسم|عنوان)\s+الواجب\s*[:：-]?\s*/i, '')
    .replace(/^[\s:：\-–—]+|[\s:：\-–—]+$/g, '')
    .trim();

  const isUsableAssignmentName = (value) => {
    const t = cleanAssignmentNameCandidate(value);
    if (!t || t.length < 2 || t.length > 140) return false;
    if (/نعم\s*[،,]?\s*أنا\s+ولي\s+أمر|الطالب\/الطالبة\s+الموضح|مدير\s+الواجبات|تفاصيل\s+النتيجة|إجمالي\s+عدد\s+الأسئلة|درجة\s+الطالب|ملاحظات\s+المعلم/i.test(t)) return false;
    if (/^(?:الواجب|الواجبات|تفاصيل\s+الواجب|رصد\s+درجات(?:\s+الواجب)?|أسئلة\s+الواجب|نموذج\s+إجابة\s+الواجب|تقرير\s+تحليل\s+الواجب|أسئلة\s+داخل\s+مدرستي)$/i.test(t)) return false;
    return true;
  };

  const extractAssignmentNameFromDocument = (doc) => {
    if (!doc) return '';

    const take = (value) => {
      const t = cleanAssignmentNameCandidate(value);
      return isUsableAssignmentName(t) ? t : '';
    };

    // 0) المصدر المؤكد في GradeAssignment: عنوان بطاقة الواجب نفسها.
    // لا نستخدم h1/h2/h3 العامة لأن صفحة مدرستي تحتوي عناوين نوافذ وسياسات كثيرة.
    const confirmedTitleNodes = [...doc.querySelectorAll(
      '.homeworks-management-section > .card-header h5.mb-0'
    )];

    const nodeVisible = (el) => {
      if (!el) return false;
      if (el.closest?.('[hidden],.d-none,[aria-hidden="true"]')) return false;
      if (doc !== document) return true;
      try {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
      } catch {
        return true;
      }
    };

    for (const el of confirmedTitleNodes) {
      const candidate = take(el.textContent || el.innerText || '');
      if (candidate && nodeVisible(el)) return candidate;
    }
    for (const el of confirmedTitleNodes) {
      const candidate = take(el.textContent || el.innerText || '');
      if (candidate) return candidate;
    }

    // احتياط مؤكد آخر ظهر في الجزء المختصر المخفي أعلى بطاقة الرصد.
    for (const el of doc.querySelectorAll('#mainDiv > .bg-light h5.mb-0')) {
      const candidate = take(el.textContent || el.innerText || '');
      if (candidate) return candidate;
    }

    // 1) حقول مخفية/مقروءة ذات اسم دلالي واضح.
    for (const el of doc.querySelectorAll('input,textarea,select')) {
      const key = `${el.id || ''} ${el.name || ''}`;
      if (!/(?:assignment|assigment).*(?:name|title)|(?:name|title).*(?:assignment|assigment)/i.test(key)) continue;
      const candidate = take(el.value || el.getAttribute('value') || '');
      if (candidate) return candidate;
    }

    // 2) ابحث عن تسمية "اسم الواجب" / "عنوان الواجب" وخذ القيمة المجاورة.
    const labels = [...doc.querySelectorAll('label,dt,th,strong,b,span,p,div')]
      .filter(el => {
        const t = clean(el.textContent || '');
        return t.length <= 45 && /^(?:اسم|عنوان)\s+الواجب\s*[:：]?$/i.test(t);
      });

    for (const label of labels) {
      const nearby = [
        label.nextElementSibling?.innerText,
        label.nextElementSibling?.textContent,
        label.parentElement?.querySelector?.('input,textarea,select')?.value,
        label.parentElement?.innerText
      ];
      for (const value of nearby) {
        if (!value) continue;
        let candidate = String(value);
        const match = candidate.match(/(?:اسم|عنوان)\s+الواجب\s*[:：]?\s*(.+?)(?=\s+(?:المادة|الفصل|الصف|نوع\s+الواجب|طريقة\s+الحل|الدرجة|درجة\s+الواجب|تاريخ|وقت|الوصف|الحالة)\s*[:：]?|$)/i);
        if (match) candidate = match[1];
        candidate = take(candidate);
        if (candidate) return candidate;
      }
    }

    // 3) النص الخام مع الحفاظ على الأسطر؛ مفيد عندما تكون القيمة نصًا بجوار label.
    const rawText = String(doc.body?.innerText || '').replace(/\u00a0/g, ' ');
    const lineMatch = rawText.match(/(?:اسم|عنوان)\s+الواجب\s*[:：]?\s*([^\r\n]{2,140})/i);
    if (lineMatch) {
      const candidate = take(lineMatch[1].split(/\s{2,}/)[0]);
      if (candidate) return candidate;
    }

    // 4) عناوين مرئية محددة، مع رفض العناوين العامة والنوافذ المخفية.
    const headingSelectors = [
      '[id*="assignment" i][id*="name" i]',
      '[id*="assignment" i][id*="title" i]',
      '[class*="assignment" i][class*="name" i]',
      '[class*="assignment" i][class*="title" i]',
      '.page-title', '.card-title', 'h1', 'h2', 'h3'
    ].join(',');

    const headingCandidates = [...doc.querySelectorAll(headingSelectors)]
      .map(el => ({
        text: take(el.innerText || el.textContent || ''),
        hidden: el.hidden || el.closest?.('[hidden],[aria-hidden="true"],.modal')?.hidden === true,
        len: clean(el.innerText || el.textContent || '').length
      }))
      .filter(x => x.text && !x.hidden)
      .sort((a, b) => a.text.length - b.text.length);

    if (headingCandidates.length) return headingCandidates[0].text;

    return '';
  };

  async function resolveAssignmentNameEnhanced({ allowFetch = true } = {}) {
    if (isUsableAssignmentName(assignmentNameCache)) return assignmentNameCache;

    let name = extractAssignmentNameFromDocument(document);

    // إذا تعذر من صفحة الرصد، استخدم صفحة تفاصيل الواجب فقط كاحتياط.
    if (!name && allowFetch) {
      const detailsUrl = findDetailsUrlEnhanced();
      if (detailsUrl) {
        try {
          const doc = await fetchTextDocument(detailsUrl);
          name = extractAssignmentNameFromDocument(doc);
        } catch (e) {
          console.warn('[MAI v1.4.8] Could not resolve assignment name from details page:', e);
        }
      }
    }

    if (!name && isUsableAssignmentName(state.gradeData?.title)) {
      name = cleanAssignmentNameCandidate(state.gradeData.title);
    }

    assignmentNameCache = name || 'واجب مدرستي';
    if (state.gradeData) {
      state.gradeData.assignmentName = assignmentNameCache;
      state.gradeData.title = assignmentNameCache;
    }
    const panelSub = document.querySelector(`#${APP}-panel .${APP}-sub`);
    if (panelSub && assignmentNameCache !== 'واجب مدرستي') {
      panelSub.textContent = `${assignmentNameCache} · تحليل الطلاب والأسئلة + تقارير PDF + استيراد ذكي — v${VERSION}`;
    }
    return assignmentNameCache;
  }

  const mergeAnswerKeyIntoQuestions = (questions, analytics) => {
    if (!analytics?.questions?.length) return questions;
    const keyMap = new Map(analytics.questions.map(q => [String(q.questionId || q.number), q]));
    return (questions || []).map(q => {
      const aq = keyMap.get(String(q.questionId || q.number));
      if (!aq) return q;
      const ids = new Set(aq.correctAnswerIds || []);
      const options = (q.options || []).map(o => ({
        ...o,
        markedCorrect: o.markedCorrect || (o.answerId && ids.has(o.answerId))
      }));
      const correctText = options.filter(o => o.markedCorrect).map(o => o.text).filter(Boolean).join('، ') || aq.correctText || q.correctText || '';
      return { ...q, options, correctOptions: options.filter(o => o.markedCorrect), correctText };
    });
  };

  async function getQuestionTemplateEnhanced({ requireAnswerKey = false } = {}) {
    let analytics = getQuestionAnalytics();
    if (requireAnswerKey && !analytics && isOnlineQuestions()) {
      try { analytics = await runDeepQuestionAnalysisEnhanced({ silent: true }); } catch {}
    }

    const firstResult = analytics?.results?.find(r => !r.error && r.questions?.length);
    if (firstResult) {
      const merged = mergeAnswerKeyIntoQuestions(firstResult.questions, analytics);
      if (!requireAnswerKey || merged.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText)) return merged;
    }

    const solved = (state.gradeData?.students || []).find(s => s.resultUrlVerified && s.resultUrl) ||
      (state.gradeData?.students || []).find(s => s.resultUrl);
    if (solved) {
      const doc = await fetchTextDocument(solved.resultUrl);
      const questions = mergeAnswerKeyIntoQuestions(parseQuestionCardsEnhanced(doc), analytics);
      if (questions.length && (!requireAnswerKey || questions.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText))) return questions;
    }

    const detailsUrl = findDetailsUrlEnhanced();
    if (detailsUrl) {
      const doc = await fetchTextDocument(detailsUrl);
      const questions = mergeAnswerKeyIntoQuestions(parseQuestionCardsEnhanced(doc), analytics);
      if (questions.length) {
        if (requireAnswerKey && !questions.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText)) {
          throw new Error('تعذر استنتاج مفتاح الإجابة لجميع الأسئلة من النتائج الحالية.');
        }
        return questions;
      }
    }

    const current = mergeAnswerKeyIntoQuestions(parseQuestionCardsEnhanced(document), analytics);
    if (current.length) {
      if (requireAnswerKey && !current.every(q => (q.options || []).some(o => o.markedCorrect) || q.correctText)) {
        throw new Error('تعذر استنتاج مفتاح الإجابة لجميع الأسئلة من النتائج الحالية.');
      }
      return current;
    }

    if (requireAnswerKey) throw new Error('لا يمكن إنشاء نموذج الإجابة قبل توفر نتيجة طالب تكشف مفتاح الإجابة.');
    throw new Error('لم أتمكن من العثور على بنية الأسئلة في الصفحات المتاحة.');
  };


  // -----------------------------
  // بناء التحليلات المرئية
  // -----------------------------
  const studentQuestionStats = (student) => {
    const analytics = getQuestionAnalytics();
    if (!analytics) return null;
    const key = String(student.assignmentStudentId || student.studentId || '');
    return analytics.studentMap?.[key] || null;
  };

  const getStatusLabel = (student) => {
    const mode = getMode();
    if (mode.key === 'outside_system') {
      const submission = classifyOutsideSubmission(student);
      if (submission.key === 'not_submitted') return 'لم يسلّم';
      if (submission.key === 'submitted') {
        if (Number.isFinite(outsideDirectGrade(student))) return nearlyEqual(outsideDirectGrade(student), 0) ? 'سلّم / درجة صفر' : 'سلّم / درجة مرصودة';
        return 'سلّم / بانتظار الرصد';
      }
      return 'غير محسوم';
    }
    if (student.submissionState === 'not_submitted') return 'لم يحل';
    if (student.gradeState === 'recorded') return 'تم الحل / مصحح';
    if (student.submissionState === 'submitted') return 'تم الحل / بانتظار الرصد';
    return 'غير محدد';
  };

  // تقارير الطلاب والجداول والتصدير مرتبة افتراضيًا أبجديًا من أ إلى ي.
  const performanceRows = () => {
    const { rows } = computeStudentLevels();
    return rows.sort((a, b) => {
      const byName = compareArabicNames(a.student?.name || '', b.student?.name || '');
      if (byName) return byName;
      const byClass = compareArabicNames(a.student?.className || '', b.student?.className || '');
      if (byClass) return byClass;
      return String(a.student?.studentId || a.student?.assignmentStudentId || '')
        .localeCompare(String(b.student?.studentId || b.student?.assignmentStudentId || ''));
    });
  };

  // v1.4.5 — المرشحات تمثل "سياق التقرير" الحالي، وليست مجرد عرض للجدول.
  // لذلك البطاقات، مستويات الطلاب، PDF، CSV وExcel تتبع المجموعة المفلترة نفسها.
  const studentViewState = {
    className: 'all',
    submission: 'all',
    level: 'all',
    sort: 'name_asc'
  };

  const availableStudentClasses = () => [...new Set(
    (state.gradeData?.students || []).map(s => clean(s.className)).filter(Boolean)
  )].sort(compareArabicNames);

  const isStudentViewFiltered = () =>
    studentViewState.className !== 'all' ||
    studentViewState.submission !== 'all' ||
    studentViewState.level !== 'all';

  const studentSubmissionKey = (student) => {
    if (isOutsideSystem()) return classifyOutsideSubmission(student).key;
    if (student?.submissionState === 'not_submitted') return 'not_submitted';
    if (student?.submissionState === 'submitted' || student?.hasAnswer === true) return 'submitted';
    return 'unknown';
  };

  const performanceLevelRank = (key) => ({
    excellent: 1,
    'very-good': 2,
    good: 3,
    acceptable: 4,
    weak: 5
  }[key] ?? 99);

  const isRatedLevel = (key) => performanceLevelRank(key) < 99;

  const compareRowNames = (a, b) => {
    const byName = compareArabicNames(a.student?.name || '', b.student?.name || '');
    if (byName) return byName;
    const byClass = compareArabicNames(a.student?.className || '', b.student?.className || '');
    if (byClass) return byClass;
    return String(a.student?.studentId || a.student?.assignmentStudentId || '')
      .localeCompare(String(b.student?.studentId || b.student?.assignmentStudentId || ''));
  };

  const studentViewRows = () => {
    let rows = performanceRows();

    if (studentViewState.className !== 'all') {
      rows = rows.filter(row => norm(row.student?.className || '') === norm(studentViewState.className));
    }

    if (studentViewState.submission !== 'all') {
      rows = rows.filter(row => studentSubmissionKey(row.student) === studentViewState.submission);
    }

    if (studentViewState.level === 'unrated') {
      rows = rows.filter(row => !isRatedLevel(row.level?.key));
    } else if (studentViewState.level !== 'all') {
      rows = rows.filter(row => row.level?.key === studentViewState.level);
    }

    const sort = studentViewState.sort;
    rows = rows.slice().sort((a, b) => {
      if (sort === 'name_desc') return -compareRowNames(a, b);

      if (sort === 'submission_submitted') {
        const rank = { submitted: 1, not_submitted: 2, unknown: 3 };
        const diff = (rank[studentSubmissionKey(a.student)] ?? 9) - (rank[studentSubmissionKey(b.student)] ?? 9);
        return diff || compareRowNames(a, b);
      }

      if (sort === 'submission_not_submitted') {
        const rank = { not_submitted: 1, unknown: 2, submitted: 3 };
        const diff = (rank[studentSubmissionKey(a.student)] ?? 9) - (rank[studentSubmissionKey(b.student)] ?? 9);
        return diff || compareRowNames(a, b);
      }

      if (sort === 'level_high' || sort === 'level_low') {
        const ar = performanceLevelRank(a.level?.key);
        const br = performanceLevelRank(b.level?.key);
        // الحالات بلا تقدير تبقى في نهاية القائمة في الاتجاهين.
        if (ar === 99 && br !== 99) return 1;
        if (br === 99 && ar !== 99) return -1;
        if (ar !== br) return sort === 'level_high' ? ar - br : br - ar;

        const ap = Number.isFinite(a.percent) ? a.percent : null;
        const bp = Number.isFinite(b.percent) ? b.percent : null;
        if (ap !== null && bp !== null && ap !== bp) return sort === 'level_high' ? bp - ap : ap - bp;
        return compareRowNames(a, b);
      }

      return compareRowNames(a, b);
    });

    return rows;
  };

  const studentFilterContextLabel = () => {
    const parts = [];
    if (studentViewState.className !== 'all') parts.push(`الفصل: ${studentViewState.className}`);
    if (studentViewState.submission !== 'all') {
      const outside = isOutsideSystem();
      const labels = outside
        ? { submitted: 'سلّم', not_submitted: 'لم يسلّم', unknown: 'غير محسوم' }
        : { submitted: 'حلّ الواجب', not_submitted: 'لم يحل', unknown: 'غير محدد' };
      parts.push(`التسليم: ${labels[studentViewState.submission] || studentViewState.submission}`);
    }
    if (studentViewState.level !== 'all') {
      const labels = {
        excellent: 'ممتاز', 'very-good': 'جيد جدًا', good: 'جيد',
        acceptable: 'مقبول', weak: 'ضعيف', unrated: 'بدون تقدير'
      };
      parts.push(`التقدير: ${labels[studentViewState.level] || studentViewState.level}`);
    }
    return parts.length ? parts.join(' · ') : 'جميع الطلاب';
  };

  const getFilteredQuestionAnalytics = (rows = studentViewRows()) => {
    const analytics = getQuestionAnalytics();
    if (!analytics?.results) return analytics;
    if (!isStudentViewFiltered()) return analytics;

    const ids = new Set(rows.map(row => String(
      row.student?.assignmentStudentId || row.student?.studentId || ''
    )).filter(Boolean));
    const filteredResults = analytics.results.filter(result => ids.has(String(result.assignmentStudentId || '')));
    return aggregateDeepAnalysis(filteredResults);
  };

  const studentFilterControlsHtml = () => {
    const outside = isOutsideSystem();
    const rows = studentViewRows();
    const total = performanceRows().length;
    const submissionLabels = outside
      ? { submitted: 'سلّم', not_submitted: 'لم يسلّم', unknown: 'غير محسوم' }
      : { submitted: 'حلّ الواجب', not_submitted: 'لم يحل', unknown: 'غير محدد' };

    const selected = (actual, expected) => actual === expected ? ' selected' : '';
    const classes = availableStudentClasses();

    return `
      <div class="${APP}-student-tools" data-mai-student-tools>
        <label><span>الفصل</span><select data-mai-student-class>
          <option value="all"${selected(studentViewState.className, 'all')}>كل الفصول</option>
          ${classes.map(className => `<option value="${esc(className)}"${selected(studentViewState.className, className)}>${esc(className)}</option>`).join('')}
        </select></label>
        <label><span>التسليم</span><select data-mai-student-submission>
          <option value="all"${selected(studentViewState.submission, 'all')}>الكل</option>
          <option value="submitted"${selected(studentViewState.submission, 'submitted')}>${esc(submissionLabels.submitted)}</option>
          <option value="not_submitted"${selected(studentViewState.submission, 'not_submitted')}>${esc(submissionLabels.not_submitted)}</option>
          <option value="unknown"${selected(studentViewState.submission, 'unknown')}>${esc(submissionLabels.unknown)}</option>
        </select></label>
        <label><span>التقدير</span><select data-mai-student-level>
          <option value="all"${selected(studentViewState.level, 'all')}>الكل</option>
          <option value="excellent"${selected(studentViewState.level, 'excellent')}>ممتاز</option>
          <option value="very-good"${selected(studentViewState.level, 'very-good')}>جيد جدًا</option>
          <option value="good"${selected(studentViewState.level, 'good')}>جيد</option>
          <option value="acceptable"${selected(studentViewState.level, 'acceptable')}>مقبول</option>
          <option value="weak"${selected(studentViewState.level, 'weak')}>ضعيف</option>
          <option value="unrated"${selected(studentViewState.level, 'unrated')}>بدون تقدير</option>
        </select></label>
        <label><span>الفرز</span><select data-mai-student-sort>
          <option value="name_asc"${selected(studentViewState.sort, 'name_asc')}>الاسم: أ ← ي</option>
          <option value="name_desc"${selected(studentViewState.sort, 'name_desc')}>الاسم: ي ← أ</option>
          <option value="submission_submitted"${selected(studentViewState.sort, 'submission_submitted')}>التسليم: المسلّم أولًا</option>
          <option value="submission_not_submitted"${selected(studentViewState.sort, 'submission_not_submitted')}>التسليم: غير المسلّم أولًا</option>
          <option value="level_high"${selected(studentViewState.sort, 'level_high')}>التقدير: الأعلى أولًا</option>
          <option value="level_low"${selected(studentViewState.sort, 'level_low')}>التقدير: الأدنى أولًا</option>
        </select></label>
        <button type="button" class="${APP}-student-reset" data-mai-student-reset>إعادة الضبط</button>
        <div class="${APP}-student-count" data-mai-student-count>عرض ${rows.length} من ${total}</div>
      </div>`;
  };

  const metricHtml = (value, label, hint = '') => `
    <div class="${APP}-metric ${APP}-metric-v12">
      <b>${value}</b><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}
    </div>`;

  const levelCardsHtml = (rows = studentViewRows()) => {
    const counts = Object.fromEntries(levelOrder.map(([key]) => [key, 0]));
    for (const row of rows) counts[row.level?.key] = (counts[row.level?.key] || 0) + 1;
    const total = rows.length;
    const outside = isOutsideSystem();
    const visible = levelOrder.filter(([key]) => (counts[key] || 0) > 0 || ['excellent','very-good','good','acceptable','weak','not-solved'].includes(key));
    return visible.map(([key, label]) => {
      const displayLabel = outside && key === 'not-solved' ? 'لم يسلّم' : outside && key === 'unverified' ? 'غير محسوم' : label;
      return `
      <div class="${APP}-level-card ${APP}-level-${key}">
        <strong>${counts[key] || 0}</strong>
        <span>${esc(displayLabel)}</span>
        <small>${total ? pct(counts[key] || 0, total) : 0}% من المعروض</small>
      </div>`;
    }).join('');
  };

  const questionSummaryCardsHtml = (a = getFilteredQuestionAnalytics()) => {
    if (!a) {
      return `<div class="${APP}-analysis-note">تحليل الأسئلة سيظهر بعد جمع نتائج الطلاب. استخدم «تحديث التحليل».</div>`;
    }
    const s = a.summary;
    return `
      <div class="${APP}-question-metrics">
        ${metricHtml(s.questionCount, 'عدد الأسئلة')}
        ${metricHtml(`${fmt(s.correctRate)}%`, 'الإجابات الصحيحة')}
        ${metricHtml(`${fmt(s.incorrectRate)}%`, 'الإجابات الخاطئة')}
        ${metricHtml(s.unansweredResponses, 'إجابات متروكة')}
        ${metricHtml(s.hardest ? `س${s.hardest.number}` : '—', 'أصعب سؤال', s.hardest ? `${fmt(s.hardest.correctRate)}% صحة` : '')}
        ${metricHtml(s.easiest ? `س${s.easiest.number}` : '—', 'أسهل سؤال', s.easiest ? `${fmt(s.easiest.correctRate)}% صحة` : '')}
      </div>`;
  };

  const buildStudentTableRows = (rows = studentViewRows()) => rows.map((row, index) => {
    const s = row.student;
    const qs = studentQuestionStats(s);
    const achieved = resolvedAchievedGrade(s);
    const maxGrade = resolvedMaxGrade(s);
    const discrepancyHint = s.gradeDiscrepancy
      ? `<div class="${APP}-tiny ${APP}-grade-warning">⚠ درجة صفحة الرصد: ${fmt(num(s.gradeFieldValue), 4)}</div>`
      : '';
    return `<tr>
      <td>${index + 1}</td>
      <td><b>${esc(s.name || '—')}</b></td>
      <td>${esc(s.className || '—')}</td>
      <td>${esc(getStatusLabel(s))}</td>
      <td>${Number.isFinite(achieved) ? `${fmt(achieved, 4)} / ${fmt(maxGrade, 4)}${discrepancyHint}` : '—'}</td>
      <td>${Number.isFinite(row.percent) ? `${fmt(row.percent)}%` : '—'}</td>
      <td><span class="${APP}-level-pill ${APP}-level-${row.level.key}">${esc(row.level.label)}</span></td>
      ${isOnlineQuestions() ? `<td>${qs?.correct ?? '—'}</td><td>${qs?.incorrect ?? '—'}</td><td>${qs?.unanswered ?? '—'}</td>` : ''}
    </tr>`;
  }).join('');

  const buildQuestionTableRows = (a = getFilteredQuestionAnalytics()) => {
    if (!a) return '';
    return a.questions.map(q => `<tr>
      <td>${q.number}</td>
      <td><b>${esc(q.text || '—')}</b><div class="${APP}-tiny">${esc(q.correctText ? `الإجابة الصحيحة: ${q.correctText}` : '')}</div></td>
      <td>${esc(q.type || '—')}</td>
      <td>${Number.isFinite(q.maxScore) ? fmt(q.maxScore, 4) : '—'}</td>
      <td>${q.participants}</td>
      <td>${q.correct}</td>
      <td>${q.incorrect}</td>
      <td>${q.unanswered}</td>
      <td>${fmt(q.correctRate)}%</td>
      <td><span class="${APP}-difficulty ${q.difficulty === 'صعب' ? 'hard' : q.difficulty === 'متوسط' ? 'medium' : 'easy'}">${esc(q.difficulty)}</span></td>
      <td>${q.mostCommonWrong ? `${esc(q.mostCommonWrong.text)} <small>(${q.mostCommonWrong.count})</small>` : '—'}</td>
    </tr>`).join('');
  };

  const buildInlineAnalysisHtml = () => {
    const data = state.gradeData;
    if (!data) return `<div class="${APP}-analysis-note">جاري تجهيز بيانات الواجب…</div>`;

    const gate = gradeReportGate(document);
    if (!gate.ready) {
      const endText = gate.timing?.endDate ? formatGradeTimingDate(gate.timing.endDate) : 'غير متاح';
      const serverText = gate.timing?.serverDate ? formatGradeTimingDate(gate.timing.serverDate) : 'غير متاح';
      return `
        <section class="${APP}-analysis-section ${APP}-analysis-overview">
          <div class="${APP}-analysis-heading">
            <div>
              <h3>${gate.status === 'receiving' ? 'الواجب قيد الاستقبال' : 'تعذر التحقق من اكتمال الواجب'}</h3>
              <p>${esc(gate.message)}</p>
            </div>
            <span class="${APP}-pill">v${VERSION}</span>
          </div>
          <div class="${APP}-overview-metrics">
            ${metricHtml(gate.status === 'receiving' ? 'قيد الاستقبال' : 'غير متحقق', 'حالة التقرير', 'لا تُحتسب بيانات الأداء الآن')}
            ${metricHtml(endText, 'نهاية استقبال الحلول')}
            ${metricHtml(serverText, 'وقت خادم مدرستي')}
          </div>
          <div class="${APP}-analysis-note ${APP}-analysis-warning">
            لا يتم عرض نسبة الإنجاز أو المتوسط أو «لم يحل» قبل انتهاء وقت النشر، لأن هذه القيم ما زالت قابلة للتغير. تبقى أدوات الرصد والاستيراد وطباعة نموذج الأسئلة متاحة.
          </div>
        </section>`;
    }

    const viewRows = studentViewRows();
    const s = computeEnhancedSummary(viewRows);
    const outside = isOutsideSystem();
    const qa = getFilteredQuestionAnalytics(viewRows);
    const filterContext = studentFilterContextLabel();

    const topMetrics = outside
      ? [
          metricHtml(s.total ?? 0, 'عدد الطلاب'),
          metricHtml(s.submittedCount ?? 0, 'سلّموا الواجب'),
          metricHtml(s.notSubmittedCount ?? 0, 'لم يسلّموا'),
          metricHtml(s.unknownSubmissionCount ?? 0, 'غير محسوم'),
          metricHtml(`${fmt(s.submissionRate ?? 0)}%`, 'نسبة التسليم', 'مستنتجة من الدرجة والملاحظة'),
          metricHtml(s.graded ?? 0, 'درجات مرصودة'),
          metricHtml(Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'),
          metricHtml(Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'),
          metricHtml(Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة مرصودة')
        ].join('')
      : [
          metricHtml(s.total ?? 0, 'عدد الطلاب'),
          metricHtml(s.submittedCount ?? 0, 'حلوا الواجب'),
          metricHtml(s.notSubmittedCount ?? 0, 'لم يحلوا'),
          metricHtml(`${fmt(s.submissionRate ?? 0)}%`, 'نسبة الإنجاز'),
          metricHtml(Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'),
          metricHtml(Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'),
          metricHtml(Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة')
        ].join('');

    const questionSection = outside
      ? `<div class="${APP}-analysis-note ${APP}-analysis-note-muted">هذا الواجب «خارج النظام»؛ لذلك لا تعرض مدرستي بنية أسئلة أو إجابات يمكن تحليلها. تحليل الدرجات والطلاب أدناه يظل متاحًا.</div>`
      : `
        <section class="${APP}-analysis-section">
          <div class="${APP}-analysis-heading"><div><h3>تحليل الأسئلة والإجابات</h3><p>نسب الصحة والخطأ والأسئلة الأصعب والأخطاء الأكثر شيوعًا.</p></div></div>
          ${questionSummaryCardsHtml(qa)}
          ${qa ? `<details class="${APP}-details" open><summary>تفاصيل الأسئلة (${qa.questions.length})</summary>
            <div class="${APP}-table-wrap"><table class="${APP}-table ${APP}-analysis-table">
              <thead><tr><th>#</th><th>السؤال</th><th>النوع</th><th>درجة السؤال</th><th>الطلاب</th><th>صحيح</th><th>خطأ</th><th>لم يجب</th><th>نسبة الصحة</th><th>الصعوبة</th><th>أكثر خطأ شيوعًا</th></tr></thead>
              <tbody>${buildQuestionTableRows(qa)}</tbody>
            </table></div>
          </details>` : ''}
        </section>`;

    return `
      <section class="${APP}-analysis-section ${APP}-analysis-overview">
        <div class="${APP}-analysis-heading">
          <div><h3>تحليل الواجب</h3><p>${esc(data.assignmentMode?.label || 'الواجب')} · ${esc(filterContext)} · تحديث: ${new Date().toLocaleString('ar-SA')}</p></div>
          <span class="${APP}-pill">v${VERSION}</span>
        </div>
        <div class="${APP}-overview-metrics">${topMetrics}</div>
        ${s.discrepancyCount ? `<div class="${APP}-analysis-note ${APP}-analysis-warning">⚠ تم اكتشاف ${s.discrepancyCount} حالة تعارض بين درجة صفحة الرصد ودرجة صفحة نتيجة الطالب. اعتمد التحليل درجة صفحة النتيجة.</div>` : ''}
      </section>

      <section class="${APP}-analysis-section">
        <div class="${APP}-analysis-heading"><div><h3>مستويات الطلاب</h3><p>${outside ? '«لم يسلّم» فئة مستقلة عن الطالب الذي سلّم وأخذ صفرًا.' : '«ضعيف» يشمل 50% فأقل لمن لديه درجة، و«لم يحل» فئة مستقلة.'}</p></div></div>
        <div class="${APP}-level-grid">${levelCardsHtml(viewRows)}</div>
      </section>

      ${questionSection}

      <section class="${APP}-analysis-section" data-mai-student-section>
        <div class="${APP}-analysis-heading"><div><h3>تقييم الطلاب</h3><p>صفِّ حسب الفصل أو التسليم أو التقدير، وفرز حسب الاسم أو التسليم أو التقدير. البطاقات والتقارير تتبع التصفية الحالية.</p></div></div>
        ${studentFilterControlsHtml()}
        <div class="${APP}-table-wrap"><table class="${APP}-table ${APP}-analysis-table">
          <thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th>${isOnlineQuestions() ? '<th>صحيح</th><th>خطأ</th><th>لم يجب</th>' : ''}</tr></thead>
          <tbody data-mai-student-tbody>${buildStudentTableRows()}</tbody>
        </table></div>
      </section>`;
  };

  const renderInlineAnalysis = () => {
    const summary = document.getElementById(`${APP}-summary`);
    if (summary) summary.style.display = 'none';

    let host = document.getElementById(`${APP}-analysis-inline`);
    if (!host) {
      host = document.createElement('div');
      host.id = `${APP}-analysis-inline`;
      const panel = document.getElementById(`${APP}-panel`);
      const rights = panel?.querySelector(`.${APP}-rights`);
      if (panel && rights) panel.insertBefore(host, rights);
      else panel?.appendChild(host);
    }
    if (host) host.innerHTML = buildInlineAnalysisHtml();
    syncActionAvailability();
  };

  const refreshStudentTableView = (section) => {
    if (!section) return;
    const rows = studentViewRows();
    const total = performanceRows().length;
    const tbody = section.querySelector('[data-mai-student-tbody]');
    const count = section.querySelector('[data-mai-student-count]');
    const classFilter = section.querySelector('[data-mai-student-class]');
    const submission = section.querySelector('[data-mai-student-submission]');
    const level = section.querySelector('[data-mai-student-level]');
    const sort = section.querySelector('[data-mai-student-sort]');
    if (classFilter) classFilter.value = studentViewState.className;
    if (submission) submission.value = studentViewState.submission;
    if (level) level.value = studentViewState.level;
    if (sort) sort.value = studentViewState.sort;
    if (tbody) tbody.innerHTML = buildStudentTableRows(rows);
    if (count) count.textContent = `عرض ${rows.length} من ${total}`;
  };

  const refreshAllFilteredViews = () => {
    // الصفحة الرئيسية: إعادة بناء كاملة حتى تتغير البطاقات ومستويات الطلاب مع المرشح.
    renderInlineAnalysis();

    // إن كانت نافذة "لوحة تحليل الواجب" مفتوحة، نجدد محتواها كذلك.
    const modal = document.getElementById(`${APP}-modal`);
    const titleEl = document.getElementById(`${APP}-modal-title`);
    const body = document.getElementById(`${APP}-modal-body`);
    if (modal && !modal.hidden && body && clean(titleEl?.textContent || '') === 'لوحة تحليل الواجب') {
      body.innerHTML = buildInlineAnalysisHtml();
    }
  };

  const installStudentViewControls = () => {
    if (document.documentElement.dataset.maiStudentViewBound === '1') return;
    document.documentElement.dataset.maiStudentViewBound = '1';

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const section = target.closest('[data-mai-student-section]');
      if (!section) return;

      if (target.matches('[data-mai-student-class]')) studentViewState.className = target.value || 'all';
      else if (target.matches('[data-mai-student-submission]')) studentViewState.submission = target.value || 'all';
      else if (target.matches('[data-mai-student-level]')) studentViewState.level = target.value || 'all';
      else if (target.matches('[data-mai-student-sort]')) studentViewState.sort = target.value || 'name_asc';
      else return;

      refreshAllFilteredViews();
    });

    document.addEventListener('click', (event) => {
      const btn = event.target instanceof Element ? event.target.closest('[data-mai-student-reset]') : null;
      if (!btn) return;
      const section = btn.closest('[data-mai-student-section]');
      studentViewState.className = 'all';
      studentViewState.submission = 'all';
      studentViewState.level = 'all';
      studentViewState.sort = 'name_asc';
      if (section) refreshAllFilteredViews();
    });
  };

  // -----------------------------
  // نافذة التحليل الموسعة
  // -----------------------------
  const showModal = (title, html) => {
    const modal = document.getElementById(`${APP}-modal`);
    const titleEl = document.getElementById(`${APP}-modal-title`);
    const body = document.getElementById(`${APP}-modal-body`);
    if (!modal || !body) throw new Error('تعذر فتح نافذة مدير الواجبات.');
    if (titleEl) titleEl.textContent = title;
    body.innerHTML = html;
    modal.hidden = false;
  };

  const openDashboardEnhanced = () => {
    assertFinalReportReady();
    if (!state.gradeData) throw new Error('حدّث التحليل أولًا.');
    showModal('لوحة تحليل الواجب', buildInlineAnalysisHtml());
  };

  const openQuestionAnalyticsEnhanced = async () => {
    assertFinalReportReady();
    if (isOutsideSystem()) throw new Error('تحليل الأسئلة غير متاح لواجبات «خارج النظام».');
    let a = getQuestionAnalytics();
    if (!a) a = await runDeepQuestionAnalysisEnhanced();
    a = getFilteredQuestionAnalytics(studentViewRows()) || a;
    showModal('تحليل الأسئلة', `
      <div class="${APP}-analysis-note">السياق الحالي: ${esc(studentFilterContextLabel())}</div>
      ${questionSummaryCardsHtml(a)}
      <div class="${APP}-table-wrap"><table class="${APP}-table ${APP}-analysis-table">
        <thead><tr><th>#</th><th>السؤال</th><th>النوع</th><th>درجة السؤال</th><th>الطلاب</th><th>صحيح</th><th>خطأ</th><th>لم يجب</th><th>نسبة الصحة</th><th>الصعوبة</th><th>أكثر خطأ شيوعًا</th></tr></thead>
        <tbody>${buildQuestionTableRows(a)}</tbody>
      </table></div>`);
  };

  // -----------------------------
  // Print / PDF — فتح النافذة قبل أي await لمنع popup blocker
  // -----------------------------
  const openPrintShell = (title) => {
    const w = window.open('', '_blank');
    if (!w) {
      throw new Error('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لموقع مدرستي ثم أعد المحاولة.');
    }
    try { w.opener = null; } catch {}
    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
      <body style="font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:32px;text-align:center"><h3>جارٍ تجهيز ${esc(title)}…</h3></body></html>`);
    w.document.close();
    return w;
  };

  const renderPrintDocument = (w, title, bodyHtml, { autoPrint = true } = {}) => {
    const css = `
      @page{size:A4;margin:12mm}
      *{box-sizing:border-box}
      body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111827;margin:0;font-size:12px;line-height:1.65}
      h1{font-size:22px;margin:0} h2{font-size:16px;margin:0 0 10px} h3{font-size:13px;margin:0}
      .header{border-bottom:3px solid #111827;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end}
      .muted{color:#6b7280}.small{font-size:10px}.nowrap{white-space:nowrap}
      .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 16px}
      .card{border:1px solid #d1d5db;border-radius:10px;padding:10px;break-inside:avoid}.card b{display:block;font-size:18px}.card span{color:#6b7280}
      .levels{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:10px 0 16px}.level{border:1px solid #d1d5db;border-radius:9px;padding:8px;text-align:center}.level b{font-size:16px;display:block}
      .section{margin:18px 0;break-inside:auto}.section-title{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #9ca3af;padding-bottom:6px;margin-bottom:8px}
      table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #d1d5db;padding:6px;text-align:right;vertical-align:top}th{background:#f3f4f6;font-weight:700}
      tr{break-inside:avoid}.page-break{break-before:page}.q{border:1px solid #d1d5db;border-radius:9px;padding:10px;margin:8px 0;break-inside:avoid}.qhead{display:flex;justify-content:space-between;gap:10px;font-weight:700}.opts{list-style:none;padding:0;margin:8px 0}.opts li{padding:3px 0}.correct{font-weight:700}.badge{display:inline-block;border:1px solid #9ca3af;border-radius:999px;padding:2px 6px;font-size:9px}
      .footer{margin-top:20px;border-top:1px solid #d1d5db;padding-top:8px;color:#6b7280;font-size:9px;display:flex;justify-content:space-between}
      .print-actions{position:fixed;left:15px;bottom:15px;z-index:10}.print-actions button{padding:10px 16px;border:0;border-radius:8px;background:#111827;color:#fff;font-weight:700;cursor:pointer}
      @media print{.print-actions{display:none}.page-break{break-before:page}}
    `;

    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>
      <div class="print-actions"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
      ${bodyHtml}
      </body></html>`);
    w.document.close();
    if (autoPrint) {
      w.setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 450);
    }
  };

  const printHeaderHtml = (documentLabel, { compact = false, assignmentName = '', rows = null } = {}) => {
    const data = state.gradeData;
    const name = assignmentName || data?.assignmentName || (isUsableAssignmentName(data?.title) ? cleanAssignmentNameCandidate(data.title) : '') || 'واجب مدرستي';
    if (compact) {
      return `<div class="header compact-header">
        <div><h1>${esc(name)}</h1><div class="muted">${esc(documentLabel)}</div></div>
      </div>`;
    }

    const rowStudents = Array.isArray(rows) ? rows.map(row => row?.student || row).filter(Boolean) : (data?.students || []);
    const classes = [...new Set(rowStudents.map(s => clean(s.className)).filter(Boolean))].sort(compareArabicNames).join('، ');
    return `<div class="header">
      <div><h1>${esc(name)}</h1><div class="muted">${esc(documentLabel)} · ${esc(studentFilterContextLabel())}</div></div>
      <div class="small">${esc(data?.assignmentMode?.label || '')}<br>${classes ? `الفصل/الفصول: ${esc(classes)}` : ''}<br>${new Date().toLocaleString('ar-SA')}</div>
    </div>`;
  };

  const questionPaperCss = `
    @page{size:A4;margin:12mm}
    *{box-sizing:border-box}
    body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111827;margin:0;font-size:13px;line-height:1.7}
    .paper-head{border-bottom:3px solid #111827;padding-bottom:12px;margin-bottom:14px}
    .paper-head h1{font-size:24px;margin:0 0 3px}.paper-head .sub{font-size:12px;color:#4b5563}.paper-meta{font-size:10px;color:#6b7280;margin-top:5px}
    .student-fields{display:none;border:1px solid #9ca3af;border-radius:8px;padding:9px 12px;margin:10px 0 14px;grid-template-columns:1fr 1fr;gap:18px}
    body.student-copy .student-fields{display:grid}
    .q{border:1px solid #d1d5db;border-radius:9px;padding:11px 12px;margin:9px 0;break-inside:avoid}
    .qhead{display:flex;justify-content:space-between;gap:12px;font-weight:700}.qgrade{white-space:nowrap;font-size:11px;color:#4b5563}
    .opts{list-style:none;padding:0;margin:8px 0 0}.opts li{padding:4px 7px;border-radius:6px;margin:2px 0}.choice-marker{display:inline-block;min-width:20px;font-weight:800}
    .correct-choice{font-weight:700;background:#f3f4f6}.correct-label{font-size:9px;border:1px solid #9ca3af;border-radius:999px;padding:1px 6px;margin-right:8px;white-space:nowrap}
    body.student-copy .correct-choice{font-weight:400;background:transparent}body.student-copy .correct-label{display:none}
    body.teacher-copy .student-marker{display:none}body.student-copy .teacher-marker{display:none}
    .print-actions{position:fixed;left:14px;bottom:14px;z-index:20;display:flex;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 28px)}
    .print-actions button{padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111827;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .print-actions button.primary{background:#111827;color:#fff;border-color:#111827}
    .print-actions button.active{outline:2px solid #111827;outline-offset:1px}
    @media print{.print-actions{display:none}.q{border-color:#9ca3af}.correct-choice{background:#f3f4f6!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}body.student-copy .correct-choice{background:transparent!important}}
  `;

  const renderQuestionPaperDocument = (w, assignmentName, questions) => {
    const total = questions.map(q => num(q.maxScore)).filter(Number.isFinite).reduce((a, b) => a + b, 0);
    const meta = `${questions.length} ${questions.length === 1 ? 'سؤال' : 'أسئلة'}${Number.isFinite(total) && total > 0 ? ` · الدرجة الكلية: ${fmt(total, 4)}` : ''}`;
    const body = `
      <div class="print-actions">
        <button id="teacherMode" class="active" onclick="setCopyMode('teacher')">نسخة المعلم · مع الإجابات</button>
        <button id="studentMode" onclick="setCopyMode('student')">نسخة الطالب · بدون إجابات</button>
        <button class="primary" onclick="window.print()">طباعة / حفظ PDF</button>
      </div>
      <header class="paper-head">
        <h1>${esc(assignmentName)}</h1>
        <div class="sub" id="paperModeLabel">نموذج أسئلة الواجب والإجابة</div>
        <div class="paper-meta">${esc(meta)}</div>
      </header>
      <div class="student-fields"><div>اسم الطالب: ....................................................................</div><div>الفصل: ....................................................</div></div>
      ${questions.map(q => `
        <section class="q">
          <div class="qhead"><span>السؤال ${q.number}: ${esc(q.text)}</span><span class="qgrade">${Number.isFinite(q.maxScore) ? `${fmt(q.maxScore, 4)} درجة` : ''}</span></div>
          ${(q.options || []).length ? `<ul class="opts">${q.options.map(o => {
            const correct = !!o.markedCorrect;
            return `<li class="${correct ? 'correct-choice' : ''}">
              <span class="choice-marker"><span class="teacher-marker">${correct ? '✓' : '○'}</span><span class="student-marker">○</span></span>${esc(o.text)}${correct ? '<span class="correct-label">الإجابة الصحيحة</span>' : ''}
            </li>`;
          }).join('')}</ul>` : (q.correctText ? `<div class="correct-label">الإجابة الصحيحة: ${esc(q.correctText)}</div>` : '')}
        </section>`).join('')}`;

    const script = `
      function setCopyMode(mode){
        document.body.classList.toggle('teacher-copy', mode === 'teacher');
        document.body.classList.toggle('student-copy', mode === 'student');
        document.getElementById('teacherMode')?.classList.toggle('active', mode === 'teacher');
        document.getElementById('studentMode')?.classList.toggle('active', mode === 'student');
        const label = document.getElementById('paperModeLabel');
        if (label) label.textContent = mode === 'teacher' ? 'نموذج أسئلة الواجب والإجابة' : 'أسئلة الواجب';
        document.title = ${JSON.stringify(assignmentName)} + (mode === 'teacher' ? ' — نموذج الإجابة' : ' — أسئلة الواجب');
      }
      setCopyMode('teacher');`;

    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(assignmentName)} — نموذج الإجابة</title><style>${questionPaperCss}</style></head><body class="teacher-copy">${body}<script>${script}<\/script></body></html>`);
    w.document.close();
  };

  async function printQuestionsEnhanced() {
    if (isOutsideSystem()) throw new Error('الأسئلة ونموذج الإجابة غير متاحين لواجب «خارج النظام».');
    const w = openPrintShell('طباعة أسئلة الواجب');
    try {
      const [assignmentName, questions] = await Promise.all([
        resolveAssignmentNameEnhanced({ allowFetch: true }),
        getQuestionTemplateEnhanced({ requireAnswerKey: true })
      ]);
      renderQuestionPaperDocument(w, assignmentName, questions);
    } catch (e) {
      renderPrintDocument(w, 'طباعة أسئلة الواجب', `<div class="header"><h1>تعذر تجهيز أسئلة الواجب</h1></div><div class="card"><div>${esc(String(e?.message || e))}</div></div>`, { autoPrint: false });
      throw e;
    }
  }

  const printLevelGrid = (rows = studentViewRows()) => {
    const counts = Object.fromEntries(levelOrder.map(([key]) => [key, 0]));
    for (const row of rows) counts[row.level?.key] = (counts[row.level?.key] || 0) + 1;
    const total = rows.length;
    const outside = isOutsideSystem();
    return levelOrder
      .filter(([key]) => (counts[key] || 0) > 0 || ['excellent','very-good','good','acceptable','weak','not-solved'].includes(key))
      .map(([key, label]) => {
        const displayLabel = outside && key === 'not-solved' ? 'لم يسلّم' : outside && key === 'unverified' ? 'غير محسوم' : label;
        return `<div class="level"><b>${counts[key] || 0}</b><span>${esc(displayLabel)}</span><div class="small muted">${total ? pct(counts[key] || 0, total) : 0}%</div></div>`;
      }).join('');
  };

  const buildAssignmentPrintReport = (assignmentName = '') => {
    const data = state.gradeData;
    const viewRows = studentViewRows();
    const s = computeEnhancedSummary(viewRows);
    const outside = isOutsideSystem();
    const qa = getFilteredQuestionAnalytics(viewRows);

    const cards = outside
      ? [
          [s.total ?? 0, 'عدد الطلاب'], [s.submittedCount ?? 0, 'سلّموا الواجب'], [s.notSubmittedCount ?? 0, 'لم يسلّموا'],
          [s.unknownSubmissionCount ?? 0, 'غير محسوم'], [`${fmt(s.submissionRate ?? 0)}%`, 'نسبة التسليم'], [s.graded ?? 0, 'درجات مرصودة'],
          [Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'], [Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'], [Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة']
        ]
      : [
          [s.total ?? 0, 'عدد الطلاب'], [s.submittedCount ?? 0, 'حلوا الواجب'], [s.notSubmittedCount ?? 0, 'لم يحلوا'],
          [`${fmt(s.submissionRate ?? 0)}%`, 'نسبة الإنجاز'], [Number.isFinite(s.averagePercent) ? `${fmt(s.averagePercent)}%` : '—', 'متوسط الأداء'],
          [Number.isFinite(s.highestPercent) ? `${fmt(s.highestPercent)}%` : '—', 'أعلى نتيجة'], [Number.isFinite(s.lowestPercent) ? `${fmt(s.lowestPercent)}%` : '—', 'أدنى نتيجة']
        ];

    const studentRows = viewRows.map((row, i) => {
      const st = row.student;
      const qs = studentQuestionStats(st);
      const achieved = resolvedAchievedGrade(st);
      const maxGrade = resolvedMaxGrade(st);
      const discrepancy = st.gradeDiscrepancy
        ? `<div class="small muted">تعارض: صفحة الرصد ${fmt(num(st.gradeFieldValue),4)}</div>`
        : '';
      return `<tr><td>${i + 1}</td><td>${esc(st.name || '—')}</td><td>${esc(st.className || '—')}</td><td>${esc(getStatusLabel(st))}</td><td>${Number.isFinite(achieved) ? `${fmt(achieved,4)} / ${fmt(maxGrade,4)}${discrepancy}` : '—'}</td><td>${Number.isFinite(row.percent) ? `${fmt(row.percent)}%` : '—'}</td><td>${esc(row.level.label)}</td>${!outside ? `<td>${qs?.correct ?? '—'}</td><td>${qs?.incorrect ?? '—'}</td><td>${qs?.unanswered ?? '—'}</td>` : ''}</tr>`;
    }).join('');

    const questionReport = !outside && qa ? `<div class="section page-break">
      <div class="section-title"><h2>تحليل الأسئلة</h2><span class="muted">${qa.questions.length} سؤال</span></div>
      <div class="cards">
        <div class="card"><b>${fmt(qa.summary.correctRate)}%</b><span>نسبة الإجابات الصحيحة</span></div>
        <div class="card"><b>${qa.summary.hardest ? `س${qa.summary.hardest.number}` : '—'}</b><span>أصعب سؤال${qa.summary.hardest ? ` · ${fmt(qa.summary.hardest.correctRate)}%` : ''}</span></div>
        <div class="card"><b>${qa.summary.easiest ? `س${qa.summary.easiest.number}` : '—'}</b><span>أسهل سؤال${qa.summary.easiest ? ` · ${fmt(qa.summary.easiest.correctRate)}%` : ''}</span></div>
      </div>
      <table><thead><tr><th>#</th><th>السؤال</th><th>الدرجة</th><th>صحيح</th><th>خطأ</th><th>لم يجب</th><th>نسبة الصحة</th><th>التصنيف</th><th>أكثر خطأ شيوعًا</th></tr></thead><tbody>
        ${qa.questions.map(q => `<tr><td>${q.number}</td><td>${esc(q.text)}${q.correctText ? `<div class="small muted">الصحيح: ${esc(q.correctText)}</div>` : ''}</td><td>${Number.isFinite(q.maxScore) ? fmt(q.maxScore,4) : '—'}</td><td>${q.correct}</td><td>${q.incorrect}</td><td>${q.unanswered}</td><td>${fmt(q.correctRate)}%</td><td>${esc(q.difficulty)}</td><td>${q.mostCommonWrong ? `${esc(q.mostCommonWrong.text)} (${q.mostCommonWrong.count})` : '—'}</td></tr>`).join('')}
      </tbody></table>
    </div>` : outside ? `<div class="section"><div class="card"><b>ملاحظة</b><span>هذا الواجب خارج النظام؛ لا تتوفر بنية أسئلة لتحليل الإجابات. حالة التسليم تُستنتج من الدرجة وملاحظة المعلم، مع إبقاء أي حالة غير محسومة منفصلة.</span></div></div>` : '';

    const discrepancyNote = s.discrepancyCount
      ? `<div class="section"><div class="card"><b>تنبيه تعارض بيانات</b><span>اكتشف النظام ${s.discrepancyCount} حالة اختلفت فيها درجة صفحة الرصد عن صفحة نتيجة الطالب؛ تم اعتماد صفحة النتيجة في هذا التقرير.</span></div></div>`
      : '';

    return `${printHeaderHtml('تقرير الواجب', { rows: viewRows, assignmentName })}
      <div class="section"><div class="section-title"><h2>الملخص التنفيذي</h2></div><div class="cards">${cards.map(([v,l]) => `<div class="card"><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div></div>
      ${discrepancyNote}
      <div class="section"><div class="section-title"><h2>توزيع مستويات الطلاب</h2><span class="muted">${outside ? 'لم يسلّم مستقل عن سلّم وأخذ صفرًا' : 'ضعيف = 50% فأقل لمن لديه درجة'}</span></div><div class="levels">${printLevelGrid(viewRows)}</div></div>
      <div class="section"><div class="section-title"><h2>تقرير الطلاب</h2><span class="muted">${esc(studentFilterContextLabel())} · حسب الفرز الحالي</span></div><table><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th>${!outside ? '<th>صحيح</th><th>خطأ</th><th>لم يجب</th>' : ''}</tr></thead><tbody>${studentRows}</tbody></table></div>
      ${questionReport}
      <div class="footer"><span>تم إنشاء التقرير بواسطة Madrasati Assignment Intelligence v${VERSION}</span><span>Mohammed Almalki (M0HM3D85)</span></div>`;
  };


  async function printAssignmentReportEnhanced() {
    assertFinalReportReady();
    const w = openPrintShell('تقرير الواجب');
    try {
      if (!state.gradeData) await refreshEnhanced(false);

      // تقرير الواجب يجب أن يأخذ الاسم من بطاقة الواجب الظاهرة في نفس صفحة GradeAssignment
      // وقت الطباعة، حتى لا يعتمد على قيمة قديمة في state أو cache.
      const directAssignmentName = extractAssignmentNameFromDocument(document);
      const assignmentName = isUsableAssignmentName(directAssignmentName)
        ? cleanAssignmentNameCandidate(directAssignmentName)
        : await resolveAssignmentNameEnhanced({ allowFetch: true });

      if (state.gradeData && assignmentName) {
        assignmentNameCache = assignmentName;
        state.gradeData.assignmentName = assignmentName;
        state.gradeData.title = assignmentName;
      }

      if (isOnlineQuestions() && !getQuestionAnalytics() && (state.gradeData?.students || []).some(s => s.submissionState === 'submitted' || s.hasAnswer === true)) {
        await runDeepQuestionAnalysisEnhanced({ silent: true });
      }
      renderPrintDocument(w, `${assignmentName || 'الواجب'} — تقرير الواجب`, buildAssignmentPrintReport(assignmentName));
    } catch (e) {
      renderPrintDocument(w, 'تقرير الواجب', `<div class="header"><h1>تقرير الواجب</h1></div><div class="card"><b>تعذر تجهيز التقرير</b><div>${esc(String(e?.message || e))}</div></div>`, { autoPrint: false });
      throw e;
    }
  }

  // -----------------------------
  // Export
  // -----------------------------
  const exportRowsEnhanced = () => studentViewRows().map(row => {
    const s = row.student;
    const qs = studentQuestionStats(s);
    return {
      'الطالب': s.name || '',
      'الفصل': s.className || '',
      'حساب الطالب': s.account || '',
      'StudentId': s.studentId || s.assignmentStudentId || '',
      'الحالة': getStatusLabel(s),
      'الدرجة': Number.isFinite(resolvedAchievedGrade(s)) ? resolvedAchievedGrade(s) : '',
      'الدرجة الكلية': Number.isFinite(resolvedMaxGrade(s)) ? resolvedMaxGrade(s) : '',
      'درجة صفحة الرصد': Number.isFinite(num(s.gradeFieldValue ?? s.currentGrade)) ? num(s.gradeFieldValue ?? s.currentGrade) : '',
      'مصدر الدرجة': Number.isFinite(num(s.resultGrade)) ? 'صفحة نتيجة الطالب' : 'صفحة الرصد',
      'تعارض الدرجة': s.gradeDiscrepancy ? 'نعم' : 'لا',
      'النسبة': Number.isFinite(row.percent) ? row.percent : '',
      'المستوى': row.level.label,
      'صحيح': qs?.correct ?? '',
      'خطأ': qs?.incorrect ?? '',
      'لم يجب': qs?.unanswered ?? '',
      'الملاحظة': s.feedback || ''
    };
  });

  const downloadText = (name, text, mime) => {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const dateStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function exportCSVEnhanced() {
    assertFinalReportReady();
    const data = exportRowsEnhanced();
    if (!data.length) throw new Error('لا توجد بيانات طلاب قابلة للتصدير.');
    const headers = Object.keys(data[0] || {});
    const lines = [headers.map(csvCell).join(',')];
    for (const row of data) lines.push(headers.map(h => csvCell(row[h])).join(','));
    downloadText(`madrasati-assignment-analysis-${dateStamp()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function exportExcelEnhanced() {
    assertFinalReportReady();
    const data = exportRowsEnhanced();
    if (!data.length) throw new Error('لا توجد بيانات طلاب قابلة للتصدير.');
    if (!globalThis.XLSX) return exportCSVEnhanced();
    const wb = XLSX.utils.book_new();
    const studentsWs = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, studentsWs, 'Students');
    const qa = getFilteredQuestionAnalytics(studentViewRows());
    if (qa?.questions?.length) {
      const questionData = qa.questions.map(q => ({
        '#': q.number,
        'السؤال': q.text,
        'النوع': q.type,
        'درجة السؤال': Number.isFinite(q.maxScore) ? q.maxScore : '',
        'المشاركون': q.participants,
        'صحيح': q.correct,
        'خطأ': q.incorrect,
        'لم يجب': q.unanswered,
        'غير محسوم': q.unknown || 0,
        'نسبة الصحة': q.correctRate,
        'الصعوبة': q.difficulty,
        'الإجابة الصحيحة': q.correctText,
        'أكثر خطأ شيوعًا': q.mostCommonWrong?.text || '',
        'تكرار الخطأ': q.mostCommonWrong?.count || 0
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionData), 'Questions');
    }
    const filterSheet = XLSX.utils.json_to_sheet([{
      'السياق الحالي': studentFilterContextLabel(),
      'عدد الطلاب المعروضين': studentViewRows().length,
      'إجمالي طلاب الواجب': performanceRows().length
    }]);
    XLSX.utils.book_append_sheet(wb, filterSheet, 'Filters');
    XLSX.writeFile(wb, `madrasati-assignment-analysis-${dateStamp()}.xlsx`);
  }

  // -----------------------------
  // Refresh + cache
  // -----------------------------
  let enhancedRefreshRunning = false;
  let summaryObserver = null;
  let summaryObserverTimer = null;

  async function refreshEnhanced(forceRegistry = false) {
    if (enhancedRefreshRunning) return state.gradeData;
    enhancedRefreshRunning = true;
    setStatus('جاري جمع بيانات الواجب…', true);
    try {
      await base.refreshAll(forceRegistry);
      try {
        const classRepair = await repairStudentClassesEnhanced();
        if (classRepair.changed) console.info(`[MAI v${VERSION}] Corrected student classes`, classRepair);
      } catch (e) {
        console.warn(`[MAI v${VERSION}] Student class repair skipped:`, e);
      }
      if (studentViewState.className !== 'all' && !availableStudentClasses().some(c => norm(c) === norm(studentViewState.className))) {
        studentViewState.className = 'all';
      }
      await resolveAssignmentNameEnhanced({ allowFetch: true });
      state.enhancedQuestionAnalytics = null;
      state.questionAnalytics = null;

      const gate = gradeReportGate(document);
      if (!gate.ready) {
        renderInlineAnalysis();
        const panelSub = document.querySelector(`#${APP}-panel .${APP}-sub`);
        if (panelSub) {
          panelSub.textContent = `${gate.label} · التقرير النهائي مؤجل — v${VERSION}`;
          panelSub.title = gate.message;
        }
        syncActionAvailability();
        toast(gate.message, gate.status === 'receiving' ? 'info' : 'error');
        return state.gradeData;
      }

      if (isOnlineQuestions() && (state.gradeData?.students || []).some(s => s.submissionState === 'submitted' || s.hasAnswer === true)) {
        try {
          await runDeepQuestionAnalysisEnhanced({ silent: true });
        } catch (e) {
          console.warn('[MAI v1.4.8] Question analysis skipped:', e);
        }
      }

      renderInlineAnalysis();
      const panelSub = document.querySelector(`#${APP}-panel .${APP}-sub`);
      if (panelSub) {
        const currentGate = gradeReportGate(document);
        panelSub.textContent = currentGate.ready
          ? `الواجب منتهي · التحليل والتقرير النهائي متاحان — v${VERSION}`
          : `${currentGate.label} · التقرير النهائي مؤجل — v${VERSION}`;
        panelSub.title = currentGate.message;
      }
      toast('تم تحديث تحليل الواجب والبطاقات.', 'success');
      return state.gradeData;
    } finally {
      enhancedRefreshRunning = false;
      setStatus('جاهز', false);
    }
  }

  const setupBaseSummaryObserver = () => {
    const summary = document.getElementById(`${APP}-summary`);
    if (!summary || summaryObserver) return;
    summaryObserver = new MutationObserver(() => {
      if (enhancedRefreshRunning) return;
      clearTimeout(summaryObserverTimer);
      summaryObserverTimer = setTimeout(async () => {
        if (enhancedRefreshRunning || !state.gradeData) return;
        try {
          try { await repairStudentClassesEnhanced(); } catch (e) { console.warn(`[MAI v${VERSION}] Student class repair after base update skipped:`, e); }
          if (studentViewState.className !== 'all' && !availableStudentClasses().some(c => norm(c) === norm(studentViewState.className))) {
            studentViewState.className = 'all';
          }
          state.enhancedQuestionAnalytics = null;
          state.questionAnalytics = null;
          const gate = gradeReportGate(document);
          if (!gate.ready) {
            renderInlineAnalysis();
            syncActionAvailability();
            return;
          }
          if (isOnlineQuestions() && (state.gradeData?.students || []).some(s => s.submissionState === 'submitted' || s.hasAnswer === true)) {
            try { await runDeepQuestionAnalysisEnhanced({ silent: true }); } catch (e) { console.warn('[MAI v1.4.8] Post-base refresh analysis skipped:', e); }
          }
          renderInlineAnalysis();
        } catch (e) {
          console.warn('[MAI v1.4.8] UI sync after base update failed:', e);
        }
      }, 650);
    });
    summaryObserver.observe(summary, { childList: true, subtree: true });
  };


  // -----------------------------
  // UI replacement
  // -----------------------------
  const addEnhancedStyles = () => {
    if (document.getElementById(`${APP}-v12-style`)) return;
    const style = document.createElement('style');
    style.id = `${APP}-v12-style`;
    style.textContent = `
      #${APP}-analysis-inline{margin-top:14px;display:flex;flex-direction:column;gap:12px}
      .${APP}-analysis-section{border:1px solid #e5e7eb;border-radius:15px;padding:14px;background:#fff}
      .${APP}-analysis-overview{background:linear-gradient(180deg,#fff,#f8fafc)}
      .${APP}-analysis-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .${APP}-analysis-heading h3{font-size:16px;margin:0;color:#111827}.${APP}-analysis-heading p{margin:3px 0 0;color:#6b7280;font-size:11px}
      .${APP}-overview-metrics,.${APP}-question-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
      .${APP}-metric-v12{background:#fff;border:1px solid #e5e7eb;border-radius:13px;padding:13px 11px;min-height:86px;display:flex;flex-direction:column;justify-content:center}.${APP}-metric-v12 b{font-size:23px;line-height:1.15}.${APP}-metric-v12 span{font-size:11px;font-weight:800;margin-top:5px}.${APP}-metric-v12 small{display:block;margin-top:3px;color:#6b7280;font-size:9px}
      .${APP}-level-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
      .${APP}-level-card{border:1px solid #e5e7eb;border-radius:12px;padding:10px;text-align:center;background:#fafafa}.${APP}-level-card strong{display:block;font-size:21px}.${APP}-level-card span{display:block;font-weight:800;font-size:11px}.${APP}-level-card small{font-size:9px;color:#6b7280}
      .${APP}-level-pill{display:inline-block;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}
      .${APP}-level-excellent{background:#dcfce7!important;color:#166534}.${APP}-level-very-good{background:#dbeafe!important;color:#1d4ed8}.${APP}-level-good{background:#e0e7ff!important;color:#4338ca}.${APP}-level-acceptable{background:#fef3c7!important;color:#92400e}.${APP}-level-weak{background:#fee2e2!important;color:#991b1b}.${APP}-level-not-solved{background:#f3f4f6!important;color:#374151}.${APP}-level-pending,.${APP}-level-unverified{background:#f3e8ff!important;color:#6b21a8}
      .${APP}-analysis-note{padding:12px;border-radius:11px;background:#eff6ff;color:#1e40af;font-size:11px;margin-top:10px}.${APP}-analysis-note-muted{background:#f3f4f6;color:#4b5563}.${APP}-analysis-warning{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.${APP}-grade-warning{color:#b45309;margin-top:3px}
      .${APP}-student-tools{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;padding:10px;margin:0 0 10px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc}
      .${APP}-student-tools label{display:flex;flex-direction:column;gap:4px;min-width:145px;font-size:10px;font-weight:800;color:#374151}.${APP}-student-tools select{height:34px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111827;padding:0 9px;font-size:11px;min-width:145px}.${APP}-student-reset{height:34px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;padding:0 12px;font-size:10px;font-weight:800;cursor:pointer}.${APP}-student-reset:hover{background:#f3f4f6}.${APP}-student-count{margin-inline-start:auto;align-self:center;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:10px;font-weight:800;white-space:nowrap}
      .${APP}-details{margin-top:10px}.${APP}-details summary{cursor:pointer;font-weight:800;font-size:12px;margin-bottom:8px}
      .${APP}-analysis-table td{line-height:1.6}.${APP}-difficulty{display:inline-block;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:800}.${APP}-difficulty.hard{background:#fee2e2;color:#991b1b}.${APP}-difficulty.medium{background:#fef3c7;color:#92400e}.${APP}-difficulty.easy{background:#dcfce7;color:#166534}
      .${APP}-btn[data-mode-disabled="1"]{opacity:.45;cursor:not-allowed!important;background:#f3f4f6!important;color:#6b7280!important}.${APP}-btn[data-running="1"]{opacity:.65;cursor:wait!important;pointer-events:none}
      .${APP}-collapse-btn{border:1px solid #d1d5db;background:#fff;border-radius:9px;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}.${APP}-head-tools{display:flex;align-items:center;gap:8px}
      #${APP}-panel.${APP}-collapsed>.${APP}-toolbar,#${APP}-panel.${APP}-collapsed>#${APP}-summary,#${APP}-panel.${APP}-collapsed>#${APP}-analysis-inline,#${APP}-panel.${APP}-collapsed>.${APP}-rights{display:none!important}
      @media(max-width:1100px){.${APP}-level-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:650px){.${APP}-level-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.${APP}-overview-metrics,.${APP}-question-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.${APP}-student-tools label,.${APP}-student-tools select{min-width:100%;width:100%}.${APP}-student-tools label{flex:1 1 100%}.${APP}-student-count{margin-inline-start:0}}
    `;
    document.head.appendChild(style);
  };

  const syncActionAvailability = () => {
    const outside = isOutsideSystem();
    const gate = gradeReportGate(document);
    const questionActions = new Set(['questions','printQuestions']);
    const finalReportActions = new Set(['dashboard','questions','printStudents','csv','excel']);
    const buttons = document.querySelectorAll(`#${APP}-panel [data-${APP.toLowerCase()}-action]`);

    for (const btn of buttons) {
      const action = btn.dataset[`${APP.toLowerCase()}Action`] || '';
      let disabled = false;
      let title = '';

      if (questionActions.has(action) && outside) {
        disabled = true;
        title = 'هذه الميزة غير متاحة لواجبات خارج النظام.';
      }

      if (finalReportActions.has(action) && !gate.ready) {
        disabled = true;
        title = gate.message;
      }

      btn.dataset.modeDisabled = disabled ? '1' : '0';
      btn.disabled = disabled;
      btn.title = title;
    }
  };

  const setPanelCollapsed = (panel, collapsed) => {
    if (!panel) return;
    panel.classList.toggle(`${APP}-collapsed`, !!collapsed);
    const btn = panel.querySelector(`[data-${APP.toLowerCase()}-collapse]`);
    if (btn) {
      btn.textContent = collapsed ? 'فتح اللوحة' : 'طي اللوحة';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    try { localStorage.setItem(PANEL_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  };

  const installPanelCollapse = (panel) => {
    const head = panel?.querySelector?.(`.${APP}-head`);
    const status = panel?.querySelector?.(`#${APP}-status`);
    if (!head || !status) return;

    let tools = head.querySelector(`.${APP}-head-tools`);
    if (!tools) {
      tools = document.createElement('div');
      tools.className = `${APP}-head-tools`;
      status.parentElement?.insertBefore(tools, status);
      tools.appendChild(status);
    }

    let btn = tools.querySelector(`[data-${APP.toLowerCase()}-collapse]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `${APP}-collapse-btn`;
      btn.dataset[`${APP.toLowerCase()}Collapse`] = '1';
      tools.appendChild(btn);
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPanelCollapsed(panel, !panel.classList.contains(`${APP}-collapsed`));
      });
    }

    let collapsed = false;
    try { collapsed = localStorage.getItem(PANEL_COLLAPSE_KEY) === '1'; } catch {}
    setPanelCollapsed(panel, collapsed);
  };

  const replacePanelToolbar = () => {
    const oldPanel = document.getElementById(`${APP}-panel`);
    if (!oldPanel) return null;

    // clone يزيل مستمع النواة القديم عن اللوحة فقط، بينما نبقي الـ modal الأصلي
    // لأن استيراد الدرجات في v1.1.7 يعتمد على مستمعه الداخلي.
    const panel = oldPanel.cloneNode(true);
    oldPanel.replaceWith(panel);

    const title = panel.querySelector(`.${APP}-title`);
    if (title) title.textContent = 'مدير الواجبات الذكي — تحليل متقدم';
    const sub = panel.querySelector(`.${APP}-sub`);
    if (sub) {
      const gate = gradeReportGate(document);
      sub.textContent = gate.ready
        ? `الواجب منتهي · التحليل والتقرير النهائي متاحان — v${VERSION}`
        : `${gate.label} · التقرير النهائي مؤجل — v${VERSION}`;
      sub.title = gate.message;
    }

    installPanelCollapse(panel);

    const toolbar = panel.querySelector(`.${APP}-toolbar`);
    if (toolbar) {
      toolbar.innerHTML = `
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="refresh">تحديث التحليل</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="identity">مزامنة الهوية</button>
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="importGrades">استيراد درجات Excel / CSV</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="dashboard">عرض لوحة موسعة</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="questions">تحليل الأسئلة</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="printQuestions">طباعة الأسئلة / النموذج</button>
        <button class="${APP}-btn ${APP}-primary" data-${APP.toLowerCase()}-action="printStudents">تقرير الواجب / PDF</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="csv">CSV</button>
        <button class="${APP}-btn" data-${APP.toLowerCase()}-action="excel">Excel</button>`;
    }

    panel.addEventListener('click', async (event) => {
      const btn = event.target.closest?.(`[data-${APP.toLowerCase()}-action]`);
      if (!btn || btn.disabled || btn.dataset.modeDisabled === '1' || btn.dataset.running === '1') return;
      const action = btn.dataset[`${APP.toLowerCase()}Action`];
      if (!action) return;

      const originalText = btn.textContent;
      btn.dataset.running = '1';
      btn.setAttribute('aria-busy', 'true');
      if (!['dashboard','csv','excel'].includes(action)) btn.textContent = `${originalText}…`;

      try {
        if (action === 'refresh') await refreshEnhanced(false);
        else if (action === 'identity') {
          setStatus('جاري مزامنة الهوية…', true);
          await base.buildIdentityBridge(true, state.gradeData?.students || []);
          await refreshEnhanced(false);
        }
        else if (action === 'importGrades') await base.openImportWizard();
        else if (action === 'dashboard') openDashboardEnhanced();
        else if (action === 'questions') await openQuestionAnalyticsEnhanced();
        else if (action === 'printQuestions') await printQuestionsEnhanced();
        else if (action === 'printStudents') await printAssignmentReportEnhanced();
        else if (action === 'csv') exportCSVEnhanced();
        else if (action === 'excel') exportExcelEnhanced();
        else throw new Error(`إجراء غير معروف: ${action}`);
      } catch (e) {
        console.error('[MAI v1.4.8] Action failed:', action, e);
        toast(String(e?.message || e), 'error');
      } finally {
        btn.dataset.running = '0';
        btn.removeAttribute('aria-busy');
        btn.textContent = originalText;
        setStatus('جاهز', false);
        syncActionAvailability();
      }
    });

    return panel;
  };

  const restoreCache = () => {
    if (!gradeReportGate(document).ready) return false;
    const cached = loadEnhancedCache();
    if (!cached?.analytics) return false;
    state.enhancedQuestionAnalytics = cached.analytics;
    state.questionAnalytics = cached.analytics;
    if (state.gradeData && cached.analytics?.results) applyResultGradesToStudents(cached.analytics.results);
    return true;
  };

  async function bootstrapGrade() {
    addEnhancedStyles();
    installStudentViewControls();

    // انتظر حتى تنتهي النواة من حقن واجهتها.
    for (let i = 0; i < 40 && !document.getElementById(`${APP}-panel`); i++) await sleep(100);
    const panel = replacePanelToolbar();
    if (!panel) return;

    try { base.version = VERSION; } catch {}
    const hadCache = restoreCache();
    if (state.gradeData) renderInlineAnalysis();
    setupBaseSummaryObserver();

    // نعرض الكاش فورًا إن وجد، ثم نجري تحديثًا حقيقيًا واحدًا لضمان أن البطاقات والأزرار تعتمد أحدث بيانات.
    try {
      await refreshEnhanced(false);
    } catch (e) {
      if (!hadCache) renderInlineAnalysis();
      toast(`تعذر التحديث التلقائي: ${String(e?.message || e)}`, 'error');
    }
  }

  // =====================================================================
  // Assignments Index — لوحة الواجبات الشاملة
  // =====================================================================
  const indexState = {
    assignments: [],
    query: '',
    publications: null,
    deep: null,
    busy: false,
    collectedAt: null,
    indexPagesScanned: 0,
    indexStopReason: '',
    indexCollectionMode: 'current'
  };

  const indexPanelId = `${APP}-index-panel`;
  const INDEX_MAX_PAGES = 100;

  const indexCardSelector = '.list-group .dga-defualt-card';

  const safeAbsoluteUrl = (href) => {
    if (!href) return '';
    try { return new URL(href, location.origin).href; }
    catch { return ''; }
  };

  const parseIndexPathSegments = (pathText) => clean(pathText)
    .split(/\s*-\s*/)
    .map(clean)
    .filter(Boolean);

  const parseIndexAssignmentCard = (card, index = 0) => {
    const title = clean(card.querySelector('h4.mb-1')?.textContent || '');
    const infoNode = card.querySelector('.flex-fill.mb-2.mb-sm-0') || card;
    const infoText = clean(infoNode.innerText || infoNode.textContent || '');

    const source = clean(infoText.match(/مصدر\s+الواجب\s*:\s*(.+?)(?=\s+طريقة\s+عرض\s+الواجب\s*:|\s+درجة\s+الواجب\s*:|$)/i)?.[1] || '');
    const displayMode = clean(infoText.match(/طريقة\s+عرض\s+الواجب\s*:\s*(.+?)(?=\s+درجة\s+الواجب\s*:|$)/i)?.[1] || '');
    const grade = num(infoText.match(/درجة\s+الواجب\s*:\s*([\d٠-٩۰-۹.,]+)/i)?.[1]);

    let curriculumPath = infoText;
    if (title && curriculumPath.startsWith(title)) curriculumPath = clean(curriculumPath.slice(title.length));
    const sourcePos = curriculumPath.search(/مصدر\s+الواجب\s*:/i);
    if (sourcePos >= 0) curriculumPath = clean(curriculumPath.slice(0, sourcePos));
    curriculumPath = curriculumPath.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

    const pathSegments = parseIndexPathSegments(curriculumPath);
    const course = pathSegments.length >= 3 ? pathSegments[pathSegments.length - 3] : '';
    const unit = pathSegments.length >= 2 ? pathSegments[pathSegments.length - 2] : '';
    const topic = pathSegments.length >= 1 ? pathSegments[pathSegments.length - 1] : '';

    const viewAnchor = card.querySelector('a[href*="/Teacher/Assignments/ViewAssignment/"]');
    const publishAnchor = card.querySelector('a[href*="/Teacher/Assignments/PublishAssignment"]');
    const publishedAnchor = card.querySelector('a[href*="/Teacher/Assignments/PublishedAssignments"]');

    const viewUrl = safeAbsoluteUrl(viewAnchor?.getAttribute('href'));
    const publishUrl = safeAbsoluteUrl(publishAnchor?.getAttribute('href'));
    const publishedUrl = safeAbsoluteUrl(publishedAnchor?.getAttribute('href'));
    const assignmentGuid = viewUrl.match(/\/ViewAssignment\/([A-F0-9]{32})/i)?.[1] ||
      publishedUrl.match(/[?&]assignmentId=([A-F0-9]{32})/i)?.[1] || '';

    const activationEl = [...card.querySelectorAll('[onclick]')]
      .find(el => /showActivateConfirmation\s*\(/i.test(el.getAttribute('onclick') || ''));
    const activationCode = activationEl?.getAttribute('onclick') || '';
    const internalId = activationCode.match(/showActivateConfirmation\s*\(\s*['"]?(\d+)['"]?/i)?.[1] || '';
    const action = activationCode.match(/showActivateConfirmation\s*\([^,]+,\s*['"](activate|deactivate)['"]/i)?.[1] || '';
    const active = action === 'deactivate' ? true : action === 'activate' ? false : null;

    return {
      index: index + 1,
      title,
      curriculumPath,
      pathSegments,
      course,
      unit,
      topic,
      source,
      displayMode,
      grade,
      active,
      internalId,
      assignmentGuid,
      viewUrl,
      publishUrl,
      publishedUrl
    };
  };

  const parseIndexAssignmentsFromDocument = (doc = document) => {
    const cards = [...doc.querySelectorAll(indexCardSelector)]
      .filter(card => card.querySelectorAll('a[href*="/Teacher/Assignments/ViewAssignment/"]').length === 1);

    const assignments = cards
      .map(parseIndexAssignmentCard)
      .filter(a => a.title && a.assignmentGuid);

    const unique = new Map();
    for (const a of assignments) if (!unique.has(a.assignmentGuid)) unique.set(a.assignmentGuid, a);
    return [...unique.values()];
  };

  const indexScopeUrl = () => {
    try { return new URL(location.pathname, location.origin).href; }
    catch { return location.origin + location.pathname; }
  };

  const indexPageUrl = (pageNumber = 1) => {
    const url = new URL(indexScopeUrl());
    url.searchParams.set('pageNumber', String(pageNumber));
    return url.href;
  };

  const collectIndexAssignments = () => {
    const assignments = parseIndexAssignmentsFromDocument(document);
    indexState.assignments = assignments.map((a, i) => ({ ...a, index: i + 1 }));
    indexState.collectedAt = new Date().toISOString();
    indexState.indexPagesScanned = assignments.length ? 1 : 0;
    indexState.indexStopReason = 'current_dom';
    indexState.indexCollectionMode = 'current';
    return indexState.assignments;
  };

  async function collectAllIndexAssignments({ silent = false } = {}) {
    const unique = new Map();
    let pagesScanned = 0;
    let stopReason = '';
    let firstPageFailed = false;

    for (let pageNumber = 1; pageNumber <= INDEX_MAX_PAGES; pageNumber++) {
      if (!silent) setIndexBusy(true, `جاري قراءة صفحة الواجبات ${pageNumber}…`);

      let doc = null;
      try {
        doc = await fetchTextDocument(indexPageUrl(pageNumber));
      } catch (e) {
        if (pageNumber === 1) firstPageFailed = true;
        stopReason = `fetch_error:${pageNumber}`;
        console.warn(`[MAI v${VERSION}] Could not fetch Index page ${pageNumber}:`, e);
        break;
      }

      const rows = parseIndexAssignmentsFromDocument(doc);

      // أول صفحة فارغة قد تعني أن GET تغيّر مستقبلاً؛ عندها نحتفظ بالـDOM الحالي بدل فقد البيانات.
      if (!rows.length) {
        stopReason = pageNumber === 1 ? 'empty_first_page' : 'empty_page';
        break;
      }

      pagesScanned++;
      let newCount = 0;
      for (const row of rows) {
        if (!unique.has(row.assignmentGuid)) {
          unique.set(row.assignmentGuid, row);
          newCount++;
        }
      }

      // حماية من أي خادم يعيد الصفحة نفسها مهما تغير pageNumber.
      if (pageNumber > 1 && newCount === 0) {
        stopReason = 'duplicate_page';
        break;
      }

      if (pageNumber === INDEX_MAX_PAGES) stopReason = 'max_pages';
    }

    // احتياط: لو تعذر جلب الصفحة الأولى نستخدم بطاقات الصفحة المفتوحة.
    if (!unique.size) {
      const fallback = parseIndexAssignmentsFromDocument(document);
      for (const row of fallback) if (!unique.has(row.assignmentGuid)) unique.set(row.assignmentGuid, row);
      if (fallback.length && !pagesScanned) pagesScanned = 1;
      if (firstPageFailed) stopReason = 'fallback_current_dom';
    }

    indexState.assignments = [...unique.values()].map((a, i) => ({ ...a, index: i + 1 }));
    indexState.collectedAt = new Date().toISOString();
    indexState.indexPagesScanned = pagesScanned;
    indexState.indexStopReason = stopReason || 'done';
    indexState.indexCollectionMode = 'all_pages';
    return indexState.assignments;
  }

  const loadIndexPublicationsCache = () => {
    const cached = safeJSONParse(localStorage.getItem(INDEX_PUBLICATIONS_CACHE_KEY), null);
    if (!cached || cached.pageUrl !== indexScopeUrl() || !cached.byGuid) return null;
    const current = new Set(indexState.assignments.map(a => a.assignmentGuid));
    const cachedKeys = Object.keys(cached.byGuid || {});
    if (!cachedKeys.some(k => current.has(k))) return null;
    indexState.publications = cached;
    return cached;
  };

  const saveIndexPublicationsCache = (cache) => {
    try { localStorage.setItem(INDEX_PUBLICATIONS_CACHE_KEY, JSON.stringify(cache)); } catch {}
  };

  const loadIndexDeepCache = () => {
    const cached = safeJSONParse(localStorage.getItem(INDEX_DEEP_CACHE_KEY), null);
    if (!cached || cached.pageUrl !== indexScopeUrl() || !cached.byGuid) return null;
    const current = new Set(indexState.assignments.map(a => a.assignmentGuid));
    if (!Object.keys(cached.byGuid || {}).some(k => current.has(k))) return null;
    indexState.deep = cached;
    return cached;
  };

  const saveIndexDeepCache = (cache) => {
    try { localStorage.setItem(INDEX_DEEP_CACHE_KEY, JSON.stringify(cache)); } catch {}
  };

  const publicationInfoFor = (assignment) => indexState.publications?.byGuid?.[assignment.assignmentGuid] || null;
  const deepInfoFor = (assignment) => indexState.deep?.byGuid?.[assignment.assignmentGuid] || null;

  // التقرير النهائي لا يُحتسب إلا بعد انتهاء جميع مرات نشر الواجب.
  // وجود أي نشر حالي يعني أن البيانات ما زالت قيد الاكتمال، لذلك نؤجل التقرير بالكامل.
  const reportEligibilityFor = (assignment) => {
    const pub = publicationInfoFor(assignment);
    if (!pub) return { eligible: false, status: 'unscanned', label: 'لم يتم فحص المنشورات', current: 0, ended: 0 };

    const deep = deepInfoFor(assignment);
    if (deep?.reportStatus === 'receiving_server_verified') {
      return { eligible: false, status: 'receiving', label: 'قيد الاستقبال (وقت الخادم)', current: Number(pub.currentGradeLinks || 0), ended: Number(pub.endedGradeLinks || 0) };
    }
    if (deep?.reportStatus === 'timing_unverified') {
      return { eligible: false, status: 'scan_incomplete', label: 'تعذر التحقق من وقت النهاية', current: Number(pub.currentGradeLinks || 0), ended: Number(pub.endedGradeLinks || 0) };
    }

    const current = Number(pub.currentGradeLinks || pub.current?.gradeLinks?.length || 0);
    const ended = Number(pub.endedGradeLinks || pub.ended?.gradeLinks?.length || 0);
    const currentOk = Array.isArray(pub.current?.errors) ? pub.current.errors.length === 0 : false;
    const endedOk = Array.isArray(pub.ended?.errors) ? pub.ended.errors.length === 0 : false;

    if (current > 0) return { eligible: false, status: 'receiving', label: 'قيد الاستقبال', current, ended };
    if (!currentOk || !endedOk) return { eligible: false, status: 'scan_incomplete', label: 'فحص المنشورات غير مكتمل', current, ended };
    if (ended > 0) return { eligible: true, status: 'ready', label: 'مكتمل', current, ended };
    return { eligible: false, status: 'no_publications', label: 'لا توجد منشورات منتهية', current, ended };
  };

  // نفس سلوك البحث في الأنشطة: يطبّق على الواجبات والتقرير والتصدير.
  const filteredIndexAssignments = () => {
    const tokens = norm(indexState.query || '').split(/\s+/).filter(Boolean);
    if (!tokens.length) return indexState.assignments || [];
    return (indexState.assignments || []).filter(row => {
      const fields = [row.title,row.course,row.unit,row.topic,row.source,row.internalId,row.assignmentGuid,row.displayMode];
      return tokens.every(token => fields.some(value => norm(value).includes(token)));
    });
  };

  const summarizeIndexAssignments = () => {
    const rows = filteredIndexAssignments();
    const grades = rows.map(r => r.grade).filter(Number.isFinite);
    const totalGrade = grades.reduce((a, b) => a + b, 0);
    const averageGrade = grades.length ? totalGrade / grades.length : null;
    const activeCount = rows.filter(r => r.active === true).length;
    const disabledCount = rows.filter(r => r.active === false).length;
    const sourceCounts = {};
    for (const row of rows) {
      const k = row.source || 'غير محدد';
      sourceCounts[k] = (sourceCounts[k] || 0) + 1;
    }
    const publicationLinks = rows.reduce((sum, row) => sum + (publicationInfoFor(row)?.gradeLinks?.length || 0), 0);
    const publishedAssignments = rows.filter(row => (publicationInfoFor(row)?.gradeLinks?.length || 0) > 0).length;
    const reportReadyCount = rows.filter(row => reportEligibilityFor(row).eligible).length;
    const reportReceivingCount = rows.filter(row => reportEligibilityFor(row).status === 'receiving').length;
    const reportDeferredCount = rows.filter(row => ['receiving','scan_incomplete'].includes(reportEligibilityFor(row).status)).length;
    const deepItems = rows.map(deepInfoFor).filter(x => x && x.analysisAvailable !== false && x.reportStatus !== 'receiving' && x.publicationsAnalyzed > 0);
    const deepStudentRecords = deepItems.reduce((sum, x) => sum + (x.studentRecords || 0), 0);
    const deepSubmitted = deepItems.reduce((sum, x) => sum + (x.submitted || 0), 0);
    const deepNotSubmitted = deepItems.reduce((sum, x) => sum + (x.notSubmitted || 0), 0);
    const deepScoreCount = deepItems.reduce((sum, x) => sum + (x.scoreCount || 0), 0);
    const deepScoreSum = deepItems.reduce((sum, x) => sum + (x.scorePercentSum || 0), 0);

    return {
      total: rows.length,
      activeCount,
      disabledCount,
      unknownStatusCount: rows.length - activeCount - disabledCount,
      totalGrade,
      averageGrade,
      highestGrade: grades.length ? Math.max(...grades) : null,
      lowestGrade: grades.length ? Math.min(...grades) : null,
      sourceCounts,
      uniqueSources: Object.keys(sourceCounts).length,
      publicationLinks,
      publishedAssignments,
      reportReadyCount,
      reportReceivingCount,
      reportDeferredCount,
      publicationsScanned: !!indexState.publications,
      deepScanned: !!indexState.deep,
      deepStudentRecords,
      deepSubmitted,
      deepNotSubmitted,
      deepAveragePercent: deepScoreCount ? deepScoreSum / deepScoreCount : null
    };
  };

  const indexStatusLabel = (row) => row.active === true ? 'مفعّل' : row.active === false ? 'معطل' : 'غير محدد';

  const indexMetric = (value, label, hint = '') => `
    <div class="${APP}-idx-metric">
      <strong>${esc(value)}</strong>
      <span>${esc(label)}</span>
      ${hint ? `<small>${esc(hint)}</small>` : ''}
    </div>`;

  const renderIndexPanel = () => {
    const panel = document.getElementById(indexPanelId);
    if (!panel) return;

    const summary = summarizeIndexAssignments();
    const sourceHtml = Object.entries(summary.sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<span class="${APP}-idx-chip">${esc(name)} <b>${count}</b></span>`)
      .join('');

    const body = panel.querySelector(`.${APP}-idx-body`);
    if (!body) return;

    body.innerHTML = `
      <div class="${APP}-idx-searchline">
        <label for="${APP}-idx-search"><b>البحث عن واجب</b></label>
        <input id="${APP}-idx-search" type="search" autocomplete="off" placeholder="اكتب اسم الواجب أو المادة أو الوحدة أو رقم الواجب…" value="${esc(indexState.query || '')}" aria-label="البحث في جميع الواجبات المحملة">
        <button id="${APP}-idx-find" class="${APP}-idx-btn primary" type="button">بحث عن واجب</button>
        <button id="${APP}-idx-clear" class="${APP}-idx-btn" type="button">مسح البحث</button>
        <span class="${APP}-idx-searchcount">عرض ${summary.total} من ${(indexState.assignments || []).length} واجب</span>
      </div>
      <div class="${APP}-idx-metrics">
        ${indexMetric(summary.total, 'إجمالي الواجبات', indexState.indexPagesScanned ? `من ${indexState.indexPagesScanned} صفحة` : '')}
        ${indexMetric(summary.activeCount, 'مفعّلة', summary.disabledCount ? `${summary.disabledCount} معطل` : '')}
        ${indexMetric(fmt(summary.totalGrade, 4), 'مجموع الدرجات')}
        ${indexMetric(Number.isFinite(summary.averageGrade) ? fmt(summary.averageGrade, 4) : '—', 'متوسط درجة الواجب')}
        ${indexMetric(Number.isFinite(summary.highestGrade) ? fmt(summary.highestGrade, 4) : '—', 'أعلى درجة')}
        ${indexMetric(Number.isFinite(summary.lowestGrade) ? fmt(summary.lowestGrade, 4) : '—', 'أقل درجة')}
        ${indexMetric(summary.publicationsScanned ? summary.publicationLinks : '—', 'روابط رصد مكتشفة', summary.publicationsScanned ? `${summary.publishedAssignments} واجب له رصد` : 'اضغط فحص المنشورات')}
        ${indexMetric(summary.deepScanned && Number.isFinite(summary.deepAveragePercent) ? `${fmt(summary.deepAveragePercent)}%` : '—', 'متوسط الأداء العام', summary.deepScanned ? `${summary.deepStudentRecords} سجل طالب · ${summary.reportReceivingCount} قيد الاستقبال` : 'للواجبات المنتهية فقط')}
      </div>

      ${sourceHtml ? `<div class="${APP}-idx-sources"><b>مصادر الواجبات:</b>${sourceHtml}</div>` : ''}

      <div class="${APP}-idx-note">
        يجمع «تحديث السجل» جميع صفحات إدارة الواجبات تلقائيًا ويزيل التكرار بالـ Assignment GUID. «فحص المنشورات» يكتشف الحالية والمنتهية، أما تقرير الأداء فلا يُحتسب إلا للواجب الذي انتهت جميع مرات نشره؛ أي واجب ما زال قيد الاستقبال يُؤجل تقريره حتى ينتهي.
      </div>

      <div class="${APP}-idx-table-wrap">
        <table class="${APP}-idx-table">
          <thead><tr>
            <th>#</th><th>الواجب</th><th>المقرر</th><th>الوحدة / الموضوع</th><th>المصدر</th><th>الدرجة</th><th>الحالة</th><th>الرصد</th><th>نسبة الحل / التسليم</th><th>المتوسط</th><th>لم يحل / لم يسلّم</th><th>روابط</th>
          </tr></thead>
          <tbody>
            ${filteredIndexAssignments().map(row => {
              const pub = publicationInfoFor(row);
              const deep = deepInfoFor(row);
              const reportState = reportEligibilityFor(row);
              const pubCount = pub ? (pub.gradeLinks?.length || 0) : null;
              const pubCell = !pub
                ? '—'
                : pub.error && !pub.scanComplete
                  ? `تعذر<div class="${APP}-idx-tiny error">فشل فحص المنشورات</div>`
                  : pubCount > 0
                    ? `${pubCount}<div class="${APP}-idx-tiny">${pub.currentGradeLinks || 0} حالي · ${pub.endedGradeLinks || 0} منتهي</div>${reportState.status === 'receiving' ? `<div class="${APP}-idx-tiny">التقرير مؤجل حتى انتهاء الاستقبال</div>` : ''}`
                    : `لا يوجد<div class="${APP}-idx-tiny">0 رابط رصد مكتشف</div>`;
              const deepAvailable = !!(reportState.eligible && deep && deep.analysisAvailable !== false && deep.publicationsAnalyzed > 0);
              return `<tr>
                <td>${row.index}</td>
                <td><b>${esc(row.title)}</b>${row.internalId ? `<div class="${APP}-idx-tiny">ID: ${esc(row.internalId)}</div>` : ''}</td>
                <td>${esc(row.course || '—')}</td>
                <td>${esc([row.unit, row.topic].filter(Boolean).join(' ← ') || '—')}</td>
                <td>${esc(row.source || '—')}<div class="${APP}-idx-tiny">${esc(row.displayMode || '')}</div></td>
                <td>${Number.isFinite(row.grade) ? fmt(row.grade, 4) : '—'}</td>
                <td><span class="${APP}-idx-status ${row.active === true ? 'on' : row.active === false ? 'off' : ''}">${esc(indexStatusLabel(row))}</span></td>
                <td>${pubCell}</td>
                <td>${reportState.status === 'receiving' ? '<b>قيد الاستقبال</b>' : deepAvailable && deep.submissionAvailable ? `${fmt(deep.submissionRate)}%${deep.submissionMethod === 'grade_feedback_inference' ? `<div class="${APP}-idx-tiny">مستنتجة من الرصد والملاحظات${deep.submissionUnknown ? ` · ${deep.submissionUnknown} غير محسوم` : ''}</div>` : ''}` : 'غير متاح'}</td>
                <td>${deepAvailable && Number.isFinite(deep.averagePercent) ? `${fmt(deep.averagePercent)}%` : '—'}${deepAvailable && deep?.gradeDiscrepancies ? `<div class="${APP}-idx-tiny error">${deep.gradeDiscrepancies} تعارض درجة</div>` : ''}</td>
                <td>${deepAvailable && deep.submissionAvailable ? `${deep.notSubmitted}${deep.submissionUnknown ? `<div class="${APP}-idx-tiny">${deep.submissionUnknown} غير محسوم</div>` : ''}` : '—'}</td>
                <td class="${APP}-idx-links">
                  ${row.viewUrl ? `<a href="${esc(row.viewUrl)}" target="_blank" rel="noopener">استعراض</a>` : ''}
                  ${row.publishedUrl ? `<a href="${esc(row.publishedUrl)}" target="_blank" rel="noopener">المرسلة</a>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  const setIndexBusy = (busy, text = '') => {
    indexState.busy = !!busy;
    const panel = document.getElementById(indexPanelId);
    if (!panel) return;
    const status = panel.querySelector(`.${APP}-idx-status-text`);
    if (status) {
      const pages = indexState.indexPagesScanned ? ` · ${indexState.indexPagesScanned} صفحة` : '';
      status.textContent = busy ? (text || 'جارٍ المعالجة…') : `جاهز · ${indexState.assignments.length} واجب${pages}`;
    }
    panel.querySelectorAll(`[data-${APP.toLowerCase()}-index-action]`).forEach(btn => { btn.disabled = !!busy; });
  };

  const setIndexCollapsed = (panel, collapsed) => {
    if (!panel) return;
    panel.classList.toggle(`${APP}-idx-collapsed`, !!collapsed);
    const btn = panel.querySelector(`[data-${APP.toLowerCase()}-index-collapse]`);
    if (btn) {
      btn.textContent = collapsed ? 'فتح اللوحة' : 'طي اللوحة';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    try { localStorage.setItem(INDEX_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  };

  const addIndexStyles = () => {
    if (document.getElementById(`${APP}-index-style`)) return;
    const style = document.createElement('style');
    style.id = `${APP}-index-style`;
    style.textContent = `
      #${indexPanelId}{direction:rtl;font-family:Tahoma,Arial,sans-serif;border:1px solid #dbe3ee;border-radius:14px;background:#fff;margin:14px 0 18px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.06)}
      #${indexPanelId} .${APP}-idx-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;background:linear-gradient(135deg,#f8fafc,#eef6ff);border-bottom:1px solid #e5e7eb}
      #${indexPanelId} .${APP}-idx-title{font-size:18px;font-weight:900;color:#111827;margin:0}#${indexPanelId} .${APP}-idx-sub{font-size:11px;color:#64748b;margin-top:4px}
      #${indexPanelId} .${APP}-idx-head-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}#${indexPanelId} .${APP}-idx-status-text{font-size:10px;color:#64748b;font-weight:700}
      #${indexPanelId} button{font-family:inherit}#${indexPanelId} .${APP}-idx-collapse,#${indexPanelId} .${APP}-idx-btn{border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:9px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}
      #${indexPanelId} .${APP}-idx-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}#${indexPanelId} .${APP}-idx-btn:disabled{opacity:.55;cursor:wait}
      #${indexPanelId} .${APP}-idx-toolbar{display:flex;gap:7px;flex-wrap:wrap;padding:11px 14px;border-bottom:1px solid #eef2f7;background:#fff}
      #${indexPanelId} .${APP}-idx-body{padding:14px}#${indexPanelId}.${APP}-idx-collapsed .${APP}-idx-toolbar,#${indexPanelId}.${APP}-idx-collapsed .${APP}-idx-body{display:none!important}
      #${indexPanelId} .${APP}-idx-metrics{display:grid;grid-template-columns:repeat(8,minmax(105px,1fr));gap:8px;margin-bottom:12px}
      #${indexPanelId} .${APP}-idx-metric{border:1px solid #e5e7eb;border-radius:11px;padding:10px;text-align:center;background:#fafafa;min-height:76px;display:flex;flex-direction:column;justify-content:center}
      #${indexPanelId} .${APP}-idx-metric strong{font-size:21px;color:#111827;line-height:1.2}#${indexPanelId} .${APP}-idx-metric span{font-size:10px;font-weight:800;color:#475569;margin-top:4px}#${indexPanelId} .${APP}-idx-metric small{font-size:9px;color:#94a3b8;margin-top:2px}
      #${indexPanelId} .${APP}-idx-sources{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;margin:8px 0 10px;color:#475569}#${indexPanelId} .${APP}-idx-chip{background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 7px;border-radius:999px}
      #${indexPanelId} .${APP}-idx-searchline{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:13px}
      #${indexPanelId} .${APP}-idx-searchline label{color:#334155;font-size:12px}
      #${indexPanelId} .${APP}-idx-searchline input{flex:1 1 300px;min-width:190px;border:1px solid #cbd5e1;border-radius:9px;padding:10px 12px;font:12px Tahoma,Arial}
      #${indexPanelId} .${APP}-idx-searchcount{font-size:11px;color:#64748b;font-weight:700}
      #${indexPanelId} .${APP}-idx-note{font-size:10px;line-height:1.7;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px 10px;margin-bottom:10px}
      #${indexPanelId} .${APP}-idx-table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:10px}#${indexPanelId} .${APP}-idx-table{width:100%;border-collapse:collapse;min-width:1220px;font-size:10px}
      #${indexPanelId} .${APP}-idx-table th,#${indexPanelId} .${APP}-idx-table td{border-bottom:1px solid #edf2f7;padding:8px 7px;text-align:right;vertical-align:top}#${indexPanelId} .${APP}-idx-table th{background:#f8fafc;position:sticky;top:0;z-index:1;font-weight:900;color:#334155}
      #${indexPanelId} .${APP}-idx-table tr:last-child td{border-bottom:0}#${indexPanelId} .${APP}-idx-tiny{font-size:8px;color:#94a3b8;margin-top:2px}#${indexPanelId} .${APP}-idx-tiny.error{color:#b91c1c}
      #${indexPanelId} .${APP}-idx-status{display:inline-block;padding:3px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-weight:800}#${indexPanelId} .${APP}-idx-status.on{background:#dcfce7;color:#166534}#${indexPanelId} .${APP}-idx-status.off{background:#fee2e2;color:#991b1b}
      #${indexPanelId} .${APP}-idx-links{white-space:nowrap}#${indexPanelId} .${APP}-idx-links a{display:inline-block;margin-left:5px;text-decoration:none;font-weight:800;color:#1d4ed8}
      @media(max-width:1200px){#${indexPanelId} .${APP}-idx-metrics{grid-template-columns:repeat(4,minmax(100px,1fr))}}@media(max-width:700px){#${indexPanelId} .${APP}-idx-head{align-items:flex-start;flex-direction:column}#${indexPanelId} .${APP}-idx-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  };

  const createIndexPanel = () => {
    let panel = document.getElementById(indexPanelId);
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = indexPanelId;
    panel.innerHTML = `
      <div class="${APP}-idx-head">
        <div><div class="${APP}-idx-title">لوحة الواجبات الشاملة</div><div class="${APP}-idx-sub">سجل وتقارير صفحة إدارة الواجبات — v${VERSION}</div></div>
        <div class="${APP}-idx-head-tools"><span class="${APP}-idx-status-text">جاهز</span><button type="button" class="${APP}-idx-collapse" data-${APP.toLowerCase()}-index-collapse>طي اللوحة</button></div>
      </div>
      <div class="${APP}-idx-toolbar">
        <button type="button" class="${APP}-idx-btn primary" data-${APP.toLowerCase()}-index-action="refresh">تحديث السجل</button>
        <button type="button" class="${APP}-idx-btn" data-${APP.toLowerCase()}-index-action="publications">فحص المنشورات</button>
        <button type="button" class="${APP}-idx-btn primary" data-${APP.toLowerCase()}-index-action="deep">تحليل أداء الواجبات المنتهية</button>
        <button type="button" class="${APP}-idx-btn primary" data-${APP.toLowerCase()}-index-action="print">تقرير / PDF</button>
        <button type="button" class="${APP}-idx-btn" data-${APP.toLowerCase()}-index-action="csv">CSV</button>
        <button type="button" class="${APP}-idx-btn" data-${APP.toLowerCase()}-index-action="excel">Excel</button>
      </div>
      <div class="${APP}-idx-body"></div>`;

    // لا نستخدم أول .list-group في الصفحة؛ مدرستي تحتوي قوائم مخفية كثيرة في المودالات والقوائم العامة.
    // نربط اللوحة بقائمة الواجبات نفسها عبر أول بطاقة واجب مؤكدة.
    const firstAssignmentCard = document.querySelector(indexCardSelector);
    const assignmentList = firstAssignmentCard?.closest('.list-group') || null;
    const assignmentSection = firstAssignmentCard?.closest('.card') || null;

    if (assignmentList?.parentElement) {
      assignmentList.parentElement.insertBefore(panel, assignmentList);
    } else if (assignmentSection) {
      assignmentSection.prepend(panel);
    } else {
      (document.querySelector('#mainDiv .card-body') || document.querySelector('#mainDiv') || document.body).prepend(panel);
    }

    panel.querySelector(`[data-${APP.toLowerCase()}-index-collapse]`)?.addEventListener('click', () => {
      setIndexCollapsed(panel, !panel.classList.contains(`${APP}-idx-collapsed`));
    });

    // تفويض الأحداث حتى يبقى البحث فعالًا بعد كل تحديث للسجل.
    panel.addEventListener('input', event => {
      if(event.target?.id !== `${APP}-idx-search`)return;
      const pos=event.target.selectionStart ?? event.target.value.length;
      indexState.query=event.target.value;
      renderIndexPanel();
      const input=panel.querySelector(`#${APP}-idx-search`);
      if(input){input.focus();try{input.setSelectionRange(pos,pos);}catch{}}
    });
    panel.addEventListener('click', event => {
      const id=event.target?.id;
      if(id===`${APP}-idx-find`){panel.querySelector(`#${APP}-idx-search`)?.focus();}
      if(id===`${APP}-idx-clear`){indexState.query='';renderIndexPanel();panel.querySelector(`#${APP}-idx-search`)?.focus();}
    });
    panel.addEventListener('click', async (event) => {
      const btn = event.target.closest?.(`[data-${APP.toLowerCase()}-index-action]`);
      if (!btn || btn.disabled || indexState.busy) return;
      const action = btn.dataset[`${APP.toLowerCase()}IndexAction`];
      if (!action) return;

      try {
        if (action === 'refresh') {
          setIndexBusy(true, 'جاري تحديث سجل الواجبات من جميع الصفحات…');
          await collectAllIndexAssignments();
          loadIndexPublicationsCache();
          loadIndexDeepCache();
          renderIndexPanel();
          toast(`تمت قراءة ${indexState.assignments.length} واجبًا من ${indexState.indexPagesScanned || 1} صفحة.`, 'success');
        } else if (action === 'publications') {
          await auditIndexPublications();
        } else if (action === 'deep') {
          await runIndexDeepAnalysis();
        } else if (action === 'print') {
          printIndexReport();
        } else if (action === 'csv') {
          exportIndexCSV();
        } else if (action === 'excel') {
          exportIndexExcel();
        }
      } catch (e) {
        console.error('[MAI v1.4.8] Index action failed:', action, e);
        toast(String(e?.message || e), 'error');
      } finally {
        setIndexBusy(false);
      }
    });

    let collapsed = false;
    try { collapsed = localStorage.getItem(INDEX_COLLAPSE_KEY) === '1'; } catch {}
    setIndexCollapsed(panel, collapsed);
    return panel;
  };

  const extractGradeLinksFromPublishedDocument = (doc, meta = {}) => {
    const found = [];
    const push = (href, context = '') => {
      const abs = safeAbsoluteUrl(href);
      if (!/\/Teacher\/Assignments\/GradeAssignment\/[A-F0-9]{32}/i.test(abs)) return;
      if (!found.some(x => x.href === abs)) {
        found.push({
          href: abs,
          context: clean(context).slice(0, 520),
          publicationState: meta.publicationState || '',
          isDue: meta.isDue ?? null,
          pageNumber: meta.pageNumber || 1
        });
      }
    };

    for (const a of doc.querySelectorAll('a[href*="/Teacher/Assignments/GradeAssignment/"]')) {
      push(a.getAttribute('href'), a.closest('.dga-defualt-card,.card,tr,.list-group-item')?.innerText || a.parentElement?.innerText || a.innerText);
    }

    for (const el of doc.querySelectorAll('[onclick]')) {
      const onclick = el.getAttribute('onclick') || '';
      const m = onclick.match(/(\/Teacher\/Assignments\/GradeAssignment\/[A-F0-9]{32}[^'"\s)]*)/i);
      if (m) push(m[1], el.closest('.dga-defualt-card,.card,tr,.list-group-item')?.innerText || el.innerText);
    }

    return found;
  };

  const publishedPageCount = (doc) => {
    const text = clean(doc?.body?.innerText || '');
    const fromText = num(text.match(/صفحة\s+[\d٠-٩۰-۹]+\s+من\s+([\d٠-٩۰-۹]+)/i)?.[1]);
    if (Number.isFinite(fromText) && fromText > 0) return Math.min(50, Math.max(1, Math.trunc(fromText)));

    const nums = [...(doc?.querySelectorAll?.('a[href]') || [])]
      .map(a => {
        try { return Number(new URL(a.getAttribute('href'), location.origin).searchParams.get('pageNumber')); }
        catch { return 0; }
      })
      .filter(n => Number.isFinite(n) && n > 0);
    return nums.length ? Math.min(50, Math.max(...nums)) : 1;
  };

  const publicationStatusUrl = (row, isDue, pageNumber = 1) => {
    const url = new URL(row.publishedUrl, location.origin);
    // نوحد أسماء مفاتيح الاستعلام لأن مدرستي تستخدم AssignmentId/assignmentId بالتبادل.
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase() === 'assignmentid') url.searchParams.delete(key);
      if (key.toLowerCase() === 'isdue') url.searchParams.delete(key);
      if (key.toLowerCase() === 'pagenumber') url.searchParams.delete(key);
    }
    url.searchParams.set('AssignmentId', row.assignmentGuid);
    url.searchParams.set('pageNumber', String(pageNumber));
    url.searchParams.set('IsDue', isDue ? 'True' : 'False');
    if (![...url.searchParams.keys()].some(k => k.toLowerCase() === 'searchclassroom')) url.searchParams.set('searchClassRoom', '0');
    if (![...url.searchParams.keys()].some(k => k.toLowerCase() === 'type')) url.searchParams.set('type', '0');
    return url.href;
  };

  async function scanPublicationBucket(row, isDue) {
    const publicationState = isDue ? 'منتهي' : 'حالي';
    const gradeLinks = [];
    const errors = [];
    let totalPages = 1;
    let emptyMessage = '';

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const url = publicationStatusUrl(row, isDue, pageNumber);
      try {
        const doc = await fetchTextDocument(url);
        if (pageNumber === 1) totalPages = publishedPageCount(doc);
        const bodyText = clean(doc.body?.innerText || '');
        if (/لا\s+توجد\s+واجبات\s+(?:حالية|منتهية)/i.test(bodyText)) {
          emptyMessage = bodyText.match(/لا\s+توجد\s+واجبات\s+(?:حالية|منتهية)/i)?.[0] || '';
        }
        const links = extractGradeLinksFromPublishedDocument(doc, { publicationState, isDue, pageNumber });
        for (const link of links) if (!gradeLinks.some(x => x.href === link.href)) gradeLinks.push(link);
      } catch (e) {
        errors.push(`صفحة ${pageNumber}: ${String(e?.message || e)}`);
        if (pageNumber === 1) break;
      }
    }

    return {
      publicationState,
      isDue,
      totalPages,
      gradeLinks,
      count: gradeLinks.length,
      emptyMessage,
      errors
    };
  }

  async function auditIndexPublications() {
    if (!indexState.assignments.length) await collectAllIndexAssignments();
    if (!indexState.assignments.length) throw new Error('لم أجد واجبات في صفحة إدارة الواجبات.');

    setIndexBusy(true, 'جاري فحص الواجبات الحالية والمنتهية…');
    const byGuid = {};
    const concurrency = 2;

    for (let i = 0; i < indexState.assignments.length; i += concurrency) {
      const batch = indexState.assignments.slice(i, i + concurrency);
      const part = await Promise.all(batch.map(async (row) => {
        if (!row.publishedUrl) {
          return [row.assignmentGuid, {
            title: row.title,
            fetchedAt: new Date().toISOString(),
            gradeLinks: [],
            scanComplete: false,
            error: 'لا يوجد رابط للواجبات المرسلة'
          }];
        }

        const [current, ended] = await Promise.all([
          scanPublicationBucket(row, false),
          scanPublicationBucket(row, true)
        ]);

        const gradeLinks = [];
        for (const link of [...current.gradeLinks, ...ended.gradeLinks]) {
          if (!gradeLinks.some(x => x.href === link.href)) gradeLinks.push(link);
        }

        const errors = [...current.errors.map(x => `الحالية: ${x}`), ...ended.errors.map(x => `المنتهية: ${x}`)];
        return [row.assignmentGuid, {
          title: row.title,
          fetchedAt: new Date().toISOString(),
          gradeLinks,
          current,
          ended,
          currentGradeLinks: current.gradeLinks.length,
          endedGradeLinks: ended.gradeLinks.length,
          scanComplete: current.errors.length === 0 && ended.errors.length === 0,
          error: errors.length && !gradeLinks.length ? errors.join(' | ') : '',
          warnings: errors
        }];
      }));
      for (const [guid, value] of part) byGuid[guid] = value;
      setIndexBusy(true, `فحص الحالية والمنتهية ${Math.min(i + concurrency, indexState.assignments.length)} / ${indexState.assignments.length}`);
    }

    const cache = { pageUrl: indexScopeUrl(), savedAt: new Date().toISOString(), schemaVersion: 5, byGuid };
    indexState.publications = cache;
    saveIndexPublicationsCache(cache);
    indexState.deep = null;
    try { localStorage.removeItem(INDEX_DEEP_CACHE_KEY); } catch {}
    renderIndexPanel();

    const summary = summarizeIndexAssignments();
    toast(`اكتمل الفحص: ${summary.publicationLinks} رابط رصد عبر ${summary.publishedAssignments} واجب.`, 'success');
    return cache;
  }


  const extractGradePageParamsFromDocument = (doc) => {
    const scripts = [...(doc?.scripts || [])]
      .map(s => s.textContent || '')
      .filter(text => /GetGradeStudentsList|loadStudents/i.test(text));
    const src = scripts.join('\n');
    if (!src) return null;

    const get = (key) => {
      const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return src.match(new RegExp(`${k}\\s*:\\s*['"]([^'"]*)['"]`))?.[1] ??
        src.match(new RegExp(`${k}\\s*:\\s*(true|false|[\\d.]+)`, 'i'))?.[1] ?? '';
    };

    const out = {
      schoolId: get('schoolId'), subjectId: get('subjectId'), teacherId: get('teacherId'), semesterId: get('semesterId'),
      assignmentId: get('assignmentId'), publishedAssignmentId: get('publishedAssignmentId'), lectureClassId: get('lectureClassId'),
      isGradebook: get('isGradebook'), isPublished: get('isPublished'), isCurrentTeacher: get('isCurrentTeacher'), isQuran: get('isQuran'),
      assigmentStarts: get('assigmentStarts'), grade: get('grade'), solvingType: get('solvingType')
    };
    return out.assignmentId || out.publishedAssignmentId ? out : null;
  };

  const parseIndexGradeStudentsHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const groups = new Map();
    [...doc.querySelectorAll('[name^="List["]')].forEach(el => {
      const m = el.name?.match(/^List\[(\d+)\]\.(.+)$/);
      if (!m) return;
      const index = Number(m[1]);
      if (!groups.has(index)) groups.set(index, {});
      groups.get(index)[m[2]] = el.value;
    });

    const rows = [];
    for (const [index, fields] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const studentId = clean(fields.StudentId);
      if (!studentId) continue;
      const block = findGradeStudentVisualBlockEnhanced(doc, index, studentId);
      const blockText = clean(block?.innerText || block?.textContent || '');
      const className = blockText.match(/الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+الدرجة|\s+الإجابة|\s+ملاحظات|$)/i)?.[1]?.trim() || '';
      const resultLink = block
        ? [...block.querySelectorAll('a[href]')].find(a => /StudentAssignmentResult/i.test(a.getAttribute('href') || ''))
        : null;
      rows.push({
        studentId,
        recordId: clean(fields.Id),
        className,
        hasAnswer: String(fields.hasAnswer).toLowerCase() === 'true',
        isApproved: String(fields.IsApproved).toLowerCase() === 'true',
        solvingType: clean(fields.SolvingType),
        maxGrade: num(fields.TotalGrade),
        currentGrade: num(fields.Grade),
        autoGrade: num(fields.AutoGrade),
        feedback: clean(fields.feedBack),
        resultUrl: resultLink ? safeAbsoluteUrl(resultLink.getAttribute('href')) : '',
        resolvedGrade: num(fields.Grade),
        resolvedMaxGrade: num(fields.TotalGrade),
        gradeDiscrepancy: false
      });
    }
    return rows;
  };

  async function fetchIndexGradeRows(gradeUrl) {
    const doc = await fetchTextDocument(gradeUrl);
    const timing = getGradePublicationTiming(doc);
    const params = extractGradePageParamsFromDocument(doc);
    if (!params) throw new Error('تعذر قراءة إعدادات صفحة رصد الدرجات.');

    const merged = new Map();
    let stagnant = 0;
    for (let pageNumber = 1; pageNumber <= 30; pageNumber++) {
      const response = await postFormEnhanced('/Teacher/Assignments/GetGradeStudentsList', {
        ...params, pageNumber, pageSize: 200, studentIds: '', status: '', sortBy: ''
      });
      const rows = parseIndexGradeStudentsHtml(responseHtmlEnhanced(response));
      let added = 0;
      for (const row of rows) {
        const key = String(row.studentId);
        if (!merged.has(key)) added++;
        merged.set(key, row);
      }
      if (!rows.length) break;
      if (!added) stagnant++; else stagnant = 0;
      if (stagnant >= 2) break;
      const totalPages = Number(response?.totalPages);
      if (Number.isFinite(totalPages) && totalPages > 0 && pageNumber >= totalPages) break;
    }
    return { doc, params, timing, rows: [...merged.values()] };
  };

  const resolveIndexSingleResultLink = async (row, params) => {
    if (!row?.studentId) return '';
    const response = await postFormEnhanced('/Teacher/Assignments/GetGradeStudentsList', {
      ...params, pageNumber: 1, pageSize: 10, studentIds: [String(row.studentId)], status: '', sortBy: ''
    });
    const doc = new DOMParser().parseFromString(responseHtmlEnhanced(response), 'text/html');
    const link = doc.querySelector('a[href*="StudentAssignmentResult"]');
    return link ? safeAbsoluteUrl(link.getAttribute('href')) : '';
  };

  async function verifyFractionalIndexResults(rows, params) {
    const candidates = rows.filter(row =>
      row.solvingType === '4' && row.hasAnswer && Number.isFinite(row.maxGrade) &&
      (!Number.isInteger(row.maxGrade) || row.maxGrade < 1)
    );
    if (!candidates.length) return;

    const concurrency = 4;
    for (let i = 0; i < candidates.length; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      await Promise.all(batch.map(async row => {
        try {
          const resultUrl = await resolveIndexSingleResultLink(row, params);
          if (!resultUrl) return;
          const resultDoc = await fetchTextDocument(resultUrl);
          const summary = parseResultSummaryEnhanced(resultDoc);
          if (Number.isFinite(summary.resultScore)) {
            const pageGrade = row.currentGrade;
            row.resolvedGrade = summary.resultScore;
            if (Number.isFinite(summary.resultMaxScore) && summary.resultMaxScore > 0) row.resolvedMaxGrade = summary.resultMaxScore;
            row.gradeDiscrepancy = Number.isFinite(pageGrade) && !nearlyEqual(pageGrade, summary.resultScore);
          }
        } catch (e) {
          console.warn('[MAI v1.4.8] Fractional result verification skipped:', e);
        }
      }));
    }
  };

  async function analyzeIndexGradePage(gradeUrl) {
    const { params, rows, timing } = await fetchIndexGradeRows(gradeUrl);

    if (timing.status !== 'ended') {
      return {
        gradeUrl,
        excluded: true,
        publicationStatus: timing.status,
        exclusionReason: timing.status === 'receiving'
          ? `قيد الاستقبال حتى ${formatGradeTimingDate(timing.endDate)}`
          : 'تعذر التحقق من وقت نهاية النشر من صفحة الرصد',
        serverDateTime: timing.serverRaw,
        publishedEndTime: timing.endRaw
      };
    }

    if (!rows.length) throw new Error('لم يتم العثور على سجلات طلاب في صفحة الرصد.');
    await verifyFractionalIndexResults(rows, params);

    const outside = rows.length ? rows.every(row => row.solvingType === '3') : String(params.solvingType) === '3';
    const outsideStates = outside ? rows.map(row => ({ row, state: classifyOutsideSubmission(row) })) : [];
    const submitted = outside
      ? outsideStates.filter(x => x.state.key === 'submitted').map(x => x.row)
      : rows.filter(row => row.hasAnswer);
    const notSubmitted = outside
      ? outsideStates.filter(x => x.state.key === 'not_submitted').length
      : Math.max(0, rows.length - submitted.length);
    const submissionUnknown = outside
      ? outsideStates.filter(x => x.state.key === 'unknown').length
      : 0;
    const submissionAvailable = outside ? (submitted.length + notSubmitted > 0) : true;
    const scoredPercents = rows.map(row => {
      const achieved = Number.isFinite(row.resolvedGrade) ? row.resolvedGrade : row.currentGrade;
      const max = Number.isFinite(row.resolvedMaxGrade) ? row.resolvedMaxGrade : row.maxGrade;
      return Number.isFinite(achieved) && Number.isFinite(max) && max > 0 ? (achieved / max) * 100 : null;
    }).filter(Number.isFinite);
    const classes = [...new Set(rows.map(row => clean(row.className)).filter(Boolean))];

    return {
      gradeUrl,
      studentRecords: rows.length,
      outsideSystem: outside,
      submissionAvailable,
      submissionVerifiable: outside ? submissionUnknown === 0 : true,
      submissionMethod: outside ? 'grade_feedback_inference' : 'hasAnswer',
      submitted: submitted.length,
      notSubmitted,
      submissionUnknown,
      submissionRate: submissionAvailable ? pct(submitted.length, rows.length) : null,
      scoreCount: scoredPercents.length,
      scorePercentSum: scoredPercents.reduce((a, b) => a + b, 0),
      averagePercent: scoredPercents.length ? scoredPercents.reduce((a, b) => a + b, 0) / scoredPercents.length : null,
      highestPercent: scoredPercents.length ? Math.max(...scoredPercents) : null,
      lowestPercent: scoredPercents.length ? Math.min(...scoredPercents) : null,
      gradeDiscrepancies: rows.filter(row => row.gradeDiscrepancy).length,
      classes,
      solvingType: rows.find(row => row.solvingType)?.solvingType || params.solvingType || ''
    };
  };

  const aggregateIndexDeepAssignment = (assignment, pages) => {
    const receiving = pages.filter(p => p?.excluded && p.publicationStatus === 'receiving');
    const unverified = pages.filter(p => p?.excluded && p.publicationStatus !== 'receiving');

    // إذا كانت أي مرة نشر ما زالت جارية، نؤجل تقرير الواجب كله حتى تنتهي.
    if (receiving.length || unverified.length) {
      return {
        title: assignment.title,
        analysisAvailable: false,
        reportStatus: receiving.length ? 'receiving_server_verified' : 'timing_unverified',
        exclusionReason: receiving.length
          ? 'قيد الاستقبال حسب ServerDateTime و PublishedEndTime في صفحة الرصد'
          : 'تعذر التحقق من وقت نهاية إحدى مرات النشر',
        publicationsAnalyzed: 0,
        publicationErrors: pages.filter(p => p.error).length,
        studentRecords: null,
        submissionAvailable: null,
        submissionVerifiable: null,
        submissionMethod: '',
        submitted: null,
        notSubmitted: null,
        submissionUnknown: null,
        submissionRate: null,
        scoreCount: 0,
        scorePercentSum: 0,
        averagePercent: null,
        highestPercent: null,
        lowestPercent: null,
        gradeDiscrepancies: 0,
        classes: [],
        pages
      };
    }

    const good = pages.filter(p => !p.error && !p.excluded);
    if (!good.length) {
      return {
        title: assignment.title,
        analysisAvailable: false,
        publicationsAnalyzed: 0,
        publicationErrors: pages.filter(p => p.error).length,
        studentRecords: null,
        submissionAvailable: null,
        submissionVerifiable: null,
        submissionMethod: '',
        submitted: null,
        notSubmitted: null,
        submissionUnknown: null,
        submissionRate: null,
        scoreCount: 0,
        scorePercentSum: 0,
        averagePercent: null,
        highestPercent: null,
        lowestPercent: null,
        gradeDiscrepancies: 0,
        classes: [],
        pages
      };
    }
    const submissionAvailable = good.every(p => p.submissionAvailable !== false) && good.some(p => p.submissionAvailable === true);
    const submissionVerifiable = good.every(p => p.submissionVerifiable);
    const studentRecords = good.reduce((sum, p) => sum + (p.studentRecords || 0), 0);
    const submitted = good.reduce((sum, p) => sum + (p.submitted || 0), 0);
    const notSubmitted = good.reduce((sum, p) => sum + (p.notSubmitted || 0), 0);
    const submissionUnknown = good.reduce((sum, p) => sum + (p.submissionUnknown || 0), 0);
    const scoreCount = good.reduce((sum, p) => sum + (p.scoreCount || 0), 0);
    const scorePercentSum = good.reduce((sum, p) => sum + (p.scorePercentSum || 0), 0);
    const highs = good.map(p => p.highestPercent).filter(Number.isFinite);
    const lows = good.map(p => p.lowestPercent).filter(Number.isFinite);
    const classes = [...new Set(good.flatMap(p => p.classes || []).filter(Boolean))];
    return {
      title: assignment.title,
      analysisAvailable: true,
      publicationsAnalyzed: good.length,
      publicationErrors: pages.filter(p => p.error).length,
      studentRecords,
      submissionAvailable,
      submissionVerifiable,
      submissionMethod: good.some(p => p.submissionMethod === 'grade_feedback_inference') ? 'grade_feedback_inference' : 'hasAnswer',
      submitted,
      notSubmitted,
      submissionUnknown,
      submissionRate: submissionAvailable ? pct(submitted, studentRecords) : null,
      scoreCount,
      scorePercentSum,
      averagePercent: scoreCount ? scorePercentSum / scoreCount : null,
      highestPercent: highs.length ? Math.max(...highs) : null,
      lowestPercent: lows.length ? Math.min(...lows) : null,
      gradeDiscrepancies: good.reduce((sum, p) => sum + (p.gradeDiscrepancies || 0), 0),
      classes,
      pages
    };
  };

  async function runIndexDeepAnalysis() {
    if (!indexState.assignments.length) await collectAllIndexAssignments();
    if (!indexState.publications) await auditIndexPublications();

    const eligibleAssignments = indexState.assignments.filter(row => reportEligibilityFor(row).eligible);
    const receivingAssignments = indexState.assignments.filter(row => reportEligibilityFor(row).status === 'receiving');
    const totalGradeLinks = eligibleAssignments.reduce((sum, row) => {
      const pub = publicationInfoFor(row);
      return sum + (pub?.ended?.gradeLinks?.length || 0);
    }, 0);

    if (!totalGradeLinks) {
      if (receivingAssignments.length) {
        throw new Error(`لا توجد واجبات منتهية جاهزة للتقرير حاليًا. يوجد ${receivingAssignments.length} واجب قيد استقبال الحلول، وسيظهر تقريره بعد انتهاء جميع مرات النشر.`);
      }
      throw new Error('لم يتم العثور على واجبات منتهية تحتوي على روابط رصد جاهزة للتقرير.');
    }

    setIndexBusy(true, `بدء تحليل الواجبات المنتهية فقط: ${totalGradeLinks} صفحة رصد…`);
    const byGuid = {};
    let completed = 0;

    for (const assignment of indexState.assignments) {
      const eligibility = reportEligibilityFor(assignment);
      if (!eligibility.eligible) {
        byGuid[assignment.assignmentGuid] = {
          title: assignment.title,
          analysisAvailable: false,
          reportStatus: eligibility.status,
          exclusionReason: eligibility.label,
          publicationsAnalyzed: 0,
          publicationErrors: 0,
          studentRecords: null,
          submissionAvailable: null,
          submissionVerifiable: null,
          submissionMethod: '',
          submitted: null,
          notSubmitted: null,
          submissionUnknown: null,
          submissionRate: null,
          scoreCount: 0,
          scorePercentSum: 0,
          averagePercent: null,
          highestPercent: null,
          lowestPercent: null,
          gradeDiscrepancies: 0,
          classes: [],
          pages: []
        };
        continue;
      }

      // نحلل روابط «المنتهية» فقط. الروابط الحالية لا تدخل التقرير النهائي إطلاقًا.
      const links = publicationInfoFor(assignment)?.ended?.gradeLinks || [];
      if (!links.length) continue;
      const pages = [];
      for (let i = 0; i < links.length; i += 2) {
        const batch = links.slice(i, i + 2);
        const part = await Promise.all(batch.map(async link => {
          try { return await analyzeIndexGradePage(link.href); }
          catch (e) { return { gradeUrl: link.href, error: String(e?.message || e) }; }
        }));
        pages.push(...part);
        completed += batch.length;
        setIndexBusy(true, `تحليل الواجبات المنتهية ${completed} / ${totalGradeLinks}`);
      }
      const aggregate = aggregateIndexDeepAssignment(assignment, pages);
      if (aggregate.analysisAvailable !== false) {
        aggregate.reportStatus = 'complete';
        aggregate.exclusionReason = '';
      }
      byGuid[assignment.assignmentGuid] = aggregate;
    }

    const cache = { pageUrl: indexScopeUrl(), savedAt: new Date().toISOString(), schemaVersion: 7, byGuid };
    indexState.deep = cache;
    saveIndexDeepCache(cache);
    renderIndexPanel();
    const summary = summarizeIndexAssignments();
    toast(`اكتمل تحليل ${summary.reportReadyCount} واجب منتهي: ${summary.deepStudentRecords} سجل طالب${summary.reportReceivingCount ? ` · تم تأجيل ${summary.reportReceivingCount} واجب قيد الاستقبال` : ''}${Number.isFinite(summary.deepAveragePercent) ? ` · متوسط ${fmt(summary.deepAveragePercent)}%` : ''}.`, 'success');
    return cache;
  }

  const indexExportRows = () => filteredIndexAssignments().map(row => {
    const pub = publicationInfoFor(row);
    const deep = deepInfoFor(row);
    const reportState = reportEligibilityFor(row);
    return {
      '#': row.index,
      'اسم الواجب': row.title,
      'المقرر': row.course,
      'الوحدة': row.unit,
      'الموضوع': row.topic,
      'المسار الدراسي': row.curriculumPath,
      'مصدر الواجب': row.source,
      'طريقة العرض': row.displayMode,
      'درجة الواجب': Number.isFinite(row.grade) ? row.grade : '',
      'الحالة': indexStatusLabel(row),
      'Assignment GUID': row.assignmentGuid,
      'Assignment ID': row.internalId,
      'روابط الرصد المكتشفة': pub ? ((pub.gradeLinks?.length || 0) || 'لا يوجد') : '',
      'حالة التقرير': reportState.label,
      'سجلات الطلاب': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep?.studentRecords ?? ''),
      'نسبة الحل / التسليم': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep ? (deep.submissionAvailable ? deep.submissionRate : 'غير متاح') : ''),
      'متوسط الأداء': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep && Number.isFinite(deep.averagePercent) ? deep.averagePercent : ''),
      'لم يحل / لم يسلّم': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep ? (deep.submissionAvailable ? deep.notSubmitted : '') : ''),
      'غير محسوم': !reportState.eligible || deep?.analysisAvailable === false ? '' : (deep?.submissionUnknown ?? ''),
      'طريقة احتساب التسليم': deep?.submissionMethod === 'grade_feedback_inference' ? 'الدرجة + ملاحظة المعلم' : deep?.submissionMethod === 'hasAnswer' ? 'حالة الحل في مدرستي' : '',
      'تعارضات الدرجة': deep?.gradeDiscrepancies ?? '',
      'الفصول المنشورة': deep?.classes?.join('، ') || '',
      'رابط الاستعراض': row.viewUrl,
      'رابط الواجبات المرسلة': row.publishedUrl
    };
  });

  function exportIndexCSV() {
    const data = indexExportRows();
    if (!data.length) throw new Error('لا توجد واجبات قابلة للتصدير.');
    const headers = Object.keys(data[0]);
    const lines = [headers.map(csvCell).join(',')];
    for (const row of data) lines.push(headers.map(h => csvCell(row[h])).join(','));
    downloadText(`madrasati-assignments-register-${dateStamp()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function exportIndexExcel() {
    const data = indexExportRows();
    if (!data.length) throw new Error('لا توجد واجبات قابلة للتصدير.');
    if (!globalThis.XLSX) return exportIndexCSV();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 5 }, { wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 60 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 34 }, { wch: 16 }, { wch: 20 }, { wch: 60 }, { wch: 60 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments');

    if (indexState.publications) {
      const pubRows = [];
      for (const row of indexState.assignments) {
        const pub = publicationInfoFor(row);
        for (const link of pub?.current?.gradeLinks || []) pubRows.push({ 'الواجب': row.title, 'Assignment GUID': row.assignmentGuid, 'حالة النشر': 'حالي - مستبعد من التقرير النهائي', 'رابط الرصد': link.href, 'سياق': link.context || '' });
        for (const link of pub?.ended?.gradeLinks || []) pubRows.push({ 'الواجب': row.title, 'Assignment GUID': row.assignmentGuid, 'حالة النشر': 'منتهي', 'رابط الرصد': link.href, 'سياق': link.context || '' });
      }
      if (pubRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pubRows), 'Publications');
    }

    XLSX.writeFile(wb, `madrasati-assignments-register-${dateStamp()}.xlsx`);
  }

  const indexPrintCss = `
    @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111827;margin:0;font-size:10px;line-height:1.55}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:10px;margin-bottom:12px}.head h1{font-size:22px;margin:0}.muted{color:#64748b}.small{font-size:9px}
    .cards{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin:10px 0 12px}.card{border:1px solid #d1d5db;border-radius:8px;padding:8px;text-align:center}.card b{display:block;font-size:18px}.card span{font-size:9px;color:#475569}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:5px;text-align:right;vertical-align:top}th{background:#f3f4f6;font-weight:800}.src{margin:8px 0 10px}.src span{display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:2px 6px;margin-left:4px}
    .footer{margin-top:10px;border-top:1px solid #d1d5db;padding-top:6px;display:flex;justify-content:space-between;color:#64748b;font-size:8px}.actions{position:fixed;left:12px;bottom:12px}.actions button{border:0;border-radius:8px;background:#111827;color:#fff;padding:9px 14px;font-weight:800;cursor:pointer}@media print{.actions{display:none}}
  `;

  function printIndexReport() {
    if (!indexState.assignments.length) collectIndexAssignments();
    if (!indexState.assignments.length) throw new Error('لا توجد واجبات للطباعة.');
    const w = window.open('', '_blank');
    if (!w) throw new Error('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع.');

    const s = summarizeIndexAssignments();
    const sourceHtml = Object.entries(s.sourceCounts).map(([name, count]) => `<span>${esc(name)}: <b>${count}</b></span>`).join('');
    const rows = indexState.assignments.map(row => {
      const pub = publicationInfoFor(row);
      const deep = deepInfoFor(row);
      const reportState = reportEligibilityFor(row);
      const deepAvailable = reportState.eligible && deep && deep.analysisAvailable !== false;
      return `<tr><td>${row.index}</td><td><b>${esc(row.title)}</b></td><td>${esc(row.course || '—')}</td><td>${esc(row.unit || '—')}</td><td>${esc(row.topic || '—')}</td><td>${esc(row.source || '—')}</td><td>${Number.isFinite(row.grade) ? fmt(row.grade,4) : '—'}</td><td>${esc(indexStatusLabel(row))}</td><td>${pub ? (pub.gradeLinks?.length || 0) : '—'}</td><td>${esc(reportState.label)}</td><td>${deepAvailable && deep.submissionAvailable ? `${fmt(deep.submissionRate)}%${deep.submissionMethod === 'grade_feedback_inference' ? `<div class="small muted">من الرصد والملاحظات${deep.submissionUnknown ? ` · ${deep.submissionUnknown} غير محسوم` : ''}</div>` : ''}` : '—'}</td><td>${deepAvailable && Number.isFinite(deep.averagePercent) ? `${fmt(deep.averagePercent)}%` : '—'}</td><td>${deepAvailable && deep.submissionAvailable ? deep.notSubmitted : '—'}</td></tr>`;
    }).join('');

    const body = `
      <div class="actions"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
      <div class="head"><div><h1>سجل الواجبات</h1><div class="muted">لوحة الواجبات الشاملة — تقارير الأداء للواجبات المنتهية فقط</div></div><div class="small">${esc(document.querySelector('#mainTitle')?.textContent || 'إدارة الواجبات')}<br>${new Date().toLocaleString('ar-SA')}</div></div>
      <div class="cards">
        <div class="card"><b>${s.total}</b><span>إجمالي الواجبات</span></div>
        <div class="card"><b>${s.activeCount}</b><span>مفعّلة</span></div>
        <div class="card"><b>${fmt(s.totalGrade,4)}</b><span>مجموع الدرجات</span></div>
        <div class="card"><b>${Number.isFinite(s.averageGrade) ? fmt(s.averageGrade,4) : '—'}</b><span>متوسط الدرجة</span></div>
        <div class="card"><b>${Number.isFinite(s.highestGrade) ? fmt(s.highestGrade,4) : '—'}</b><span>أعلى درجة</span></div>
        <div class="card"><b>${Number.isFinite(s.lowestGrade) ? fmt(s.lowestGrade,4) : '—'}</b><span>أقل درجة</span></div>
        <div class="card"><b>${s.deepScanned ? s.deepStudentRecords : '—'}</b><span>سجلات الطلاب</span></div>
        <div class="card"><b>${s.deepScanned && Number.isFinite(s.deepAveragePercent) ? `${fmt(s.deepAveragePercent)}%` : '—'}</b><span>متوسط الأداء</span></div>
      </div>
      <div class="src"><b>المصادر:</b> ${sourceHtml}</div>
      <table><thead><tr><th>#</th><th>الواجب</th><th>المقرر</th><th>الوحدة</th><th>الموضوع</th><th>المصدر</th><th>الدرجة</th><th>الحالة</th><th>روابط الرصد</th><th>حالة التقرير</th><th>نسبة الحل / التسليم</th><th>المتوسط</th><th>لم يحل / لم يسلّم</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer"><span>Madrasati Assignment Intelligence v${VERSION}</span><span>Mohammed Almalki (M0HM3D85)</span></div>`;

    w.document.open();
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سجل الواجبات</title><style>${indexPrintCss}</style></head><body>${body}</body></html>`);
    w.document.close();
    w.setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 350);
  }

  async function bootstrapIndex() {
    try { if (base) base.version = VERSION; } catch {}
    addIndexStyles();

    // انتظر بطاقات Index لأنها قد تتأخر قليلًا بعد تحميل الصفحة.
    for (let i = 0; i < 80 && !document.querySelector(indexCardSelector); i++) await sleep(100);

    // اعرض الصفحة الحالية سريعًا أولًا، ثم اجمع جميع الصفحات قبل تمكين الأزرار.
    collectIndexAssignments();
    const panel = createIndexPanel();
    renderIndexPanel();

    if (panel) {
      panel.style.display = 'block';
      panel.hidden = false;
      setIndexBusy(true, 'جاري جمع جميع صفحات إدارة الواجبات…');
    }

    try {
      await collectAllIndexAssignments();
      loadIndexPublicationsCache();
      loadIndexDeepCache();
      renderIndexPanel();
      console.info(`[MAI v${VERSION}] Index panel mounted`, {
        assignments: indexState.assignments.length,
        pages: indexState.indexPagesScanned,
        stopReason: indexState.indexStopReason,
        panel
      });
    } catch (e) {
      console.error(`[MAI v${VERSION}] Index bootstrap failed:`, e);
      toast(`تعذر جمع جميع صفحات الواجبات: ${String(e?.message || e)}`, 'error');
      loadIndexPublicationsCache();
      loadIndexDeepCache();
      renderIndexPanel();
    } finally {
      setIndexBusy(false);
    }
  }


  // أدوات فحص آمنة للإصدارات القادمة.
  globalThis.MadrasatiAssignmentIntelligenceEnhanced = {
    version: VERSION,
    baseVersion: BASE_REQUIRED_VERSION,
    state,
    refresh: refreshEnhanced,
    parseQuestionCards: parseQuestionCardsEnhanced,
    runDeepQuestionAnalysis: runDeepQuestionAnalysisEnhanced,
    getQuestionAnalytics,
    studentLevel,
    printAssignmentReport: printAssignmentReportEnhanced,
    printQuestions: printQuestionsEnhanced,
    resolveAssignmentName: resolveAssignmentNameEnhanced,
    getGradePublicationTiming,
    gradeReportGate,
    render: renderInlineAnalysis,
    repairStudentClasses: repairStudentClassesEnhanced,
    getFilteredStudents: () => studentViewRows().map(row => row.student),
    indexState,
    collectIndexAssignments,
    collectAllIndexAssignments,
    auditIndexPublications,
    runIndexDeepAnalysis,
    renderIndexPanel
  };

  if (isAssignmentsIndex) bootstrapIndex();
  else if (isGradeAssignment) bootstrapGrade();
})();

  } else if (projectsPage) {
    // Projects & activities intelligence v1.5.6 (grade import, search and reports).
/*
=========================================================================
 Madrasati Projects Intelligence | مدير الأنشطة والمشاريع الذكي — v1.5.6

 إصدار مستقر لوحدة الأنشطة والمشاريع يعمل إلى جانب:
 Madrasati Assignment Intelligence | مدير الواجبات الذكي

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
=========================================================================
*/

// ============================================================================
// Madrasati Projects & Activities Intelligence — v1.5.6
// وحدة الأنشطة والمشاريع لمدير الواجبات الذكي
// ============================================================================
(() => {
  'use strict';

  const APP = 'MAIP';
  const VERSION = '2.0.0-beta1';
  const path = location.pathname;
  const isIndex = /\/Projects\/Projects\/Index\//i.test(path);
  const isPublished = /\/Projects\/Projects\/PublishedProjects\/?$/i.test(path);
  const isGrade = /\/Projects\/Projects\/GradeProject\//i.test(path);
  if (!isIndex && !isPublished && !isGrade) return;

  const clean = v => String(v ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const norm = v => clean(v)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();

  const esc = v => clean(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const num = v => {
    const raw = String(v ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    if (!raw || raw === '-' || raw === '.' || raw === '-.') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const truthy = v => /^(?:true|1|yes)$/i.test(clean(v));
  const pct = (a, b) => b ? Number(((a / b) * 100).toFixed(2)) : 0;
  const fmt = (v, digits = 2) => Number.isFinite(v) ? Number(v.toFixed(digits)).toString() : '—';
  const arabicCollator = new Intl.Collator('ar-SA', { sensitivity: 'base', numeric: true, ignorePunctuation: true });
  const compareNames = (a, b) => arabicCollator.compare(clean(a), clean(b));

  const state = {
    students: [],
    loading: false,
    filter: { className: 'all', submission: 'all', level: 'all', grading: 'all', sort: 'name_asc', query: '' },
    view: 'students',
    importExpanded: false,
    indexItems: [], indexQuery: '', indexPages: 1, indexScanned: false, indexBusy: false,
    publishedItems: [], publishedQuery: '', publishedScanned: false, publishedDeepScanned: false,
    deepByProject: new Map(), deepByUrl: new Map(), deepScanned: false, deepBusy: false,
    importPreview: null,
    importFeedback: false,
    activityTitle: '',
    totalExpected: 0,
    lastRefresh: null
  };

  const css = `
    #${APP}-panel{direction:rtl;font-family:Tahoma,Arial,sans-serif;margin:16px 0;border:1px solid #dfe5ec;border-radius:14px;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.05);overflow:hidden}
    #${APP}-panel *{box-sizing:border-box}
    .${APP}-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
    .${APP}-title{font-size:16px;font-weight:800;color:#1f2937}. ${APP}-sub{font-size:11px;color:#64748b;margin-top:3px}
    .${APP}-toolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
    .${APP}-btn{border:1px solid #0d6efd;background:#0d6efd;color:#fff;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer}
    .${APP}-btn.alt{background:#fff;color:#0d6efd}. ${APP}-btn.gray{background:#fff;color:#334155;border-color:#cbd5e1}. ${APP}-btn.danger{background:#fff;color:#b91c1c;border-color:#fecaca}
    .${APP}-btn:disabled{opacity:.55;cursor:not-allowed}. ${APP}-body{padding:14px 16px}
    .${APP}-metrics{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;margin-bottom:12px}
    .${APP}-metric{border:1px solid #e5e7eb;border-radius:11px;padding:10px;background:#fff;min-width:0}. ${APP}-metric b{display:block;font-size:20px;color:#111827}. ${APP}-metric span{font-size:10px;color:#64748b}
    .${APP}-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0}. ${APP}-field{display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:700;color:#475569}. ${APP}-field select,.${APP}-field input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:7px 8px;background:#fff;font:12px Tahoma,Arial}
    .${APP}-tablewrap{overflow:auto;max-height:520px;border:1px solid #e5e7eb;border-radius:10px}. ${APP}-table{width:100%;border-collapse:collapse;font-size:11px;min-width:850px}. ${APP}-table th,.${APP}-table td{padding:8px;border-bottom:1px solid #eef2f7;text-align:right;vertical-align:middle}. ${APP}-table th{position:sticky;top:0;background:#f8fafc;z-index:2;font-weight:800}. ${APP}-table tr:hover td{background:#fafcff}
    .${APP}-pill{display:inline-block;padding:3px 7px;border-radius:999px;font-size:10px;background:#f1f5f9}. ${APP}-ok{background:#dcfce7;color:#166534}. ${APP}-bad{background:#fee2e2;color:#991b1b}. ${APP}-warn{background:#fef3c7;color:#92400e}. ${APP}-info{background:#dbeafe;color:#1e40af}
    .${APP}-note{border:1px dashed #cbd5e1;border-radius:10px;padding:9px 11px;background:#f8fafc;font-size:11px;color:#475569;margin:8px 0}
    .${APP}-import{display:none;margin-top:12px;border-top:1px solid #e5e7eb;padding-top:12px}. ${APP}-import.show{display:block}. ${APP}-drop{border:2px dashed #cbd5e1;border-radius:12px;padding:18px;text-align:center;position:relative;background:#f8fafc}. ${APP}-drop input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}. ${APP}-drop b,.${APP}-drop span{display:block}. ${APP}-drop span{font-size:11px;color:#64748b;margin-top:4px}
    .${APP}-status{font-size:11px;color:#475569;font-weight:700}. ${APP}-status.busy{color:#0d6efd}
    #${APP}-toast{position:fixed;left:18px;bottom:18px;z-index:2147483647;opacity:0;transform:translateY(8px);transition:.2s;background:#111827;color:#fff;border-radius:9px;padding:10px 13px;font:12px Tahoma,Arial}. #${APP}-toast.show{opacity:1;transform:none}. #${APP}-toast.success{background:#065f46}. #${APP}-toast.error{background:#991b1b}
    @media(max-width:1100px){.${APP}-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}. ${APP}-filters{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:650px){.${APP}-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}. ${APP}-filters{grid-template-columns:1fr}. ${APP}-head{align-items:flex-start}}
  `.replace(/\. MAIP/g, '.MAIP');



  const importModalCss = `
    #${APP}-import-modal.${APP}-modal{position:fixed;inset:0;z-index:2147483645;background:rgba(15,23,42,.57);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Tahoma,Arial,sans-serif}
    #${APP}-import-modal[hidden]{display:none!important}
    #${APP}-import-modal .${APP}-dialog{box-sizing:border-box;width:min(1320px,97vw);max-height:94vh;overflow:auto;background:#fff;color:#172033;border-radius:16px;box-shadow:0 18px 75px rgba(0,0,0,.28);padding:18px}
    #${APP}-import-modal .${APP}-dialog *{box-sizing:border-box}
    #${APP}-import-modal .${APP}-dialog-head{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0;padding-bottom:12px}
    #${APP}-import-modal .${APP}-drop{border:2px dashed #b9c9de;padding:22px;border-radius:12px;background:#f8fbff;position:relative;text-align:center}
    #${APP}-import-modal .${APP}-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
    #${APP}-import-modal .${APP}-drop b,#${APP}-import-modal .${APP}-drop span{display:block}
    #${APP}-import-modal .${APP}-drop span{font-size:12px;color:#64748b;margin-top:5px}
    #${APP}-import-modal .${APP}-note{font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:10px;margin:10px 0}
    #${APP}-import-modal .${APP}-toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:10px 0}
    #${APP}-import-modal .${APP}-btn{padding:9px 12px;border:1px solid #0d6efd;background:#0d6efd;color:white;border-radius:8px;cursor:pointer;font:700 12px Tahoma,Arial}
    #${APP}-import-modal .${APP}-btn.gray,#${APP}-import-modal .${APP}-btn.alt{color:#0d6efd;background:#fff}
    #${APP}-import-modal .${APP}-btn:disabled{opacity:.45;cursor:not-allowed}
    #${APP}-import-modal .${APP}-tablewrap{overflow:auto;border:1px solid #e2e8f0;border-radius:10px}
    #${APP}-import-modal .${APP}-table{width:100%;border-collapse:collapse;font-size:11px;min-width:980px}
    #${APP}-import-modal .${APP}-table th,#${APP}-import-modal .${APP}-table td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:middle}
    #${APP}-import-modal .${APP}-table th{background:#f1f5f9;position:sticky;top:0;z-index:2}
    #${APP}-import-modal .${APP}-pill{border-radius:25px;padding:4px 8px;font-size:10px}
    #${APP}-import-modal .${APP}-ok{background:#dcfce7;color:#166534}
    #${APP}-import-modal .${APP}-bad{background:#fee2e2;color:#991b1b}
    #${APP}-import-modal .${APP}-sub,#${APP}-import-modal .${APP}-count{font-size:11px;color:#64748b}
    @media(max-width:700px){#${APP}-import-modal{padding:5px}#${APP}-import-modal .${APP}-dialog{max-height:97vh;width:100%;padding:10px}}
  `;

  const parityCss = `
    #${APP}-panel{box-shadow:0 4px 18px rgba(15,23,42,.06);border-color:#dbe3ee}
    #${APP}-panel .${APP}-head{background:linear-gradient(135deg,#f8fafc,#eef6ff)}
    #${APP}-panel .${APP}-btn{font-size:11px;border-radius:9px;padding:8px 11px}
    #${APP}-panel .${APP}-btn:not(.alt):not(.gray):not(.danger){background:#0f172a;border-color:#0f172a}
    #${APP}-panel .${APP}-btn.alt{border-color:#cbd5e1;color:#0f172a}
    #${APP}-panel .${APP}-metric{background:#fafafa;min-height:77px;text-align:center;display:flex;flex-direction:column;justify-content:center}
    #${APP}-panel .${APP}-metric b{font-size:21px}
    #${APP}-panel .${APP}-metric span{font-size:11px;font-weight:700;color:#475569}
    #${APP}-panel .${APP}-filters{grid-template-columns:repeat(6,minmax(120px,1fr));align-items:end}
    #${APP}-panel .${APP}-searchline{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:10px 0 14px}
    #${APP}-panel .${APP}-searchline input{flex:1 1 250px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 11px;font:12px Tahoma,Arial;min-width:180px}
    #${APP}-panel .${APP}-count{font-size:11px;color:#475569;font-weight:800}
    #${APP}-panel .${APP}-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 14px;border-bottom:1px solid #e2e8f0;padding-bottom:8px}
    #${APP}-panel .${APP}-tab{padding:8px 12px;border:1px solid #dbe3ee;border-radius:8px;background:#fff;color:#334155;font-weight:800;cursor:pointer;font-size:11px}
    #${APP}-panel .${APP}-tab.active{background:#0f172a;color:#fff;border-color:#0f172a}
    #${APP}-panel .${APP}-chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:15px}
    #${APP}-panel .${APP}-chart{border:1px solid #e2e8f0;border-radius:11px;padding:14px;background:#fff;min-width:0}
    #${APP}-panel .${APP}-chart h4{font-size:13px;margin:0 0 13px;color:#0f172a;font-weight:900}
    #${APP}-panel .${APP}-bar-row{display:grid;grid-template-columns:94px minmax(20px,1fr) 67px;align-items:center;gap:8px;margin-bottom:9px;font-size:11px;color:#334155}
    #${APP}-panel .${APP}-track{background:#e8edf4;height:12px;overflow:hidden;border-radius:20px}
    #${APP}-panel .${APP}-fill{display:block;background:#64748b;height:100%;border-radius:20px;max-width:100%}
    #${APP}-panel .${APP}-fill.excellent{background:#16a34a}#${APP}-panel .${APP}-fill.verygood{background:#0ea5e9}
    #${APP}-panel .${APP}-fill.good{background:#6366f1}#${APP}-panel .${APP}-fill.pass{background:#eab308}
    #${APP}-panel .${APP}-fill.weak{background:#ef4444}#${APP}-panel .${APP}-fill.none{background:#94a3b8}
    #${APP}-panel .${APP}-report-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px;margin-bottom:12px}
    #${APP}-panel .${APP}-report-stat{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:12px;font-size:11px}
    #${APP}-panel .${APP}-report-stat b{display:block;color:#0f172a;font-size:19px}
    #${APP}-panel .${APP}-gradeview[hidden]{display:none!important}
    #${APP}-panel .${APP}-subhead{font-weight:900;margin:14px 0 9px;color:#0f172a;font-size:13px}
    #${APP}-panel .${APP}-rowempty{padding:18px;text-align:center;color:#64748b}
    #${APP}-panel .${APP}-badge{display:inline-block;background:#e2e8f0;border-radius:99px;padding:3px 8px;font-size:10px;font-weight:800;color:#334155}
    #${APP}-panel .${APP}-badge.warn{background:#fef3c7;color:#92400e}
    #${APP}-panel .${APP}-badge.ok{background:#dcfce7;color:#166534}
    #${APP}-panel .${APP}-idxwrap{overflow-x:auto}
    #${APP}-panel .${APP}-table{min-width:800px}
    #${APP}-panel .${APP}-table td{word-break:normal}
    @media(max-width:1260px){#${APP}-panel .${APP}-filters{grid-template-columns:repeat(3,minmax(140px,1fr))}}
    @media(max-width:700px){#${APP}-panel .${APP}-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;

  const injectStyle = () => {
    if (document.getElementById(`${APP}-style`)) return;
    const style = document.createElement('style');
    style.id = `${APP}-style`;
    style.textContent = css + parityCss;
    document.head.appendChild(style);
  };

  const toast = (message, type = 'info') => {
    let box = document.getElementById(`${APP}-toast`);
    if (!box) {
      box = document.createElement('div');
      box.id = `${APP}-toast`;
      document.body.appendChild(box);
    }
    box.className = type;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(box._t);
    box._t = setTimeout(() => box.classList.remove('show'), 3500);
  };

  const setBusy = (busy, label = '') => {
    state.loading = busy;
    const status = document.getElementById(`${APP}-status`);
    if (status) {
      status.textContent = busy ? (label || 'جارٍ المعالجة…') : 'جاهز';
      status.classList.toggle('busy', busy);
    }
    document.querySelectorAll(`#${APP}-panel button, #${APP}-import-modal button`).forEach(btn => btn.disabled = !!busy && !btn.dataset.allowbusy);
  };

  const findMount = () => {
    const mainTitle = document.getElementById('mainTitle');
    if (mainTitle) {
      let node = mainTitle;
      for (let i = 0; i < 5 && node?.parentElement; i++, node = node.parentElement) {
        if (node.parentElement && node.parentElement.children.length > 1) return node.parentElement;
      }
    }
    return document.querySelector('main .container-fluid,main .container,main,.container-fluid,.container') || document.body;
  };

  const insertPanel = (title, sub, actions = '') => {
    let panel = document.getElementById(`${APP}-panel`);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = `${APP}-panel`;
    panel.innerHTML = `<div class="${APP}-head"><div><div class="${APP}-title">${esc(title)}</div><div class="${APP}-sub">${esc(sub)}</div></div><div class="${APP}-toolbar">${actions}<span id="${APP}-status" class="${APP}-status">جاهز</span></div></div><div id="${APP}-body" class="${APP}-body"></div>`;
    const mount = findMount();
    const ref = document.querySelector('#divSearchContainerId,#divSearchResultId,.homeworks-management-section');
    if (ref?.parentElement) ref.parentElement.insertBefore(panel, ref);
    else mount.prepend(panel);
    return panel;
  };

  const getActivityTitle = (doc = document) => {
    const candidates = [...doc.querySelectorAll('h4,h5,h6')]
      .map(el => clean(el.innerText || el.textContent || ''))
      .filter(Boolean)
      .filter(t => !/^(?:إدارة الأنشطة المدرسية|استعراض اجابات الطلبة|نسبة حل الطلاب|نسبة درجات الطلاب|الفصل المدرسي\s*:|البحث فى الأنشطة المرسلة|معلومات النشاط|تفاصيل النشاط)$/i.test(t));
    const preferred = candidates.find(t => /(?:مشروع|نشاط|مهمة|بحث|تفاعلي)/i.test(t) && t.length < 220);
    return preferred || clean(document.getElementById('mainTitle')?.textContent || '') || 'النشاط';
  };

  const getParamFromLoadStudents = key => {
    const fn = typeof globalThis.loadStudents === 'function' ? String(globalThis.loadStudents) : '';
    if (!fn) return '';
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return fn.match(new RegExp(`${k}\\s*:\\s*['\"]([^'\"]*)['\"]`))?.[1]
      ?? fn.match(new RegExp(`${k}\\s*:\\s*(true|false|[\\d.]+)`, 'i'))?.[1]
      ?? '';
  };

  const projectParams = () => ({
    IsPublished: getParamFromLoadStudents('IsPublished') || clean(document.getElementById('Published')?.value) || 'true',
    ProjectId: getParamFromLoadStudents('ProjectId'),
    LectureClassId: getParamFromLoadStudents('LectureClassId'),
    PublishedProjectId: getParamFromLoadStudents('PublishedProjectId'),
    IsGradebook: getParamFromLoadStudents('IsGradebook'),
    SchoolId: getParamFromLoadStudents('SchoolId') || clean(document.getElementById('SchoolId')?.value),
    SubjectId: getParamFromLoadStudents('SubjectId'),
    TeacherId: getParamFromLoadStudents('TeacherId'),
    SemesterId: getParamFromLoadStudents('SemesterId'),
    IsCreatedByTeacher: getParamFromLoadStudents('IsCreatedByTeacher'),
    IsCurrentTeacher: getParamFromLoadStudents('IsCurrentTeacher'),
    PublishLectureId: getParamFromLoadStudents('PublishLectureId'),
    SolvingType: getParamFromLoadStudents('SolvingType'),
    ProjectStarts: getParamFromLoadStudents('ProjectStarts'),
    IsRelatedToSubject: getParamFromLoadStudents('IsRelatedToSubject') || 'true'
  });

  const postForm = async (url, data) => {
    const body = new URLSearchParams();
    Object.entries(data || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(x => body.append(k, x));
      else if (v !== undefined && v !== null) body.append(k, String(v));
    });
    const response = await fetch(url, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: body.toString()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return typeof json === 'string' ? json : (json?.html || json?.data || text);
    } catch { return text; }
  };

  const groupsFromDoc = doc => {
    const map = new Map();
    doc.querySelectorAll('[name^="List["]').forEach(el => {
      const m = String(el.name || '').match(/^List\[(\d+)\]\.(.+)$/);
      if (!m) return;
      const index = Number(m[1]);
      if (!map.has(index)) map.set(index, {});
      map.get(index)[m[2]] = el.value ?? el.getAttribute('value') ?? '';
    });
    return map;
  };

  const studentNameKey = function(value){
 return norm(value).replace(/[\u200b-\u200d\u2060\ufeff]/g,'').replace(/[\u060c\u061b\u061f.,:()ـ\-\/_]+/g,' ').replace(/^(?:اسم\s*الطالب|الطالب|الطالبه)\s*/,'').replace(/\s+/g,' ').trim();
};

    const studentIdKey = function(value){
 const v=clean(value).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s+/g,'');
 return /^\d+$/.test(v)?v.replace(/^0+(?=\d)/,''):v.toLowerCase();
};

    const studentNameFromSelect = function(studentId){
 const key=studentIdKey(studentId);
 if(!key)return '';
 const select=document.getElementById('studentsFilter');
 const opt=[...(select?.options||[])].find(o=>studentIdKey(o.value)===key);
 const text=clean(opt?.textContent||'').replace(/^(?:اسم\s*الطالب|الطالب)\s*[:：-]?\s*/,'');
 return studentNameKey(text).split(' ').length>=3?text:'';
};

    const findVisualBlock = function(doc,studentId) {
 const sid=String(studentId||'');
 if(!sid)return null;
 const checkbox=doc.getElementById(`checkStudent-${sid}`)||[...doc.querySelectorAll('input[id^="checkStudent-"]')].find(el=>String(el.value||'')===sid);
 if(!checkbox)return null;
 let fallback=null,node=checkbox;
 for(let depth=0;depth<15&&node;depth++,node=node.parentElement){
   const checks=node.querySelectorAll?.('input[id^="checkStudent-"]').length||0;
   const txt=clean(node.textContent||'');
   if(checks===1&&txt.length>=8&&txt.length<1300)fallback=node;
   if(checks===1&&/الفصل\s+المدرسي\s*:/i.test(txt))return node;
 }
 return fallback;
};

  // إعادة الدالة الأساسية لاستخراج الفصل من بطاقة الطالب.
  const classFromBlock = block => {
    const text = clean(block?.innerText || block?.textContent || '');
    return text.match(/الفصل\s+المدرسي\s*:\s*(.+?)(?=\s+(?:الدرجة|الإجابة|ملاحظ|الحل|استعراض|$))/i)?.[1]?.trim()
      || text.match(/الفصل\s+المدرسي\s*:\s*([^|\n]+)/i)?.[1]?.trim()
      || '';
  };

    const nameFromBlock = function(block,fields,studentId) {
 const optionName=studentNameFromSelect(studentId);
 const vals=[
  fields.fullName,fields.FullName,fields.Name,fields.StudentName,fields.studentName,fields.StudentFullName,
  optionName
 ].map(clean).filter(Boolean);
 for(const v of vals)if(studentNameKey(v).split(' ').length>=3&&v.length<180)return v;
 const text=String(block?.textContent||block?.innerText||'').replace(/\u00a0/g,' ');
 const before=clean(text.split(/الفصل\s+المدرسي\s*:/i)[0]).replace(/^(?:اسم\s*الطالب|الطالب|الطالبه)\s*[:：-]?\s*/,'').replace(/^(?:اختيار|تحديد)\s*(?:الطالب)?\s*/,'');
 const picked=before.slice(0,180);
 return studentNameKey(picked).split(' ').length>=3?picked:`طالب ${clean(studentId||fields.StudentId)}`;
};

    const parseStudentsHtml = html => {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const groups = groupsFromDoc(doc);
    const rows = [];
    for (const [index, fields] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const studentId = clean(fields.StudentId);
      if (!studentId) continue;
      const block = findVisualBlock(doc, studentId);
      const grade = num(fields.Grade);
      const totalGrade = num(fields.TotalGrade);
      rows.push({
        index,
        studentId,
        name: nameFromBlock(block, fields, studentId),
        className: classFromBlock(block),
        grade,
        totalGrade,
        feedback: clean(fields.feedBack),
        hasAnswer: truthy(fields.hasAnswer),
        isApproved: truthy(fields.isApproved),
        rawFields: { ...fields }
      });
    }
    return rows;
  };

  const expectedStudentCount = () => {
    const optionIds = [...document.querySelectorAll('#studentsFilter option')]
      .map(o => clean(o.value)).filter(Boolean);
    if (optionIds.length) return new Set(optionIds).size;
    const ids = [...document.querySelectorAll('.multiselect-container input[type="checkbox"]')]
      .map(x => clean(x.value)).filter(v => /^\d+$/.test(v));
    return new Set(ids).size;
  };

  const fetchAllStudents = async () => {
    const base = projectParams();
    if (!base.ProjectId || !base.PublishedProjectId) throw new Error('تعذر قراءة معرف النشاط المنشور من الصفحة.');
    const expected = expectedStudentCount();
    const byId = new Map();
    for (let page = 1; page <= 100; page++) {
      const html = await postForm('/Projects/Projects/GetGradeStudentsList', {
        ...base, StudentIds: '', Status: 'All', SortBy: 'name_asc', PageNumber: page
      });
      const rows = parseStudentsHtml(html);
      if (!rows.length) break;
      let newCount = 0;
      rows.forEach(row => {
        if (!byId.has(row.studentId)) newCount++;
        byId.set(row.studentId, row);
      });
      if ((expected && byId.size >= expected) || newCount === 0) break;
    }
    const rows = [...byId.values()].sort((a, b) => compareNames(a.name, b.name));
    state.totalExpected = expected || rows.length;
    return rows;
  };

  const band = row => {
    if (!Number.isFinite(row.grade) || !Number.isFinite(row.totalGrade) || row.totalGrade <= 0) return 'none';
    const p = (row.grade / row.totalGrade) * 100;
    if (p >= 90) return 'excellent';
    if (p >= 80) return 'verygood';
    if (p >= 70) return 'good';
    if (p > 50) return 'pass';
    return 'weak';
  };

  const bandLabel = key => ({ excellent: 'ممتاز', verygood: 'جيد جدًا', good: 'جيد', pass: 'مقبول', weak: 'ضعيف', none: 'بدون تقدير' }[key] || '—');

  const filteredRows = () => {
    let rows = state.students.slice();
    const f = state.filter;
    if (f.className !== 'all') rows = rows.filter(r => clean(r.className) === f.className);
    if (f.query) { const q = norm(f.query); rows = rows.filter(r => [r.name, r.studentId, r.className, r.feedback].some(v => norm(v).includes(q))); }
    if (f.submission === 'submitted') rows = rows.filter(r => r.hasAnswer);
    if (f.submission === 'not_submitted') rows = rows.filter(r => !r.hasAnswer);
    if (f.grading === 'graded') rows = rows.filter(r => Number.isFinite(r.grade));
    if (f.grading === 'ungraded') rows = rows.filter(r => !Number.isFinite(r.grade));
    if (f.level !== 'all') rows = rows.filter(r => band(r) === f.level);
    if (f.sort === 'grade_desc') rows.sort((a, b) => (Number.isFinite(b.grade) ? b.grade : -Infinity) - (Number.isFinite(a.grade) ? a.grade : -Infinity) || compareNames(a.name, b.name));
    else if (f.sort === 'grade_asc') rows.sort((a, b) => (Number.isFinite(a.grade) ? a.grade : Infinity) - (Number.isFinite(b.grade) ? b.grade : Infinity) || compareNames(a.name, b.name));
    else if (f.sort === 'name_desc') rows.sort((a, b) => compareNames(b.name, a.name));
    else if (f.sort === 'submission_submitted') rows.sort((a, b) => Number(b.hasAnswer) - Number(a.hasAnswer) || compareNames(a.name, b.name));
    else if (f.sort === 'submission_not_submitted') rows.sort((a, b) => Number(a.hasAnswer) - Number(b.hasAnswer) || compareNames(a.name, b.name));
    else if (f.sort === 'level_high') rows.sort((a,b) => ((Number.isFinite(b.grade)&&b.totalGrade>0)?b.grade/b.totalGrade:-1)-((Number.isFinite(a.grade)&&a.totalGrade>0)?a.grade/a.totalGrade:-1) || compareNames(a.name,b.name));
    else if (f.sort === 'level_low') rows.sort((a,b) => ((Number.isFinite(a.grade)&&a.totalGrade>0)?a.grade/a.totalGrade:Infinity)-((Number.isFinite(b.grade)&&b.totalGrade>0)?b.grade/b.totalGrade:Infinity) || compareNames(a.name,b.name));
    else rows.sort((a, b) => compareNames(a.name, b.name));
    return rows;
  };

  const summary = rows => {
    const total = rows.length;
    const submitted = rows.filter(r => r.hasAnswer).length;
    const gradedRows = rows.filter(r => Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0);
    const percents = gradedRows.map(r => (r.grade / r.totalGrade) * 100);
    return {
      total,
      submitted,
      notSubmitted: total - submitted,
      submissionRate: pct(submitted, total),
      graded: gradedRows.length,
      ungraded: total - gradedRows.length,
      gradingRate: pct(gradedRows.length, total),
      avg: percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : null,
      high: percents.length ? Math.max(...percents) : null,
      low: percents.length ? Math.min(...percents) : null
    };
  };

  const classOptions = () => [...new Set(state.students.map(r => clean(r.className)).filter(Boolean))].sort(compareNames);

  const filterContext = () => {
    const f = state.filter;
    const parts = [];
    if (f.className !== 'all') parts.push(`الفصل: ${f.className}`);
    if (f.submission !== 'all') parts.push(`التسليم: ${f.submission === 'submitted' ? 'سلّم' : 'لم يسلّم'}`);
    if (f.grading !== 'all') parts.push(`الرصد: ${f.grading === 'graded' ? 'مرصود' : 'غير مرصود'}`);
    if (f.level !== 'all') parts.push(`التقدير: ${bandLabel(f.level)}`);
    if (f.query) parts.push(`البحث: ${f.query}`);
    return parts.join(' · ') || 'كل الطلاب';
  };

  const rowHtml = (r, i) => {
    const p = Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade, r.totalGrade) : null;
    const sub = r.hasAnswer ? `<span class="${APP}-pill ${APP}-ok">سلّم</span>` : `<span class="${APP}-pill ${APP}-bad">لم يسلّم</span>`;
    const grd = Number.isFinite(r.grade) ? `<span class="${APP}-pill ${APP}-info">مرصود</span>` : `<span class="${APP}-pill ${APP}-warn">غير مرصود</span>`;
    return `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.className || '—')}</td><td>${sub}</td><td>${grd}</td><td>${Number.isFinite(r.grade) ? fmt(r.grade) : '—'} / ${Number.isFinite(r.totalGrade) ? fmt(r.totalGrade) : '—'}</td><td>${p == null ? '—' : `${fmt(p)}%`}</td><td>${esc(bandLabel(band(r)))}</td><td>${esc(r.feedback || '')}</td></tr>`;
  };


  const levelKeys = ['excellent','verygood','good','pass','weak','none'];
  const gradePercent = r => Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade,r.totalGrade) : null;
  const detailedStats = rows => {
    const s = summary(rows);
    const percents = rows.map(gradePercent).filter(Number.isFinite).sort((a,b) => a-b);
    s.median = percents.length ? (percents[Math.floor((percents.length-1)/2)] + percents[Math.ceil((percents.length-1)/2)])/2 : null;
    s.low = percents.length ? percents[0] : null;
    s.levels = Object.fromEntries(levelKeys.map(k => [k,rows.filter(r => band(r) === k).length]));
    s.byClass = [...new Set(rows.map(r=>r.className || 'غير محدد'))].sort(compareNames).map(name => {
      const rs = rows.filter(r=>(r.className||'غير محدد')===name);
      const scored = rs.map(gradePercent).filter(Number.isFinite);
      return { name, total:rs.length,submitted:rs.filter(r=>r.hasAnswer).length,graded:scored.length,avg:scored.length?scored.reduce((a,b)=>a+b,0)/scored.length:null };
    });
    s.buckets = [
      { label:'90–100%', count:percents.filter(v=>v>=90).length, kind:'excellent' },
      { label:'80–<90%',count:percents.filter(v=>v>=80&&v<90).length,kind:'verygood' },
      { label:'70–<80%',count:percents.filter(v=>v>=70&&v<80).length,kind:'good' },
      { label:'51–<70%',count:percents.filter(v=>v>50&&v<70).length,kind:'pass' },
      { label:'0–50%',count:percents.filter(v=>v<=50).length,kind:'weak' }
    ];
    return s;
  };

  const metric = (value,label) => `<div class="${APP}-metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  const bars = (items,max) => items.map(x=>`<div class="${APP}-bar-row"><span title="${esc(x.label)}">${esc(x.label)}</span><div class="${APP}-track"><span class="${APP}-fill ${esc(x.kind||'')}" style="width:${max ? Math.max(0,Math.min(100,100*x.count/max)) : 0}%"></span></div><b>${x.count}${x.suffix||''}</b></div>`).join('');
  const gradeAnalyticsHtml = (rows,s) => {
    const maxLevel = Math.max(1,...levelKeys.map(k=>s.levels[k]));
    const classes = s.byClass;
    return `<div class="${APP}-chart-grid">
      <div class="${APP}-chart"><h4>توزيع التقديرات</h4>${bars(levelKeys.map(k=>({label:bandLabel(k),count:s.levels[k],kind:k})),maxLevel)}</div>
      <div class="${APP}-chart"><h4>توزيع الدرجات المئوية</h4>${bars(s.buckets,Math.max(1,...s.buckets.map(b=>b.count)))}</div>
      <div class="${APP}-chart"><h4>نسبة التسليم والرصد</h4>${bars([{label:'سلّم',count:s.submitted,kind:'excellent'},{label:'لم يسلّم',count:s.notSubmitted,kind:'weak'},{label:'درجة مرصودة',count:s.graded,kind:'verygood'},{label:'غير مرصود',count:s.ungraded,kind:'none'}],Math.max(1,s.total))}</div>
      <div class="${APP}-chart"><h4>متوسط الأداء حسب الفصل</h4>${classes.length?bars(classes.map(c=>({label:c.name,count:c.avg||0,suffix:'%',kind:'good'})),100):'لا توجد فصول'}</div>
    </div><div class="${APP}-subhead">مقارنة الفصول</div><div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>الفصل</th><th>الطلاب</th><th>سلّم</th><th>لم يسلّم</th><th>مرصود</th><th>نسبة التسليم</th><th>متوسط الأداء</th></tr></thead><tbody>${classes.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.total}</td><td>${c.submitted}</td><td>${c.total-c.submitted}</td><td>${c.graded}</td><td>${fmt(pct(c.submitted,c.total))}%</td><td>${c.avg===null?'—':fmt(c.avg)+'%'}</td></tr>`).join('')}</tbody></table></div>`;
  };

  // لوحة واحدة تتشارك فلاترها جميع الإحصائيات والتقارير والمخرجات.
  const updateGradeViews = () => {
    const rows = filteredRows();
    const s = detailedStats(rows);
    const m = document.getElementById(`${APP}-dynamic-metrics`);
    if (m) m.innerHTML = [metric(s.total,'الطلاب المعروضون'),metric(s.submitted,'سلّم'),metric(s.notSubmitted,'لم يسلّم'),metric(`${fmt(s.submissionRate)}%`,'نسبة التسليم'),metric(s.graded,'درجات مرصودة'),metric(s.avg===null?'—':`${fmt(s.avg)}%`,'متوسط الأداء'),metric(s.high===null?'—':`${fmt(s.high)}%`,'أعلى أداء'),metric(s.low===null?'—':`${fmt(s.low)}%`,'أقل أداء')].join('');
    const count=document.getElementById(`${APP}-shown-count`);
    if (count) count.textContent=`عرض ${rows.length} من ${state.students.length} طالبًا`;
    const tbody=document.getElementById(`${APP}-students-tbody`);
    if(tbody) tbody.innerHTML=rows.length?rows.map(rowHtml).join(''):`<tr><td colspan="9" class="${APP}-rowempty">لا توجد نتائج مطابقة للبحث والتصفية.</td></tr>`;
    const analytics=document.getElementById(`${APP}-analytics-host`);
    if(analytics) analytics.innerHTML=gradeAnalyticsHtml(rows,s);
    const context=document.getElementById(`${APP}-filter-context`);
    if(context) context.textContent=`${filterContext()} · تم جلب ${state.students.length}${state.totalExpected ? ` من ${state.totalExpected}`:''} طالبًا`;
    const report=document.getElementById(`${APP}-report-host`);
    if(report) report.innerHTML=`<div class="${APP}-report-grid">${[
      ['متوسط الأداء',s.avg===null?'—':fmt(s.avg)+'%'],['الوسيط',s.median===null?'—':fmt(s.median)+'%'],['أعلى درجة',s.high===null?'—':fmt(s.high)+'%'],['أقل درجة',s.low===null?'—':fmt(s.low)+'%'],['نسبة الرصد',fmt(s.gradingRate)+'%'],['عدد الفصول',s.byClass.length],['تقدير ممتاز',s.levels.excellent],['تقدير ضعيف',s.levels.weak]
    ].map(([k,v])=>`<div class="${APP}-report-stat"><b>${esc(v)}</b>${esc(k)}</div>`).join('')}</div><div class="${APP}-note">التقرير يتبع البحث والفصل والتسليم والتقدير تمامًا، ويمكن تصديره من شريط الأدوات. المتوسط يحسب من الدرجات المتاحة فقط، ولا يستبدل الدرجات الناقصة بأصفار.</div>`;
  };

  const setGradeView = view => {
    state.view=view;
    document.querySelectorAll(`#${APP}-panel .${APP}-gradeview`).forEach(el=>{el.hidden=el.dataset.view!==view;});
    document.querySelectorAll(`#${APP}-panel .${APP}-tab`).forEach(el=>{const selected=el.dataset.view===view;el.classList.toggle('active',selected);el.setAttribute('aria-selected',String(selected));});
  };

  const renderGradeBody = () => {
    const body=document.getElementById(`${APP}-body`);
    if(!body)return;
    const classes=classOptions();
    if(state.filter.className!=='all'&&!classes.includes(state.filter.className))state.filter.className='all';
    body.innerHTML=`
      <div id="${APP}-dynamic-metrics" class="${APP}-metrics"></div>
      <div class="${APP}-note"><b>${esc(state.activityTitle)}</b><span id="${APP}-filter-context"></span></div>
      <div class="${APP}-searchline"><input id="${APP}-search" type="search" autocomplete="off" placeholder="بحث فوري باسم الطالب أو الرقم أو الفصل أو الملاحظة…" aria-label="بحث في طلاب النشاط" value="${esc(state.filter.query)}"><span id="${APP}-shown-count" class="${APP}-count"></span><button id="${APP}-clear-search" class="${APP}-btn gray" type="button">مسح البحث</button></div>
      <div class="${APP}-filters">
      <label class="${APP}-field">الفصل<select id="${APP}-class"><option value="all">كل الفصول</option>${classes.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label>
      <label class="${APP}-field">التسليم<select id="${APP}-submission"><option value="all">الكل</option><option value="submitted">سلّم</option><option value="not_submitted">لم يسلّم</option></select></label>
      <label class="${APP}-field">الرصد<select id="${APP}-grading"><option value="all">الكل</option><option value="graded">مرصود</option><option value="ungraded">غير مرصود</option></select></label>
      <label class="${APP}-field">التقدير<select id="${APP}-level"><option value="all">كل التقديرات</option>${levelKeys.map(k=>`<option value="${k}">${esc(bandLabel(k))}</option>`).join('')}</select></label>
      <label class="${APP}-field">الفرز<select id="${APP}-sort"><option value="name_asc">الاسم أ ← ي</option><option value="name_desc">الاسم ي ← أ</option><option value="submission_submitted">المسلّم أولًا</option><option value="submission_not_submitted">غير المسلّم أولًا</option><option value="level_high">التقدير الأعلى</option><option value="level_low">التقدير الأقل</option><option value="grade_desc">الدرجة الأعلى</option><option value="grade_asc">الدرجة الأقل</option></select></label>
      <div class="${APP}-field"><span>تصفية</span><button id="${APP}-quick-reset" class="${APP}-btn gray" type="button">إعادة الضبط</button></div>
      </div>
      <div class="${APP}-tabs" role="tablist"><button class="${APP}-tab" role="tab" data-view="students" type="button">سجل الطلاب</button><button class="${APP}-tab" role="tab" data-view="analytics" type="button">الرسوم والتحليل</button><button class="${APP}-tab" role="tab" data-view="report" type="button">ملخص التقرير</button></div>
      <div class="${APP}-gradeview" data-view="students"><div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>التسليم</th><th>الرصد</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th><th>الملاحظة</th></tr></thead><tbody id="${APP}-students-tbody"></tbody></table></div></div>
      <div class="${APP}-gradeview" data-view="analytics" id="${APP}-analytics-host"></div>
      <div class="${APP}-gradeview" data-view="report" id="${APP}-report-host"></div>
      <div class="${APP}-note" id="${APP}-import-hint">لا تُغيَّر الدرجات من عرض التحليل. اضغط «استيراد درجات» لفتح نافذة الاستيراد والمراجعة قبل الحفظ.</div>`;
    [['class','className'],['submission','submission'],['grading','grading'],['level','level'],['sort','sort']].forEach(([id,key])=>{
      const el=document.getElementById(`${APP}-${id}`);if(!el)return;
      el.value=state.filter[key];
      el.addEventListener('change',()=>{state.filter[key]=el.value;updateGradeViews();});
    });
    document.getElementById(`${APP}-search`)?.addEventListener('input',e=>{state.filter.query=e.target.value;updateGradeViews();});
    document.getElementById(`${APP}-clear-search`)?.addEventListener('click',()=>{state.filter.query='';const i=document.getElementById(`${APP}-search`);if(i){i.value='';i.focus();}updateGradeViews();});
    document.getElementById(`${APP}-quick-reset`)?.addEventListener('click',resetFilters);
    document.querySelectorAll(`#${APP}-panel .${APP}-tab`).forEach(b=>b.addEventListener('click',()=>setGradeView(b.dataset.view)));

    updateGradeViews();setGradeView(state.view);
    if(state.importPreview&&state.importExpanded)renderImportPreview();
  };

  const refreshGrade = async () => {
    setBusy(true, 'جاري جلب جميع الطلاب…');
    try {
      state.activityTitle = getActivityTitle(document);
      state.students = await fetchAllStudents();
      state.lastRefresh = new Date().toISOString();
      renderGradeBody();
      toast(`تم جلب ${state.students.length} طالبًا من النشاط.`, 'success');
    } catch (e) {
      toast(String(e?.message || e), 'error');
      const body = document.getElementById(`${APP}-body`);
      if (body) body.innerHTML = `<div class="${APP}-note">تعذر تحليل النشاط: ${esc(e?.message || e)}</div>`;
    } finally { setBusy(false); }
  };

  const resetFilters = () => {
    state.filter = { className: 'all', submission: 'all', level: 'all', grading: 'all', sort: 'name_asc', query: '' };
    renderGradeBody();
  };

  const ensureImportModal = function ensureImportModal(){
 let modal=document.getElementById(`${APP}-import-modal`);
 if(modal)return modal;
 modal=document.createElement('section');
 modal.id=`${APP}-import-modal`;
 modal.className=`${APP}-modal`;
 modal.hidden=true;
 modal.setAttribute('role','dialog');
 modal.setAttribute('aria-modal','true');
 modal.setAttribute('aria-label','استيراد درجات الأنشطة والمشاريع');
 modal.innerHTML=`<div class="${APP}-dialog" dir="rtl">
   <div class="${APP}-dialog-head">
    <div><div class="${APP}-title">استيراد درجات Excel / CSV</div><div class="${APP}-sub">مطابقة آمنة · معاينة مفصلة · نسخة احتياطية · تحقق من الحفظ</div></div>
    <button id="${APP}-modal-close" class="${APP}-btn gray" type="button" aria-label="إغلاق نافذة الاستيراد">إغلاق ×</button>
   </div>
   <div class="${APP}-note"><b>قبل الحفظ:</b> الأولوية لرقم الطالب المؤكد، ثم الاسم والفصل عند عدم وجود رقم مطابق. يُرفض الاسم المكرر والتعارض المؤكد بين الهويات. جميع درجات الصفر تُعرض صراحة في المعاينة.</div>
   <div class="${APP}-drop" style="margin:14px 0"><input id="${APP}-file" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><b>اختر ملف الدرجات أو اسحبه هنا</b><span>Excel أو CSV — لن يُحفظ شيء قبل المعاينة والتأكيد</span></div>
   <div id="${APP}-import-preview" aria-live="polite"></div>
 </div>`;
 document.body.appendChild(modal);
 const close=()=>{if(state.loading)return;modal.hidden=true;state.importExpanded=false;};
 document.getElementById(`${APP}-modal-close`)?.addEventListener('click',close);
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close();});
 document.getElementById(`${APP}-file`)?.addEventListener('change',async e=>{
   await readImportFile(e.target.files?.[0]);
   e.target.value='';
 });
 return modal;
};

  const openImport = function newOpenImport() {
 if(state.loading)return;
 const modal=ensureImportModal();
 modal.hidden=false;state.importExpanded=true;
 if(state.importPreview)renderImportPreview();
 document.getElementById(`${APP}-file`)?.focus();
};

  const parseCsv = text => {
    const rows = [];
    let row = [], cell = '', quoted = false;
    const src = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    row.push(cell.replace(/\r$/, ''));
    if (row.some(x => clean(x))) rows.push(row);
    return rows;
  };

  const detectColumns = function(headers) {
 const nh=headers.map(norm);
 const find=patterns=>nh.findIndex(h=>patterns.some(p=>p.test(h)));
 return {
  studentId:find([/student\s*id/,/studentid/,/رقم\s*الطالب/,/معرف\s*الطالب/,/^id$/]),
  name:find([/اسم\s*الطالب/,/^الطالب$/,/(?:student|full)\s*name/,/^name$/]),
  grade:find([/^الدرجه$/,/^درجه$/,/الدرجه\s*المحصله/,/score/,/grade/,/mark/]),
  feedback:find([/ملاحظ/,/تعليق/,/feedback/,/comment/]),
  submissionStatus:find([/^الحاله$/, /حاله\s*التسليم/, /submission\s*status/, /^status$/]),
  className:find([/^الفصل$/, /الفصل\s*المدرسي/, /class\s*name/, /^class$/])
 };
};

    const readImportFile = async function(file) {
 if(!file)return;
 setBusy(true,'جارٍ فحص الملف ومطابقة الطلاب…');
 try {
  if(!state.students.length)throw new Error('قائمة طلاب المشروع فارغة. اضغط «تحديث التحليل» أولًا.');
  let aoa=[],sheetName='';
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='csv') {aoa=parseCsv(await file.text());sheetName='CSV';}
  else {
   if(!globalThis.XLSX)throw new Error('مكتبة Excel غير متاحة.');
   const book=XLSX.read(await file.arrayBuffer(),{type:'array',raw:false});
   for(const shName of book.SheetNames) {
    const rows=XLSX.utils.sheet_to_json(book.Sheets[shName],{header:1,defval:'',raw:false});
    const headerIndex=rows.slice(0,15).findIndex(row=>{
     const c=detectColumns((row||[]).map(clean));
     return c.grade>=0&&(c.name>=0||c.studentId>=0);
    });
    if(headerIndex>=0){aoa=rows.slice(headerIndex);sheetName=shName;break;}
   }
  }
  if(aoa.length<2)throw new Error('لم أجد ورقة تحتوي على أعمدة «اسم الطالب» و«الدرجة». راجع ترتيب الأعمدة.');
  const headers=aoa[0].map(clean),cols=detectColumns(headers);
  if(cols.grade<0)throw new Error('تعذر العثور على عمود الدرجة.');
  if(cols.name<0&&cols.studentId<0)throw new Error('يلزم عمود اسم الطالب أو رقم الطالب.');

  const idMap=new Map(),nameMap=new Map();
  const add=(map,key,student)=>{
   if(!key)return;
   if(!map.has(key))map.set(key,[]);
   if(!map.get(key).some(s=>s.studentId===student.studentId))map.get(key).push(student);
  };
  state.students.forEach(student=>{
   const f=student.rawFields||{};
   const identifiers=[student.studentId,f.StudentNationalId,f.NationalId,f.NationalID,f.IdentityNumber,f.StudentNumber,f.CivilId,f.StudentIdentityNumber];
   identifiers.forEach(v=>add(idMap,studentIdKey(v),student));
   [student.name,studentNameFromSelect(student.studentId),f.FullName,f.fullName,f.StudentName,f.Name].forEach(v=>add(nameMap,studentNameKey(v),student));
  });

  const preview=[],matchedIds=new Map();
  for(let i=1;i<aoa.length;i++){
   const row=aoa[i]||[];
   if(!row.some(x=>clean(x)))continue;
   const sid=cols.studentId>=0?clean(row[cols.studentId]):'';
   const name=cols.name>=0?clean(row[cols.name]):'';
   const className=cols.className>=0?clean(row[cols.className]):'';
   const grade=num(row[cols.grade]);
   const feedback=cols.feedback>=0?clean(row[cols.feedback]):'';
   const submissionStatus=cols.submissionStatus>=0?clean(row[cols.submissionStatus]):'';
   const idMatches=idMap.get(studentIdKey(sid))||[];
   const nameKey=studentNameKey(name);
   let nameMatches=nameMap.get(nameKey)||[];
   if(nameMatches.length>1&&className){
    const cls=nameMatches.filter(x=>norm(x.className)===norm(className));
    if(cls.length===1)nameMatches=cls;
   }
   // لا نستخدم تطابقًا جزئيًا إلا إذا كان الاسم طويلًا ومميزًا بين جميع طلاب المشروع.
   if(!nameMatches.length&&nameKey.split(' ').length>=4&&nameKey.length>=17){
    nameMatches=state.students.filter(x=>{
     const k=studentNameKey(x.name);
     return k.includes(nameKey)&&(k.length-nameKey.length)<=65;
    });
   }
   let student=null,method='',reason='',status='ready';
   if(idMatches.length===1) {
    student=idMatches[0];method='رقم الطالب';
    // مثل استيراد الواجبات: هوية الطالب ذات الرقم الفريد موثوقة.
    // لا نرفضها لمجرد اختلاف الاسم المستخرج من بطاقة HTML.
    // نوقفها فقط عندما يثبت الاسم الفريد أنه يعود لطالب آخر داخل نفس المشروع.
    if(nameMatches.length===1 && nameMatches[0].studentId!==student.studentId){
     status='identity_conflict';reason='رقم الطالب والاسم يشيران إلى طالبين مختلفين مسجلين في المشروع';
    }else if(name&&studentNameKey(student.name)!==nameKey){
     method='رقم الطالب مؤكد · اختلاف عرض الاسم';
    }
   } else if(idMatches.length>1) {
    status='ambiguous';reason='معرف الطالب غير فريد في بيانات مدرستي';
   } else if(nameMatches.length===1) {
    student=nameMatches[0];method=sid?'اسم فريد (رقم مختلف النظام)':'الاسم الفريد';
   } else if(nameMatches.length>1) {
    status='ambiguous';reason='الاسم متكرر؛ لا يمكن اختيار الطالب تلقائيًا';
   } else {
    status='unmatched';reason='لم يتطابق الاسم أو رقم الطالب مع سجلات المشروع';
   }
   if(status==='ready'&&!Number.isFinite(grade)){
    status='invalid';reason='الدرجة ليست رقمًا صالحًا';
   }else if(status==='ready'&&grade<0){
    status='invalid';reason='درجة سالبة';
   }else if(status==='ready'&&Number.isFinite(student?.totalGrade)&&student.totalGrade>=0&&grade>student.totalGrade){
    status='invalid';reason=`درجة الملف ${fmt(grade)} أعلى من الدرجة القصوى في مدرستي ${fmt(student.totalGrade)}`;
   }else if(status==='ready'&&(!Number.isFinite(student?.totalGrade)||student.totalGrade<=0)){
    status='invalid';reason='الدرجة الكلية في مدرستي غير معروفة؛ لن يتم الحفظ دون تحقق';
   }
   if(status==='ready'&&student&&className&&clean(student.className)&&norm(className)!==norm(student.className)){
    status='identity_conflict';reason='الفصل في الملف يختلف عن الفصل المسجل للطالب في هذا المشروع';
   }
   if(student&&status==='ready'){
    const prior=matchedIds.get(String(student.studentId));
    if(prior){
     status='duplicate';reason=`هذا الطالب مكرر في صفوف الملف (الصف ${prior.sourceRow})`;
     const prev=preview[prior.mark];
     if(prev){prev.status='duplicate';prev.reason=`هذا الطالب مكرر في صفوف الملف (الصف ${i+1})`;}
    }else matchedIds.set(String(student.studentId),{sourceRow:i+1,mark:preview.length});
   }
   // نفس الواجبات: افصل «لا تغيير» عن «جاهز للحفظ».
   if(status==='ready'&&Number.isFinite(student?.grade)&&Math.abs(student.grade-grade)<1e-6
      &&(!state.importFeedback||!feedback||clean(student.feedback)===feedback)){
    status='unchanged';reason='الدرجة مطابقة للموجودة في مدرستي';
   }
   preview.push({sourceRow:i+1,sid,name,className,grade,feedback,submissionStatus,student,method,status,baseStatus:status==='unchanged'?'ready':status,reason});
  }
  const numberNotes=preview.filter(x=>/^\d+(?:[.,]\d+)?$/.test(x.feedback)).length;
  state.importFeedback=false;
  state.importPreview={fileName:file.name,sheetName,rows:preview,numericFeedbackCount:numberNotes};
  state.importExpanded=true;
  ensureImportModal().hidden=false;
  renderImportPreview();
  if(!preview.some(x=>x.status==='ready')&&preview.some(x=>x.status!=='unchanged'))toast('بعض الصفوف تحتاج مراجعة. افتح المعاينة لتفاصيلها.','info');
 }catch(e){toast(String(e?.message||e),'error');}
 finally{setBusy(false);}
};

    const renderImportPreview = function(){
 const host=document.getElementById(`${APP}-import-preview`);
 if(!host||!state.importPreview)return;
 const rows=state.importPreview.rows;
 // إبقاء معاينة «لا تغيير / جاهز» متزامنة مع خيار استيراد الملاحظات.
 rows.forEach(r=>{
   if(r.baseStatus!=='ready')return;
   const gradeSame=Number.isFinite(r.student?.grade)&&Math.abs(r.student.grade-r.grade)<1e-6;
   const feedbackSame=!r.feedback||clean(r.student?.feedback)===clean(r.feedback);
   if(gradeSame&&(!state.importFeedback||feedbackSame)){r.status='unchanged';r.reason='الدرجة مطابقة للموجودة في مدرستي';}
   else{r.status='ready';r.reason='';}
 });
 const ready=rows.filter(r=>r.status==='ready');
 const unchanged=rows.filter(r=>r.status==='unchanged').length;
 const bad=rows.length-ready.length-unchanged;
 const unmatched=rows.filter(r=>r.status==='unmatched').length;
 const invalid=rows.filter(r=>r.status==='invalid').length;
 const ambiguous=rows.filter(r=>['ambiguous','duplicate','identity_conflict'].includes(r.status)).length;
 const fileGrades=rows.map(r=>r.grade).filter(Number.isFinite);
 const maxFile=fileGrades.length?Math.max(...fileGrades):null;
 const platformLimits=[...new Set(state.students.map(s=>s.totalGrade).filter(x=>Number.isFinite(x)&&x>0))];
 const cap=platformLimits.length===1?fmt(platformLimits[0]):platformLimits.length?platformLimits.map(x=>fmt(x)).slice(0,5).join(' / '):'غير متاح';
 const notesWarning=state.importPreview.numericFeedbackCount?`<div class="${APP}-note">تنبيه: يوجد ${state.importPreview.numericFeedbackCount} صفًا يحتوي رقمًا في عمود الملاحظات (مثل 14). <b>لن تُنقل الملاحظات تلقائيًا</b> إلا إذا فعّلت الخيار أدناه.</div>`:'';
 host.innerHTML=`
 <div class="${APP}-note"><b>${esc(state.importPreview.fileName)}</b> · الورقة: ${esc(state.importPreview.sheetName)} · الصفوف: ${rows.length} · <b>جاهز للتغيير: ${ready.length}</b> · مطابق بالفعل: ${unchanged} · يحتاج مراجعة: ${bad} · غير مطابق: ${unmatched} · درجة غير صالحة: ${invalid} · ملتبس: ${ambiguous}</div>
 <div class="${APP}-note">أعلى درجة في الملف: <b>${maxFile===null?'—':fmt(maxFile)}</b> · الدرجة الكلية في مدرستي: <b>${esc(cap)}</b> · الطلاب المحملون: ${state.students.length}.</div>
 ${notesWarning}
 <label class="${APP}-note" style="display:block;cursor:pointer"><input id="${APP}-import-feedback" type="checkbox" ${state.importFeedback?'checked':''}> استيراد الملاحظات أيضًا (اختياري، غير مفعّل افتراضيًا). إن لم تُفعّل هذا الخيار ستبقى ملاحظات مدرستي كما هي.</label>
 <div class="${APP}-toolbar" style="margin-bottom:8px"><button id="${APP}-patch" class="${APP}-btn alt" ${ready.length?'':'disabled'}>تطبيق في الخانات الظاهرة</button><button id="${APP}-save" class="${APP}-btn" ${ready.length?'':'disabled'}>حفظ ${ready.length} درجة على مدرستي</button><button type="button" id="${APP}-preview-xlsx" class="${APP}-btn alt">تصدير المعاينة Excel</button></div>
 <div class="${APP}-tablewrap" style="max-height:380px"><table class="${APP}-table"><thead><tr><th>الصف</th><th>الطالب في الملف</th><th>اسم مدرستي</th><th>رقم الطالب</th><th>الفصل</th><th>حالة التسليم</th><th>طريقة المطابقة</th><th>الدرجة الحالية</th><th>الدرجة الجديدة</th><th>الدرجة القصوى</th><th>الحالة / السبب</th></tr></thead><tbody>
 ${rows.slice(0,300).map(r=>`<tr><td>${r.sourceRow}</td><td>${esc(r.name||'—')}</td><td>${esc(r.student?.name||'—')}</td><td>${esc(r.sid||r.student?.studentId||'—')}</td><td>${esc(r.className||r.student?.className||'—')}</td><td>${esc(r.submissionStatus||'غير محدد')}</td><td>${esc(r.method||'—')}</td><td>${Number.isFinite(r.student?.grade)?fmt(r.student.grade):'—'}</td><td><b>${Number.isFinite(r.grade)?fmt(r.grade):'—'}</b></td><td>${Number.isFinite(r.student?.totalGrade)?fmt(r.student.totalGrade):'—'}</td><td>${r.status==='ready'?`<span class="${APP}-pill ${APP}-ok">جاهز للتطبيق</span>`:`<span class="${APP}-pill ${r.status==='unchanged'?`${APP}-ok`:`${APP}-bad`}">${esc(r.reason||'يحتاج مراجعة')}</span>`}</td></tr>`).join('')}
 </tbody></table></div>`;
 document.getElementById(`${APP}-import-feedback`)?.addEventListener('change',e=>{state.importFeedback=!!e.target.checked;renderImportPreview();});
 document.getElementById(`${APP}-patch`)?.addEventListener('click',patchVisibleImport);
 document.getElementById(`${APP}-save`)?.addEventListener('click',saveImport);
 document.getElementById(`${APP}-preview-xlsx`)?.addEventListener('click',exportImportPreview);
};

  const exportImportPreview = function exportImportPreview(){
 if(!globalThis.XLSX)return toast('مكتبة Excel غير متاحة.','error');
 const rows=state.importPreview?.rows||[];
 if(!rows.length)return toast('لا توجد معاينة لتصديرها.','error');
 const values=rows.map(r=>({
  'صف الملف':r.sourceRow,
  'الاسم في Excel':r.name,
  'الاسم في مدرستي':r.student?.name||'',
  'رقم الملف':r.sid,
  'رقم مدرستي':r.student?.studentId||'',
  'الفصل':r.className||r.student?.className||'',
  'حالة التسليم':r.submissionStatus||'',
  'طريقة المطابقة':r.method||'',
  'الدرجة الحالية':r.student?.grade??'',
  'الدرجة الجديدة':r.grade??'',
  'الدرجة القصوى':r.student?.totalGrade??'',
  'الحالة':r.status,
  'سبب المراجعة':r.reason
 }));
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(values),'معاينة الاستيراد');
 XLSX.writeFile(wb,`معاينة-درجات-المشاريع-${new Date().toISOString().slice(0,10)}.xlsx`);
};

    const patchVisibleImport = () => {
    const ready = state.importPreview?.rows?.filter(r => r.status === 'ready') || [];
    let count = 0;
    ready.forEach(r => {
      const sid = r.student.studentId;
      const checkbox = document.getElementById(`checkStudent-${sid}`);
      const index = checkbox?.dataset?.index ?? checkbox?.getAttribute('data-index');
      let gradeInput = index !== undefined && index !== null && index !== '' ? document.querySelector(`[name="List[${index}].Grade"]`) : null;
      let feedback = index !== undefined && index !== null && index !== '' ? document.querySelector(`[name="List[${index}].feedBack"]`) : null;
      if (!gradeInput) {
        const hidden = [...document.querySelectorAll('input[name$=".StudentId"]')].find(x => String(x.value) === String(sid));
        const m = hidden?.name?.match(/^List\[(\d+)\]/);
        if (m) {
          gradeInput = document.querySelector(`[name="List[${m[1]}].Grade"]`);
          feedback = document.querySelector(`[name="List[${m[1]}].feedBack"]`);
        }
      }
      if (gradeInput) {
        gradeInput.value = r.grade;
        gradeInput.dispatchEvent(new Event('input', { bubbles: true }));
        gradeInput.dispatchEvent(new Event('change', { bubbles: true }));
        if (feedback && state.importFeedback && r.feedback) feedback.value = r.feedback;
        count++;
      }
    });
    toast(`تم تطبيق ${count} درجة في الخانات الظاهرة.`, 'success');
  };

  const downloadJson = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const globalProjectFormFields = () => {
    const form=[...document.forms].find(f=>/\/Projects\/Projects\/GradeProject\//i.test(f.action||'')||f.querySelector?.('[name^="List["]'));
    const out=[],seen=new Set();
    const push=el=>{
      if(!el?.name||/^List\[/i.test(el.name)||el.disabled)return;
      if(['button','submit','reset','file'].includes(el.type))return;
      if((el.type==='radio'||el.type==='checkbox')&&!el.checked)return;
      const key=el.name+'|'+String(el.value??'');
      if(!seen.has(key)){out.push([el.name,el.value??'']);seen.add(key);}
    };
    if(form)[...form.elements].forEach(push);
    document.querySelectorAll('input[type="hidden"][name]').forEach(push);
    return out;
  };

    const buildProjectPost = rows => {
    const params = new URLSearchParams();
    globalProjectFormFields().forEach(([k, v]) => params.append(k, v));
    rows.forEach((row, index) => {
      const fields = { ...(row.rawFields || {}) };
      fields.StudentId = row.studentId;
      fields.TotalGrade = Number.isFinite(row.totalGrade) ? row.totalGrade : (fields.TotalGrade ?? '');
      fields.Grade = Number.isFinite(row.grade) ? row.grade : '';
      fields.feedBack = row.feedback ?? fields.feedBack ?? '';
      Object.keys(fields).forEach(key => {
        const value = fields[key];
        if (value === undefined || value === null) return;
        params.append(`List[${index}].${key}`, String(value));
      });
    });
    return params;
  };

  const postProjectRows = async rows => {
    if(!/\/Projects\/Projects\/GradeProject\//i.test(location.pathname))throw new Error('الحفظ متاح من صفحة رصد المشروع فقط.');
    if(!rows?.length)throw new Error('لا توجد درجات في الدفعة.');
    const form=[...document.forms].find(f=>/\/Projects\/Projects\/GradeProject\//i.test(f.action||'')||f.querySelector?.('[name^="List["]'));
    if(!form)throw new Error('لم أتعرف على نموذج حفظ درجات المشروع. لم تُرسل الدفعة.');
    const url=`${location.origin}${location.pathname}${location.search||''}`;
    const body=buildProjectPost(rows);
    const count=[...body.keys()].filter(k=>/^List\[\d+\]\.StudentId$/.test(k)).length;
    if(count!==rows.length)throw new Error('الدفعة غير مكتملة. لم تُرسل إلى مدرستي.');
    const trace=globalThis.MAIP_IMPORT_TRACE||(globalThis.MAIP_IMPORT_TRACE=[]);
    trace.push({action:'POST_START',at:new Date().toISOString(),size:rows.length});
    const response=await fetch(url,{method:'POST',credentials:'include',cache:'no-store',redirect:'follow',
      headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},
      body:body.toString()});
    const html=await response.text();
    trace.push({action:'POST_RESULT',at:new Date().toISOString(),size:rows.length,status:response.status,redirected:response.redirected,bodyLength:html.length});
    if(!response.ok)throw new Error(`رفض مدرستي الحفظ (HTTP ${response.status}).`);
    const resolved=new URL(response.url||url,location.origin);
    if(response.redirected&&!/\/Projects\/Projects\/GradeProject\//i.test(resolved.pathname))throw new Error('أعاد مدرستي التوجيه بعيدًا عن صفحة الرصد؛ لم يتأكد الحفظ.');
    if(/<title[^>]*>\s*(?:تسجيل الدخول|Login|Sign in)/i.test(html)||/name=["']password["']/i.test(html))throw new Error('انتهت الجلسة أو ظهر تسجيل الدخول بدل نتيجة الحفظ.');
    return html;
  };

    const saveImport = async function(){
 const ready=state.importPreview?.rows?.filter(r=>r.status==='ready')||[];
 if(!ready.length)return toast('لا توجد درجات جاهزة للحفظ. راجع أسباب الرفض في المعاينة.','error');
 if(new Set(ready.map(r=>String(r.student.studentId))).size!==ready.length)return toast('هناك طلاب مكررون في المطابقة، تم إيقاف الحفظ.','error');
 const noteLabel=state.importFeedback?'مع الملاحظات':'مع الحفاظ على ملاحظات مدرستي';
 if(!confirm(`سيتم حفظ ${ready.length} درجة في المشروع «${state.activityTitle}» (${noteLabel}).\nسيتم تنزيل نسخة احتياطية قبل الحفظ، ثم التحقق من الدرجات من مدرستي.\n\nمتابعة؟`))return;
 const backup=ready.map(r=>({studentId:r.student.studentId,name:r.student.name,oldGrade:r.student.grade,oldFeedback:r.student.feedback,newGrade:r.grade,newFeedback:state.importFeedback?r.feedback:r.student.feedback}));
 downloadJson(`project-grade-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{activity:state.activityTitle,at:new Date().toISOString(),notesImported:state.importFeedback,rows:backup});
 setBusy(true,'جاري الحفظ والتحقق من أول دفعة…');
 let posted=0;
 try{
  // اقرأ أحدث حالة للطلاب قبل أي كتابة على مدرستي؛ الخانات القديمة قد تكون تغيّرت.
  const latest=await fetchAllStudents(),latestById=new Map(latest.map(row=>[studentIdKey(row.studentId),row]));
  if(ready.some(r=>!latestById.has(studentIdKey(r.student.studentId))))throw new Error('بعض سجلات الطلاب لم تعد متاحة في مدرستي؛ لم تُرسل الدرجات.');
  const changes=ready.map(r=>{
    const student=latestById.get(studentIdKey(r.student.studentId));
    if(!Number.isFinite(student.totalGrade)||student.totalGrade<=0||r.grade>student.totalGrade)throw new Error(`تغير الحد الأعلى لدرجة ${r.student.name}. أُوقف الحفظ.`);
    const feedback=state.importFeedback?(r.feedback||student.feedback||''):(student.feedback||'');
    return {...student,grade:r.grade,feedback,rawFields:{...student.rawFields,Grade:String(r.grade),feedBack:feedback}};
  });
  for(let i=0;i<changes.length;i+=10){
   const batch=changes.slice(i,i+10);
   await postProjectRows(batch);
   posted+=batch.length;
   // تحقّق من أول دفعة قبل إرسال بقية الملف لتقليل أثر اختلاف نموذج الحفظ بين الواجبات والمشاريع.
   if(i===0){
    const firstFetch=await fetchAllStudents();
    const firstMap=new Map(firstFetch.map(r=>[String(r.studentId),r]));
    const miss=batch.filter(r=>!Number.isFinite(firstMap.get(String(r.studentId))?.grade)||Math.abs(firstMap.get(String(r.studentId)).grade-r.grade)>1e-4);
    state.students=firstFetch;
    if(miss.length)throw new Error(`أرسلت أول ${batch.length} سجلات، لكن مدرستي لم يؤكد ${miss.length} درجة. أوقفت بقية الدفعات تلقائيًا. راجع نتائج المشروع ولا تكرر الحفظ قبل التأكد.`);
   }
   const status=document.getElementById(`${APP}-status`);
   if(status)status.textContent=`أُرسل ${posted} من ${changes.length} درجة…`;
  }
  const after=await fetchAllStudents(),map=new Map(after.map(r=>[String(r.studentId),r]));
  const mismatch=ready.filter(r=>!Number.isFinite(map.get(String(r.student.studentId))?.grade)||Math.abs(map.get(String(r.student.studentId)).grade-r.grade)>1e-4);
  state.students=after;
  if(mismatch.length){
   renderGradeBody();
   toast(`أُرسلت ${posted} درجة، لكن ${mismatch.length} لم تتأكد بعد قراءة مدرستي. لم يُعلن نجاح الحفظ.`, 'error');
  }else{
   state.importPreview=null;
   renderGradeBody();
   toast(`تم حفظ والتحقق من ${ready.length} درجة في مدرستي بنجاح.`, 'success');
  }
 }catch(e){
  renderGradeBody();
  toast(`توقف الحفظ بعد إرسال ${posted} درجة: ${String(e?.message||e)}`,'error');
 }finally{setBusy(false);}
};

    const cleanFile = name => clean(name).replace(/[\\/:*?"<>|]/g,'-').slice(0,90) || 'تقرير';
  const printHtml = (title,inner) => {
    const w=window.open('','_blank','width=1100,height=800');
    if(!w)return toast('يرجى السماح بنوافذ الطباعة المنبثقة.','error');
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Tahoma,Arial,sans-serif;color:#172033;padding:24px}h1{font-size:20px;margin:0 0 5px}.sub{color:#64748b;font-size:12px;margin-bottom:18px}h2{font-size:15px;margin:22px 0 9px}
      .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.metric{border:1px solid #ddd;border-radius:8px;padding:9px}.metric b{display:block;font-size:18px}.metric small{color:#64748b}
      table{border-collapse:collapse;width:100%;font-size:10px;table-layout:auto}th,td{border:1px solid #d8e0e7;padding:6px;text-align:right}th{background:#f1f5f9}tr{break-inside:avoid}thead{display:table-header-group}p{font-size:11px;line-height:1.8}
      @page{size:A4 landscape;margin:12mm}@media print{body{padding:0}}
      </style></head><body>${inner}<script>setTimeout(()=>window.print(),350)<\/script></body></html>`);
    w.document.close();
  };
  const gradeMetricsPrint = s => `<div class="metrics">${[['الطلاب',s.total],['سلّم',s.submitted],['لم يسلّم',s.notSubmitted],['نسبة التسليم',fmt(s.submissionRate)+'%'],['مرصود',s.graded],['متوسط الأداء',s.avg===null?'—':fmt(s.avg)+'%'],['أعلى أداء',s.high===null?'—':fmt(s.high)+'%'],['أقل أداء',s.low===null?'—':fmt(s.low)+'%']].map(([k,v])=>`<div class="metric"><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join('')}</div>`;
  const gradeTablePrint = rows => `<table><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>التسليم</th><th>الرصد</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th><th>الملاحظة</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.className||'—')}</td><td>${r.hasAnswer?'سلّم':'لم يسلّم'}</td><td>${Number.isFinite(r.grade)?'مرصود':'غير مرصود'}</td><td>${Number.isFinite(r.grade)?fmt(r.grade):'—'} / ${Number.isFinite(r.totalGrade)?fmt(r.totalGrade):'—'}</td><td>${gradePercent(r)===null?'—':fmt(gradePercent(r))+'%'}</td><td>${esc(bandLabel(band(r)))}</td><td>${esc(r.feedback||'')}</td></tr>`).join('')}</tbody></table>`;
  const printReport = () => {
    const rows=filteredRows(),s=detailedStats(rows);
    const title=state.activityTitle||'تقرير نشاط / مشروع';
    const timing=verifiedProjectEnd(document);
    const stage=timing==='ended'?'تقرير نهائي بعد انتهاء استقبال الحلول':timing==='receiving'?'تقرير متابعة أولي — استقبال الحلول لم ينتهِ بعد':'تقرير متابعة غير نهائي — تعذر التحقق من وقت انتهاء النشاط';
    const classes=s.byClass.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.total}</td><td>${c.submitted}</td><td>${c.graded}</td><td>${c.avg===null?'—':fmt(c.avg)+'%'}</td></tr>`).join('');
    const levels=levelKeys.map(k=>`<tr><td>${esc(bandLabel(k))}</td><td>${s.levels[k]}</td><td>${fmt(pct(s.levels[k],s.total))}%</td></tr>`).join('');
    printHtml(`تقرير ${title}`,`<h1>تقرير النشاط / المشروع</h1><p><b>${esc(stage)}</b></p><div class="sub">${esc(title)} · ${esc(filterContext())} · ${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>${gradeMetricsPrint(s)}<h2>توزيع التقديرات</h2><table><thead><tr><th>التقدير</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${levels}</tbody></table><h2>ملخص الفصول</h2><table><thead><tr><th>الفصل</th><th>الطلاب</th><th>سلّم</th><th>مرصود</th><th>المتوسط</th></tr></thead><tbody>${classes}</tbody></table><h2>تفاصيل الطلاب</h2>${gradeTablePrint(rows)}<p>تستند النتائج إلى بيانات الطلاب المتاحة في صفحة رصد مدرستي. لا تُحسب الدرجة الناقصة صفرًا. التقرير يعكس البحث والتصفية عند الطباعة.</p>`);
  };

  const exportExcel = () => {
    if (!globalThis.XLSX) return toast('مكتبة Excel غير متاحة.', 'error');
    const rows = filteredRows();
    const s = detailedStats(rows);
    const wb = XLSX.utils.book_new();
    const summaryRows = [['النشاط', state.activityTitle], ['السياق', filterContext()], ['الطلاب', s.total], ['سلّم', s.submitted], ['لم يسلّم', s.notSubmitted], ['نسبة التسليم', `${s.submissionRate}%`], ['مرصود', s.graded], ['نسبة الرصد', `${s.gradingRate}%`], ['متوسط الأداء', s.avg == null ? '' : s.avg]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    const studentRows = rows.map((r, i) => ({ '#': i + 1, 'الطالب': r.name, 'رقم الطالب': r.studentId, 'الفصل': r.className, 'التسليم': r.hasAnswer ? 'سلّم' : 'لم يسلّم', 'الدرجة': r.grade ?? '', 'من': r.totalGrade ?? '', 'النسبة': Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade, r.totalGrade) : '', 'التقدير': bandLabel(band(r)), 'الملاحظة': r.feedback || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'Students');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['التقدير','العدد','النسبة'], ...levelKeys.map(k=>[bandLabel(k),s.levels[k],pct(s.levels[k],s.total)])]),'Levels');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.byClass.map(c=>({'الفصل':c.name,'الطلاب':c.total,'سلّم':c.submitted,'مرصود':c.graded,'المتوسط':c.avg??''}))), 'Classes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['سياق البحث والفلاتر',filterContext()],['الطلاب المعروضون',rows.length],['وقت التصدير',new Date().toISOString()],['صلاحية التقرير النهائي',verifiedProjectEnd(document)==='ended'?'مكتمل':'غير نهائي / غير متحقق']]),'Filters');
    XLSX.writeFile(wb, `تقرير-${state.activityTitle.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`);
  };

  const exportCsv = () => {
    const rows = filteredRows();
    const cells = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['#','الطالب','رقم الطالب','الفصل','التسليم','الدرجة','من','النسبة','التقدير','الملاحظة'].map(cells).join(',')];
    rows.forEach((r, i) => lines.push([i + 1, r.name, r.studentId, r.className, r.hasAnswer ? 'سلّم' : 'لم يسلّم', r.grade ?? '', r.totalGrade ?? '', Number.isFinite(r.grade) && Number.isFinite(r.totalGrade) && r.totalGrade > 0 ? pct(r.grade, r.totalGrade) : '', bandLabel(band(r)), r.feedback || ''].map(cells).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `تقرير-${state.activityTitle.replace(/[\\/:*?"<>|]/g, '-')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const renderGrade = () => {
    insertPanel('مدير الأنشطة والمشاريع الذكي', `تحليل الطلاب والتقارير والرسوم البيانية — ${VERSION}`,
      `<button id="${APP}-refresh" class="${APP}-btn">تحديث التحليل</button><button id="${APP}-import-btn" class="${APP}-btn alt">استيراد درجات</button><button id="${APP}-print" class="${APP}-btn gray">طباعة التقرير</button><button id="${APP}-xlsx" class="${APP}-btn gray">Excel</button><button id="${APP}-csv" class="${APP}-btn gray">CSV</button><button id="${APP}-reset" class="${APP}-btn gray">إعادة التصفية</button>`);
    document.getElementById(`${APP}-refresh`)?.addEventListener('click', refreshGrade);
    document.getElementById(`${APP}-import-btn`)?.addEventListener('click', openImport);
    document.getElementById(`${APP}-print`)?.addEventListener('click', printReport);
    document.getElementById(`${APP}-xlsx`)?.addEventListener('click', exportExcel);
    document.getElementById(`${APP}-csv`)?.addEventListener('click', exportCsv);
    document.getElementById(`${APP}-reset`)?.addEventListener('click', resetFilters);
    refreshGrade();
  };


  const samePageUrl = raw => {
    if (!raw) return '';
    try { const u=new URL(raw,location.href); return u.origin===location.origin && /^https?:$/.test(u.protocol) ? u.href : ''; }
    catch{return '';}
  };
  const safeLink = (url,label) => url && samePageUrl(url) ? `<a class="${APP}-btn alt" style="display:inline-block;text-decoration:none" href="${esc(samePageUrl(url))}">${esc(label)}</a>` : '—';
  const projectCardsFromDoc = (doc=document) => {
    const results=[],seen=new Set();
    [...doc.querySelectorAll('a[href*="/Projects/Projects/ViewProject/"]')].forEach(link=>{
      const href=samePageUrl(link.href);if(!href)return;
      const m=new URL(href).pathname.match(/\/ViewProject\/([A-F0-9]{32})/i);
      if(!m||seen.has(m[1]))return;
      seen.add(m[1]);let root=link;
      for(let i=0;i<11 && root;i++,root=root.parentElement){if(root.querySelectorAll?.('a[href*="/ViewProject/"]').length===1 && root.querySelector?.('h4'))break;}
      const title=clean(root?.querySelector?.('h4')?.textContent||link.closest('div')?.parentElement?.querySelector('h4')?.textContent||`نشاط ${results.length+1}`);
      const pub=root?.querySelector?.('a.analytic-activity-grading,a[href*="/Projects/Projects/PublishedProjects"]');
      const pubHref=samePageUrl(pub?.href)||samePageUrl(`/Projects/Projects/PublishedProjects?ProjectId=${m[1]}`);
      const text=clean(root?.innerText||'');
      const allLinks=[...root?.querySelectorAll?.('a[href]')||[]];
      results.push({projectId:m[1],title,viewUrl:href,publishedUrl:pubHref,description:text.slice(0,320),source:clean(root?.querySelector?.('h5,h6')?.textContent||''),status:/منتهي/.test(text)?'منتهي':/جار|حالي|نشط/.test(text)?'حالي':'غير محدد',grade:null});
    });
    return results;
  };
  const pageLinks = (doc,routePart) => [...doc.querySelectorAll('.pagination a[href],a.page-link[href], [class*="pagination"] a[href]')].map(a=>samePageUrl(a.href)).filter(url=>{if(!url)return false;try{return new URL(url).pathname.toLowerCase().includes(routePart.toLowerCase());}catch{return false;}});
  const getDocument = async url => {
    const safe=samePageUrl(url);if(!safe)throw new Error('رابط غير آمن أو خارج منصة مدرستي');
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),18000);
    try {const r=await fetch(safe,{credentials:'include',cache:'no-store',signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const text=await r.text();return new DOMParser().parseFromString(text,'text/html');}
    finally{clearTimeout(timer);}
  };
  const indexFiltered = () => state.indexItems.filter(x=>![x.title,x.description,x.projectId,x.status,x.source].every(s=>!norm(s).includes(norm(state.indexQuery))));
  const indexSummary = rows => ({total:rows.length,current:rows.filter(x=>x.status==='حالي').length,ended:rows.filter(x=>x.status==='منتهي').length,unspecified:rows.filter(x=>x.status==='غير محدد').length,published:rows.filter(x=>!!x.publishedUrl).length});

  const indexView = () => {
    const rows=indexFiltered(),s=indexSummary(rows),deep=deepSummaryOf(rows),ds=deep.stats;
    const host=document.getElementById(`${APP}-index-results`);if(!host)return;
    host.innerHTML=`<div class="${APP}-metrics">${[
      [s.total,'الأنشطة والمشاريع'],[s.current,'الحالية في العرض'],[s.ended,'المنتهية في العرض'],[state.indexPages,'صفحات مفهرسة'],[state.deepScanned?deep.published:'—','منشورات محللة'],[state.deepScanned?deep.scanned:'—','أنشطة مكتملة الفحص'],[state.deepScanned&&ds.avg!==null?`${fmt(ds.avg)}%`:'—','متوسط الأداء العام'],[state.deepScanned&&ds.total?`${fmt(ds.submissionRate)}%`:'—','نسبة التسليم المحققة']
    ].map(([v,k])=>metric(v,k)).join('')}</div>
    <div class="${APP}-note">${state.indexScanned?'جُمعت صفحات الفهرس المتاحة.':'هذه نتائج الصفحة الحالية فقط؛ اضغط «تحديث جميع الصفحات». '} ${state.deepScanned?`النتائج التفصيلية من ${deep.scanned} نشاطًا مكتملًا، مع ${deep.receiving} نشر قيد الاستقبال و${deep.unknown} حالة لا يمكن التحقق منها.`:'اضغط «تحليل أداء الأنشطة المنتهية» لجلب إحصائيات التسليم والدرجات من الرصد الفعلي. '} التقارير النهائية تستبعد المنشورات الجاري استقبالها وغير المتحققة؛ العدد الظاهر لا يعني بالضرورة شمول كل المشاريع.</div>
    <div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>#</th><th>النشاط / المشروع</th><th>المصدر</th><th>الحالة</th><th>الرصد</th><th>نسبة التسليم</th><th>المتوسط</th><th>لم يسلّم</th><th>الروابط</th></tr></thead><tbody>${rows.length?rows.map((x,i)=>{
      const d=state.deepByProject.get(x.projectId),r=d?.rows||[],sum=d&&d.status==='ready'&&r.length?summary(r):null;
      const label=!d?'لم يفحص':d.status==='ready'?'مكتمل':d.status==='partial'?'جزئي':d.status==='error'?'تعذر':'غير متحقق';
      return `<tr><td>${i+1}</td><td><b>${esc(x.title)}</b></td><td>${esc(x.source||'—')}</td><td>${esc(x.status)}</td><td>${d?`${d.links} · ${esc(label)}`:'—'}</td><td>${sum?fmt(sum.submissionRate)+'%':'—'}</td><td>${sum&&sum.avg!==null?fmt(sum.avg)+'%':'—'}</td><td>${sum?sum.notSubmitted:'—'}</td><td>${safeLink(x.viewUrl,'استعراض')} ${safeLink(x.publishedUrl,'المرسلة / الرصد')}</td></tr>`;
    }).join(''):`<tr><td colspan="9" class="${APP}-rowempty">لا توجد نتائج مطابقة.</td></tr>`}</tbody></table></div>
    ${state.deepScanned&&ds.total?`<div class="${APP}-subhead">التحليل البياني للأنشطة المكتملة التي شملها الفلتر</div>${gradeAnalyticsHtml(deep.rows,ds)}`:''}`;
    const count=document.getElementById(`${APP}-index-count`);if(count)count.textContent=`عرض ${rows.length} من ${state.indexItems.length}`;
  };
  const scanAllIndexPages = async () => {
    if(state.indexBusy)return;
    state.indexBusy=true;setBusy(true,'جاري فهرسة صفحات الأنشطة…');
    try {
      const queue=[location.href],visited=new Set(),items=new Map();let problems=0;
      for(let j=0;j<queue.length&&j<30;j++){
        const url=samePageUrl(queue[j]);if(!url||visited.has(url))continue;
        visited.add(url);
        let doc;
        try{doc=j===0?document:await getDocument(url);}catch{problems++;continue;}
        projectCardsFromDoc(doc).forEach(p=>items.set(p.projectId,p));
        pageLinks(doc,'/Projects/Projects/Index').forEach(link=>{if(!visited.has(link)&&!queue.includes(link)&&queue.length<30)queue.push(link);});
      }
      state.indexItems=[...items.values()].sort((a,b)=>compareNames(a.title,b.title));
      state.indexPages=visited.size;state.indexScanned=true;indexView();
      toast(`تم فهرسة ${state.indexItems.length} نشاطًا من ${visited.size} صفحة${problems?`، تعذر فتح ${problems} صفحة`:''}.`,problems?'info':'success');
    }catch(e){toast(String(e.message||e),'error');}
    finally{state.indexBusy=false;setBusy(false);}
  };
  const publishedCardsFromDoc = (doc=document,label='العرض الحالي') => {
    const result=[];
    [...doc.querySelectorAll('a[href*="/Projects/Projects/GradeProject/"]')].forEach(a=>{
      const href=samePageUrl(a.href);if(!href)return;
      let root=a;
      for(let i=0;i<10&&root;i++,root=root.parentElement){if(root.querySelectorAll?.('a[href*="/GradeProject/"]').length===1&&root.querySelector?.('h4,h5'))break;}
      result.push({href,title:clean(root?.querySelector?.('h4,h5')?.textContent||'')||clean(a.textContent)||'رصد نشاط',detail:clean(root?.innerText||'').slice(0,300),status:label});
    });return result;
  };
  const publishedFiltered = () => state.publishedItems.filter(x=>[x.title,x.detail,x.status].some(v=>norm(v).includes(norm(state.publishedQuery))));

  const publishedStats = items => {
    const rows=[];let checked=0,receiving=0,unknown=0;
    items.forEach(x=>{
      const r=state.deepByUrl.get(x.href);
      if(!r)return;
      if(r.status==='ready'){checked++;rows.push(...r.rows);}
      else if(r.status==='receiving')receiving++;
      else unknown++;
    });
    return {rows,checked,receiving,unknown,stats:detailedStats(rows)};
  };
  const publishedView = () => {
    const rows=publishedFiltered(),host=document.getElementById(`${APP}-published-results`);if(!host)return;
    const statuses=[...new Set(rows.map(x=>x.status))],a=publishedStats(rows),stat=a.stats;
    host.innerHTML=`<div class="${APP}-metrics">${[
      [rows.length,'روابط الرصد'],[rows.filter(x=>/الحالية/.test(x.status)).length,'الحالية'],[rows.filter(x=>/المنتهية/.test(x.status)).length,'المنتهية'],[state.publishedDeepScanned?a.checked:'—','منشورات حُللت'],[state.publishedDeepScanned?stat.total:'—','سجلات الطلاب'],[state.publishedDeepScanned&&stat.total?`${fmt(stat.submissionRate)}%`:'—','نسبة التسليم'],[state.publishedDeepScanned&&stat.avg!==null?`${fmt(stat.avg)}%`:'—','متوسط الأداء'],[state.publishedDeepScanned?stat.graded:'—','درجات مرصودة']
    ].map(([v,k])=>metric(v,k)).join('')}</div><div class="${APP}-note">${state.publishedDeepScanned?`تحليل ${a.checked} نشر منتهٍ، ${a.receiving} نشر قيد الاستقبال، ${a.unknown} تعذر التحقق منه.`:'اضغط «فحص الحالية والمنتهية» لاكتشاف روابط الرصد، ثم «تحليل أداء المنتهية» لاستخراج بيانات الطلاب الموثقة.'} النتائج النهائية لا تشمل النشر الجاري أو غير المتحقق، ولا تعد القيم الناقصة أصفارًا.</div>
    <div class="${APP}-tablewrap"><table class="${APP}-table"><thead><tr><th>#</th><th>النشاط / المنشور</th><th>حالة المنشور</th><th>الرصد</th><th>التسليم</th><th>المتوسط</th><th>الطلاب</th></tr></thead><tbody>${rows.length?rows.map((x,i)=>{
      const d=state.deepByUrl.get(x.href),ss=d?.status==='ready'&&d.rows?.length?summary(d.rows):null;
      return `<tr><td>${i+1}</td><td><b>${esc(x.title)}</b><div style="font-size:10px;color:#64748b">${esc(x.detail.slice(0,120))}</div></td><td>${esc(x.status)}</td><td>${safeLink(x.href,'فتح التحليل والرصد')}</td><td>${ss?fmt(ss.submissionRate)+'%':'—'}</td><td>${ss&&ss.avg!==null?fmt(ss.avg)+'%':'—'}</td><td>${ss?ss.total:'—'}</td></tr>`;
    }).join(''):`<tr><td colspan="7" class="${APP}-rowempty">لا توجد نتائج مطابقة.</td></tr>`}</tbody></table></div>${state.publishedDeepScanned&&stat.total?`<div class="${APP}-subhead">توزيع المستويات بحسب المنشورات المكتملة المفلترة</div>${gradeAnalyticsHtml(a.rows,stat)}`:''}`;
    const count=document.getElementById(`${APP}-published-count`);if(count)count.textContent=`عرض ${rows.length} من ${state.publishedItems.length}`;
  };
  const scanPublished = async () => {
    setBusy(true,'جاري فحص المنشورات الحالية والمنتهية…');
    try{
      const cur=samePageUrl(document.getElementById('currntProjectLink')?.href);
      const ended=samePageUrl(document.getElementById('endedProjectLink')?.href);
      const queue=[{url:location.href,label:'العرض الحالي'},...(cur?[{url:cur,label:'الحالية'}]:[]),...(ended?[{url:ended,label:'المنتهية'}]:[])];
      const seen=new Set(),mapped=new Map();let failures=0;
      for(let i=0;i<queue.length&&i<32;i++){
        const {url,label}=queue[i];const safe=samePageUrl(url);if(!safe||seen.has(safe))continue;seen.add(safe);
        let doc;try{doc=i===0?document:await getDocument(safe);}catch{failures++;continue;}
        publishedCardsFromDoc(doc,label).forEach(x=>{if(!mapped.has(x.href))mapped.set(x.href,x);else if(label!=='العرض الحالي')mapped.get(x.href).status=label;});
        pageLinks(doc,'/Projects/Projects/PublishedProjects').forEach(link=>{if(!seen.has(link)&&!queue.some(x=>x.url===link)&&queue.length<32)queue.push({url:link,label});});
      }
      state.publishedItems=[...mapped.values()];state.publishedScanned=true;publishedView();
      toast(`تم اكتشاف ${state.publishedItems.length} رابط رصد${failures?`، تعذر فتح ${failures} صفحة`:''}.`,'success');
    }catch(e){toast(String(e.message||e),'error');}
    finally{setBusy(false);}
  };

  // الفحص التحليلي الكامل اختياري، وبطلب المعلم، ويعتمد بيانات الرصد الفعلية.
  const fieldValue = (doc,id) => clean(doc.getElementById(id)?.value || doc.querySelector(`[name="${id}"]`)?.value || '');
  const paramsFromGradeDoc = doc => {
    const inline=[...doc.scripts].filter(x=>!x.src).map(x=>x.textContent||'').join('\n');
    const at=inline.indexOf('loadStudents');
    const source=at>=0?inline.slice(at,at+18000):inline;
    const names=['IsPublished','ProjectId','LectureClassId','PublishedProjectId','IsGradebook','SchoolId','SubjectId','TeacherId','SemesterId','IsCreatedByTeacher','IsCurrentTeacher','PublishLectureId','SolvingType','ProjectStarts','IsRelatedToSubject'];
    const o={};
    for(const key of names){
      const m=source.match(new RegExp(`\\b${key}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|(true|false|[\\d.]+))`,'i'));
      o[key]=m ? (m[1]??m[2]??m[3]??'') : '';
    }
    o.IsPublished=o.IsPublished||fieldValue(doc,'Published')||'true';
    o.ProjectId=o.ProjectId||fieldValue(doc,'ProjectId');
    o.PublishedProjectId=o.PublishedProjectId||fieldValue(doc,'publishedProjectIdEnc')||fieldValue(doc,'PublishedProjectId');
    o.SchoolId=o.SchoolId||fieldValue(doc,'SchoolId');
    o.IsRelatedToSubject=o.IsRelatedToSubject||'true';
    return o;
  };
  const verifiedProjectEnd = doc => {
    const server=fieldValue(doc,'ServerDateTime'),end=fieldValue(doc,'PublishedEndTime');
    const parse=s=>{
      if(!s)return null;
      const st=String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
      const n=Date.parse(st);
      if(Number.isFinite(n))return n;
      const m=st.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      return m?new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0)).getTime():null;
    };
    const a=parse(server),b=parse(end);
    if(!Number.isFinite(a)||!Number.isFinite(b))return 'unverified';
    return a>=b?'ended':'receiving';
  };
  const findGradeLinks = doc => [...new Set([...doc.querySelectorAll('a[href*="/Projects/Projects/GradeProject/"]')].map(a=>samePageUrl(a.href)).filter(Boolean))];
  const fetchGradeAnalysis = async (url, budget) => {
    if(state.deepByUrl.has(url))return state.deepByUrl.get(url);
    if(budget.remaining<=0)return {status:'limit',rows:[]};
    budget.remaining--;
    const doc=await getDocument(url);
    const timing=verifiedProjectEnd(doc);
    if(timing!=='ended'){
      const result={status:timing,rows:[]};state.deepByUrl.set(url,result);return result;
    }
    const base=paramsFromGradeDoc(doc);
    if(!base.ProjectId||!base.PublishedProjectId){
      const result={status:'unavailable',rows:[]};state.deepByUrl.set(url,result);return result;
    }
    const byId=new Map();let incomplete=false;
    for(let page=1;page<=50;page++){
      if(budget.remaining<=0){incomplete=true;break;}
      budget.remaining--;
      const html=await postForm('/Projects/Projects/GetGradeStudentsList',{...base,StudentIds:'',Status:'All',SortBy:'name_asc',PageNumber:page});
      const rows=parseStudentsHtml(html);
      if(!rows.length)break;
      let added=0;
      rows.forEach(x=>{if(!byId.has(x.studentId))added++;byId.set(x.studentId,x);});
      if(!added)break;
      if(rows.length<20)break;
    }
    const result={status:incomplete?'partial':'ready',rows:[...byId.values()],paramsAvailable:true};
    state.deepByUrl.set(url,result);
    return result;
  };
  const deepSummaryOf = items => {
    const rows=[],published=new Set();let receiving=0,unknown=0,scanned=0;
    for(const item of items){
      const detail=state.deepByProject.get(item.projectId);
      if(!detail)continue;
      if(detail.links>0)published.add(item.projectId);
      receiving+=detail.receiving||0;unknown+=detail.unknown||0;
      if(detail.status==='ready')scanned++;
      (detail.rows||[]).forEach(x=>rows.push(x));
    }
    return {rows,stats:detailedStats(rows),published:published.size,receiving,unknown,scanned};
  };
  const deepAnalyzeIndex = async () => {
    if(state.deepBusy)return;
    if(!state.indexItems.length)return toast('لا توجد مشاريع مفهرسة للتحليل.','error');
    state.deepBusy=true;setBusy(true,'جاري تحليل رصد الأنشطة المنتهية…');
    const budget={remaining:170},items=state.indexItems.slice(0,50);
    let errors=0;
    try{
      for(let i=0;i<items.length;i++){
        const item=items[i],existing=state.deepByProject.get(item.projectId);
        if(existing?.status==='ready')continue;
        if(budget.remaining<=0){errors+=items.length-i;break;}
        const status=document.getElementById(`${APP}-status`);
        if(status)status.textContent=`تحليل النشاط ${i+1} من ${items.length} · ${item.title.slice(0,45)}`;
        try{
          budget.remaining--;
          const doc=await getDocument(item.publishedUrl);
          const links=findGradeLinks(doc).slice(0,15);
          const rows=[],keyed=new Set();let receiving=0,unknown=0;
          for(const link of links){
            if(budget.remaining<=0){unknown++;break;}
            const result=await fetchGradeAnalysis(link,budget);
            if(result.status==='receiving')receiving++;
            else if(result.status!=='ready')unknown++;
            else result.rows.forEach(r=>{const key=link+'|'+r.studentId;if(!keyed.has(key)){keyed.add(key);rows.push(r);}});
          }
          state.deepByProject.set(item.projectId,{status:unknown?'partial':'ready',rows,receiving,unknown,links:links.length});
        }catch(e){errors++;state.deepByProject.set(item.projectId,{status:'error',rows:[],receiving:0,unknown:1,links:0});}
        if((i+1)%3===0)indexView();
      }
      state.deepScanned=true;indexView();
      toast(`اكتمل فحص ${items.length} نشاطًا. ${errors?`تعذر تحليل ${errors}؛ ستبقى نتائجها غير متاحة.`:'تظهر نتائج الطلاب للمنشورات المنتهية والمتحقق منها فقط.'}`,errors?'info':'success');
    }catch(e){toast(String(e?.message||e),'error');}
    finally{state.deepBusy=false;setBusy(false);indexView();}
  };


  const deepAnalyzePublished = async () => {
    if(state.deepBusy)return;
    if(!state.publishedItems.length)return toast('افحص روابط المنشورات أولًا.','error');
    state.deepBusy=true;setBusy(true,'جاري جلب درجات المنشورات المنتهية…');
    const items=state.publishedItems.slice(0,55),budget={remaining:150};let failures=0;
    try {
      for(let i=0;i<items.length;i++){
        if(budget.remaining<=0){failures+=items.length-i;break;}
        const item=items[i],status=document.getElementById(`${APP}-status`);
        if(status)status.textContent=`فحص نشر ${i+1} من ${items.length}`;
        try { await fetchGradeAnalysis(item.href,budget); }
        catch {failures++;state.deepByUrl.set(item.href,{status:'error',rows:[]});}
        if((i+1)%3===0)publishedView();
      }
      state.publishedDeepScanned=true;publishedView();
      toast(`فُحص ${items.length} رابطًا؛ ستظهر بيانات الأداء فقط للمنشورات المنتهية والمتاحة${failures?`، مع ${failures} حالة تعذر فحصها`:''}.`,failures?'info':'success');
    }catch(e){toast(String(e?.message||e),'error');}
    finally{state.deepBusy=false;setBusy(false);publishedView();}
  };

  const genericExport = (kind,rows,columns,name,summaryPairs=[]) => {
    if(kind==='print'){
      const header=`<h1>${esc(name)}</h1><div class="sub">${new Date().toLocaleString('ar-SA-u-nu-latn')} · ${rows.length} سجل</div><div class="metrics">${summaryPairs.map(([k,v])=>`<div class="metric"><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join('')}</div>`;
      const table=`<h2>تفاصيل السجل</h2><table><thead><tr>${columns.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(r[c[1]]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      return printHtml(name,header+table);
    }
    if(kind==='excel'){
      if(!globalThis.XLSX)return toast('مكتبة Excel غير متاحة.','error');
      const wb=XLSX.utils.book_new(),data=rows.map(r=>Object.fromEntries(columns.map(([title,key])=>[title,r[key]??''])));
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),'Items');
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summaryPairs),'Summary');
      XLSX.writeFile(wb,`${cleanFile(name)}.xlsx`);return;
    }
    const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const lines=[columns.map(([header])=>csv(header)).join(','),...rows.map(r=>columns.map(([,key])=>csv(r[key])).join(','))];
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${cleanFile(name)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1800);
  };
  const renderIndex = () => {
    insertPanel('لوحة الأنشطة والمشاريع الشاملة',`سجل وتقارير إدارة الأنشطة — v${VERSION}`,
      `<button id="${APP}-index-refresh" class="${APP}-btn">تحديث جميع الصفحات</button><button id="${APP}-index-deep" class="${APP}-btn">تحليل أداء الأنشطة المنتهية</button><button id="${APP}-index-print" class="${APP}-btn gray">تقرير / PDF</button><button id="${APP}-index-xlsx" class="${APP}-btn gray">Excel</button><button id="${APP}-index-csv" class="${APP}-btn gray">CSV</button><button id="${APP}-collapse" class="${APP}-btn gray">طي اللوحة</button>`);
    const body=document.getElementById(`${APP}-body`);
    body.innerHTML=`<div class="${APP}-searchline"><input type="search" id="${APP}-index-search" placeholder="البحث في الأنشطة والمشاريع بالاسم أو الوصف أو الرقم…"><span class="${APP}-count" id="${APP}-index-count"></span><button id="${APP}-index-reset" class="${APP}-btn gray">مسح البحث</button></div><div id="${APP}-index-results"></div>`;
    state.indexItems=projectCardsFromDoc();indexView();
    document.getElementById(`${APP}-index-refresh`)?.addEventListener('click',scanAllIndexPages);
    document.getElementById(`${APP}-index-deep`)?.addEventListener('click',deepAnalyzeIndex);
    document.getElementById(`${APP}-index-search`)?.addEventListener('input',e=>{state.indexQuery=e.target.value;indexView();});
    document.getElementById(`${APP}-index-reset`)?.addEventListener('click',()=>{state.indexQuery='';document.getElementById(`${APP}-index-search`).value='';indexView();});
    const columns=[['النشاط / المشروع','title'],['المصدر','source'],['الحالة','status'],['نسبة التسليم','submissionRate'],['متوسط الأداء','averagePercent'],['لم يسلّم','notSubmitted'],['حالة التحليل','analysisStatus'],['رابط الاستعراض','viewUrl'],['رابط المنشورات','publishedUrl']];
    ['print','xlsx','csv'].forEach(k=>document.getElementById(`${APP}-index-${k}`)?.addEventListener('click',()=>{const items=indexFiltered(),sum=indexSummary(items),deep=deepSummaryOf(items);const rows=items.map(x=>{const d=state.deepByProject.get(x.projectId),ss=d?.status==='ready'&&d.rows?.length?summary(d.rows):null;return {...x,submissionRate:ss?fmt(ss.submissionRate)+'%':'غير متاح',averagePercent:ss&&ss.avg!==null?fmt(ss.avg)+'%':'غير متاح',notSubmitted:ss?.notSubmitted??'غير متاح',analysisStatus:d?.status||'لم يفحص'};});genericExport(k==='xlsx'?'excel':k,rows,columns,'تقرير الأنشطة والمشاريع',[['إجمالي الأنشطة',sum.total],['حالية',sum.current],['منتهية',sum.ended],['حالة غير محددة',sum.unspecified],['أنشطة مكتملة الفحص',deep.scanned],['منشورات قيد الاستقبال',deep.receiving],['حالات غير متحققة',deep.unknown]]);}));
    const collapsed=localStorage.getItem('maip-collapse')==='1';
    const collapse=hide=>{body.hidden=hide;document.getElementById(`${APP}-collapse`).textContent=hide?'فتح اللوحة':'طي اللوحة';localStorage.setItem('maip-collapse',hide?'1':'0');};
    document.getElementById(`${APP}-collapse`)?.addEventListener('click',()=>collapse(!body.hidden));collapse(collapsed);
  };
  const renderPublished = () => {
    insertPanel('لوحة الأنشطة والمشاريع الشاملة',`متابعة المنشورات والرصد — v${VERSION}`,
      `<button id="${APP}-pub-refresh" class="${APP}-btn">فحص الحالية والمنتهية</button><button id="${APP}-pub-deep" class="${APP}-btn">تحليل أداء المنتهية</button><button id="${APP}-pub-print" class="${APP}-btn gray">تقرير / PDF</button><button id="${APP}-pub-xlsx" class="${APP}-btn gray">Excel</button><button id="${APP}-pub-csv" class="${APP}-btn gray">CSV</button>`);
    const body=document.getElementById(`${APP}-body`);
    body.innerHTML=`<div class="${APP}-searchline"><input id="${APP}-pub-search" type="search" placeholder="البحث في الأنشطة المنشورة والرصد…"><span class="${APP}-count" id="${APP}-published-count"></span><button class="${APP}-btn gray" id="${APP}-pub-reset">مسح البحث</button></div><div id="${APP}-published-results"></div>`;
    state.publishedItems=publishedCardsFromDoc();publishedView();
    document.getElementById(`${APP}-pub-refresh`)?.addEventListener('click',scanPublished);
    document.getElementById(`${APP}-pub-deep`)?.addEventListener('click',deepAnalyzePublished);
    document.getElementById(`${APP}-pub-search`)?.addEventListener('input',e=>{state.publishedQuery=e.target.value;publishedView();});
    document.getElementById(`${APP}-pub-reset`)?.addEventListener('click',()=>{state.publishedQuery='';document.getElementById(`${APP}-pub-search`).value='';publishedView();});
    const columns=[['النشاط / المنشور','title'],['حالة المنشور','status'],['تفاصيل','detail'],['الطلاب','students'],['نسبة التسليم','submissionRate'],['متوسط الأداء','averagePercent'],['حالة التحليل','analysisStatus'],['الرابط','href']];
    ['print','xlsx','csv'].forEach(k=>document.getElementById(`${APP}-pub-${k}`)?.addEventListener('click',()=>{const items=publishedFiltered(),stat=publishedStats(items);const rows=items.map(x=>{const d=state.deepByUrl.get(x.href),ss=d?.status==='ready'&&d.rows?.length?summary(d.rows):null;return {...x,students:ss?.total??'غير متاح',submissionRate:ss?fmt(ss.submissionRate)+'%':'غير متاح',averagePercent:ss&&ss.avg!==null?fmt(ss.avg)+'%':'غير متاح',analysisStatus:d?.status||'لم يفحص'};});genericExport(k==='xlsx'?'excel':k,rows,columns,'تقرير الأنشطة المنشورة',[['المنشورات المكتشفة',rows.length],['المكتملة الفحص',stat.checked],['قيد الاستقبال',stat.receiving],['غير متحققة',stat.unknown]]);}));
  };

  injectStyle();
  {const st=document.createElement('style');st.id=`${APP}-import-modal-styles`;st.textContent=importModalCss;document.head.appendChild(st);}
  if (isGrade) renderGrade();
  else if (isPublished) renderPublished();
  else if (isIndex) renderIndex();

  globalThis.MadrasatiProjectsIntelligence = {
    version: VERSION,
    state,
    refresh: isGrade ? refreshGrade : null,
    getStudents: () => state.students.slice(),
    getFilteredStudents: filteredRows,
    projectParams,
    parseStudentsHtml
  };
})();
/*
 * المطور: Mohammed Almalki (M0HM3D85)
 * GitHub: https://github.com/M0HM3D85/teacher-userscripts
 * X / Twitter: https://x.com/M0HM3D85
 * Snapchat: https://www.snapchat.com/add/M0HM3D85
 * © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 */
  }

  globalThis.MadrasatiTeachingTasksIntelligence = {
    version: UNIFIED_VERSION,
    section: assignmentsPage ? 'assignments' : projectsPage ? 'projects' : 'students',
    bundled: true,
    features: ['search', 'analytics', 'reports', 'csv', 'excel', 'grade-import']
  };
})();
