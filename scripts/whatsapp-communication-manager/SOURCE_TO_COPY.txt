// ==UserScript==
// @name         WhatsApp Communication Manager | مدير التواصل عبر واتساب
// @namespace    https://greasyfork.org/users/1636459
// @version      0.5.0
// @description  مدير تواصل ومتابعة قروبات واتساب مع تدقيق العضوية، سجل التواصل، ومستورد ذكي لملفات Excel/CSV العامة.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://web.whatsapp.com/*
// @icon         https://web.whatsapp.com/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @require      https://cdn.jsdelivr.net/npm/@wppconnect/wa-js@4.6.0/dist/wppconnect-wa.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
=========================================================================
 WhatsApp Communication Manager | مدير التواصل عبر واتساب

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 يمنع حذف أو تغيير بيانات المصمم وحقوقه عند إعادة نشر السكربت.
=========================================================================
*/

/* globals XLSX, WPP */

(() => {
  'use strict';

  const VERSION = '0.5.0';

  const APP = {
    id: 'wa-communication-manager',
    version: VERSION,
    store: 'wa-sga:',
  };

  const DEVELOPER = Object.freeze({
    name: 'Mohammed Almalki',
    handle: 'M0HM3D85',
    x: 'https://x.com/M0HM3D85',
    snapchat: 'https://www.snapchat.com/add/M0HM3D85',
    greasyFork: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
    copyright: '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة',
  });

  const S = {
    ready: false,
    panelOpen: false,
    view: 'home',
    coverageFilter: 'missing',

    fileName: '',
    students: [],
    studentById: new Map(),
    phoneIndex: new Map(),
    classes: [],
    selectedClass: '__all__',
    invalidFilePhones: [],
    usageMode: 'education',
    sourceKind: '',

    importSource: null,
    importWizardOpen: false,
    importMapping: null,
    importProfileFound: false,

    group: null,
    members: [],
    unresolved: [],
    selfPhone: '',

    audit: null,
    memberFilter: 'all',
    stats: null,
    lastChatId: '',

    groupInviteCode: '',
    groupInviteLink: '',
    invitePickerStudentId: '',

    communicationByPhone: new Map(),
    communicationScanned: false,
    communicationFilter: 'all',

    aboutOpen: false,
  };

  const AR = '٠١٢٣٤٥٦٧٨٩';
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uniq = arr => [...new Set(arr.filter(Boolean))];

  // =========================================================
  // أدوات عامة
  // =========================================================

  function toLatin(v) {
    return String(v ?? '')
      .replace(/[٠-٩]/g, d => String(AR.indexOf(d)))
      .replace(/[۰-۹]/g, d => String(FA.indexOf(d)));
  }

  function digitsOnly(v) {
    return toLatin(v).replace(/\D/g, '');
  }

  function normalizePhone(v) {
    let n = digitsOnly(v);
    if (!n) return '';
    if (n.startsWith('00')) n = n.slice(2);
    if (/^05\d{8}$/.test(n)) n = `966${n.slice(1)}`;
    else if (/^5\d{8}$/.test(n)) n = `966${n}`;
    if (n.length < 8 || n.length > 15) return '';
    return n;
  }

  function phoneProblem(v) {
    const raw = String(v ?? '').trim();
    if (!raw) return '';
    const d = digitsOnly(raw);
    if (!d) return 'لا يحتوي على أرقام';
    if (d.length < 8) return 'الرقم أقصر من الحد المقبول';
    if (d.length > 17) return 'الرقم أطول من الحد المقبول';
    return 'صيغة الرقم غير قابلة للتوحيد';
  }

  function formatPhone(v) {
    const n = normalizePhone(v);
    if (!n) return '—';

    if (/^9665\d{8}$/.test(n)) {
      return `+966 ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
    }

    return `+${n}`;
  }

  function normText(v) {
    return String(v ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[إأآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ـ/g, '')
      .toLowerCase();
  }

  function esc(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function clean(v) {
    return String(v ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function usageLabels() {
    if (S.usageMode === 'education') {
      return {
        person: 'الطالب',
        people: 'الطلاب',
        group: 'الفصل',
        groups: 'الفصول',
        contact: 'ولي الأمر / جهة الاتصال',
      };
    }

    return {
      person: 'الشخص',
      people: 'الأشخاص',
      group: 'المجموعة',
      groups: 'المجموعات',
      contact: 'جهة الاتصال',
    };
  }

  // =========================================================
  // معرفات واتساب
  // =========================================================

  function widString(wid) {
    if (!wid) return '';

    try {
      if (typeof wid === 'string') return wid;
      if (wid._serialized) return String(wid._serialized);
      if (wid.user && wid.server) return `${wid.user}@${wid.server}`;

      if (typeof wid.toString === 'function') {
        const s = wid.toString();
        if (s && s !== '[object Object]') return s;
      }

      if (wid.id) return widString(wid.id);
    } catch (_) {}

    return '';
  }

  function phoneFromWid(wid) {
    const match = widString(wid)
      .match(/^(\d+)@(?:c\.us|s\.whatsapp\.net)$/i);

    return match
      ? normalizePhone(match[1])
      : '';
  }

  function displayName(obj) {
    if (!obj) return '';

    const fields = [
      'name',
      'pushname',
      'shortName',
      'verifiedName',
      'formattedName',
      'formattedShortName',
      'displayName',
      'notifyName',
    ];

    for (const field of fields) {
      if (
        typeof obj[field] === 'string' &&
        obj[field].trim()
      ) {
        return obj[field].trim();
      }
    }

    return '';
  }

  // =========================================================
  // المستورد الذكي العام
  // =========================================================

  const COLUMN_ALIASES = Object.freeze({
    name: [
      'اسم الطالب',
      'الطالب',
      'الاسم',
      'اسم',
      'اسم الشخص',
      'اسم العضو',
      'اسم المتدرب',
      'اسم الموظف',
      'اسم العميل',
      'student name',
      'student',
      'name',
      'person',
      'member name',
      'trainee name',
      'employee name',
      'client name',
      'full name',
    ],

    id: [
      'رقم الطالب',
      'رقم الهوية',
      'الهوية',
      'المعرف',
      'الرقم الأكاديمي',
      'رقم العضو',
      'رقم الموظف',
      'student id',
      'id',
      'person id',
      'member id',
      'employee id',
      'code',
    ],

    group: [
      'الفصل',
      'الصف',
      'الشعبة',
      'المجموعة',
      'القسم',
      'الفريق',
      'class',
      'grade',
      'section',
      'group',
      'team',
      'department',
      'cohort',
    ],

    phone: [
      'الجوال',
      'رقم الجوال',
      'الهاتف',
      'رقم الهاتف',
      'واتساب',
      'رقم واتساب',
      'جوال',
      'mobile',
      'mobile number',
      'phone',
      'phone number',
      'whatsapp',
      'contact number',
      'tel',
    ],

    contactName: [
      'اسم ولي الأمر',
      'ولي الأمر',
      'اسم الوالد',
      'اسم الوالدة',
      'اسم الأب',
      'اسم الأم',
      'اسم جهة الاتصال',
      'اسم المسؤول',
      'guardian name',
      'parent name',
      'contact name',
      'father name',
      'mother name',
      'responsible name',
    ],

    role: [
      'صلة القرابة',
      'الصفة',
      'الدور',
      'نوع جهة الاتصال',
      'العلاقة',
      'relation',
      'relationship',
      'role',
      'contact type',
      'type',
    ],
  });

  function aliasKey(v) {
    return normText(v)
      .replace(/[\s_\-\/\\()]+/g, ' ')
      .trim();
  }

  function headerScore(header, aliases) {
    const h = aliasKey(header);
    if (!h) return 0;

    let best = 0;

    aliases.forEach(alias => {
      const a = aliasKey(alias);

      if (h === a) {
        best = Math.max(best, 100);
      }

      else if (
        h.includes(a) ||
        a.includes(h)
      ) {
        best = Math.max(best, 70);
      }

      else {
        const hw = new Set(h.split(' '));
        const aw = a.split(' ');
        const overlap =
          aw.filter(w => hw.has(w)).length;

        if (overlap) {
          best = Math.max(
            best,
            20 + overlap * 10
          );
        }
      }
    });

    return best;
  }

  function bestColumn(
    headers,
    aliases,
    exclude = []
  ) {
    const banned =
      new Set(exclude.filter(Boolean));

    let best = '';
    let score = 0;

    headers.forEach(header => {
      if (banned.has(header)) return;

      const s =
        headerScore(header, aliases);

      if (s > score) {
        score = s;
        best = header;
      }
    });

    return score >= 35
      ? best
      : '';
  }

  function looksLikePhoneColumn(
    header,
    rows
  ) {
    const phoneHeaderScore =
      headerScore(
        header,
        COLUMN_ALIASES.phone
      );

    if (phoneHeaderScore >= 35) {
      return true;
    }

    if (
      headerScore(
        header,
        COLUMN_ALIASES.id
      ) >= 35
    ) {
      return false;
    }

    const values =
      rows.slice(0, 50)
        .map(r => clean(r[header]))
        .filter(Boolean);

    if (!values.length) return false;

    const valid =
      values.filter(v =>
        normalizePhone(v)
      ).length;

    return (
      valid / values.length >=
      0.65
    );
  }

  function inferRoleFromHeader(header) {
    const h = aliasKey(header);

    if (/الطالب|student/.test(h)) {
      return S.usageMode === 'education'
        ? 'الطالب'
        : 'الشخص';
    }

    if (/الاب|الوالد|father/.test(h)) {
      return 'الأب';
    }

    if (/الام|الوالده|mother/.test(h)) {
      return 'الأم';
    }

    if (/ولي|guardian|parent/.test(h)) {
      return 'ولي أمر';
    }

    if (/مسؤول|responsible/.test(h)) {
      return 'المسؤول';
    }

    if (/واتساب|whatsapp/.test(h)) {
      return 'واتساب';
    }

    return clean(header) ||
      'جهة اتصال';
  }

  function detectUsageMode(headers) {
    const joined =
      aliasKey(headers.join(' '));

    return /طالب|فصل|صف|شعبه|ولي|student|class|guardian|parent/
      .test(joined)
      ? 'education'
      : 'general';
  }

  function suggestMapping(sheet) {
    const headers = sheet.headers;
    const rows = sheet.rows;

    const nameCol =
      bestColumn(
        headers,
        COLUMN_ALIASES.name
      );

    const idCol =
      bestColumn(
        headers,
        COLUMN_ALIASES.id,
        [nameCol]
      );

    const groupCol =
      bestColumn(
        headers,
        COLUMN_ALIASES.group,
        [nameCol, idCol]
      );

    const contactNameCol =
      bestColumn(
        headers,
        COLUMN_ALIASES.contactName,
        [
          nameCol,
          idCol,
          groupCol,
        ]
      );

    const roleCol =
      bestColumn(
        headers,
        COLUMN_ALIASES.role,
        [
          nameCol,
          idCol,
          groupCol,
          contactNameCol,
        ]
      );

    const phoneCols =
      headers.filter(
        h =>
          looksLikePhoneColumn(
            h,
            rows
          )
      );

    const phoneCol =
      phoneCols[0] ||
      bestColumn(
        headers,
        COLUMN_ALIASES.phone
      );

    let mode = 'wide';

    if (
      phoneCols.length <= 1 &&
      (
        contactNameCol ||
        roleCol
      )
    ) {
      mode = 'long';
    }

    return {
      mode,
      nameCol,
      idCol,
      groupCol,
      phoneCols,
      phoneCol,
      contactNameCol,
      roleCol,
    };
  }

  function mappingSignature(sheet) {
    return sheet.headers
      .map(aliasKey)
      .join('|');
  }

  function mappingProfileKey(sheet) {
    return (
      `${APP.store}` +
      `mapping:` +
      `${mappingSignature(sheet)}`
    );
  }

  function loadMappingProfile(sheet) {
    try {
      const raw =
        localStorage.getItem(
          mappingProfileKey(sheet)
        );

      if (!raw) return null;

      const value =
        JSON.parse(raw);

      return (
        value &&
        typeof value === 'object'
      )
        ? value
        : null;
    }

    catch (_) {
      return null;
    }
  }

  function saveMappingProfile(
    sheet,
    mapping
  ) {
    try {
      localStorage.setItem(
        mappingProfileKey(sheet),
        JSON.stringify(mapping)
      );
    }

    catch (_) {}
  }

  function addContact(
    student,
    rawPhone,
    role,
    meta = {},
    invalidCollector = null
  ) {
    const raw =
      String(
        rawPhone ?? ''
      ).trim();

    if (!raw) return;

    const phone =
      normalizePhone(raw);

    if (!phone) {
      invalidCollector?.push({
        studentId:
          student.id,

        studentName:
          student.name,

        className:
          student.className,

        role,

        raw,

        source:
          meta.source || '',

        guardianName:
          meta.guardianName || '',

        relation:
          meta.relation || '',

        reason:
          phoneProblem(raw),
      });

      return;
    }

    let contact =
      student.contacts
        .find(
          x =>
            x.phone === phone
        );

    if (!contact) {
      contact = {
        phone,
        roles: [],
        details: [],
      };

      student.contacts
        .push(contact);
    }

    if (
      role &&
      !contact.roles.includes(role)
    ) {
      contact.roles.push(role);
    }

    contact.details.push({
      role,
      raw,
      ...meta,
    });
  }

  function rows(sheet) {
    return XLSX.utils
      .sheet_to_json(
        sheet,
        {
          raw: false,
          defval: '',
        }
      );
  }

  function sheetInfo(
    name,
    worksheet
  ) {
    const data =
      rows(worksheet);

    const headers =
      data.length
        ? Object.keys(data[0])
            .map(clean)
            .filter(Boolean)
        : [];

    return {
      name,
      rows: data,
      headers,
    };
  }

  function hasLegacyWorkbook(wb) {
    const s =
      wb.Sheets['الطلاب'];

    const g =
      wb.Sheets[
        'أولياء الأمور'
      ];

    if (!s || !g) return false;

    const sr = rows(s);
    const gr = rows(g);

    if (
      !sr.length ||
      !gr.length
    ) {
      return false;
    }

    const sk =
      new Set(
        Object.keys(sr[0])
          .map(clean)
      );

    const gk =
      new Set(
        Object.keys(gr[0])
          .map(clean)
      );

    return [
      'اسم الطالب',
      'رقم الطالب',
      'الفصل',
      'رقم هاتف الطالب',
    ].every(
      x => sk.has(x)
    ) &&
    [
      'رقم الطالب',
      'اسم ولي الأمر',
      'الجوال',
    ].every(
      x => gk.has(x)
    );
  }

  function finalizeImportedData(
    students,
    invalidFilePhones,
    meta = {}
  ) {
    const byId =
      new Map();

    students.forEach(
      (
        student,
        index
      ) => {
        if (!student.id) {
          student.id =
            `AUTO-${index + 1}`;
        }

        let id =
          String(student.id);

        if (byId.has(id)) {
          let n = 2;

          while (
            byId.has(
              `${id}-${n}`
            )
          ) {
            n++;
          }

          student.id =
            `${id}-${n}`;
        }

        byId.set(
          String(student.id),
          student
        );
      }
    );

    const phoneIndex =
      new Map();

    students.forEach(
      student => {
        student.contacts
          .forEach(
            contact => {
              if (
                !phoneIndex.has(
                  contact.phone
                )
              ) {
                phoneIndex.set(
                  contact.phone,
                  []
                );
              }

              phoneIndex
                .get(contact.phone)
                .push({
                  student,
                  contact,
                });
            }
          );
      }
    );

    const classes =
      uniq(
        students.map(
          x =>
            x.className ||
            'بدون مجموعة'
        )
      )
        .sort(
          (a, b) =>
            a.localeCompare(
              b,
              'ar'
            )
        );

    const sharedPhones =
      [...phoneIndex.values()]
        .filter(
          links =>
            new Set(
              links.map(
                x =>
                  x.student.id
              )
            ).size > 1
        )
        .length;

    const noContacts =
      students.filter(
        x =>
          !x.contacts.length
      ).length;

    S.fileName =
      meta.fileName ||
      S.fileName;

    S.students =
      students;

    S.studentById =
      byId;

    S.phoneIndex =
      phoneIndex;

    S.classes =
      classes;

    S.invalidFilePhones =
      invalidFilePhones;

    S.selectedClass =
      '__all__';

    S.audit =
      null;

    S.memberFilter =
      'all';

    S.communicationByPhone =
      new Map();

    S.communicationScanned =
      false;

    S.communicationFilter =
      'all';

    S.sourceKind =
      meta.sourceKind ||
      'عام';

    if (meta.usageMode) {
      S.usageMode =
        meta.usageMode;
    }

    S.stats = {
      students:
        students.length,

      guardians:
        meta.guardians || 0,

      classes:
        classes.length,

      uniquePhones:
        phoneIndex.size,

      sharedPhones,

      noContacts,

      invalidFilePhones:
        invalidFilePhones.length,

      orphanGuardians:
        meta.orphanGuardians || 0,

      malformed:
        meta.malformed || 0,
    };

    autoClass();

    S.view = 'home';

    if (
      S.group &&
      S.members.length
    ) {
      runAudit();
    }

    else {
      render();
    }
  }

  function importLegacyWorkbook(
    wb,
    fileName
  ) {
    const studentRows =
      rows(
        wb.Sheets['الطلاب']
      );

    const guardianRows =
      rows(
        wb.Sheets[
          'أولياء الأمور'
        ]
      );

    const students = [];
    const byId =
      new Map();

    const invalid = [];

    let malformed = 0;

    studentRows.forEach(
      row => {
        const id =
          clean(
            row[
              'رقم الطالب'
            ]
          );

        const name =
          clean(
            row[
              'اسم الطالب'
            ]
          );

        if (
          !id &&
          !name
        ) {
          return;
        }

        if (!id) {
          malformed++;
          return;
        }

        const student = {
          id,

          name:
            name ||
            `طالب ${id}`,

          className:
            clean(
              row['الفصل']
            ) ||
            'بدون فصل',

          status:
            clean(
              row['الحالة']
            ),

          contacts: [],

          raw:
            row,
        };

        addContact(
          student,
          row[
            'رقم هاتف الطالب'
          ],
          'الطالب',
          {
            source:
              'الطلاب',
          },
          invalid
        );

        addContact(
          student,
          row[
            'رقم هاتف ولي الأمر الأساسي'
          ],
          'ولي الأمر الأساسي',
          {
            source:
              'الطلاب',

            guardianName:
              clean(
                row[
                  'ولي الأمر الأساسي'
                ]
              ),
          },
          invalid
        );

        students.push(
          student
        );

        byId.set(
          id,
          student
        );
      }
    );

    let orphanGuardians = 0;

    guardianRows.forEach(
      row => {
        const id =
          clean(
            row[
              'رقم الطالب'
            ]
          );

        const student =
          byId.get(id);

        if (!student) {
          if (
            id ||
            row['الجوال']
          ) {
            orphanGuardians++;
          }

          return;
        }

        addContact(
          student,
          row['الجوال'],
          'ولي أمر',
          {
            source:
              'أولياء الأمور',

            guardianName:
              clean(
                row[
                  'اسم ولي الأمر'
                ]
              ),

            relation:
              clean(
                row[
                  'صلة القرابة'
                ]
              ),

            primary:
              clean(
                row['أساسي']
              ),

            receivesMessages:
              clean(
                row[
                  'يستقبل الرسائل'
                ]
              ),
          },
          invalid
        );
      }
    );

    S.usageMode =
      'education';

    finalizeImportedData(
      students,
      invalid,
      {
        fileName,

        sourceKind:
          'قالب الطلاب وأولياء الأمور',

        usageMode:
          'education',

        guardians:
          guardianRows.length,

        orphanGuardians,

        malformed,
      }
    );
  }

  function currentImportSheet() {
    if (!S.importSource) {
      return null;
    }

    return (
      S.importSource.sheets
        .find(
          x =>
            x.name ===
            S.importSource
              .selectedSheet
        ) ||
      S.importSource
        .sheets[0] ||
      null
    );
  }

  function openSmartImport(
    source
  ) {
    S.importSource =
      source;

    const first =
      source.sheets
        .find(
          s =>
            s.rows.length
        ) ||
      source.sheets[0];

    if (!first) {
      throw new Error(
        'الملف لا يحتوي على أوراق قابلة للقراءة.'
      );
    }

    S.importSource.selectedSheet =
      first.name;

    S.usageMode =
      detectUsageMode(
        first.headers
      );

    const saved =
      loadMappingProfile(
        first
      );

    S.importProfileFound =
      Boolean(saved);

    S.importMapping =
      saved ||
      suggestMapping(first);

    S.importWizardOpen =
      true;

    render();
  }

  function selectImportSheet(name) {
    if (!S.importSource) {
      return;
    }

    const sheet =
      S.importSource.sheets
        .find(
          x =>
            x.name === name
        );

    if (!sheet) return;

    S.importSource.selectedSheet =
      name;

    S.usageMode =
      detectUsageMode(
        sheet.headers
      );

    const saved =
      loadMappingProfile(
        sheet
      );

    S.importProfileFound =
      Boolean(saved);

    S.importMapping =
      saved ||
      suggestMapping(sheet);

    render();
  }

  function validateMapping(mapping) {
    if (!mapping?.nameCol) {
      return 'حدد عمود الاسم.';
    }

    if (
      mapping.mode === 'wide'
    ) {
      if (
        !mapping.phoneCols
          ?.length
      ) {
        return 'حدد عمود هاتف واحدًا على الأقل.';
      }
    }

    else {
      if (!mapping.phoneCol) {
        return 'حدد عمود الهاتف.';
      }
    }

    return '';
  }

  function mappedImportPreview(
    sheet,
    mapping
  ) {
    const problem =
      validateMapping(mapping);

    if (problem) {
      return {
        error:
          problem,

        records:
          0,

        phones:
          0,

        invalid:
          0,

        groups:
          0,
      };
    }

    const result =
      buildMappedStudents(
        sheet,
        mapping,
        true
      );

    const phoneSet =
      new Set(
        result.students
          .flatMap(
            s =>
              s.contacts
                .map(
                  c =>
                    c.phone
                )
          )
      );

    const groupSet =
      new Set(
        result.students
          .map(
            s =>
              s.className
          )
      );

    return {
      records:
        result.students.length,

      phones:
        phoneSet.size,

      invalid:
        result.invalid.length,

      groups:
        groupSet.size,

      error:
        '',
    };
  }

  function buildMappedStudents(
    sheet,
    mapping,
    previewOnly = false
  ) {
    const students = [];
    const invalid = [];
    const index =
      new Map();

    const mode =
      mapping.mode === 'long'
        ? 'long'
        : 'wide';

    if (mode === 'wide') {
      sheet.rows.forEach(
        (
          row,
          i
        ) => {
          const name =
            clean(
              row[
                mapping.nameCol
              ]
            );

          if (!name) return;

          const idRaw =
            mapping.idCol
              ? clean(
                  row[
                    mapping.idCol
                  ]
                )
              : '';

          const group =
            mapping.groupCol
              ? clean(
                  row[
                    mapping.groupCol
                  ]
                )
              : '';

          const student = {
            id:
              idRaw ||
              `AUTO-${i + 1}`,

            name,

            className:
              group ||
              'بدون مجموعة',

            status:
              '',

            contacts:
              [],

            raw:
              row,
          };

          (
            mapping.phoneCols ||
            []
          ).forEach(
            col => {
              addContact(
                student,
                row[col],
                inferRoleFromHeader(
                  col
                ),
                {
                  source:
                    sheet.name,

                  column:
                    col,
                },
                invalid
              );
            }
          );

          students.push(
            student
          );
        }
      );
    }

    else {
      sheet.rows.forEach(
        (
          row,
          i
        ) => {
          const name =
            clean(
              row[
                mapping.nameCol
              ]
            );

          if (!name) return;

          const explicitId =
            mapping.idCol
              ? clean(
                  row[
                    mapping.idCol
                  ]
                )
              : '';

          const group =
            mapping.groupCol
              ? clean(
                  row[
                    mapping.groupCol
                  ]
                )
              : '';

          const key =
            explicitId ||
            `${normText(name)}::${normText(group)}`;

          let student =
            index.get(key);

          if (!student) {
            student = {
              id:
                explicitId ||
                `AUTO-${students.length + 1}`,

              name,

              className:
                group ||
                'بدون مجموعة',

              status:
                '',

              contacts:
                [],

              raw:
                row,
            };

            students.push(
              student
            );

            index.set(
              key,
              student
            );
          }

          const contactName =
            mapping.contactNameCol
              ? clean(
                  row[
                    mapping
                      .contactNameCol
                  ]
                )
              : '';

          const role =
            mapping.roleCol
              ? clean(
                  row[
                    mapping.roleCol
                  ]
                )
              : '';

          addContact(
            student,
            row[
              mapping.phoneCol
            ],
            role ||
            (
              contactName
                ? 'جهة اتصال'
                : (
                    S.usageMode ===
                    'education'
                      ? 'الطالب'
                      : 'الشخص'
                  )
            ),
            {
              source:
                sheet.name,

              guardianName:
                contactName,

              relation:
                role,

              row:
                i + 2,
            },
            invalid
          );
        }
      );
    }

    if (previewOnly) {
      return {
        students,
        invalid,
      };
    }

    return {
      students,
      invalid,
    };
  }

  function applySmartImport() {
    const sheet =
      currentImportSheet();

    if (
      !sheet ||
      !S.importMapping
    ) {
      return;
    }

    const problem =
      validateMapping(
        S.importMapping
      );

    if (problem) {
      toast(
        problem,
        'error'
      );

      return;
    }

    const result =
      buildMappedStudents(
        sheet,
        S.importMapping
      );

    if (!result.students.length) {
      toast(
        'لم ينتج عن المطابقة أي سجلات. راجع عمود الاسم.',
        'error'
      );

      return;
    }

    saveMappingProfile(
      sheet,
      S.importMapping
    );

    S.importWizardOpen =
      false;

    finalizeImportedData(
      result.students,
      result.invalid,
      {
        fileName:
          S.importSource
            ?.fileName ||
          '',

        sourceKind:
          `استيراد ذكي · ${sheet.name}`,

        usageMode:
          S.usageMode,
      }
    );

    toast(
      `تم استيراد ${result.students.length} سجلًا بنجاح`,
      'success'
    );
  }

  async function importFile(file) {
    busy(
      true,
      'جارٍ تحليل الملف…'
    );

    try {
      const ext =
        (
          file.name
            .split('.')
            .pop() ||
          ''
        ).toLowerCase();

      let wb;

      if (ext === 'csv') {
        wb =
          XLSX.read(
            await file.text(),
            {
              type:
                'string',
            }
          );
      }

      else {
        wb =
          XLSX.read(
            await file
              .arrayBuffer(),
            {
              type:
                'array',

              cellDates:
                false,
            }
          );
      }

      if (hasLegacyWorkbook(wb)) {
        importLegacyWorkbook(
          wb,
          file.name
        );

        toast(
          'تم التعرف تلقائيًا على قالب الطلاب وأولياء الأمور.',
          'success'
        );

        return;
      }

      const sheets =
        wb.SheetNames
          .map(
            name =>
              sheetInfo(
                name,
                wb.Sheets[name]
              )
          )
          .filter(
            s =>
              s.headers.length ||
              s.rows.length
          );

      openSmartImport({
        fileName:
          file.name,

        sheets,

        selectedSheet:
          '',
      });
    }

    catch (error) {
      console.error(
        '[WA-WCM] import',
        error
      );

      toast(
        error.message ||
          'تعذر قراءة الملف',
        'error'
      );
    }

    finally {
      busy(false);
    }
  }

  // =========================================================
  // المحادثة الحالية
  // =========================================================

  function activeChat() {
    if (
      !S.ready ||
      typeof WPP ===
        'undefined'
    ) {
      return null;
    }

    try {
      const chat =
        WPP.chat
          .getActiveChat?.();

      if (!chat) return null;

      const id =
        widString(chat.id);

      const isGroup =
        /@g\.us$/i.test(id) ||
        chat.isGroup === true ||
        chat.getIsGroup?.() === true;

      const name =
        displayName(chat) ||
        chat.formattedTitle ||
        chat.title ||
        id;

      return {
        id,
        isGroup,
        name,
        raw:
          chat,
      };
    }

    catch (error) {
      console.warn(
        '[WA-SGA] active chat',
        error
      );

      return null;
    }
  }

  function autoClass() {
    if (
      !S.group ||
      !S.classes.length
    ) {
      return;
    }

    const groupName =
      normText(
        S.group.name
      );

    const match =
      S.classes.find(
        className =>
          groupName.includes(
            normText(className)
          )
      );

    if (match) {
      S.selectedClass =
        match;
    }
  }

  async function resolveSelf() {
    try {
      const wid =
        WPP.conn
          .getMyUserId?.() ||
        WPP.conn
          .getMyUserWid?.();

      let phone =
        phoneFromWid(wid);

      if (
        !phone &&
        /@lid$/i.test(
          widString(wid)
        )
      ) {
        const entry =
          await WPP.contact
            .getPnLidEntry(
              widString(wid)
            );

        phone =
          phoneFromWid(
            entry?.phoneNumber
          );
      }

      S.selfPhone =
        phone || '';
    }

    catch (_) {}
  }

  async function resolveMember(
    participant
  ) {
    const rawWid =
      participant?.id ||
      participant;

    const wid =
      widString(rawWid);

    let phone =
      phoneFromWid(wid);

    let contact = null;
    let mapping = null;

    if (
      !phone &&
      /@lid$/i.test(wid)
    ) {
      try {
        const cached =
          WPP.whatsapp
            ?.lidPnCache
            ?.getPhoneNumber?.(
              rawWid
            );

        phone =
          phoneFromWid(cached);
      }

      catch (_) {}

      if (!phone) {
        try {
          mapping =
            await WPP.contact
              .getPnLidEntry(
                wid
              );

          phone =
            phoneFromWid(
              mapping?.phoneNumber
            );

          contact =
            mapping?.contact ||
            null;
        }

        catch (_) {}
      }
    }

    if (!contact) {
      try {
        contact =
          await WPP.contact
            .get(wid);
      }

      catch (_) {}
    }

    if (
      !phone &&
      contact
    ) {
      phone =
        phoneFromWid(
          contact.pnForLid ||
          contact.id
        );

      if (
        !phone &&
        typeof contact
          .formattedPhone ===
          'string'
      ) {
        phone =
          normalizePhone(
            contact
              .formattedPhone
          );
      }
    }

    return {
      wid,
      phone,

      name:
        displayName(contact) ||
        displayName(
          mapping?.contact
        ) ||
        displayName(
          participant
        ) ||
        (
          phone
            ? formatPhone(phone)
            : wid
        ),

      isAdmin:
        Boolean(
          participant?.isAdmin ||
          participant?.admin ===
            'admin' ||
          participant?.admin ===
            'superadmin'
        ),

      isSuperAdmin:
        Boolean(
          participant
            ?.isSuperAdmin ||
          participant?.admin ===
            'superadmin'
        ),
    };
  }

  async function concurrent(
    items,
    limit,
    worker,
    progress
  ) {
    const output =
      new Array(
        items.length
      );

    let cursor = 0;
    let done = 0;

    async function runner() {
      while (true) {
        const index =
          cursor++;

        if (
          index >=
          items.length
        ) {
          return;
        }

        try {
          output[index] =
            await worker(
              items[index],
              index
            );
        }

        catch (error) {
          output[index] = {
            wid:
              widString(
                items[index]?.id ||
                items[index]
              ),

            phone:
              '',

            name:
              '',

            error,
          };
        }

        done++;

        progress?.(
          done,
          items.length
        );
      }
    }

    await Promise.all(
      Array.from(
        {
          length:
            Math.min(
              limit,
              items.length ||
              1
            ),
        },
        runner
      )
    );

    return output;
  }

  async function captureGroup() {
    if (!S.ready) {
      toast(
        'محرك واتساب لم يجهز بعد.',
        'error'
      );

      return;
    }

    const chat =
      activeChat();

    if (!chat) {
      toast(
        'افتح قروبًا أولًا.',
        'error'
      );

      return;
    }

    if (!chat.isGroup) {
      toast(
        'المحادثة الحالية ليست قروبًا.',
        'error'
      );

      return;
    }

    busy(
      true,
      'جارٍ قراءة أعضاء القروب…'
    );

    try {
      const changedGroup =
        S.group?.id &&
        S.group.id !==
          chat.id;

      S.group = {
        id:
          chat.id,

        name:
          chat.name,
      };

      if (changedGroup) {
        S.groupInviteCode =
          '';

        S.groupInviteLink =
          '';
      }

      autoClass();

      await resolveSelf();

      let participants =
        await WPP.group
          .getParticipants(
            chat.id
          );

      if (
        !Array.isArray(
          participants
        )
      ) {
        participants = [];
      }

      if (
        !participants.length
      ) {
        throw new Error(
          'لم أتمكن من قراءة أعضاء القروب.'
        );
      }

      const resolved =
        await concurrent(
          participants,
          8,
          resolveMember,
          (
            done,
            total
          ) =>
            busyText(
              `تحليل الأعضاء ${done} / ${total}`
            )
        );

      const memberMap =
        new Map();

      const unresolved =
        [];

      resolved.forEach(
        member => {
          if (!member?.phone) {
            unresolved.push(
              member
            );

            return;
          }

          if (
            !memberMap.has(
              member.phone
            )
          ) {
            memberMap.set(
              member.phone,
              member
            );
          }

          else {
            const old =
              memberMap.get(
                member.phone
              );

            if (
              !old.name &&
              member.name
            ) {
              old.name =
                member.name;
            }

            old.isAdmin ||=
              member.isAdmin;

            old.isSuperAdmin ||=
              member
                .isSuperAdmin;
          }
        }
      );

      S.members =
        [...memberMap.values()];

      S.unresolved =
        unresolved;

      S.memberFilter =
        'all';

      runAudit();

      render();

      toast(
        `تمت قراءة ${S.members.length} رقمًا من القروب`,
        'success'
      );
    }

    catch (error) {
      console.error(
        '[WA-SGA] capture',
        error
      );

      toast(
        error.message ||
          'تعذر قراءة أعضاء القروب',
        'error'
      );
    }

    finally {
      busy(false);
    }
  }

  // =========================================================
  // النطاق والاستثناءات
  // =========================================================

  function scopedStudents() {
    return (
      S.selectedClass ===
        '__all__'
        ? S.students
        : S.students.filter(
            x =>
              x.className ===
              S.selectedClass
          )
    );
  }

  function exKey() {
    return (
      `${APP.store}` +
      `exceptions:` +
      `${S.group?.id || 'none'}`
    );
  }

  function exceptions() {
    try {
      return (
        JSON.parse(
          localStorage.getItem(
            exKey()
          ) ||
          '{}'
        ) ||
        {}
      );
    }

    catch (_) {
      return {};
    }
  }

  function setException(
    phone,
    label
  ) {
    const ex =
      exceptions();

    if (label) {
      ex[phone] =
        label;
    }

    else {
      delete ex[phone];
    }

    localStorage.setItem(
      exKey(),
      JSON.stringify(ex)
    );
  }

  // =========================================================
  // محرك التدقيق
  // =========================================================

  function runAudit() {
    if (
      !S.students.length ||
      !S.members.length ||
      !S.group
    ) {
      S.audit = null;
      render();
      return;
    }

    const scoped =
      scopedStudents();

    const scopedIds =
      new Set(
        scoped.map(
          x =>
            x.id
        )
      );

    const memberPhones =
      new Set(
        S.members.map(
          x =>
            x.phone
        )
      );

    const ex =
      exceptions();

    const covered = [];
    const missing = [];
    const noContact = [];

    scoped.forEach(
      student => {
        if (
          !student.contacts.length
        ) {
          noContact.push(
            student
          );

          return;
        }

        const matched =
          student.contacts
            .filter(
              contact =>
                memberPhones.has(
                  contact.phone
                )
            );

        (
          matched.length
            ? covered
            : missing
        ).push({
          student,
          matched,
        });
      }
    );

    const members =
      S.members.map(
        member => {
          const allLinks =
            S.phoneIndex.get(
              member.phone
            ) || [];

          const selected =
            allLinks.filter(
              x =>
                scopedIds.has(
                  x.student.id
                )
            );

          const outside =
            allLinks.filter(
              x =>
                !scopedIds.has(
                  x.student.id
                )
            );

          let type =
            'unlinked';

          let label =
            'غير مرتبط بالملف';

          if (
            S.selfPhone &&
            member.phone ===
              S.selfPhone
          ) {
            type =
              'self';

            label =
              'حسابك';
          }

          else if (
            selected.length
          ) {
            type =
              'linked';

            label =
              'مرتبط بالملف';
          }

          else if (
            outside.length
          ) {
            type =
              'other';

            label =
              'مرتبط بسجل خارج النطاق';
          }

          else if (
            ex[
              member.phone
            ]
          ) {
            type =
              'exception';

            label =
              ex[
                member.phone
              ];
          }

          return {
            ...member,
            type,
            label,
            selected,
            outside,
          };
        }
      );

    const total =
      scoped.length;

    const contactable =
      total -
      noContact.length;

    const coverage =
      total
        ? Math.round(
            (
              covered.length /
              total
            ) *
              1000
          ) /
          10
        : 0;

    const verifiable =
      contactable
        ? Math.round(
            (
              covered.length /
              contactable
            ) *
              1000
          ) /
          10
        : 0;

    S.audit = {
      scoped,
      covered,
      missing,
      noContact,
      members,

      unlinked:
        members.filter(
          x =>
            x.type ===
            'unlinked'
        ),

      other:
        members.filter(
          x =>
            x.type ===
            'other'
        ),

      linked:
        members.filter(
          x =>
            x.type ===
            'linked'
        ),

      exceptions:
        members.filter(
          x =>
            x.type ===
            'exception'
        ),

      self:
        members.filter(
          x =>
            x.type ===
            'self'
        ),

      unresolved:
        S.unresolved,

      total,
      contactable,
      coverage,
      verifiable,

      time:
        new Date(),
    };

    render();
  }

  // =========================================================
  // سجل التواصل الفردي
  // =========================================================

  function communicationInfo(phone) {
    const normalized =
      normalizePhone(phone);

    if (!normalized) {
      return {
        status:
          'error',

        label:
          'رقم غير صالح',

        shortLabel:
          'غير صالح',

        icon:
          '❓',
      };
    }

    return (
      S.communicationByPhone
        .get(normalized) ||
      {
        status:
          'unchecked',

        label:
          'لم يتم فحص التواصل',

        shortLabel:
          'لم يفحص',

        icon:
          '◌',
      }
    );
  }

  function communicationBadge(phone) {
    const info =
      communicationInfo(phone);

    return `
      <span
        class="sga-comm-badge ${esc(info.status)}"
      >
        ${info.icon || '◌'}
        ${esc(info.label)}
      </span>
    `;
  }

  function msgTimestamp(message) {
    const raw =
      message?.t ??
      message?.timestamp ??
      message?.time ??
      message?.__x_t ??
      0;

    const n =
      Number(raw);

    if (
      !Number.isFinite(n) ||
      n <= 0
    ) {
      return '';
    }

    const ms =
      n < 1e12
        ? n * 1000
        : n;

    const d =
      new Date(ms);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return '';
    }

    return d.toLocaleString(
      'ar-SA',
      {
        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',
      }
    );
  }

  async function possibleDirectChatIds(phone) {
    const normalized =
      normalizePhone(phone);

    if (!normalized) {
      return [];
    }

    const ids = [
      `${normalized}@c.us`,
      `${normalized}@s.whatsapp.net`,
    ];

    try {
      const mapping =
        await WPP.contact
          .getPnLidEntry(
            `${normalized}@c.us`
          );

      const lid =
        widString(
          mapping?.lid
        );

      const pn =
        widString(
          mapping?.phoneNumber
        );

      if (lid) {
        ids.push(lid);
      }

      if (pn) {
        ids.push(pn);
      }
    }

    catch (_) {}

    return uniq(ids);
  }

  async function inspectCommunication(phone) {
    const normalized =
      normalizePhone(phone);

    if (!normalized) {
      return {
        phone:
          normalized,

        status:
          'error',

        label:
          'تعذر فحص الرقم',

        shortLabel:
          'تعذر الفحص',

        icon:
          '❓',
      };
    }

    try {
      const ids =
        await possibleDirectChatIds(
          normalized
        );

      for (
        const chatId of ids
      ) {
        let chat = null;

        try {
          chat =
            WPP.chat.get(
              chatId
            );
        }

        catch (_) {}

        // لا نستخدم find هنا لأنه قد ينشئ محادثة جديدة.
        if (!chat) {
          continue;
        }

        try {
          const messages =
            await WPP.chat
              .getMessages(
                chatId,
                {
                  count:
                    1,

                  includeCallMessages:
                    true,
                }
              );

          if (
            Array.isArray(
              messages
            ) &&
            messages.length
          ) {
            const last =
              messages[0];

            const when =
              msgTimestamp(last);

            return {
              phone:
                normalized,

              status:
                'contacted',

              label:
                when
                  ? `سبق التواصل · ${when}`
                  : 'سبق التواصل',

              shortLabel:
                'سبق التواصل',

              icon:
                '💬',

              chatId,

              lastContact:
                when,

              fromMe:
                Boolean(
                  last?.fromMe ??
                  last?.id?.fromMe
                ),
            };
          }
        }

        catch (_) {}
      }

      return {
        phone:
          normalized,

        status:
          'new',

        label:
          'جديد — لم يسبق التواصل',

        shortLabel:
          'جديد',

        icon:
          '🆕',
      };
    }

    catch (error) {
      console.warn(
        '[WA-SGA] communication check',
        normalized,
        error
      );

      return {
        phone:
          normalized,

        status:
          'error',

        label:
          'تعذر فحص التواصل',

        shortLabel:
          'تعذر الفحص',

        icon:
          '❓',

        error:
          String(
            error?.message ||
            error
          ),
      };
    }
  }

  function missingCommunicationPhones() {
    if (!S.audit) {
      return [];
    }

    return uniq(
      S.audit.missing
        .flatMap(
          item =>
            item.student
              .contacts
              .map(
                contact =>
                  contact.phone
              )
        )
    );
  }

  async function scanCommunication() {
    if (!S.audit) {
      toast(
        'نفّذ تدقيق القروب أولًا.',
        'error'
      );

      return;
    }

    const phones =
      missingCommunicationPhones();

    if (!phones.length) {
      S.communicationScanned =
        true;

      render();

      toast(
        'لا توجد أرقام ناقصة تحتاج فحص التواصل.',
        'success'
      );

      return;
    }

    busy(
      true,
      'جارٍ فحص سجل التواصل…'
    );

    try {
      const results =
        await concurrent(
          phones,
          5,
          inspectCommunication,
          (
            done,
            total
          ) =>
            busyText(
              `فحص التواصل ${done} / ${total}`
            )
        );

      results.forEach(
        (
          result,
          index
        ) => {
          const phone =
            normalizePhone(
              result?.phone ||
              phones[index]
            );

          if (phone) {
            S.communicationByPhone
              .set(
                phone,
                result
              );
          }
        }
      );

      S.communicationScanned =
        true;

      render();

      const contacted =
        results.filter(
          x =>
            x?.status ===
            'contacted'
        ).length;

      const fresh =
        results.filter(
          x =>
            x?.status ===
            'new'
        ).length;

      toast(
        `تم الفحص: ${contacted} سبق التواصل معهم · ${fresh} جدد`,
        'success'
      );
    }

    catch (error) {
      console.error(
        '[WA-SGA] scan communication',
        error
      );

      toast(
        'تعذر إكمال فحص سجل التواصل.',
        'error'
      );
    }

    finally {
      busy(false);
    }
  }

  function communicationRows() {
    if (!S.audit) {
      return [];
    }

    const map =
      new Map();

    S.audit.missing
      .forEach(
        item => {
          item.student
            .contacts
            .forEach(
              contact => {
                if (
                  !map.has(
                    contact.phone
                  )
                ) {
                  map.set(
                    contact.phone,
                    {
                      phone:
                        contact.phone,

                      links:
                        [],
                    }
                  );
                }

                map.get(
                  contact.phone
                ).links.push({
                  student:
                    item.student,

                  contact,
                });
              }
            );
        }
      );

    return [
      ...map.values(),
    ].map(
      row => ({
        ...row,

        communication:
          communicationInfo(
            row.phone
          ),
      })
    );
  }

  // =========================================================
  // النسخ
  // =========================================================

  function copy(
    text,
    successMessage = 'تم النسخ'
  ) {
    if (!text) return;

    navigator.clipboard
      .writeText(text)
      .then(
        () =>
          toast(
            successMessage,
            'success'
          )
      )
      .catch(
        () => {
          const textarea =
            document
              .createElement(
                'textarea'
              );

          textarea.value =
            text;

          document.body
            .appendChild(
              textarea
            );

          textarea.select();

          document.execCommand(
            'copy'
          );

          textarea.remove();

          toast(
            successMessage,
            'success'
          );
        }
      );
  }

  function copyMissing() {
    if (!S.audit) return;

    const lines =
      S.audit.missing
        .map(
          (
            item,
            index
          ) =>
            `${index + 1}. ` +
            `${item.student.name} — ` +
            item.student
              .contacts
              .map(
                c =>
                  formatPhone(
                    c.phone
                  )
              )
              .join(' / ')
        );

    if (
      S.audit.noContact.length
    ) {
      lines.push(
        '',
        `${usageLabels().people} بلا أرقام:`
      );

      S.audit.noContact
        .forEach(
          (
            student,
            index
          ) =>
            lines.push(
              `${index + 1}. ${student.name}`
            )
        );
    }

    copy(
      lines.join('\n'),
      'تم نسخ قائمة الناقصين'
    );
  }

  function copyMissingPhones() {
    if (!S.audit) return;

    const phones =
      uniq(
        S.audit.missing
          .flatMap(
            item =>
              item.student
                .contacts
                .map(
                  contact =>
                    contact.phone
                )
          )
      );

    copy(
      phones
        .map(formatPhone)
        .join('\n'),
      'تم نسخ أرقام الناقصين'
    );
  }

  function copyAllUnlinked() {
    if (!S.audit) return;

    const phones =
      S.audit.unlinked
        .map(
          member =>
            member.phone
        );

    if (!phones.length) {
      toast(
        'لا توجد أرقام غير مرتبطة بالملف.',
        'success'
      );

      return;
    }

    copy(
      phones
        .map(formatPhone)
        .join('\n'),

      `تم نسخ ${phones.length} رقمًا غير مرتبط`
    );
  }

  // =========================================================
  // رابط القروب والدعوات
  // =========================================================

  async function ensureGroupInviteLink(
    {
      copyLink = false,
    } = {}
  ) {
    if (
      !S.ready ||
      typeof WPP ===
        'undefined'
    ) {
      toast(
        'محرك واتساب لم يجهز بعد.',
        'error'
      );

      return '';
    }

    let groupId =
      S.group?.id || '';

    let groupName =
      S.group?.name || '';

    if (!groupId) {
      const chat =
        activeChat();

      if (!chat?.isGroup) {
        toast(
          'افتح القروب المطلوب أولًا ثم اقرأ أعضاءه.',
          'error'
        );

        return '';
      }

      groupId =
        chat.id;

      groupName =
        chat.name;

      S.group = {
        id:
          groupId,

        name:
          groupName,
      };
    }

    if (
      S.groupInviteLink
    ) {
      if (copyLink) {
        copy(
          S.groupInviteLink,
          'تم نسخ رابط القروب'
        );
      }

      return (
        S.groupInviteLink
      );
    }

    busy(
      true,
      'جارٍ جلب رابط دعوة القروب…'
    );

    try {
      const code =
        await WPP.group
          .getInviteCode(
            groupId
          );

      if (
        !code ||
        typeof code !==
          'string'
      ) {
        throw new Error(
          'لم يرجع واتساب رمز دعوة صالحًا.'
        );
      }

      S.groupInviteCode =
        code;

      S.groupInviteLink =
        `https://chat.whatsapp.com/${code}`;

      if (copyLink) {
        copy(
          S.groupInviteLink,
          'تم نسخ رابط القروب'
        );
      }

      render();

      return (
        S.groupInviteLink
      );
    }

    catch (error) {
      console.error(
        '[WA-SGA] invite link',
        error
      );

      toast(
        'تعذر جلب رابط القروب. قد تحتاج صلاحية تسمح بعرض رابط الدعوة.',
        'error'
      );

      return '';
    }

    finally {
      busy(false);
    }
  }

  function inviteMessage(student) {
    const groupName =
      S.group?.name ||
      'القروب';

    const subject =
      S.usageMode ===
        'education'
        ? `بالطالب ${student?.name || ''}`
        : `بالسجل ${student?.name || ''}`;

    return (
      `السلام عليكم ورحمة الله وبركاته 🌿\n\n` +
      `هذا رابط الانضمام إلى مجموعة «${groupName}»:\n` +
      `${S.groupInviteLink}\n\n` +
      `نأمل الانضمام للمجموعة لضمان وصول التنبيهات والرسائل المتعلقة ${subject}.\n\n` +
      `شكرًا لتعاونكم.`
    );
  }

  function contactDisplay(
    student,
    contact
  ) {
    const guardianNames =
      uniq(
        (
          contact.details ||
          []
        )
          .map(
            d =>
              d.guardianName
          )
          .filter(Boolean)
      );

    const relations =
      uniq(
        (
          contact.details ||
          []
        )
          .map(
            d =>
              d.relation
          )
          .filter(Boolean)
      );

    const isStudent =
      contact.roles.includes(
        'الطالب'
      );

    const isGuardian =
      contact.roles.some(
        role =>
          role.includes(
            'ولي أمر'
          )
      );

    let title = '';

    if (
      isStudent &&
      isGuardian
    ) {
      title =
        `${student.name} / ولي الأمر`;
    }

    else if (isStudent) {
      title =
        student.name;
    }

    else if (
      guardianNames.length
    ) {
      title =
        guardianNames.join(
          ' / '
        );
    }

    else {
      title =
        S.usageMode ===
          'education'
          ? 'ولي الأمر'
          : (
              contact.roles[0] ||
              'جهة اتصال'
            );
    }

    return {
      title,

      meta:
        [
          contact.roles.join(
            ' + '
          ),

          relations.join(
            ' / '
          ),
        ]
          .filter(Boolean)
          .join(' · '),
    };
  }

  async function openInviteChat(
    phone,
    studentId
  ) {
    const student =
      S.studentById.get(
        String(studentId)
      );

    if (!student) {
      toast(
        'تعذر العثور على الطالب.',
        'error'
      );

      return;
    }

    const normalized =
      normalizePhone(phone);

    if (!normalized) {
      toast(
        'رقم الهاتف غير صالح.',
        'error'
      );

      return;
    }

    const link =
      await ensureGroupInviteLink();

    if (!link) return;

    const chatId =
      `${normalized}@c.us`;

    busy(
      true,
      `فتح محادثة ${student.name}…`
    );

    try {
      await WPP.chat
        .find(chatId);

      await WPP.chat
        .openChatBottom(
          chatId
        );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            250
          )
      );

      await WPP.chat
        .setInputText(
          inviteMessage(
            student
          ),
          chatId
        );

      S.invitePickerStudentId =
        '';

      render();

      toast(
        'تم تجهيز رسالة الدعوة — لم يتم إرسالها.',
        'success'
      );
    }

    catch (error) {
      console.error(
        '[WA-SGA] open invite chat',
        error
      );

      toast(
        'تعذر فتح المحادثة أو تجهيز الرسالة.',
        'error'
      );
    }

    finally {
      busy(false);
    }
  }

  // =========================================================
  // تصدير Excel
  // =========================================================

  function exportExcel() {
    if (!S.audit) return;

    const audit =
      S.audit;

    const labels =
      usageLabels();

    const scope =
      S.selectedClass ===
        '__all__'
        ? `كل ${labels.people}`
        : S.selectedClass;

    const workbook =
      XLSX.utils
        .book_new();

    const summary = [
      ['البند', 'القيمة'],
      ['القروب', S.group?.name || ''],
      [
        'رابط دعوة القروب',
        S.groupInviteLink ||
        'لم يتم جلبه'
      ],
      ['النطاق', scope],
      [`إجمالي ${labels.people}`, audit.total],
      ['مغطون', audit.covered.length],
      ['غير مغطين', audit.missing.length],
      ['بلا أرقام', audit.noContact.length],
      ['نسبة التغطية', `${audit.coverage}%`],
      ['أعضاء غير مرتبطين بالملف', audit.unlinked.length],
      ['خارج النطاق', audit.other.length],
      ['معرفات غير محلولة', audit.unresolved.length],
      ['قيم هاتف غير صالحة في الملف', S.invalidFilePhones.length],
      [
        'وقت التدقيق',
        audit.time
          .toLocaleString('ar-SA')
      ],
    ];

    const personRow =
      (
        item,
        state
      ) => ({
        'الاسم':
          item.student.name,

        'المعرف':
          item.student.id,

        'المجموعة':
          item.student.className,

        'الأرقام المرتبطة':
          item.student.contacts
            .map(
              c =>
                formatPhone(
                  c.phone
                )
            )
            .join(' | '),

        'الأدوار':
          item.student.contacts
            .map(
              c =>
                `${formatPhone(c.phone)} (${c.roles.join(' + ')})`
            )
            .join(' | '),

        'حالة التواصل':
          item.student.contacts
            .map(
              c =>
                `${formatPhone(c.phone)}: ${
                  communicationInfo(
                    c.phone
                  ).shortLabel ||
                  communicationInfo(
                    c.phone
                  ).label
                }`
            )
            .join(' | '),

        'الحالة':
          state,
      });

    const missing =
      audit.missing.map(
        item =>
          personRow(
            item,
            'غير مغطى'
          )
      );

    const covered =
      audit.covered.map(
        item => ({
          ...personRow(
            item,
            'مغطى'
          ),

          'الأرقام المطابقة':
            item.matched
              .map(
                c =>
                  formatPhone(
                    c.phone
                  )
              )
              .join(' | '),
        })
      );

    const noPhone =
      audit.noContact.map(
        person => ({
          'الاسم':
            person.name,

          'المعرف':
            person.id,

          'المجموعة':
            person.className,

          'الحالة':
            'لا يوجد رقم صالح',
        })
      );

    const members =
      audit.members.map(
        member => ({
          'اسم واتساب':
            member.name,

          'الرقم':
            formatPhone(
              member.phone
            ),

          'التصنيف':
            member.label,

          'مرتبط ضمن النطاق':
            uniq(
              member.selected
                .map(
                  x =>
                    x.student.name
                )
            ).join(' | '),

          'مرتبط خارج النطاق':
            uniq(
              member.outside
                .map(
                  x =>
                    x.student.name
                )
            ).join(' | '),

          'مشرف':
            member.isAdmin
              ? 'نعم'
              : 'لا',
        })
      );

    const invalid =
      S.invalidFilePhones.map(
        item => ({
          'الاسم':
            item.studentName,

          'المعرف':
            item.studentId,

          'المجموعة':
            item.className,

          'الدور':
            item.role,

          'الاسم المرتبط':
            item.guardianName,

          'القيمة الأصلية':
            item.raw,

          'المصدر':
            item.source,

          'سبب المشكلة':
            item.reason,
        })
      );

    XLSX.utils
      .book_append_sheet(
        workbook,
        XLSX.utils
          .aoa_to_sheet(summary),
        'الملخص'
      );

    XLSX.utils
      .book_append_sheet(
        workbook,
        XLSX.utils
          .json_to_sheet(missing),
        'غير المغطين'
      );

    XLSX.utils
      .book_append_sheet(
        workbook,
        XLSX.utils
          .json_to_sheet(covered),
        'المغطون'
      );

    if (noPhone.length) {
      XLSX.utils
        .book_append_sheet(
          workbook,
          XLSX.utils
            .json_to_sheet(noPhone),
          'بدون أرقام'
        );
    }

    XLSX.utils
      .book_append_sheet(
        workbook,
        XLSX.utils
          .json_to_sheet(members),
        'أعضاء القروب'
      );

    if (invalid.length) {
      XLSX.utils
        .book_append_sheet(
          workbook,
          XLSX.utils
            .json_to_sheet(invalid),
          'أرقام ملف غير صالحة'
        );
    }

    const safe =
      value =>
        String(value)
          .replace(
            /[\\/:*?"<>|]/g,
            '-'
          )
          .slice(0, 50);

    XLSX.writeFile(
      workbook,
      `تدقيق_${safe(S.group?.name || 'القروب')}_${safe(scope)}.xlsx`
    );
  }

  // =========================================================
  // واجهة v0.5.0
  // =========================================================

  function statTile(
    icon,
    value,
    label,
    tone = ''
  ) {
    return `
      <div class="wcm-stat ${tone}">
        <span class="wcm-stat-icon">
          ${icon}
        </span>

        <div>
          <b>${esc(value)}</b>
          <small>${esc(label)}</small>
        </div>
      </div>
    `;
  }

  function navButton(
    id,
    icon,
    label,
    badge = ''
  ) {
    return `
      <button
        class="wcm-nav-btn ${S.view === id ? 'active' : ''}"
        data-view="${id}"
        title="${esc(label)}"
      >
        <span>${icon}</span>
        <b>${esc(label)}</b>

        ${
          badge !== ''
            ? `<em>${esc(badge)}</em>`
            : ''
        }
      </button>
    `;
  }

  function fieldSelect(
    id,
    headers,
    value,
    placeholder = '— غير محدد —'
  ) {
    return `
      <select
        id="${id}"
        class="wcm-select"
      >
        <option value="">
          ${esc(placeholder)}
        </option>

        ${
          headers.map(
            h => `
              <option
                value="${esc(h)}"
                ${value === h ? 'selected' : ''}
              >
                ${esc(h)}
              </option>
            `
          ).join('')
        }
      </select>
    `;
  }

  function datasetHeader() {
    if (!S.students.length) {
      return '';
    }

    const labels =
      usageLabels();

    return `
      <div class="wcm-dataset-bar">

        <div class="wcm-dataset-title">

          <span class="wcm-file-icon">
            ▦
          </span>

          <div>
            <b>${esc(S.fileName)}</b>

            <small>
              ${esc(S.sourceKind || 'بيانات مستوردة')}
              ·
              ${S.students.length}
              ${esc(labels.people)}
            </small>
          </div>

        </div>

        <div class="wcm-dataset-actions">
          <button
            class="wcm-mini"
            data-action="file"
          >
            استبدال الملف
          </button>
        </div>

      </div>
    `;
  }

  function classSelector() {
    if (!S.students.length) {
      return '';
    }

    const labels =
      usageLabels();

    return `
      <label class="wcm-field compact">

        <span>
          ${esc(labels.group)}
          /
          النطاق
        </span>

        <select
          id="sga-class"
          class="wcm-select"
        >
          <option
            value="__all__"
            ${S.selectedClass === '__all__' ? 'selected' : ''}
          >
            كل ${esc(labels.people)}
          </option>

          ${
            S.classes.map(
              c => `
                <option
                  value="${esc(c)}"
                  ${S.selectedClass === c ? 'selected' : ''}
                >
                  ${esc(c)}
                </option>
              `
            ).join('')
          }

        </select>

      </label>
    `;
  }

  function onboardingView() {
    return `
      <section class="wcm-welcome">

        <div class="wcm-welcome-mark">
          WA
        </div>

        <div class="wcm-welcome-copy">

          <span class="wcm-eyebrow">
            WhatsApp Communication Manager
          </span>

          <h2>
            اعرف من داخل القروب، ومن يحتاج تواصلًا،
            وما الذي يحتاج إجراء.
          </h2>

          <p>
            ابدأ بأي ملف Excel أو CSV.
            المستورد الذكي يتعرف على الأعمدة،
            وإن لم يتعرف عليها يمكنك مطابقتها بصريًا
            في خطوة واحدة.
          </p>

          <div class="wcm-welcome-actions">

            <button
              class="wcm-btn primary"
              data-action="file"
            >
              📊 استيراد ملف بيانات
            </button>

            <button
              class="wcm-btn ghost"
              data-action="open-about"
            >
              عن السكربت
            </button>

          </div>

          <div class="wcm-feature-row">
            <span>✓ XLSX / XLS / CSV</span>
            <span>✓ عدة أعمدة هاتف</span>
            <span>✓ صيغة صفوف متعددة</span>
            <span>✓ يتذكر المطابقة</span>
          </div>

        </div>

      </section>
    `;
  }

  function homeView() {
    if (!S.students.length) {
      return onboardingView();
    }

    const labels =
      usageLabels();

    const chat =
      activeChat();

    const audit =
      S.audit;

    const missing =
      audit?.missing.length || 0;

    const unlinked =
      audit?.unlinked.length || 0;

    const commRows =
      audit
        ? communicationRows()
        : [];

    const fresh =
      commRows.filter(
        r =>
          r.communication.status ===
          'new'
      ).length;

    const contacted =
      commRows.filter(
        r =>
          r.communication.status ===
          'contacted'
      ).length;

    return `
      ${datasetHeader()}

      <section class="wcm-hero-card">

        <div class="wcm-hero-top">

          <div>

            <span class="wcm-eyebrow">
              لوحة المتابعة
            </span>

            <h2>
              ${
                audit
                  ? `${audit.coverage}% تغطية ${esc(labels.group)}`
                  : 'جهّز التدقيق في خطوتين'
              }
            </h2>

            <p>
              ${
                audit
                  ? `${audit.covered.length} من ${audit.total} ${esc(labels.people)} لديهم تمثيل داخل القروب.`
                  : `اختر ${esc(labels.group)} ثم افتح القروب المطلوب في واتساب واضغط قراءة الأعضاء.`
              }
            </p>

          </div>

          ${
            audit
              ? `
                <div
                  class="wcm-ring"
                  style="--p:${Math.max(0, Math.min(100, audit.coverage))}"
                >
                  <span>
                    ${audit.coverage}%
                  </span>
                </div>
              `
              : `
                <div class="wcm-hero-symbol">
                  ◎
                </div>
              `
          }

        </div>

        <div class="wcm-setup-row">

          ${classSelector()}

          <div
            class="wcm-current-chat ${chat?.isGroup ? 'ok' : ''}"
          >
            <span>
              القروب المفتوح
            </span>

            <b>
              ${
                chat
                  ? esc(chat.name)
                  : 'لا توجد محادثة مفتوحة'
              }
            </b>

            <small>
              ${
                chat?.isGroup
                  ? 'جاهز للقراءة'
                  : 'افتح قروبًا في واتساب'
              }
            </small>
          </div>

          <button
            class="wcm-btn primary wcm-capture"
            data-action="capture"
            ${S.ready ? '' : 'disabled'}
          >
            🔎 قراءة القروب
          </button>

        </div>

        ${
          S.group
            ? `
              <div class="wcm-group-line">

                <div>
                  <span>
                    القروب المعتمد في التدقيق
                  </span>

                  <b>
                    ${esc(S.group.name)}
                  </b>
                </div>

                <div class="wcm-group-actions">

                  <button
                    class="wcm-mini"
                    data-action="copy-group-link"
                  >
                    ${
                      S.groupInviteLink
                        ? '📋 نسخ رابط القروب'
                        : '🔗 جلب رابط الدعوة'
                    }
                  </button>

                  ${
                    audit
                      ? `
                        <button
                          class="wcm-mini"
                          data-action="audit"
                        >
                          ↻ إعادة الحساب
                        </button>
                      `
                      : ''
                  }

                </div>

              </div>
            `
            : ''
        }

      </section>

      ${
        audit
          ? `
            <section class="wcm-stats-grid">

              ${statTile(
                '✓',
                audit.covered.length,
                'مغطون',
                'success'
              )}

              ${statTile(
                '!',
                missing,
                'يحتاجون الانضمام',
                missing
                  ? 'danger'
                  : 'success'
              )}

              ${statTile(
                '?',
                unlinked,
                'أعضاء غير مرتبطين',
                unlinked
                  ? 'warning'
                  : ''
              )}

              ${statTile(
                '✦',
                fresh,
                'أرقام جديدة',
                fresh
                  ? 'accent'
                  : ''
              )}

            </section>

            <section class="wcm-action-center">

              <div class="wcm-section-title">

                <div>
                  <span class="wcm-eyebrow">
                    مركز الإجراءات
                  </span>

                  <h3>
                    ما الذي يحتاج انتباهك الآن؟
                  </h3>
                </div>

                <button
                  class="wcm-mini"
                  data-action="export"
                >
                  تصدير التقرير
                </button>

              </div>

              <div class="wcm-action-list">

                <button
                  data-view="coverage"
                  data-coverage="missing"
                  class="wcm-action-item ${missing ? 'hot' : ''}"
                >
                  <span class="wcm-action-icon">
                    👥
                  </span>

                  <div>
                    <b>
                      ${missing}
                      ${esc(labels.people)}
                      غير مغطين
                    </b>

                    <small>
                      ${
                        missing
                          ? 'أرسل رابط القروب للطالب أو لأي جهة اتصال مرتبطة به.'
                          : 'لا يوجد نقص في التغطية.'
                      }
                    </small>
                  </div>

                  <em>›</em>
                </button>

                <button
                  data-view="communication"
                  class="wcm-action-item ${fresh ? 'hot' : ''}"
                >
                  <span class="wcm-action-icon">
                    💬
                  </span>

                  <div>
                    <b>
                      ${
                        S.communicationScanned
                          ? `${fresh} أرقام جديدة · ${contacted} سبق التواصل معها`
                          : 'فحص سجل التواصل'
                      }
                    </b>

                    <small>
                      ${
                        S.communicationScanned
                          ? 'اعرف من يحتاج بدء محادثة ومن سبق التواصل معه.'
                          : 'حدد الأرقام الجديدة والأرقام التي سبق التواصل معها.'
                      }
                    </small>
                  </div>

                  <em>›</em>
                </button>

                <button
                  data-view="members"
                  data-member-filter="unlinked"
                  class="wcm-action-item ${unlinked ? 'hot' : ''}"
                >
                  <span class="wcm-action-icon">
                    ⚠
                  </span>

                  <div>
                    <b>
                      ${unlinked}
                      أعضاء غير مرتبطين بالملف
                    </b>

                    <small>
                      راجع الرقم، انسخه،
                      أو عرّفه كمعلم/إداري.
                    </small>
                  </div>

                  <em>›</em>
                </button>

                <button
                  data-view="data"
                  class="wcm-action-item ${S.invalidFilePhones.length ? 'hot' : ''}"
                >
                  <span class="wcm-action-icon">
                    ▦
                  </span>

                  <div>
                    <b>
                      ${S.invalidFilePhones.length}
                      قيم هاتف تحتاج مراجعة
                    </b>

                    <small>
                      أخطاء البيانات منفصلة عن الأعضاء
                      الزائدين في القروب.
                    </small>
                  </div>

                  <em>›</em>
                </button>

              </div>

            </section>
          `
          : `
            <section class="wcm-empty-state">

              <span>①</span>

              <b>
                الملف جاهز
              </b>

              <p>
                الآن افتح القروب في واتساب
                واضغط «قراءة القروب»
                لتبدأ المقارنة.
              </p>

            </section>
          `
      }
    `;
  }

  function dataView() {
    if (!S.students.length) {
      return onboardingView();
    }

    const labels =
      usageLabels();

    const invalid =
      S.invalidFilePhones
        .slice(0, 30);

    const scoped =
      scopedStudents();

    return `
      ${datasetHeader()}

      <div class="wcm-page-head">

        <div>
          <span class="wcm-eyebrow">
            البيانات
          </span>

          <h2>
            مصدر البيانات وجودتها
          </h2>

          <p>
            المستورد يفصل بين الأرقام الصحيحة،
            القيم غير الصالحة،
            والأرقام المشتركة بين أكثر من سجل.
          </p>
        </div>

        <button
          class="wcm-btn primary"
          data-action="file"
        >
          استيراد ملف آخر
        </button>

      </div>

      <section class="wcm-stats-grid compact">

        ${statTile(
          '👤',
          S.students.length,
          labels.people
        )}

        ${statTile(
          '📱',
          S.stats?.uniquePhones || 0,
          'أرقام فريدة'
        )}

        ${statTile(
          '▦',
          S.classes.length,
          labels.groups
        )}

        ${statTile(
          '⚠',
          S.invalidFilePhones.length,
          'قيم غير صالحة',
          S.invalidFilePhones.length
            ? 'warning'
            : 'success'
        )}

      </section>

      <section class="wcm-card">

        <div class="wcm-section-title">

          <div>
            <h3>
              إعداد البيانات الحالي
            </h3>

            <p>
              ${esc(S.sourceKind || '')}
            </p>
          </div>

          <span class="wcm-chip">
            ${
              S.usageMode ===
              'education'
                ? '🎓 تعليم'
                : '👥 عام'
            }
          </span>

        </div>

        <div class="wcm-meta-grid">

          <div>
            <span>الملف</span>
            <b>${esc(S.fileName)}</b>
          </div>

          <div>
            <span>
              السجلات في النطاق
            </span>
            <b>${scoped.length}</b>
          </div>

          <div>
            <span>
              أرقام مشتركة
            </span>
            <b>
              ${S.stats?.sharedPhones || 0}
            </b>
          </div>

          <div>
            <span>
              بلا رقم صالح
            </span>
            <b>
              ${S.stats?.noContacts || 0}
            </b>
          </div>

        </div>

      </section>

      <section class="wcm-card">

        <div class="wcm-section-title">

          <div>
            <h3>
              قيم الهاتف التي تحتاج مراجعة
            </h3>

            <p>
              هذه مشاكل داخل الملف نفسه،
              وليست أعضاء زائدين في واتساب.
            </p>
          </div>

          <span class="wcm-count">
            ${S.invalidFilePhones.length}
          </span>

        </div>

        ${
          invalid.length
            ? `
              <div class="wcm-review-list">

                ${
                  invalid.map(
                    (
                      item,
                      i
                    ) => `
                      <div class="wcm-review-row">

                        <span class="wcm-review-num">
                          ${i + 1}
                        </span>

                        <div class="wcm-review-main">

                          <b>
                            ${esc(item.studentName)}
                          </b>

                          <small>
                            ${esc(item.role)}
                            ${
                              item.guardianName
                                ? ` · ${esc(item.guardianName)}`
                                : ''
                            }
                            ·
                            ${esc(item.reason)}
                          </small>

                        </div>

                        <code>
                          ${esc(item.raw)}
                        </code>

                        <button
                          class="wcm-mini"
                          data-action="copy-raw"
                          data-value="${esc(item.raw)}"
                        >
                          نسخ
                        </button>

                      </div>
                    `
                  ).join('')
                }

              </div>
            `
            : `
              <div class="wcm-good-empty">
                ✓ لا توجد قيم هاتف غير صالحة في الملف.
              </div>
            `
        }

        ${
          S.invalidFilePhones.length >
          invalid.length
            ? `
              <p class="wcm-muted">
                يتم عرض أول ${invalid.length} قيمة فقط.
                التقرير المصدّر يحتوي على البقية.
              </p>
            `
            : ''
        }

      </section>
    `;
  }

  function coverageView() {
    if (!S.audit) {
      return `
        <div class="wcm-empty-state">

          <span>◎</span>

          <b>
            لم يتم التدقيق بعد
          </b>

          <p>
            ارجع للرئيسية،
            افتح القروب ثم اقرأ أعضاءه.
          </p>

          <button
            class="wcm-btn primary"
            data-view="home"
          >
            الرئيسية
          </button>

        </div>
      `;
    }

    const audit =
      S.audit;

    const labels =
      usageLabels();

    const missingMode =
      S.coverageFilter !==
      'covered';

    const list =
      missingMode
        ? audit.missing
        : audit.covered;

    return `
      <div class="wcm-page-head">

        <div>
          <span class="wcm-eyebrow">
            التغطية
          </span>

          <h2>
            ${esc(S.group.name)}
          </h2>

          <p>
            يكفي وجود رقم واحد مرتبط بالسجل
            داخل القروب ليعتبر مغطى.
          </p>
        </div>

        <div class="wcm-segment">

          <button
            class="${missingMode ? 'active' : ''}"
            data-coverage-filter="missing"
          >
            الناقصون
            <em>
              ${
                audit.missing.length +
                audit.noContact.length
              }
            </em>
          </button>

          <button
            class="${!missingMode ? 'active' : ''}"
            data-coverage-filter="covered"
          >
            المغطون
            <em>
              ${audit.covered.length}
            </em>
          </button>

        </div>

      </div>

      ${
        missingMode
          ? `
            <div class="wcm-toolbar">

              <button
                class="wcm-mini"
                data-action="copy-missing"
              >
                نسخ القائمة
              </button>

              <button
                class="wcm-mini"
                data-action="copy-phones"
              >
                نسخ الأرقام
              </button>

              <button
                class="wcm-mini"
                data-action="scan-communication"
              >
                فحص التواصل
              </button>

            </div>

            <div class="wcm-person-list">

              ${
                audit.missing.map(
                  (
                    item,
                    i
                  ) =>
                    personCard(
                      item.student,
                      {
                        index:
                          i + 1,

                        status:
                          'missing',
                      }
                    )
                ).join('')
              }

              ${
                audit.noContact.map(
                  (
                    student,
                    i
                  ) =>
                    personCard(
                      student,
                      {
                        index:
                          audit.missing.length +
                          i +
                          1,

                        status:
                          'no-phone',
                      }
                    )
                ).join('')
              }

              ${
                !audit.missing.length &&
                !audit.noContact.length
                  ? `
                    <div class="wcm-good-empty">
                      🎉 كل ${esc(labels.people)}
                      مغطون داخل القروب.
                    </div>
                  `
                  : ''
              }

            </div>
          `
          : `
            <div class="wcm-person-list">

              ${
                audit.covered.map(
                  (
                    item,
                    i
                  ) =>
                    personCard(
                      item.student,
                      {
                        index:
                          i + 1,

                        status:
                          'covered',

                        matched:
                          item.matched,
                      }
                    )
                ).join('')
              }

            </div>
          `
      }
    `;
  }

  function personCard(
    student,
    options = {}
  ) {
    const matched =
      options.matched || [];

    const status =
      options.status ||
      'missing';

    const statusLabel =
      status === 'covered'
        ? 'مغطى'
        : status === 'no-phone'
          ? 'بلا رقم صالح'
          : 'غير مغطى';

    const statusIcon =
      status === 'covered'
        ? '✓'
        : status === 'no-phone'
          ? '–'
          : '!';

    return `
      <article
        class="wcm-person-card ${status}"
      >

        <header>

          <div class="wcm-person-id">

            <span>
              ${esc(options.index || '')}
            </span>

            <div>

              <button
                data-action="invite-student"
                data-student-id="${esc(student.id)}"
              >
                ${esc(student.name)}
              </button>

              <small>
                ${esc(student.className)}
              </small>

            </div>

          </div>

          <span
            class="wcm-status-badge ${status}"
          >
            ${statusIcon}
            ${statusLabel}
          </span>

        </header>

        ${
          student.contacts.length
            ? `
              <div class="wcm-contact-list">

                ${
                  student.contacts
                    .map(
                      contact => {
                        const d =
                          contactDisplay(
                            student,
                            contact
                          );

                        const hit =
                          matched.some(
                            m =>
                              m.phone ===
                              contact.phone
                          );

                        return `
                          <div
                            class="wcm-contact-row ${hit ? 'hit' : ''}"
                          >

                            <div class="wcm-contact-icon">
                              ${hit ? '✓' : '☎'}
                            </div>

                            <div class="wcm-contact-copy">

                              <b>
                                ${esc(d.title)}
                              </b>

                              <small>
                                ${esc(
                                  d.meta ||
                                  contact.roles.join(' + ')
                                )}
                              </small>

                            </div>

                            <div class="wcm-phone-wrap">

                              <code>
                                ${esc(formatPhone(contact.phone))}
                              </code>

                              ${communicationBadge(contact.phone)}

                            </div>

                            ${
                              status !== 'covered'
                                ? `
                                  <button
                                    class="wcm-mini primary"
                                    data-action="invite-contact"
                                    data-phone="${esc(contact.phone)}"
                                    data-student-id="${esc(student.id)}"
                                  >
                                    دعوة
                                  </button>
                                `
                                : ''
                            }

                          </div>
                        `;
                      }
                    )
                    .join('')
                }

              </div>
            `
            : `
              <div class="wcm-no-contact">
                لا يوجد رقم صالح لهذا السجل
                في البيانات المستوردة.
              </div>
            `
        }

      </article>
    `;
  }

  function communicationView() {
    if (!S.audit) {
      return `
        <div class="wcm-empty-state">

          <span>💬</span>

          <b>
            نفّذ تدقيق القروب أولًا
          </b>

          <p>
            بعد التدقيق سنفحص فقط أرقام
            السجلات الناقصة.
          </p>

        </div>
      `;
    }

    const rows =
      communicationRows();

    const counts = {
      contacted:
        rows.filter(
          x =>
            x.communication.status ===
            'contacted'
        ).length,

      new:
        rows.filter(
          x =>
            x.communication.status ===
            'new'
        ).length,

      unchecked:
        rows.filter(
          x =>
            x.communication.status ===
            'unchecked'
        ).length,

      error:
        rows.filter(
          x =>
            x.communication.status ===
            'error'
        ).length,
    };

    const visible =
      S.communicationFilter ===
        'all'
        ? rows
        : rows.filter(
            x =>
              x.communication.status ===
              S.communicationFilter
          );

    return `
      <div class="wcm-page-head">

        <div>

          <span class="wcm-eyebrow">
            التواصل
          </span>

          <h2>
            من سبق التواصل معه؟
          </h2>

          <p>
            وجود الرقم في القروب أو جهات الاتصال
            لا يعني وجود تواصل؛ نبحث عن محادثة
            فردية بها رسالة أو مكالمة.
          </p>

        </div>

        <button
          class="wcm-btn primary"
          data-action="scan-communication"
        >
          ${
            S.communicationScanned
              ? '↻ إعادة الفحص'
              : '💬 فحص التواصل'
          }
        </button>

      </div>

      <section class="wcm-stats-grid compact">

        ${statTile(
          '💬',
          counts.contacted,
          'سبق التواصل',
          'success'
        )}

        ${statTile(
          '✦',
          counts.new,
          'جديد',
          'accent'
        )}

        ${statTile(
          '◌',
          counts.unchecked,
          'لم يفحص'
        )}

        ${statTile(
          '?',
          counts.error,
          'تعذر الفحص',
          counts.error
            ? 'warning'
            : ''
        )}

      </section>

      <div class="wcm-filter-row">

        ${
          [
            [
              'all',
              'الكل',
              rows.length,
            ],
            [
              'contacted',
              'سبق التواصل',
              counts.contacted,
            ],
            [
              'new',
              'جديد',
              counts.new,
            ],
            [
              'unchecked',
              'لم يفحص',
              counts.unchecked,
            ],
            [
              'error',
              'تعذر',
              counts.error,
            ],
          ].map(
            (
              [
                id,
                l,
                c,
              ]
            ) => `
              <button
                class="${S.communicationFilter === id ? 'active' : ''}"
                data-communication-filter="${id}"
              >
                ${l}
                <em>${c}</em>
              </button>
            `
          ).join('')
        }

      </div>

      <div class="wcm-contact-audit-list">

        ${
          visible.map(
            row => {
              const info =
                row.communication;

              const names =
                uniq(
                  row.links
                    .map(
                      x =>
                        x.student.name
                    )
                );

              const roles =
                uniq(
                  row.links
                    .flatMap(
                      x =>
                        x.contact.roles
                    )
                );

              const first =
                row.links[0]
                  ?.student;

              return `
                <article
                  class="wcm-contact-audit ${esc(info.status)}"
                >

                  <div class="wcm-contact-audit-top">

                    <div>

                      <span class="wcm-big-phone">
                        ${esc(formatPhone(row.phone))}
                      </span>

                      <small>
                        ${esc(roles.join(' + '))}
                      </small>

                    </div>

                    ${communicationBadge(row.phone)}

                  </div>

                  <p>
                    ${esc(names.join('، '))}
                  </p>

                  ${
                    info.lastContact
                      ? `
                        <small class="wcm-last">
                          آخر تواصل ظاهر:
                          ${esc(info.lastContact)}
                        </small>
                      `
                      : ''
                  }

                  <footer>

                    <button
                      class="wcm-mini"
                      data-action="copy-phone"
                      data-phone="${esc(row.phone)}"
                    >
                      نسخ الرقم
                    </button>

                    ${
                      first
                        ? `
                          <button
                            class="wcm-mini primary"
                            data-action="invite-contact"
                            data-phone="${esc(row.phone)}"
                            data-student-id="${esc(first.id)}"
                          >
                            تجهيز دعوة
                          </button>
                        `
                        : ''
                    }

                  </footer>

                </article>
              `;
            }
          ).join('') ||
          `
            <div class="wcm-empty-state small">
              <span>◌</span>
              <b>
                لا توجد نتائج في هذا الفلتر
              </b>
            </div>
          `
        }

      </div>
    `;
  }

  function linkedNames(links) {
    const map =
      new Map();

    links.forEach(
      item => {
        if (
          !map.has(
            item.student.id
          )
        ) {
          map.set(
            item.student.id,
            {
              student:
                item.student,

              roles:
                [],
            }
          );
        }

        item.contact.roles
          .forEach(
            role => {
              if (
                !map
                  .get(
                    item.student.id
                  )
                  .roles
                  .includes(role)
              ) {
                map
                  .get(
                    item.student.id
                  )
                  .roles
                  .push(role);
              }
            }
          );
      }
    );

    return [
      ...map.values(),
    ]
      .map(
        item =>
          `${item.student.name} (${item.roles.join(' + ')})`
      )
      .join('، ');
  }

  function membersView() {
    if (!S.audit) {
      return `
        <div class="wcm-empty-state">

          <span>👥</span>

          <b>
            لم تتم قراءة القروب بعد
          </b>

          <p>
            اقرأ أعضاء القروب من الرئيسية أولًا.
          </p>

        </div>
      `;
    }

    const audit =
      S.audit;

    const counts = {
      all:
        audit.members.length +
        audit.unresolved.length,

      linked:
        audit.linked.length,

      unlinked:
        audit.unlinked.length,

      other:
        audit.other.length,

      exception:
        audit.exceptions.length,

      unresolved:
        audit.unresolved.length,
    };

    let list =
      S.memberFilter ===
        'all'
        ? audit.members
        : audit.members
            .filter(
              m =>
                m.type ===
                S.memberFilter
            );

    if (
      S.memberFilter ===
      'unresolved'
    ) {
      list = [];
    }

    return `
      <div class="wcm-page-head">

        <div>

          <span class="wcm-eyebrow">
            أعضاء القروب
          </span>

          <h2>
            ${esc(S.group.name)}
          </h2>

          <p>
            «غير مرتبط» يعني رقمًا صحيحًا
            في القروب لم نجده في الملف؛
            لا يعني أن صيغة الرقم خاطئة.
          </p>

        </div>

        ${
          audit.unlinked.length
            ? `
              <button
                class="wcm-btn ghost"
                data-action="copy-all-unlinked"
              >
                نسخ غير المرتبطين
              </button>
            `
            : ''
        }

      </div>

      <div class="wcm-filter-row">

        ${
          [
            ['all', 'الكل'],
            ['linked', 'مرتبط'],
            ['unlinked', 'غير مرتبط'],
            ['other', 'خارج النطاق'],
            ['exception', 'مستثنى'],
            ['unresolved', 'غير محلول'],
          ].map(
            (
              [
                id,
                label,
              ]
            ) => `
              <button
                class="${S.memberFilter === id ? 'active' : ''}"
                data-member-filter="${id}"
              >
                ${label}
                <em>
                  ${counts[id]}
                </em>
              </button>
            `
          ).join('')
        }

      </div>

      <div class="wcm-member-list">

        ${
          list.map(
            member =>
              memberCard(member)
          ).join('')
        }

        ${
          (
            S.memberFilter ===
              'all' ||
            S.memberFilter ===
              'unresolved'
          )
            ? audit.unresolved
                .map(
                  member => `
                    <article
                      class="wcm-member-card unresolved"
                    >

                      <div class="wcm-member-main">

                        <span class="wcm-avatar">
                          ?
                        </span>

                        <div>

                          <b>
                            ${esc(member.name || 'عضو')}
                          </b>

                          <code>
                            ${esc(member.wid || '')}
                          </code>

                        </div>

                      </div>

                      <span
                        class="wcm-status-badge unresolved"
                      >
                        غير محلول
                      </span>

                      <p>
                        تعذر استخراج رقم الهاتف
                        من معرف واتساب،
                        لذلك لا يدخل في حكم زائد/مرتبط.
                      </p>

                    </article>
                  `
                )
                .join('')
            : ''
        }

        ${
          !list.length &&
          !(
            S.memberFilter ===
              'all' ||
            S.memberFilter ===
              'unresolved'
          )
            ? `
              <div class="wcm-good-empty">
                لا توجد نتائج ضمن هذا الفلتر.
              </div>
            `
            : ''
        }

      </div>
    `;
  }

  function memberCard(member) {
    const map = {
      linked:
        ['✓', 'مرتبط'],

      unlinked:
        ['!', 'غير مرتبط'],

      other:
        ['↗', 'خارج النطاق'],

      exception:
        ['◆', member.label],

      self:
        ['●', 'حسابك'],
    };

    const [
      icon,
      label,
    ] =
      map[member.type] ||
      [
        '•',
        member.label,
      ];

    return `
      <article
        class="wcm-member-card ${esc(member.type)}"
      >

        <div class="wcm-member-top">

          <div class="wcm-member-main">

            <span class="wcm-avatar">
              ${icon}
            </span>

            <div>

              <b>
                ${esc(member.name || formatPhone(member.phone))}
              </b>

              <code>
                ${esc(formatPhone(member.phone))}
                ${member.isAdmin ? ' · مشرف' : ''}
              </code>

            </div>

          </div>

          <span
            class="wcm-status-badge ${esc(member.type)}"
          >
            ${esc(label)}
          </span>

        </div>

        ${
          member.selected.length
            ? `
              <p>
                ${esc(linkedNames(member.selected))}
              </p>
            `
            : ''
        }

        ${
          member.outside.length
            ? `
              <p class="wcm-outside">
                خارج النطاق:
                ${esc(linkedNames(member.outside))}
              </p>
            `
            : ''
        }

        <footer>

          <button
            class="wcm-mini"
            data-action="copy-phone"
            data-phone="${esc(member.phone)}"
          >
            نسخ الرقم
          </button>

          ${
            member.type ===
              'unlinked'
              ? `
                <button
                  class="wcm-mini"
                  data-action="add-ex"
                  data-phone="${esc(member.phone)}"
                >
                  اعتباره معلم/إداري
                </button>
              `
              : ''
          }

          ${
            member.type ===
              'exception'
              ? `
                <button
                  class="wcm-mini danger"
                  data-action="del-ex"
                  data-phone="${esc(member.phone)}"
                >
                  إلغاء الاستثناء
                </button>
              `
              : ''
          }

        </footer>

      </article>
    `;
  }

  function qualityView() {
    if (!S.students.length) {
      return onboardingView();
    }

    const scoped =
      scopedStudents();

    const phoneMap =
      new Map();

    scoped.forEach(
      student =>
        student.contacts
          .forEach(
            contact => {
              if (
                !phoneMap.has(
                  contact.phone
                )
              ) {
                phoneMap.set(
                  contact.phone,
                  []
                );
              }

              phoneMap
                .get(
                  contact.phone
                )
                .push(
                  student
                );
            }
          )
    );

    const shared =
      [...phoneMap.entries()]
        .filter(
          (
            [
              ,
              people,
            ]
          ) =>
            new Set(
              people.map(
                p =>
                  p.id
              )
            ).size > 1
        );

    return `
      <div class="wcm-page-head">

        <div>

          <span class="wcm-eyebrow">
            جودة البيانات
          </span>

          <h2>
            التكرار والروابط المشتركة
          </h2>

          <p>
            الرقم المشترك قد يكون ولي أمر
            لأكثر من شخص،
            لذلك يمكن أن يغطي أكثر من سجل
            في القروب.
          </p>

        </div>

      </div>

      <section class="wcm-stats-grid compact">

        ${statTile(
          '📱',
          phoneMap.size,
          'أرقام في النطاق'
        )}

        ${statTile(
          '⇄',
          shared.length,
          'أرقام مشتركة',
          shared.length
            ? 'accent'
            : ''
        )}

        ${statTile(
          '–',
          scoped.filter(
            x =>
              !x.contacts.length
          ).length,
          'بلا رقم'
        )}

        ${statTile(
          '⚠',
          S.invalidFilePhones.length,
          'قيم غير صالحة',
          S.invalidFilePhones.length
            ? 'warning'
            : ''
        )}

      </section>

      <section class="wcm-card">

        <div class="wcm-section-title">

          <div>

            <h3>
              الأرقام المشتركة
            </h3>

            <p>
              تظهر الأسماء المرتبطة بنفس الرقم.
            </p>

          </div>

          <span class="wcm-count">
            ${shared.length}
          </span>

        </div>

        ${
          shared.length
            ? `
              <div class="wcm-shared-list">

                ${
                  shared.map(
                    (
                      [
                        phone,
                        people,
                      ]
                    ) => `
                      <div class="wcm-shared-row">

                        <code>
                          ${esc(formatPhone(phone))}
                        </code>

                        <div>
                          ${
                            uniq(
                              people.map(
                                p =>
                                  p.name
                              )
                            )
                              .map(
                                n =>
                                  `<span>${esc(n)}</span>`
                              )
                              .join('')
                          }
                        </div>

                        <button
                          class="wcm-mini"
                          data-action="copy-phone"
                          data-phone="${esc(phone)}"
                        >
                          نسخ
                        </button>

                      </div>
                    `
                  ).join('')
                }

              </div>
            `
            : `
              <div class="wcm-good-empty">
                لا توجد أرقام مشتركة
                داخل النطاق الحالي.
              </div>
            `
        }

      </section>
    `;
  }

  function renderMainView() {
    switch (S.view) {
      case 'data':
        return dataView();

      case 'coverage':
        return coverageView();

      case 'communication':
        return communicationView();

      case 'members':
        return membersView();

      case 'quality':
        return qualityView();

      default:
        return homeView();
    }
  }

  // =========================================================
  // معالج الاستيراد الذكي
  // =========================================================

  function importWizard() {
    if (!S.importWizardOpen) {
      return '';
    }

    const sheet =
      currentImportSheet();

    if (!sheet) {
      return '';
    }

    const m =
      S.importMapping ||
      suggestMapping(sheet);

    const preview =
      mappedImportPreview(
        sheet,
        m
      );

    const phoneSelected =
      new Set(
        m.phoneCols || []
      );

    const sampleCols =
      uniq([
        m.nameCol,
        m.idCol,
        m.groupCol,

        ...(
          m.mode === 'wide'
            ? (
                m.phoneCols ||
                []
              )
            : [
                m.contactNameCol,
                m.roleCol,
                m.phoneCol,
              ]
        ),
      ])
        .filter(Boolean)
        .slice(0, 6);

    return `
      <div class="wcm-modal-layer">

        <section class="wcm-import-modal">

          <header class="wcm-modal-head">

            <div>

              <span class="wcm-eyebrow">
                المستورد الذكي
              </span>

              <h2>
                مطابقة بيانات
                «${esc(S.importSource?.fileName || '')}»
              </h2>

              <p>
                ${
                  S.importProfileFound
                    ? '✓ تم العثور على إعداد مطابقة محفوظ لهذا التنسيق.'
                    : 'راجع الاقتراحات ثم اعتمد الاستيراد.'
                }
              </p>

            </div>

            <button
              data-action="close-import"
            >
              ×
            </button>

          </header>

          <div class="wcm-import-body">

            <div class="wcm-import-layout">

              <div class="wcm-map-panel">

                <div class="wcm-two-fields">

                  <label class="wcm-field">

                    <span>
                      ورقة البيانات
                    </span>

                    <select
                      id="wcm-map-sheet"
                      class="wcm-select"
                    >
                      ${
                        S.importSource.sheets
                          .map(
                            s => `
                              <option
                                value="${esc(s.name)}"
                                ${s.name === sheet.name ? 'selected' : ''}
                              >
                                ${esc(s.name)}
                                ·
                                ${s.rows.length}
                                صف
                              </option>
                            `
                          )
                          .join('')
                      }
                    </select>

                  </label>

                  <label class="wcm-field">

                    <span>
                      نوع الاستخدام
                    </span>

                    <select
                      id="wcm-usage-mode"
                      class="wcm-select"
                    >

                      <option
                        value="education"
                        ${S.usageMode === 'education' ? 'selected' : ''}
                      >
                        🎓 طلاب وأولياء أمور
                      </option>

                      <option
                        value="general"
                        ${S.usageMode === 'general' ? 'selected' : ''}
                      >
                        👥 استخدام عام
                      </option>

                    </select>

                  </label>

                </div>

                <label class="wcm-field">

                  <span>
                    شكل الملف
                  </span>

                  <select
                    id="wcm-map-mode"
                    class="wcm-select"
                  >

                    <option
                      value="wide"
                      ${m.mode === 'wide' ? 'selected' : ''}
                    >
                      صف واحد للشخص + عدة أعمدة هاتف
                    </option>

                    <option
                      value="long"
                      ${m.mode === 'long' ? 'selected' : ''}
                    >
                      عدة صفوف للشخص + رقم واحد بكل صف
                    </option>

                  </select>

                </label>

                <div class="wcm-map-grid">

                  <label class="wcm-field">

                    <span>
                      الاسم الرئيسي *
                    </span>

                    ${fieldSelect(
                      'wcm-map-name',
                      sheet.headers,
                      m.nameCol
                    )}

                  </label>

                  <label class="wcm-field">

                    <span>
                      المعرف — اختياري
                    </span>

                    ${fieldSelect(
                      'wcm-map-id',
                      sheet.headers,
                      m.idCol
                    )}

                  </label>

                  <label class="wcm-field">

                    <span>
                      الفصل / المجموعة
                    </span>

                    ${fieldSelect(
                      'wcm-map-group',
                      sheet.headers,
                      m.groupCol
                    )}

                  </label>

                </div>

                ${
                  m.mode === 'wide'
                    ? `
                      <div class="wcm-field">

                        <span>
                          أعمدة الهاتف *
                          <small>
                            يمكن اختيار أكثر من عمود
                          </small>
                        </span>

                        <div class="wcm-phone-columns">

                          ${
                            sheet.headers.map(
                              h => `
                                <label
                                  class="${phoneSelected.has(h) ? 'selected' : ''}"
                                >

                                  <input
                                    type="checkbox"
                                    class="wcm-phone-check"
                                    value="${esc(h)}"
                                    ${phoneSelected.has(h) ? 'checked' : ''}
                                  >

                                  <span>
                                    📱 ${esc(h)}
                                  </span>

                                </label>
                              `
                            ).join('')
                          }

                        </div>

                      </div>
                    `
                    : `
                      <div class="wcm-map-grid">

                        <label class="wcm-field">

                          <span>
                            عمود الهاتف *
                          </span>

                          ${fieldSelect(
                            'wcm-map-phone',
                            sheet.headers,
                            m.phoneCol
                          )}

                        </label>

                        <label class="wcm-field">

                          <span>
                            اسم جهة الاتصال
                          </span>

                          ${fieldSelect(
                            'wcm-map-contact-name',
                            sheet.headers,
                            m.contactNameCol
                          )}

                        </label>

                        <label class="wcm-field">

                          <span>
                            الصفة / العلاقة
                          </span>

                          ${fieldSelect(
                            'wcm-map-role',
                            sheet.headers,
                            m.roleCol
                          )}

                        </label>

                      </div>
                    `
                }

                ${
                  preview.error
                    ? `
                      <div class="wcm-map-error">
                        ⚠
                        ${esc(preview.error)}
                      </div>
                    `
                    : `
                      <div class="wcm-import-summary">

                        ${statTile(
                          '👤',
                          preview.records,
                          'سجل'
                        )}

                        ${statTile(
                          '📱',
                          preview.phones,
                          'رقم فريد'
                        )}

                        ${statTile(
                          '▦',
                          preview.groups,
                          'مجموعة'
                        )}

                        ${statTile(
                          '⚠',
                          preview.invalid,
                          'قيمة تحتاج مراجعة',
                          preview.invalid
                            ? 'warning'
                            : 'success'
                        )}

                      </div>
                    `
                }

              </div>

              <div class="wcm-preview-panel">

                <div class="wcm-section-title">

                  <div>

                    <h3>
                      معاينة البيانات
                    </h3>

                    <p>
                      أول 6 صفوف من الأعمدة المستخدمة.
                    </p>

                  </div>

                  <span class="wcm-chip">
                    ${sheet.rows.length}
                    صف
                  </span>

                </div>

                ${
                  sampleCols.length
                    ? `
                      <div class="wcm-table-wrap">

                        <table class="wcm-preview-table">

                          <thead>
                            <tr>
                              ${
                                sampleCols.map(
                                  c =>
                                    `<th>${esc(c)}</th>`
                                ).join('')
                              }
                            </tr>
                          </thead>

                          <tbody>

                            ${
                              sheet.rows
                                .slice(0, 6)
                                .map(
                                  r => `
                                    <tr>
                                      ${
                                        sampleCols.map(
                                          c =>
                                            `<td>${esc(clean(r[c]))}</td>`
                                        ).join('')
                                      }
                                    </tr>
                                  `
                                )
                                .join('')
                            }

                          </tbody>

                        </table>

                      </div>
                    `
                    : `
                      <div class="wcm-empty-state small">

                        <span>↔</span>

                        <b>
                          حدد الأعمدة لعرض المعاينة
                        </b>

                      </div>
                    `
                }

                <div class="wcm-smart-note">

                  <b>
                    كيف يعمل؟
                  </b>

                  <p>
                    بعد الاعتماد يحوّل السكربت أي تنسيق
                    إلى نموذج موحد داخليًا.
                    سيتم حفظ هذه المطابقة تلقائيًا
                    لنفس عناوين الأعمدة في المرة القادمة.
                  </p>

                </div>

              </div>

            </div>

          </div>

          <footer class="wcm-modal-footer">

            <div>
              <span class="wcm-dot"></span>
              لا يتم رفع الملف إلى خادم مخصص؛
              المعالجة داخل الصفحة.
            </div>

            <div>

              <button
                class="wcm-btn ghost"
                data-action="close-import"
              >
                إلغاء
              </button>

              <button
                class="wcm-btn primary"
                data-action="apply-smart-import"
                ${preview.error ? 'disabled' : ''}
              >
                اعتماد واستيراد البيانات
              </button>

            </div>

          </footer>

        </section>

      </div>
    `;
  }

  function invitePicker(studentId) {
    const student =
      S.studentById.get(
        String(studentId)
      );

    if (
      !student ||
      !student.contacts.length
    ) {
      return '';
    }

    return `
      <div
        class="wcm-modal-layer compact-layer"
        data-action="close-picker"
      >

        <section
          class="wcm-picker"
          data-picker-box
        >

          <header>

            <div>

              <span class="wcm-eyebrow">
                دعوة للقروب
              </span>

              <h3>
                ${esc(student.name)}
              </h3>

              <p>
                اختر الرقم الذي تريد فتح محادثته
                وتجهيز رسالة الدعوة له.
              </p>

            </div>

            <button
              data-action="close-picker"
            >
              ×
            </button>

          </header>

          <div class="wcm-picker-list">

            ${
              student.contacts
                .map(
                  contact => {
                    const d =
                      contactDisplay(
                        student,
                        contact
                      );

                    return `
                      <button
                        data-action="invite-contact"
                        data-phone="${esc(contact.phone)}"
                        data-student-id="${esc(student.id)}"
                      >

                        <span class="wcm-picker-avatar">
                          ☎
                        </span>

                        <div>

                          <b>
                            ${esc(d.title)}
                          </b>

                          <small>
                            ${esc(d.meta)}
                          </small>

                          ${communicationBadge(contact.phone)}

                        </div>

                        <code>
                          ${esc(formatPhone(contact.phone))}
                        </code>

                        <em>›</em>

                      </button>
                    `;
                  }
                )
                .join('')
            }

          </div>

        </section>

      </div>
    `;
  }

  function aboutDialog() {
    if (!S.aboutOpen) {
      return '';
    }

    return `
      <div
        class="wcm-modal-layer compact-layer"
        data-action="close-about"
      >

        <section
          class="wcm-about"
          data-about-box
        >

          <div class="wcm-about-top">

            <span class="wcm-about-logo">
              WA
            </span>

            <div>

              <h2>
                WhatsApp Communication Manager
              </h2>

              <p>
                مدير التواصل ومتابعة القروبات
                ·
                v${VERSION}
              </p>

            </div>

            <button
              data-action="close-about"
            >
              ×
            </button>

          </div>

          <div class="wcm-about-body">

            <p>
              أداة لتنظيم تدقيق القروبات
              وبيانات الأشخاص وجهات الاتصال
              ومتابعة التواصل مباشرة داخل WhatsApp Web.
            </p>

            <div class="wcm-rights-box">

              <b>
                تصميم وتطوير:
                ${DEVELOPER.name}
              </b>

              <span>
                ${DEVELOPER.handle}
              </span>

              <small>
                ${DEVELOPER.copyright}
              </small>

            </div>

            <div class="wcm-about-links">

              <a
                href="${DEVELOPER.greasyFork}"
                target="_blank"
                rel="noopener noreferrer"
              >
                GreasyFork
              </a>

              <a
                href="${DEVELOPER.x}"
                target="_blank"
                rel="noopener noreferrer"
              >
                X / Twitter
              </a>

              <a
                href="${DEVELOPER.snapchat}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Snapchat
              </a>

            </div>

            <p class="wcm-rights-note">
              يمنع حذف أو تغيير بيانات المصمم
              وحقوقه عند إعادة نشر السكربت.
            </p>

          </div>

        </section>

      </div>
    `;
  }

  function template() {
    const audit =
      S.audit;

    return `
      <input
        id="sga-file"
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
      >

      <header class="sga-head">

        <div class="wcm-brand">

          <span class="wcm-logo">
            WA
          </span>

          <div>

            <div class="wcm-brand-line">

              <b>
                مدير التواصل
              </b>

              <em>
                v${VERSION}
              </em>

            </div>

            <small>
              WhatsApp Communication Manager
              ·
              ${DEVELOPER.handle}
            </small>

          </div>

        </div>

        <div class="wcm-head-actions">

          <span
            class="wcm-ready ${S.ready ? 'ok' : ''}"
          >
            <i></i>
            ${
              S.ready
                ? 'واتساب جاهز'
                : 'تهيئة واتساب'
            }
          </span>

          <button
            class="wcm-head-btn"
            data-action="open-about"
          >
            عن السكربت
          </button>

          <button
            class="wcm-close"
            data-action="close"
            title="إغلاق"
          >
            ×
          </button>

        </div>

      </header>

      <div class="wcm-shell">

        <aside class="wcm-sidebar">

          <nav>

            ${navButton(
              'home',
              '⌂',
              'الرئيسية'
            )}

            ${navButton(
              'coverage',
              '✓',
              'التغطية',
              audit
                ? (
                    audit.missing.length +
                    audit.noContact.length
                  )
                : ''
            )}

            ${navButton(
              'communication',
              '◌',
              'التواصل',
              audit
                ? missingCommunicationPhones().length
                : ''
            )}

            ${navButton(
              'members',
              '👥',
              'الأعضاء',
              audit
                ? audit.unlinked.length
                : ''
            )}

            ${navButton(
              'data',
              '▦',
              'البيانات',
              S.invalidFilePhones.length ||
              ''
            )}

            ${navButton(
              'quality',
              '⇄',
              'الجودة'
            )}

          </nav>

          <div class="wcm-sidebar-bottom">

            <button
              data-action="open-about"
            >
              <span>ⓘ</span>
              <b>عن الأداة</b>
            </button>

          </div>

        </aside>

        <main class="wcm-main">
          ${renderMainView()}
        </main>

      </div>

      <footer class="wcm-rights-footer">

        <div>

          <strong>
            تصميم وتطوير:
            ${DEVELOPER.name}
            (${DEVELOPER.handle})
          </strong>

          <span>
            ${DEVELOPER.copyright}
          </span>

        </div>

        <div>

          <a
            href="${DEVELOPER.greasyFork}"
            target="_blank"
            rel="noopener noreferrer"
          >
            GreasyFork
          </a>

          <a
            href="${DEVELOPER.x}"
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>

          <a
            href="${DEVELOPER.snapchat}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Snapchat
          </a>

        </div>

      </footer>

      ${
        S.invitePickerStudentId
          ? invitePicker(
              S.invitePickerStudentId
            )
          : ''
      }

      ${importWizard()}

      ${aboutDialog()}
    `;
  }

  function render() {
    const panel =
      $(
        `#${APP.id}-panel`
      );

    if (!panel) return;

    panel.innerHTML =
      template();

    bind(panel);
  }

  function syncMappingField(
    id,
    key,
    root
  ) {
    const el =
      $(id, root);

    if (!el) return;

    el.addEventListener(
      'change',
      () => {
        if (!S.importMapping) {
          return;
        }

        S.importMapping[key] =
          el.value;

        render();
      }
    );
  }

  function bindImportWizard(root) {
    $(
      '#wcm-map-sheet',
      root
    )?.addEventListener(
      'change',
      e =>
        selectImportSheet(
          e.target.value
        )
    );

    $(
      '#wcm-usage-mode',
      root
    )?.addEventListener(
      'change',
      e => {
        S.usageMode =
          e.target.value;

        render();
      }
    );

    $(
      '#wcm-map-mode',
      root
    )?.addEventListener(
      'change',
      e => {
        S.importMapping.mode =
          e.target.value;

        render();
      }
    );

    syncMappingField(
      '#wcm-map-name',
      'nameCol',
      root
    );

    syncMappingField(
      '#wcm-map-id',
      'idCol',
      root
    );

    syncMappingField(
      '#wcm-map-group',
      'groupCol',
      root
    );

    syncMappingField(
      '#wcm-map-phone',
      'phoneCol',
      root
    );

    syncMappingField(
      '#wcm-map-contact-name',
      'contactNameCol',
      root
    );

    syncMappingField(
      '#wcm-map-role',
      'roleCol',
      root
    );

    $$(
      '.wcm-phone-check',
      root
    ).forEach(
      cb =>
        cb.addEventListener(
          'change',
          () => {
            S.importMapping.phoneCols =
              $$(
                '.wcm-phone-check:checked',
                root
              )
                .map(
                  x =>
                    x.value
                );

            render();
          }
        )
    );
  }

  function bind(root) {
    $$(
      '[data-action]',
      root
    ).forEach(
      element => {
        element.addEventListener(
          'click',
          async event => {
            const action =
              event.currentTarget
                .dataset
                .action;

            if (
              action ===
              'close'
            ) {
              closePanel();
            }

            else if (
              action ===
              'file'
            ) {
              $(
                '#sga-file',
                root
              )?.click();
            }

            else if (
              action ===
              'capture'
            ) {
              await captureGroup();
            }

            else if (
              action ===
              'audit'
            ) {
              runAudit();
            }

            else if (
              action ===
              'scan-communication'
            ) {
              await scanCommunication();
            }

            else if (
              action ===
              'copy-missing'
            ) {
              copyMissing();
            }

            else if (
              action ===
              'copy-phones'
            ) {
              copyMissingPhones();
            }

            else if (
              action ===
              'copy-all-unlinked'
            ) {
              copyAllUnlinked();
            }

            else if (
              action ===
              'export'
            ) {
              exportExcel();
            }

            else if (
              action ===
              'copy-group-link'
            ) {
              await ensureGroupInviteLink({
                copyLink:
                  true,
              });
            }

            else if (
              action ===
              'copy-phone'
            ) {
              copy(
                formatPhone(
                  event.currentTarget
                    .dataset
                    .phone
                ),
                'تم نسخ الرقم'
              );
            }

            else if (
              action ===
              'copy-raw'
            ) {
              copy(
                event.currentTarget
                  .dataset
                  .value ||
                  '',
                'تم نسخ القيمة'
              );
            }

            else if (
              action ===
              'invite-student'
            ) {
              S.invitePickerStudentId =
                event.currentTarget
                  .dataset
                  .studentId ||
                '';

              render();
            }

            else if (
              action ===
              'invite-contact'
            ) {
              await openInviteChat(
                event.currentTarget
                  .dataset
                  .phone,

                event.currentTarget
                  .dataset
                  .studentId
              );
            }

            else if (
              action ===
              'open-about'
            ) {
              S.aboutOpen =
                true;

              render();
            }

            else if (
              action ===
              'close-about'
            ) {
              if (
                event.currentTarget
                  .classList
                  .contains(
                    'wcm-modal-layer'
                  ) &&
                event.target !==
                  event.currentTarget
              ) {
                return;
              }

              S.aboutOpen =
                false;

              render();
            }

            else if (
              action ===
              'close-import'
            ) {
              S.importWizardOpen =
                false;

              render();
            }

            else if (
              action ===
              'apply-smart-import'
            ) {
              applySmartImport();
            }

            else if (
              action ===
              'close-picker'
            ) {
              if (
                event.currentTarget
                  .classList
                  .contains(
                    'wcm-modal-layer'
                  ) &&
                event.target !==
                  event.currentTarget
              ) {
                return;
              }

              S.invitePickerStudentId =
                '';

              render();
            }

            else if (
              action ===
              'add-ex'
            ) {
              const phone =
                event.currentTarget
                  .dataset
                  .phone;

              const label =
                prompt(
                  'وصف الاستثناء، مثال: معلم الفصل أو المرشد الطلابي',
                  'معلم/إداري'
                );

              if (
                label?.trim()
              ) {
                setException(
                  phone,
                  label.trim()
                );

                runAudit();
              }
            }

            else if (
              action ===
              'del-ex'
            ) {
              setException(
                event.currentTarget
                  .dataset
                  .phone,
                ''
              );

              runAudit();
            }
          }
        );
      }
    );

    $$(
      '[data-view]',
      root
    ).forEach(
      button =>
        button.addEventListener(
          'click',
          () => {
            S.view =
              button.dataset.view;

            if (
              button.dataset.coverage
            ) {
              S.coverageFilter =
                button.dataset.coverage;
            }

            if (
              button.dataset.memberFilter
            ) {
              S.memberFilter =
                button.dataset
                  .memberFilter;
            }

            render();
          }
        )
    );

    $$(
      '[data-coverage-filter]',
      root
    ).forEach(
      button =>
        button.addEventListener(
          'click',
          () => {
            S.coverageFilter =
              button.dataset
                .coverageFilter;

            render();
          }
        )
    );

    $$(
      '[data-member-filter]',
      root
    ).forEach(
      button =>
        button.addEventListener(
          'click',
          () => {
            S.memberFilter =
              button.dataset
                .memberFilter;

            render();
          }
        )
    );

    $$(
      '[data-communication-filter]',
      root
    ).forEach(
      button =>
        button.addEventListener(
          'click',
          () => {
            S.communicationFilter =
              button.dataset
                .communicationFilter;

            render();
          }
        )
    );

    $(
      '#sga-file',
      root
    )?.addEventListener(
      'change',
      event => {
        const file =
          event.target
            .files?.[0];

        if (file) {
          importFile(file);
        }

        event.target.value =
          '';
      }
    );

    $(
      '#sga-class',
      root
    )?.addEventListener(
      'change',
      event => {
        S.selectedClass =
          event.target.value;

        if (
          S.members.length
        ) {
          runAudit();
        }

        else {
          render();
        }
      }
    );

    bindImportWizard(root);
    bindPanelDrag(root);
  }

  // =========================================================
  // النافذة العائمة القابلة للتحريك
  // =========================================================

  function panelPositionKey() {
    return (
      `${APP.store}` +
      'floating-position'
    );
  }

  function savedPanelPosition() {
    try {
      return JSON.parse(
        localStorage.getItem(
          panelPositionKey()
        ) ||
        'null'
      );
    }

    catch (_) {
      return null;
    }
  }

  function savePanelPosition(panel) {
    if (!panel) return;

    const rect =
      panel.getBoundingClientRect();

    localStorage.setItem(
      panelPositionKey(),
      JSON.stringify({
        left:
          Math.round(
            rect.left
          ),

        top:
          Math.round(
            rect.top
          ),
      })
    );
  }

  function clampPanelPosition(
    panel,
    left,
    top
  ) {
    const margin = 8;

    const maxLeft =
      Math.max(
        margin,
        window.innerWidth -
        panel.offsetWidth -
        margin
      );

    const maxTop =
      Math.max(
        margin,
        window.innerHeight -
        panel.offsetHeight -
        margin
      );

    return {
      left:
        Math.min(
          Math.max(
            margin,
            left
          ),
          maxLeft
        ),

      top:
        Math.min(
          Math.max(
            margin,
            top
          ),
          maxTop
        ),
    };
  }

  function applyPanelPosition(panel) {
    if (!panel) return;

    if (
      window.innerWidth <=
      640
    ) {
      panel.style.left =
        '';

      panel.style.top =
        '';

      return;
    }

    const saved =
      savedPanelPosition();

    const fallbackLeft =
      Math.max(
        20,
        window.innerWidth -
        panel.offsetWidth -
        30
      );

    const fallbackTop =
      55;

    const pos =
      clampPanelPosition(
        panel,

        Number(
          saved?.left ??
          fallbackLeft
        ),

        Number(
          saved?.top ??
          fallbackTop
        )
      );

    panel.style.left =
      `${pos.left}px`;

    panel.style.top =
      `${pos.top}px`;
  }

  function bindPanelDrag(root) {
    const panel =
      root;

    const handle =
      $('.sga-head', root);

    if (
      !panel ||
      !handle ||
      handle.dataset
        .dragBound ===
        '1'
    ) {
      return;
    }

    handle.dataset.dragBound =
      '1';

    handle.addEventListener(
      'pointerdown',
      event => {
        if (
          window.innerWidth <=
          640 ||
          event.button !==
          0
        ) {
          return;
        }

        if (
          event.target.closest(
            'button, input, select, a'
          )
        ) {
          return;
        }

        event.preventDefault();

        const rect =
          panel
            .getBoundingClientRect();

        const startX =
          event.clientX;

        const startY =
          event.clientY;

        const startLeft =
          rect.left;

        const startTop =
          rect.top;

        handle.classList
          .add('dragging');

        handle
          .setPointerCapture?.(
            event.pointerId
          );

        const move =
          moveEvent => {
            const pos =
              clampPanelPosition(
                panel,

                startLeft +
                (
                  moveEvent.clientX -
                  startX
                ),

                startTop +
                (
                  moveEvent.clientY -
                  startY
                )
              );

            panel.style.left =
              `${pos.left}px`;

            panel.style.top =
              `${pos.top}px`;
          };

        const up =
          upEvent => {
            handle.classList
              .remove(
                'dragging'
              );

            handle
              .releasePointerCapture?.(
                upEvent.pointerId
              );

            document
              .removeEventListener(
                'pointermove',
                move
              );

            document
              .removeEventListener(
                'pointerup',
                up
              );

            document
              .removeEventListener(
                'pointercancel',
                up
              );

            savePanelPosition(
              panel
            );
          };

        document
          .addEventListener(
            'pointermove',
            move
          );

        document
          .addEventListener(
            'pointerup',
            up
          );

        document
          .addEventListener(
            'pointercancel',
            up
          );
      }
    );
  }

  // =========================================================
  // Panel / Launcher
  // =========================================================

  function openPanel() {
    S.panelOpen =
      true;

    let panel =
      $(
        `#${APP.id}-panel`
      );

    if (!panel) {
      panel =
        document
          .createElement(
            'aside'
          );

      panel.id =
        `${APP.id}-panel`;

      panel.className =
        'sga-panel';

      document.body
        .appendChild(panel);
    }

    panel.classList
      .add('open');

    S.lastChatId =
      activeChat()?.id ||
      '';

    render();

    requestAnimationFrame(
      () =>
        applyPanelPosition(
          panel
        )
    );
  }

  function closePanel() {
    S.panelOpen =
      false;

    $(
      `#${APP.id}-panel`
    )?.classList
      .remove('open');
  }

  function launcher() {
    if (
      $(
        `#${APP.id}-launcher`
      )
    ) {
      return;
    }

    const button =
      document
        .createElement(
          'button'
        );

    button.id =
      `${APP.id}-launcher`;

    button.className =
      'sga-launcher';

    button.innerHTML = `
      <span>◉</span>
      <b>مدير التواصل</b>
    `;

    button.title =
      'WhatsApp Communication Manager | مدير التواصل';

    button.addEventListener(
      'click',
      () =>
        S.panelOpen
          ? closePanel()
          : openPanel()
    );

    document.body
      .appendChild(button);
  }

  // =========================================================
  // Busy / Toast
  // =========================================================

  function busy(
    on,
    text = ''
  ) {
    let overlay =
      $(
        `#${APP.id}-busy`
      );

    if (!on) {
      overlay?.remove();
      return;
    }

    if (!overlay) {
      overlay =
        document
          .createElement(
            'div'
          );

      overlay.id =
        `${APP.id}-busy`;

      overlay.className =
        'sga-busy';

      overlay.innerHTML = `
        <div class="sga-spinner"></div>
        <b id="sga-busy-text"></b>
      `;

      document.body
        .appendChild(
          overlay
        );
    }

    busyText(
      text ||
      'جارٍ التنفيذ…'
    );
  }

  function busyText(text) {
    const element =
      $(
        '#sga-busy-text'
      );

    if (element) {
      element.textContent =
        text;
    }
  }

  function toast(
    message,
    type = 'info'
  ) {
    $(
      `#${APP.id}-toast`
    )?.remove();

    const element =
      document
        .createElement(
          'div'
        );

    element.id =
      `${APP.id}-toast`;

    element.className =
      `sga-toast ${type}`;

    element.textContent =
      message;

    document.body
      .appendChild(
        element
      );

    requestAnimationFrame(
      () =>
        element.classList
          .add('show')
    );

    setTimeout(
      () => {
        element.classList
          .remove('show');

        setTimeout(
          () =>
            element.remove(),
          250
        );
      },
      3200
    );
  }

  // =========================================================
  // CSS v0.5.0
  // =========================================================

  function styles() {
    if (
      $(
        `#${APP.id}-styles`
      )
    ) {
      return;
    }

    const style =
      document
        .createElement(
          'style'
        );

    style.id =
      `${APP.id}-styles`;

    style.textContent = `
      :root{
        --wcm-bg:#0b141a;
        --wcm-panel:#111b21;
        --wcm-card:#17232a;
        --wcm-card2:#1d2b32;
        --wcm-line:#2b3b44;
        --wcm-text:#edf2f4;
        --wcm-muted:#8fa1aa;
        --wcm-green:#16a085;
        --wcm-green2:#20c997;
        --wcm-red:#ef6b73;
        --wcm-yellow:#e9b95f;
        --wcm-blue:#66a9ff;
        --wcm-purple:#a78bfa;
      }

      .sga-launcher{
        position:fixed;
        left:18px;
        bottom:18px;
        z-index:2147483600;
        border:0;
        border-radius:999px;
        background:linear-gradient(
          135deg,
          #0f9f83,
          #08786c
        );
        color:#fff;
        padding:11px 16px;
        display:flex;
        align-items:center;
        gap:9px;
        box-shadow:0 14px 38px #0007;
        cursor:pointer;
        font:700 13px "Segoe UI",Tahoma,Arial;
      }

      .sga-launcher span{
        font-size:17px;
      }

      .sga-launcher:hover{
        filter:brightness(1.08);
      }

      .sga-panel{
        position:fixed;
        top:45px;
        left:28px;
        right:auto;
        bottom:auto;
        width:min(
          980px,
          calc(100vw - 48px)
        );
        height:min(
          760px,
          calc(100vh - 76px)
        );
        z-index:2147483601;
        background:var(--wcm-panel);
        color:var(--wcm-text);
        font-family:"Segoe UI",Tahoma,Arial;
        direction:rtl;
        border:1px solid #33464f;
        border-radius:20px;
        overflow:hidden;
        display:none;
        flex-direction:column;
        box-shadow:0 28px 90px #000a;
      }

      .sga-panel.open{
        display:flex;
      }

      .sga-panel *{
        box-sizing:border-box;
      }

      .sga-head{
        flex:0 0 auto;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        padding:12px 14px 12px 16px;
        background:linear-gradient(
          180deg,
          #101d23,
          #0c171d
        );
        border-bottom:1px solid var(--wcm-line);
        cursor:grab;
        user-select:none;
        touch-action:none;
      }

      .sga-head.dragging{
        cursor:grabbing;
      }

      .wcm-brand{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }

      .wcm-logo{
        width:39px;
        height:39px;
        border-radius:12px;
        display:grid;
        place-items:center;
        background:linear-gradient(
          135deg,
          #19b495,
          #087a6e
        );
        color:#fff;
        font-weight:900;
        font-size:12px;
        box-shadow:inset 0 0 0 1px #ffffff20;
      }

      .wcm-brand-line{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .wcm-brand-line b{
        font-size:16px;
      }

      .wcm-brand-line em{
        font-style:normal;
        font-size:9px;
        padding:3px 7px;
        border-radius:999px;
        background:#1f5148;
        color:#8ce0cb;
        border:1px solid #2b6b60;
      }

      .wcm-brand small{
        display:block;
        color:var(--wcm-muted);
        font-size:10px;
        margin-top:2px;
      }

      .wcm-head-actions{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .wcm-ready{
        display:inline-flex;
        align-items:center;
        gap:6px;
        color:#c89e53;
        font-size:10px;
        background:#59451f45;
        border:1px solid #66532d;
        border-radius:999px;
        padding:6px 9px;
      }

      .wcm-ready i{
        width:7px;
        height:7px;
        border-radius:50%;
        background:#d0a247;
      }

      .wcm-ready.ok{
        color:#82d7c2;
        background:#0d5c4a35;
        border-color:#286759;
      }

      .wcm-ready.ok i{
        background:#2fd1aa;
        box-shadow:0 0 0 3px #2fd1aa18;
      }

      .wcm-head-btn,
      .wcm-close{
        border:1px solid #31434d;
        background:#17252c;
        color:#c9d3d8;
        border-radius:9px;
        height:32px;
        cursor:pointer;
        font:700 10px "Segoe UI";
      }

      .wcm-head-btn{
        padding:0 10px;
      }

      .wcm-close{
        width:34px;
        font-size:20px;
      }

      .wcm-head-btn:hover,
      .wcm-close:hover{
        background:#20323a;
      }

      .wcm-shell{
        min-height:0;
        flex:1;
        display:grid;
        grid-template-columns:
          112px
          minmax(0,1fr);
      }

      .wcm-sidebar{
        border-left:1px solid var(--wcm-line);
        background:#0d181e;
        padding:12px 8px 10px;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        min-height:0;
      }

      .wcm-sidebar nav{
        display:grid;
        gap:5px;
      }

      .wcm-nav-btn,
      .wcm-sidebar-bottom button{
        position:relative;
        border:0;
        background:transparent;
        color:#8fa1aa;
        border-radius:11px;
        min-height:56px;
        padding:8px 5px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:3px;
        cursor:pointer;
        font-family:inherit;
      }

      .wcm-nav-btn span,
      .wcm-sidebar-bottom span{
        font-size:17px;
      }

      .wcm-nav-btn b,
      .wcm-sidebar-bottom b{
        font-size:9px;
      }

      .wcm-nav-btn em{
        position:absolute;
        top:5px;
        left:7px;
        min-width:17px;
        height:17px;
        padding:0 4px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:#34464f;
        color:#d9e1e4;
        font-style:normal;
        font-size:8px;
      }

      .wcm-nav-btn.active{
        background:linear-gradient(
          135deg,
          #0f4d43,
          #11372f
        );
        color:#a1ead7;
        box-shadow:inset 0 0 0 1px #256b5d;
      }

      .wcm-nav-btn.active em{
        background:#1ea687;
        color:white;
      }

      .wcm-nav-btn:hover,
      .wcm-sidebar-bottom button:hover{
        background:#16252c;
        color:#dce5e8;
      }

      .wcm-sidebar-bottom{
        border-top:1px solid #22323a;
        padding-top:7px;
      }

      .wcm-main{
        min-width:0;
        overflow:auto;
        padding:18px;
        background:
          radial-gradient(
            circle at 80% 0%,
            #15332d45,
            transparent 30%
          ),
          #101a20;
      }

      .wcm-rights-footer{
        flex:0 0 auto;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:8px 13px;
        background:#0b151a;
        border-top:1px solid var(--wcm-line);
        font-size:9px;
        color:#71828b;
      }

      .wcm-rights-footer strong{
        color:#9db0b8;
        font-weight:700;
      }

      .wcm-rights-footer span{
        display:block;
        margin-top:2px;
      }

      .wcm-rights-footer>div:last-child{
        display:flex;
        gap:9px;
      }

      .wcm-rights-footer a{
        color:#55b9a5;
        text-decoration:none;
        font-weight:700;
      }

      .wcm-eyebrow{
        display:block;
        color:#53bda7;
        font-size:9px;
        font-weight:800;
        letter-spacing:.5px;
        margin-bottom:4px;
      }

      .wcm-page-head{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:16px;
        margin-bottom:14px;
      }

      .wcm-page-head h2,
      .wcm-welcome h2,
      .wcm-hero-card h2{
        margin:0;
        color:#f3f7f8;
      }

      .wcm-page-head h2{
        font-size:21px;
      }

      .wcm-page-head p,
      .wcm-hero-card p,
      .wcm-welcome p{
        margin:5px 0 0;
        color:var(--wcm-muted);
        font-size:11px;
        line-height:1.7;
      }

      .wcm-btn{
        border:0;
        border-radius:10px;
        padding:9px 13px;
        cursor:pointer;
        font:800 10px "Segoe UI";
        white-space:nowrap;
      }

      .wcm-btn.primary{
        background:linear-gradient(
          135deg,
          #17a88b,
          #0e7b6a
        );
        color:#fff;
      }

      .wcm-btn.ghost{
        background:#1b2930;
        color:#d5dfe3;
        border:1px solid #344751;
      }

      .wcm-btn:disabled{
        opacity:.4;
        cursor:not-allowed;
      }

      .wcm-mini{
        border:1px solid #354850;
        background:#1a2930;
        color:#cbd7db;
        border-radius:8px;
        padding:6px 9px;
        cursor:pointer;
        font:700 9px "Segoe UI";
        white-space:nowrap;
      }

      .wcm-mini.primary{
        background:#0c6f5f;
        border-color:#278b79;
        color:#fff;
      }

      .wcm-mini.danger{
        color:#f5a5aa;
        border-color:#754147;
        background:#3e2529;
      }

      .wcm-mini:hover,
      .wcm-btn:hover{
        filter:brightness(1.07);
      }

      .wcm-welcome{
        min-height:470px;
        display:grid;
        grid-template-columns:
          170px
          minmax(0,1fr);
        align-items:center;
        gap:28px;
        padding:44px;
        border:1px solid #2b3d45;
        border-radius:22px;
        background:linear-gradient(
          135deg,
          #15272d,
          #101b20 58%,
          #12332d
        );
      }

      .wcm-welcome-mark{
        width:150px;
        height:150px;
        border-radius:36px;
        display:grid;
        place-items:center;
        font-weight:900;
        font-size:38px;
        background:linear-gradient(
          135deg,
          #19b597,
          #0d7469
        );
        color:#fff;
        box-shadow:
          0 28px 70px #0006,
          inset 0 0 0 1px #ffffff20;
      }

      .wcm-welcome h2{
        font-size:28px;
        line-height:1.35;
        max-width:610px;
      }

      .wcm-welcome-copy>p{
        max-width:650px;
        font-size:12px;
      }

      .wcm-welcome-actions{
        display:flex;
        gap:8px;
        margin-top:18px;
      }

      .wcm-feature-row{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-top:18px;
      }

      .wcm-feature-row span{
        padding:6px 9px;
        border-radius:999px;
        background:#0c171d88;
        border:1px solid #30434b;
        color:#9db1b9;
        font-size:9px;
      }

      .wcm-dataset-bar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        background:#142229;
        border:1px solid #2a3d46;
        border-radius:12px;
        padding:9px 11px;
        margin-bottom:11px;
      }

      .wcm-dataset-title{
        display:flex;
        align-items:center;
        gap:9px;
        min-width:0;
      }

      .wcm-file-icon{
        width:32px;
        height:32px;
        border-radius:9px;
        background:#1d3c38;
        display:grid;
        place-items:center;
        color:#79d6c0;
        font-size:16px;
      }

      .wcm-dataset-title b,
      .wcm-dataset-title small{
        display:block;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .wcm-dataset-title b{
        font-size:11px;
      }

      .wcm-dataset-title small{
        font-size:9px;
        color:var(--wcm-muted);
        margin-top:2px;
      }

      .wcm-hero-card,
      .wcm-card,
      .wcm-action-center{
        background:linear-gradient(
          180deg,
          #17252c,
          #142128
        );
        border:1px solid #2b3e47;
        border-radius:16px;
        padding:15px;
        margin-bottom:12px;
      }

      .wcm-hero-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
      }

      .wcm-hero-card h2{
        font-size:23px;
      }

      .wcm-hero-symbol{
        width:76px;
        height:76px;
        border-radius:24px;
        background:#0f332e;
        border:1px solid #29554c;
        display:grid;
        place-items:center;
        color:#63cbb4;
        font-size:34px;
      }

      .wcm-ring{
        --p:0;
        width:82px;
        height:82px;
        border-radius:50%;
        display:grid;
        place-items:center;
        background:conic-gradient(
          #20bd9d calc(var(--p)*1%),
          #263941 0
        );
        position:relative;
      }

      .wcm-ring:after{
        content:"";
        position:absolute;
        inset:7px;
        border-radius:50%;
        background:#17252c;
      }

      .wcm-ring span{
        position:relative;
        z-index:1;
        font-size:16px;
        font-weight:900;
      }

      .wcm-setup-row{
        display:grid;
        grid-template-columns:
          minmax(180px,1fr)
          minmax(220px,1.25fr)
          auto;
        gap:8px;
        align-items:end;
        margin-top:14px;
        padding-top:13px;
        border-top:1px solid #283943;
      }

      .wcm-field{
        display:grid;
        gap:5px;
      }

      .wcm-field>span{
        font-size:9px;
        color:#8fa1aa;
        font-weight:700;
      }

      .wcm-field>span small{
        font-weight:500;
        color:#657880;
      }

      .wcm-select{
        width:100%;
        height:36px;
        border:1px solid #344851;
        background:#0f1b21;
        color:#dce5e8;
        border-radius:9px;
        padding:0 9px;
        font:600 10px "Segoe UI";
        outline:none;
      }

      .wcm-select:focus{
        border-color:#278b79;
        box-shadow:0 0 0 3px #16a08518;
      }

      .wcm-current-chat{
        min-height:54px;
        border:1px solid #34464f;
        background:#0f1b21;
        border-radius:10px;
        padding:7px 9px;
      }

      .wcm-current-chat span,
      .wcm-current-chat small{
        display:block;
        color:#7e9099;
        font-size:8px;
      }

      .wcm-current-chat b{
        display:block;
        font-size:10px;
        margin:2px 0;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .wcm-current-chat.ok{
        border-color:#286658;
        background:#0e211e;
      }

      .wcm-capture{
        height:54px;
      }

      .wcm-group-line{
        margin-top:9px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        background:#0e191f;
        border-radius:10px;
        padding:8px 10px;
      }

      .wcm-group-line span{
        display:block;
        color:#74868e;
        font-size:8px;
      }

      .wcm-group-line b{
        display:block;
        font-size:10px;
        margin-top:2px;
      }

      .wcm-group-actions{
        display:flex;
        gap:6px;
      }

      .wcm-stats-grid{
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );
        gap:8px;
        margin-bottom:12px;
      }

      .wcm-stats-grid.compact{
        margin-top:2px;
      }

      .wcm-stat{
        min-width:0;
        background:#152229;
        border:1px solid #2a3b44;
        border-radius:13px;
        padding:11px;
        display:flex;
        align-items:center;
        gap:9px;
      }

      .wcm-stat-icon{
        width:31px;
        height:31px;
        border-radius:9px;
        display:grid;
        place-items:center;
        background:#22333b;
        color:#9fb0b7;
        font-weight:900;
      }

      .wcm-stat b,
      .wcm-stat small{
        display:block;
      }

      .wcm-stat b{
        font-size:18px;
      }

      .wcm-stat small{
        font-size:8px;
        color:#81939c;
        margin-top:1px;
      }

      .wcm-stat.success .wcm-stat-icon{
        background:#123b33;
        color:#64d7ba;
      }

      .wcm-stat.success b{
        color:#7de1c7;
      }

      .wcm-stat.danger .wcm-stat-icon{
        background:#44282c;
        color:#f18b92;
      }

      .wcm-stat.danger b{
        color:#f6a1a6;
      }

      .wcm-stat.warning .wcm-stat-icon{
        background:#453820;
        color:#f0c673;
      }

      .wcm-stat.warning b{
        color:#f0c673;
      }

      .wcm-stat.accent .wcm-stat-icon{
        background:#243850;
        color:#81b9ff;
      }

      .wcm-stat.accent b{
        color:#8fc1ff;
      }

      .wcm-section-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:10px;
      }

      .wcm-section-title h3{
        margin:0;
        font-size:13px;
      }

      .wcm-section-title p{
        margin:3px 0 0;
        color:#7f9199;
        font-size:9px;
      }

      .wcm-count{
        min-width:28px;
        height:28px;
        border-radius:9px;
        background:#263941;
        display:grid;
        place-items:center;
        font-size:10px;
        font-weight:800;
      }

      .wcm-chip{
        padding:5px 8px;
        border-radius:999px;
        background:#1d3435;
        border:1px solid #31504f;
        color:#8fd2c5;
        font-size:8px;
        font-weight:800;
      }

      .wcm-action-list{
        display:grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          );
        gap:7px;
      }

      .wcm-action-item{
        border:1px solid #2b3c44;
        background:#111e24;
        color:#dce5e8;
        border-radius:12px;
        padding:10px;
        display:grid;
        grid-template-columns:
          34px
          minmax(0,1fr)
          18px;
        align-items:center;
        gap:9px;
        text-align:right;
        cursor:pointer;
      }

      .wcm-action-item.hot{
        border-color:#3e544f;
        background:#142623;
      }

      .wcm-action-icon{
        width:34px;
        height:34px;
        border-radius:10px;
        background:#213139;
        display:grid;
        place-items:center;
      }

      .wcm-action-item b,
      .wcm-action-item small{
        display:block;
      }

      .wcm-action-item b{
        font-size:10px;
      }

      .wcm-action-item small{
        font-size:8px;
        color:#7f9199;
        line-height:1.5;
        margin-top:2px;
      }

      .wcm-action-item em{
        font-style:normal;
        color:#647982;
        font-size:18px;
      }

      .wcm-action-item:hover{
        border-color:#3d5c58;
        background:#182a28;
      }

      .wcm-empty-state{
        min-height:250px;
        border:1px dashed #35474f;
        border-radius:16px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:26px;
        color:#80929a;
      }

      .wcm-empty-state span{
        font-size:31px;
        color:#55b9a5;
      }

      .wcm-empty-state b{
        color:#d8e1e4;
        font-size:13px;
        margin-top:8px;
      }

      .wcm-empty-state p{
        max-width:430px;
        font-size:10px;
        line-height:1.7;
      }

      .wcm-empty-state.small{
        min-height:140px;
      }

      .wcm-good-empty{
        padding:18px;
        border:1px solid #295a50;
        background:#0f2a24;
        border-radius:12px;
        color:#7edbc5;
        text-align:center;
        font-size:10px;
      }

      .wcm-muted{
        color:#71838b;
        font-size:9px;
      }

      .wcm-segment{
        display:flex;
        border:1px solid #33464e;
        background:#101d23;
        padding:3px;
        border-radius:10px;
      }

      .wcm-segment button{
        border:0;
        background:transparent;
        color:#8c9da5;
        border-radius:7px;
        padding:7px 10px;
        font:700 9px "Segoe UI";
        cursor:pointer;
      }

      .wcm-segment button.active{
        background:#1b574d;
        color:#a2e8d7;
      }

      .wcm-segment em,
      .wcm-filter-row em{
        font-style:normal;
        margin-right:4px;
        background:#283b43;
        border-radius:999px;
        padding:1px 5px;
        font-size:8px;
      }

      .wcm-toolbar{
        display:flex;
        gap:6px;
        flex-wrap:wrap;
        margin-bottom:9px;
      }

      .wcm-person-list{
        display:grid;
        gap:8px;
      }

      .wcm-person-card{
        border:1px solid #2c3e46;
        background:#142229;
        border-radius:14px;
        overflow:hidden;
      }

      .wcm-person-card.missing{
        border-right:3px solid #c55760;
      }

      .wcm-person-card.covered{
        border-right:3px solid #258a75;
      }

      .wcm-person-card.no-phone{
        border-right:3px solid #657880;
      }

      .wcm-person-card>header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 11px;
        background:#16252c;
      }

      .wcm-person-id{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .wcm-person-id>span{
        width:24px;
        height:24px;
        border-radius:8px;
        background:#23343c;
        display:grid;
        place-items:center;
        color:#91a2aa;
        font-size:9px;
      }

      .wcm-person-id button{
        border:0;
        background:none;
        color:#edf2f4;
        padding:0;
        font:800 11px "Segoe UI";
        cursor:pointer;
        text-align:right;
      }

      .wcm-person-id small{
        display:block;
        color:#7c8e96;
        font-size:8px;
        margin-top:2px;
      }

      .wcm-status-badge{
        display:inline-flex;
        align-items:center;
        border-radius:999px;
        padding:4px 7px;
        font-size:8px;
        font-weight:800;
        border:1px solid #3b4d55;
        color:#9cacb3;
      }

      .wcm-status-badge.missing,
      .wcm-status-badge.unlinked{
        color:#f09ca1;
        border-color:#704048;
        background:#44262b;
      }

      .wcm-status-badge.covered,
      .wcm-status-badge.linked{
        color:#79dbc4;
        border-color:#2b695c;
        background:#12352f;
      }

      .wcm-status-badge.no-phone,
      .wcm-status-badge.unresolved{
        color:#aeb9be;
      }

      .wcm-status-badge.other{
        color:#91bded;
        border-color:#3d5f83;
        background:#1d3248;
      }

      .wcm-status-badge.exception,
      .wcm-status-badge.self{
        color:#c2b7e8;
        border-color:#574e79;
        background:#2f2944;
      }

      .wcm-contact-list{
        padding:5px 10px 10px;
      }

      .wcm-contact-row{
        display:grid;
        grid-template-columns:
          28px
          minmax(0,1fr)
          minmax(145px,auto)
          auto;
        align-items:center;
        gap:8px;
        padding:7px 0;
        border-bottom:1px solid #25353d;
      }

      .wcm-contact-row:last-child{
        border:0;
      }

      .wcm-contact-row.hit{
        background:#0f2a241f;
      }

      .wcm-contact-icon{
        width:27px;
        height:27px;
        border-radius:9px;
        display:grid;
        place-items:center;
        background:#22323a;
        color:#8ea0a8;
      }

      .wcm-contact-row.hit .wcm-contact-icon{
        background:#153a33;
        color:#70d9bf;
      }

      .wcm-contact-copy b,
      .wcm-contact-copy small{
        display:block;
      }

      .wcm-contact-copy b{
        font-size:9px;
      }

      .wcm-contact-copy small{
        font-size:7.5px;
        color:#788a92;
      }

      .wcm-phone-wrap{
        text-align:left;
        direction:ltr;
      }

      .wcm-phone-wrap code,
      .wcm-big-phone,
      .wcm-member-card code,
      .wcm-shared-row code{
        font:700 9px Consolas,monospace;
        color:#c3d1d6;
      }

      .wcm-no-contact{
        padding:12px;
        color:#8799a1;
        font-size:9px;
      }

      .sga-comm-badge,
      .wcm-comm-badge{
        display:inline-flex!important;
        width:max-content;
        max-width:100%;
        margin-top:3px;
        padding:2px 5px;
        border-radius:999px;
        font-size:7px!important;
        border:1px solid #3a4c54;
        background:#111c22;
        color:#899ba3;
        direction:rtl;
      }

      .sga-comm-badge.contacted{
        color:#78dfc4;
        border-color:#287a68;
        background:#00a88412;
      }

      .sga-comm-badge.new{
        color:#f2c56f;
        border-color:#7b6131;
        background:#f0b84c12;
      }

      .sga-comm-badge.error{
        color:#f29a9a;
        border-color:#7b4141;
      }

      .wcm-filter-row{
        display:flex;
        gap:5px;
        overflow:auto;
        padding-bottom:9px;
      }

      .wcm-filter-row button{
        border:1px solid #33464e;
        background:#142229;
        color:#8799a1;
        border-radius:999px;
        padding:6px 9px;
        font:700 8px "Segoe UI";
        cursor:pointer;
        white-space:nowrap;
      }

      .wcm-filter-row button.active{
        border-color:#2d7769;
        background:#123a32;
        color:#8ce2cd;
      }

      .wcm-contact-audit-list,
      .wcm-member-list{
        display:grid;
        gap:7px;
      }

      .wcm-contact-audit,
      .wcm-member-card{
        border:1px solid #2c3d45;
        background:#142229;
        border-radius:13px;
        padding:10px;
      }

      .wcm-contact-audit.contacted{
        border-right:3px solid #278d75;
      }

      .wcm-contact-audit.new{
        border-right:3px solid #c08b37;
      }

      .wcm-contact-audit.error{
        border-right:3px solid #a65050;
      }

      .wcm-contact-audit-top,
      .wcm-member-top{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
      }

      .wcm-contact-audit-top small{
        display:block;
        color:#75878f;
        font-size:8px;
        margin-top:2px;
      }

      .wcm-contact-audit p,
      .wcm-member-card p{
        margin:7px 0;
        color:#a9b7bc;
        font-size:9px;
        line-height:1.55;
      }

      .wcm-last{
        display:block;
        color:#72c9b4;
        font-size:8px;
      }

      .wcm-contact-audit footer,
      .wcm-member-card footer{
        display:flex;
        gap:5px;
        margin-top:7px;
      }

      .wcm-member-main{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .wcm-avatar{
        width:31px;
        height:31px;
        border-radius:10px;
        background:#22343c;
        display:grid;
        place-items:center;
        color:#9cb0b8;
        font-weight:900;
      }

      .wcm-member-main b,
      .wcm-member-main code{
        display:block;
      }

      .wcm-member-main b{
        font-size:10px;
      }

      .wcm-member-main code{
        margin-top:3px;
      }

      .wcm-outside{
        color:#89afd6!important;
      }

      .wcm-meta-grid{
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );
        gap:6px;
      }

      .wcm-meta-grid>div{
        padding:9px;
        background:#101d23;
        border:1px solid #293a42;
        border-radius:10px;
        min-width:0;
      }

      .wcm-meta-grid span,
      .wcm-meta-grid b{
        display:block;
      }

      .wcm-meta-grid span{
        font-size:8px;
        color:#788a92;
      }

      .wcm-meta-grid b{
        font-size:10px;
        margin-top:3px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .wcm-review-list{
        display:grid;
        gap:5px;
      }

      .wcm-review-row{
        display:grid;
        grid-template-columns:
          24px
          minmax(0,1fr)
          120px
          auto;
        align-items:center;
        gap:7px;
        background:#111e24;
        border:1px solid #283942;
        border-radius:9px;
        padding:7px;
      }

      .wcm-review-num{
        width:22px;
        height:22px;
        border-radius:7px;
        background:#2b3940;
        display:grid;
        place-items:center;
        font-size:8px;
      }

      .wcm-review-main b,
      .wcm-review-main small{
        display:block;
      }

      .wcm-review-main b{
        font-size:9px;
      }

      .wcm-review-main small{
        font-size:7px;
        color:#7f9199;
        margin-top:2px;
      }

      .wcm-review-row code{
        direction:ltr;
        font:700 8px Consolas;
        color:#e1b6b9;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .wcm-shared-list{
        display:grid;
        gap:5px;
      }

      .wcm-shared-row{
        display:grid;
        grid-template-columns:
          135px
          minmax(0,1fr)
          auto;
        align-items:center;
        gap:8px;
        padding:8px;
        border:1px solid #293b43;
        background:#111e24;
        border-radius:9px;
      }

      .wcm-shared-row>div{
        display:flex;
        gap:4px;
        flex-wrap:wrap;
      }

      .wcm-shared-row>div span{
        padding:3px 6px;
        border-radius:999px;
        background:#203139;
        color:#a8b7bc;
        font-size:7px;
      }

      .wcm-modal-layer{
        position:absolute;
        inset:0;
        z-index:50;
        background:#020608d9;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:14px;
      }

      .wcm-import-modal{
        width:calc(100% - 18px);
        height:calc(100% - 18px);
        max-width:930px;
        background:#111b21;
        border:1px solid #354850;
        border-radius:18px;
        display:flex;
        flex-direction:column;
        overflow:hidden;
        box-shadow:0 32px 100px #000c;
      }

      .wcm-modal-head{
        display:flex;
        justify-content:space-between;
        gap:15px;
        padding:14px 16px;
        border-bottom:1px solid #2b3c44;
        background:#0d181e;
      }

      .wcm-modal-head h2{
        margin:0;
        font-size:17px;
      }

      .wcm-modal-head p{
        margin:4px 0 0;
        color:#81939b;
        font-size:9px;
      }

      .wcm-modal-head>button,
      .wcm-picker header>button,
      .wcm-about-top>button{
        border:0;
        background:#203039;
        color:#aebdc2;
        border-radius:9px;
        width:32px;
        height:32px;
        cursor:pointer;
        font-size:18px;
      }

      .wcm-import-body{
        flex:1;
        min-height:0;
        overflow:auto;
        padding:13px;
      }

      .wcm-import-layout{
        display:grid;
        grid-template-columns:
          minmax(0,1.05fr)
          minmax(0,.95fr);
        gap:10px;
      }

      .wcm-map-panel,
      .wcm-preview-panel{
        border:1px solid #2b3d45;
        background:#142128;
        border-radius:13px;
        padding:12px;
        min-width:0;
      }

      .wcm-two-fields,
      .wcm-map-grid{
        display:grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          );
        gap:7px;
      }

      .wcm-map-grid{
        grid-template-columns:
          repeat(
            3,
            minmax(0,1fr)
          );
        margin-top:8px;
      }

      .wcm-map-panel>.wcm-field{
        margin-top:8px;
      }

      .wcm-phone-columns{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        max-height:120px;
        overflow:auto;
        padding:7px;
        background:#0e191f;
        border:1px solid #2c3e46;
        border-radius:9px;
      }

      .wcm-phone-columns label{
        position:relative;
      }

      .wcm-phone-columns input{
        position:absolute;
        opacity:0;
        pointer-events:none;
      }

      .wcm-phone-columns span{
        display:inline-flex;
        padding:5px 7px;
        border:1px solid #33464f;
        border-radius:999px;
        color:#82949c;
        font-size:8px;
        cursor:pointer;
      }

      .wcm-phone-columns label.selected span{
        background:#12382f;
        border-color:#287561;
        color:#8adeca;
      }

      .wcm-import-summary{
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );
        gap:5px;
        margin-top:10px;
      }

      .wcm-import-summary .wcm-stat{
        padding:7px;
      }

      .wcm-import-summary .wcm-stat-icon{
        width:26px;
        height:26px;
      }

      .wcm-import-summary .wcm-stat b{
        font-size:13px;
      }

      .wcm-map-error{
        margin-top:10px;
        padding:8px;
        border-radius:9px;
        background:#3b2529;
        border:1px solid #714047;
        color:#ef9ea4;
        font-size:9px;
      }

      .wcm-table-wrap{
        overflow:auto;
        border:1px solid #2d3e46;
        border-radius:9px;
      }

      .wcm-preview-table{
        width:100%;
        border-collapse:collapse;
        min-width:460px;
        font-size:8px;
      }

      .wcm-preview-table th,
      .wcm-preview-table td{
        padding:7px;
        border-bottom:1px solid #26373f;
        text-align:right;
        max-width:150px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .wcm-preview-table th{
        background:#0f1a20;
        color:#91a3aa;
        position:sticky;
        top:0;
      }

      .wcm-smart-note{
        margin-top:10px;
        padding:10px;
        border-radius:10px;
        background:#102721;
        border:1px solid #295246;
      }

      .wcm-smart-note b{
        font-size:9px;
        color:#87d7c5;
      }

      .wcm-smart-note p{
        margin:4px 0 0;
        color:#83969e;
        font-size:8px;
        line-height:1.6;
      }

      .wcm-modal-footer{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:10px 13px;
        border-top:1px solid #2b3c44;
        background:#0d181e;
        color:#72858d;
        font-size:8px;
      }

      .wcm-modal-footer>div:last-child{
        display:flex;
        gap:6px;
      }

      .wcm-dot{
        display:inline-block;
        width:7px;
        height:7px;
        border-radius:50%;
        background:#20bd9d;
        margin-left:4px;
      }

      .compact-layer{
        background:#020608b8;
      }

      .wcm-picker,
      .wcm-about{
        width:min(
          500px,
          calc(100% - 24px)
        );
        max-height:80%;
        overflow:auto;
        background:#131f25;
        border:1px solid #354850;
        border-radius:17px;
        box-shadow:0 25px 80px #000b;
      }

      .wcm-picker header{
        display:flex;
        justify-content:space-between;
        padding:14px;
        border-bottom:1px solid #2b3c44;
      }

      .wcm-picker h3{
        margin:0;
        font-size:15px;
      }

      .wcm-picker p{
        margin:4px 0 0;
        color:#81939b;
        font-size:9px;
      }

      .wcm-picker-list{
        padding:9px;
        display:grid;
        gap:5px;
      }

      .wcm-picker-list>button{
        display:grid;
        grid-template-columns:
          34px
          minmax(0,1fr)
          120px
          14px;
        align-items:center;
        gap:8px;
        border:1px solid #2d3f47;
        background:#16242b;
        color:#e7edef;
        border-radius:10px;
        padding:8px;
        text-align:right;
        cursor:pointer;
      }

      .wcm-picker-list>button:hover{
        border-color:#2b7567;
        background:#18312d;
      }

      .wcm-picker-avatar{
        width:31px;
        height:31px;
        border-radius:9px;
        background:#21333b;
        display:grid;
        place-items:center;
      }

      .wcm-picker-list b,
      .wcm-picker-list small{
        display:block;
      }

      .wcm-picker-list b{
        font-size:9px;
      }

      .wcm-picker-list small{
        font-size:7px;
        color:#7d8f97;
      }

      .wcm-picker-list code{
        font:700 8px Consolas;
        color:#b9c8cd;
        direction:ltr;
      }

      .wcm-picker-list em{
        font-style:normal;
        color:#72868e;
        font-size:16px;
      }

      .wcm-about-top{
        padding:17px;
        background:linear-gradient(
          135deg,
          #118a76,
          #0b6259
        );
        display:grid;
        grid-template-columns:
          50px
          minmax(0,1fr)
          auto;
        align-items:center;
        gap:10px;
      }

      .wcm-about-logo{
        width:48px;
        height:48px;
        border-radius:13px;
        background:#ffffff1f;
        border:1px solid #ffffff2a;
        display:grid;
        place-items:center;
        font-weight:900;
      }

      .wcm-about-top h2{
        margin:0;
        font-size:15px;
      }

      .wcm-about-top p{
        margin:3px 0 0;
        font-size:9px;
        color:#d5efea;
      }

      .wcm-about-body{
        padding:15px;
        font-size:10px;
        color:#aebcc1;
        line-height:1.75;
      }

      .wcm-rights-box{
        margin:11px 0;
        padding:11px;
        border:1px solid #2d4946;
        background:#102723;
        border-radius:11px;
      }

      .wcm-rights-box b,
      .wcm-rights-box span,
      .wcm-rights-box small{
        display:block;
      }

      .wcm-rights-box b{
        color:#dce8e5;
      }

      .wcm-rights-box span{
        color:#79d8c2;
        font-weight:800;
        margin:2px 0;
      }

      .wcm-about-links{
        display:flex;
        gap:6px;
      }

      .wcm-about-links a{
        padding:6px 9px;
        border-radius:8px;
        background:#1b3030;
        border:1px solid #31514d;
        color:#78d2bf;
        text-decoration:none;
        font-weight:700;
      }

      .wcm-rights-note{
        color:#7e9098!important;
        font-size:9px!important;
      }

      .sga-busy{
        position:fixed;
        inset:0;
        z-index:2147483646;
        background:#05090ccc;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        color:#fff;
        font-family:"Segoe UI",Tahoma,Arial;
        gap:11px;
        direction:rtl;
      }

      .sga-spinner{
        width:37px;
        height:37px;
        border:4px solid #ffffff25;
        border-top-color:#20bd9d;
        border-radius:50%;
        animation:wcmSpin .75s linear infinite;
      }

      @keyframes wcmSpin{
        to{
          transform:rotate(360deg);
        }
      }

      .sga-busy b{
        font-size:11px;
      }

      .sga-toast{
        position:fixed;
        left:50%;
        bottom:25px;
        transform:translate(-50%,18px);
        opacity:0;
        z-index:2147483647;
        padding:9px 14px;
        border-radius:10px;
        background:#17252c;
        color:#fff;
        border:1px solid #3a4d55;
        font:10px "Segoe UI",Tahoma,Arial;
        transition:.2s;
        direction:rtl;
        box-shadow:0 10px 36px #0008;
      }

      .sga-toast.show{
        transform:translate(-50%,0);
        opacity:1;
      }

      .sga-toast.success{
        border-color:#287463;
      }

      .sga-toast.error{
        border-color:#81454d;
      }

      @media(max-width:820px){

        .sga-panel{
          width:calc(100vw - 20px);
          height:calc(100vh - 30px);
        }

        .wcm-shell{
          grid-template-columns:
            76px
            minmax(0,1fr);
        }

        .wcm-sidebar{
          padding-inline:5px;
        }

        .wcm-nav-btn b,
        .wcm-sidebar-bottom b{
          font-size:8px;
        }

        .wcm-welcome{
          grid-template-columns:1fr;
          padding:26px;
        }

        .wcm-welcome-mark{
          width:90px;
          height:90px;
          border-radius:24px;
          font-size:25px;
        }

        .wcm-import-layout{
          grid-template-columns:1fr;
        }

        .wcm-action-list{
          grid-template-columns:1fr;
        }

        .wcm-setup-row{
          grid-template-columns:
            1fr
            1fr;
        }

        .wcm-capture{
          grid-column:1/-1;
          height:40px;
        }

        .wcm-stats-grid{
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }

        .wcm-meta-grid{
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }
      }

      @media(max-width:640px){

        .sga-panel{
          top:0!important;
          left:0!important;
          width:100vw;
          height:100vh;
          border-radius:0;
          border:0;
        }

        .sga-head{
          cursor:default;
          touch-action:auto;
        }

        .wcm-ready,
        .wcm-head-btn{
          display:none;
        }

        .wcm-shell{
          grid-template-columns:
            62px
            minmax(0,1fr);
        }

        .wcm-main{
          padding:11px;
        }

        .wcm-nav-btn{
          min-height:49px;
        }

        .wcm-nav-btn span{
          font-size:15px;
        }

        .wcm-nav-btn b{
          font-size:7px;
        }

        .wcm-rights-footer{
          display:none;
        }

        .wcm-page-head{
          flex-direction:column;
        }

        .wcm-two-fields,
        .wcm-map-grid{
          grid-template-columns:1fr;
        }

        .wcm-import-summary{
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }

        .wcm-review-row{
          grid-template-columns:
            24px
            minmax(0,1fr)
            auto;
        }

        .wcm-review-row code{
          grid-column:2/3;
        }

        .wcm-contact-row{
          grid-template-columns:
            28px
            minmax(0,1fr);
        }

        .wcm-phone-wrap{
          grid-column:2/3;
          text-align:right;
        }

        .wcm-contact-row>.wcm-mini{
          grid-column:2/3;
          width:max-content;
        }

        .wcm-picker-list>button{
          grid-template-columns:
            30px
            minmax(0,1fr)
            12px;
        }

        .wcm-picker-list code{
          grid-column:2/3;
        }

        .sga-launcher b{
          display:none;
        }

        .sga-launcher{
          width:46px;
          height:46px;
          justify-content:center;
          padding:0;
        }
      }
    `;

    document.head
      .appendChild(style);
  }

  // =========================================================
  // WPP init/watch
  // =========================================================

  function initWPP() {
    let marked = false;

    const mark =
      async () => {
        if (marked) return;

        marked = true;
        S.ready = true;

        await resolveSelf();

        render();

        console.log(
          `[${APP.id}] WPP ready`
        );
      };

    try {
      if (
        typeof WPP !==
        'undefined'
      ) {
        if (
          WPP.isReady ||
          WPP.conn
            ?.isMainReady?.()
        ) {
          mark();
        }

        else if (
          WPP.loader
            ?.onReady
        ) {
          WPP.loader
            .onReady(mark);
        }

        else if (
          WPP.webpack
            ?.onReady
        ) {
          WPP.webpack
            .onReady(mark);
        }
      }
    }

    catch (_) {}

    const timer =
      setInterval(
        () => {
          try {
            if (
              !S.ready &&
              typeof WPP !==
                'undefined' &&
              (
                WPP.isReady ||
                WPP.conn
                  ?.isMainReady?.()
              )
            ) {
              clearInterval(timer);
              mark();
            }
          }

          catch (_) {}
        },
        1000
      );

    setTimeout(
      () =>
        clearInterval(timer),
      60000
    );
  }

  function watchChat() {
    setInterval(
      () => {
        if (
          !S.panelOpen ||
          !S.ready
        ) {
          return;
        }

        const id =
          activeChat()?.id ||
          '';

        if (
          id !==
          S.lastChatId
        ) {
          S.lastChatId =
            id;

          render();
        }
      },
      1500
    );
  }

  function boot() {
    styles();
    launcher();
    initWPP();
    watchChat();

    window.addEventListener(
      'resize',
      () => {
        const panel =
          $(
            `#${APP.id}-panel.open`
          );

        if (panel) {
          applyPanelPosition(
            panel
          );
        }
      }
    );

    console.log(
      '%cWhatsApp Communication Manager',
      'font-size:18px;font-weight:800;color:#16a085'
    );

    console.log(
      `الإصدار: ${VERSION}`
    );

    console.log(
      `تصميم وتطوير: ${DEVELOPER.name} (${DEVELOPER.handle})`
    );

    console.log(
      `GreasyFork: ${DEVELOPER.greasyFork}`
    );

    console.log(
      DEVELOPER.copyright
    );

    console.log(
      '✅ السكربت جاهز للعمل.'
    );
  }

  window.WAStudentGroupAuditor = {
    version:
      APP.version,

    normalizePhone,

    getState:
      () => S,

    captureGroup,

    runAudit,

    ensureGroupInviteLink,

    openInviteChat,

    scanCommunication,

    importFile,
  };

  window.WACommunicationManager =
    window.WAStudentGroupAuditor;

  boot();

})();