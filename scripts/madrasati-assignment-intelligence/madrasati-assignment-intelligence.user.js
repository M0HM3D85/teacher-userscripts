// ==UserScript==
// @name         Madrasati Assignment Intelligence | مدير الواجبات الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      1.1.7
// @description  مدير واجبات مدرستي: هوية دقيقة للطلاب، استيراد درجات XLSX/CSV، قرار إلزامي لدرجات الصفر عند غياب حالة التسليم، ملاحظات تلقائية حسب الحالة ونسبة الدرجة، تطبيق مباشر في خانات مدرستي، حفظ آمن وتقارير وتحليل.
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://schools.madrasati.sa/Teacher/Assignments/*
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
