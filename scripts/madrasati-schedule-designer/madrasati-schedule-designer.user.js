// ==UserScript==
// @name         مدرستي - مصمم الجدول الدراسي
// @namespace    https://greasyfork.org/users/1636459
// @version      2.1.1
// @description  مصمم عصري لجدول المعلم أو الطالب في مدرستي مع أوقات تلقائية وهوية وزارة التعليم وإحصائيات مدمجة وطباعة/PDF وPNG وExcel.
// @author       Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @match        https://schools.madrasati.sa/SchoolSchedule/Schedule/TeacherSchedule*
// @match        https://schools.madrasati.sa/SchoolSchedule/Schedule/StudentSchedule*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/592421/%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20-%20%D9%85%D8%B5%D9%85%D9%85%20%D8%A7%D9%84%D8%AC%D8%AF%D9%88%D9%84%20%D8%A7%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D9%8A%20%D8%A7%D9%84%D8%A7%D8%AD%D8%AA%D8%B1%D8%A7%D9%81%D9%8A.user.js
// @updateURL    https://update.greasyfork.org/scripts/592421/%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20-%20%D9%85%D8%B5%D9%85%D9%85%20%D8%A7%D9%84%D8%AC%D8%AF%D9%88%D9%84%20%D8%A7%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D9%8A%20%D8%A7%D9%84%D8%A7%D8%AD%D8%AA%D8%B1%D8%A7%D9%81%D9%8A.meta.js
// ==/UserScript==
/*
=========================================================================
مدرستي - مصمم الجدول الدراسي
إصدار Tampermonkey : 2.1.1
مبني على أساس الإصدار المتوافق مع إضافة المتصفح: 0.2.0
تصميم وتطوير: Mohammed Almalki (M0HM3D85)
X / Twitter : https://x.com/M0HM3D85
Snapchat    : https://www.snapchat.com/add/M0HM3D85
© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
يمنع حذف أو تغيير بيانات المصمم وحقوقه عند إعادة نشر السكربت.
=========================================================================
*/
(() => {
'use strict';
// الشعار الافتراضي للجدول النهائي (مضمن محليًا لتفادي أي اعتماد خارجي).
const DEFAULT_BRAND_LOGO_DATA_URL = 'data:image/webp;base64,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';
const APP_ID = 'm0hm3d85-schedule-designer';
const OPEN_ID = 'm0hm3d85-open-schedule';
const STYLE_ID = 'm0hm3d85-schedule-style';
const TOAST_ID = 'm0hm3d85-schedule-toast';
const ONBOARDING_KEY = 'm0hm3d85_schedule_designer_onboarded_v2';
const BODY_LOCK_CLASS = 'm0hm3d85-schedule-lock';
const BRAND_ICON_DATA = DEFAULT_BRAND_LOGO_DATA_URL;
const path = location.pathname.toLowerCase();
const isTeacher = path.includes('/teacherschedule');
const isStudent = path.includes('/studentschedule');
if (!isTeacher && !isStudent) return;
const ROLE = isTeacher ? 'teacher' : 'student';
// إبقاء المفتاح v13 يحافظ على إعدادات النسخة السابقة إن وُجدت.
const STORAGE_KEY =
`m0hm3d85_schedule_designer_v13_${ROLE}`;
const PALETTE = [
['#E7F7EF', '#8AD7B5', '#075C3E', '#07A869'],
['#F0ECF8', '#B4A5D1', '#351375', '#351375'],
['#EAF2FA', '#9EC3E2', '#15445A', '#3D7EB9'],
['#F7F4EA', '#D8CFAC', '#665B2D', '#C1B489'],
['#E6F7F7', '#8BD6D4', '#0B5C5A', '#0DA9A6'],
['#F0F1FF', '#B6B9FF', '#3D438A', '#7A80FF'],
['#E9F0F3', '#9DB3BE', '#15445A', '#15445A'],
['#F2EDF8', '#C1B2D8', '#4D376C', '#7258A4'],
['#ECF9FC', '#A7E0EC', '#245D69', '#69CEE3'],
['#E8F2F8', '#92BBD5', '#1E5676', '#3078A6'],
['#E7F4F7', '#8AC8D5', '#18596B', '#218CAA'],
['#FCEDEA', '#E8A79F', '#7A342D', '#D96B5F'],
['#FFF4DF', '#EBCB8B', '#75500E', '#D79A2B'],
['#FBEAF0', '#E6A5B8', '#7B2944', '#C75B7A'],
['#F0F4E6', '#BBCB8D', '#46591D', '#7A8F3B'],
['#F8ECE7', '#DDB5A3', '#68351F', '#A65C3D']
].map(
([bg, border, text, accent]) => ({
bg,
border,
text,
accent
})
);
const SUBJECT_ACCENTS = [
'#351375',
'#07A869',
'#3D7EB9',
'#D79A2B',
'#0DA9A6',
'#C75B7A',
'#7A80FF',
'#A65C3D',
'#218CAA',
'#7258A4',
'#7A8F3B',
'#D96B5F',
'#15445A',
'#69CEE3',
'#3078A6',
'#C1B489'
];
const ORDINALS = [
'الأولى',
'الثانية',
'الثالثة',
'الرابعة',
'الخامسة',
'السادسة',
'السابعة',
'الثامنة',
'التاسعة',
'العاشرة'
];
const defaultPrefs = () => ({
name: '',
school: '',
stage: '',
className: '',
specialty: '',
academicYear: '',
region: '',
term: '',
week: '',
title:
isTeacher
? 'الجدول الدراسي الأسبوعي للمعلم'
: 'الجدول الدراسي الأسبوعي للطالب',
note: '',
showLegend: true,
showSecondary: true,
showSubjectAccent: true,
showBrandLogo: true,
showStats: true,
fitMode: 'auto',
dense: false,
monochrome: false,
remember: true,
times: [],
logoDataUrl: ''
});
const loadPrefs = () => {
const base =
defaultPrefs();
try {
return {
...base,
...JSON.parse(
localStorage.getItem(
STORAGE_KEY
) || '{}'
)
};
} catch (_) {
return base;
}
};
const state = {
data: null,
prefs: loadPrefs(),
logoDataUrl: '',
extractedAt: new Date()
};
function savePrefs() {
/*
* إذا ألغى المستخدم خيار حفظ بياناته
* نحذف البيانات المحفوظة سابقًا.
*/
if (
!state.prefs.remember
) {
try {
localStorage.removeItem(
STORAGE_KEY
);
} catch (_) {}
return;
}
try {
localStorage.setItem(
STORAGE_KEY,
JSON.stringify({
...state.prefs,
logoDataUrl:
state.logoDataUrl &&
state.logoDataUrl.length < 700000
? state.logoDataUrl
: ''
})
);
} catch (_) {}
}
function clean(
value = ''
) {
return String(value)
.replace(
/\s+/g,
' '
)
.trim();
}
function normalizeLatinDigits(value = '') {
return String(value)
.replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
.replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
}
function normalizeTimeValue(value = '') {
const text = normalizeLatinDigits(value).trim();
const match = text.match(/(\d{1,2})\s*:\s*(\d{2})\s*(ص|م|am|pm)?/iu);
if (!match) return '';
let hour = Number(match[1]);
const minute = Number(match[2]);
const marker = (match[3] || '').toLowerCase();
if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return '';
if (marker === 'م' || marker === 'pm') {
if (hour < 12) hour += 12;
} else if (marker === 'ص' || marker === 'am') {
if (hour === 12) hour = 0;
}
if (hour > 23) return '';
return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function parseTimeRange(value = '') {
const parts = normalizeLatinDigits(value)
.split(/\s*[-–—]\s*/u)
.map(part => normalizeTimeValue(part))
.filter(Boolean);
return {
start: parts[0] || '',
end: parts[1] || ''
};
}
function formatTimeRange(start = '', end = '') {
const normalizedStart = normalizeTimeValue(start);
const normalizedEnd = normalizeTimeValue(end);
if (normalizedStart && normalizedEnd) return `${normalizedStart} - ${normalizedEnd}`;
return normalizedStart || normalizedEnd || '';
}
function minutesToTime(totalMinutes) {
const day = 24 * 60;
let value = Number(totalMinutes) % day;
if (value < 0) value += day;
const hour = Math.floor(value / 60);
const minute = value % 60;
return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function timeToMinutes(value = '') {
const normalized = normalizeTimeValue(value);
if (!normalized) return null;
const [hour, minute] = normalized.split(':').map(Number);
return hour * 60 + minute;
}
function parsePageDate(value = '') {
const text = normalizeLatinDigits(value).trim();
const match = text.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);
if (!match) return null;
const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
return Number.isNaN(date.getTime()) ? null : date;
}
function addDays(date, days) {
const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
result.setDate(result.getDate() + Number(days || 0));
return result;
}
function apiDate(date, separator = '/') {
return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(separator);
}
function extractClock(value = '') {
const text = normalizeLatinDigits(value);
const direct = text.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::\d{2})?/);
if (direct) return normalizeTimeValue(`${direct[1]}:${direct[2]}`);
const ticks = text.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
if (ticks) {
const date = new Date(Number(ticks[1]));
if (!Number.isNaN(date.getTime())) return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
return normalizeTimeValue(text);
}
function findPageValue(labels = []) {
const normalizedLabels = labels.map(label => canonical(label));
const nodes = document.querySelectorAll('label, small, span, div, h5, h6');
for (const node of nodes) {
const text = clean(node.textContent || '');
if (!text || text.length > 120) continue;
const normalized = canonical(text);
for (const label of normalizedLabels) {
if (!label || !normalized.startsWith(label)) continue;
const colonIndex = Math.max(text.indexOf(':'), text.indexOf('：'));
if (colonIndex < 0) continue;
const value = clean(text.slice(colonIndex + 1));
if (value && value.length <= 80) return value;
}
}
return '';
}
function inferAcademicYear() {
try {
return normalizeLatinDigits(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{ year: 'numeric' }).format(new Date())).replace(/\s+/g, ' ').trim();
} catch (_) {
return '';
}
}
function inferStage(data) {
const text = data.days.flatMap(day => day.lessons.map(lesson => lesson.className || '')).join(' ');
if (/ابتدائي/u.test(text)) return 'ابتدائي';
if (/متوسط/u.test(text)) return 'متوسط';
if (/ثانوي/u.test(text)) return 'ثانوي';
return '';
}
function normalizeCalendarPayload(payload) {
let value = payload;
for (let depth = 0; depth < 4; depth++) {
if (typeof value === 'string') {
try { value = JSON.parse(value); continue; } catch (_) { return null; }
}
if (value && Array.isArray(value.TimeTable)) return value;
if (value && typeof value === 'object') {
value = value.data ?? value.result ?? value.value ?? value.d;
continue;
}
break;
}
return null;
}
async function fetchTeacherCalendarDay(date, separator = '/') {
const schoolId = new URLSearchParams(location.search).get('SchoolId') || document.querySelector('#hSchoolId')?.value || '';
const dateText = apiDate(date, separator);
const body = new URLSearchParams();
['date','Date','start','StartDate','startDate','CurrentDate','currentDate','SelectedDate','selectedDate'].forEach(key => body.set(key, dateText));
if (schoolId) { body.set('SchoolId', schoolId); body.set('schoolId', schoolId); }
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 3500);
try {
const response = await fetch('/Teacher/TimeTable/GetCal', {
method: 'POST',
credentials: 'same-origin',
headers: {
'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
'X-Requested-With': 'XMLHttpRequest',
'Accept': 'application/json, text/javascript, */*; q=0.01'
},
body: body.toString(),
signal: controller.signal
});
if (!response.ok) return null;
return normalizeCalendarPayload(await response.text());
} catch (_) {
return null;
} finally {
clearTimeout(timer);
}
}
async function enrichTeacherScheduleFromSystem(data) {
if (!isTeacher || !data) return false;
const start = parsePageDate(document.querySelector('#StartDateSchedule')?.value || '') || parsePageDate(document.querySelector('#CurrentWeekDate')?.value || '') || parsePageDate(document.querySelector('#currentDateToday')?.value || '');
if (!start) return false;
let separator = '/';
let first = await fetchTeacherCalendarDay(start, separator);
if (!first) { separator = '-'; first = await fetchTeacherCalendarDay(start, separator); }
if (!first) return false;
const days = [first, ...(await Promise.all([1,2,3,4].map(offset => fetchTeacherCalendarDay(addDays(start, offset), separator))))];
const slotTimes = Array.from({ length: data.periods }, () => '');
let school = '';
days.filter(Boolean).forEach(day => {
(day.TimeTable || []).forEach(item => {
const slot = Number(item?.SlotNumber) - 1;
if (slot >= 0 && slot < slotTimes.length && !slotTimes[slot]) slotTimes[slot] = formatTimeRange(extractClock(item?.StartTime), extractClock(item?.EndTime));
if (!school && item?.SchoolName) school = clean(item.SchoolName);
});
});
let found = 0;
slotTimes.forEach((value, index) => {
if (!value) return;
data.times[index] = value;
found++;
});
data.systemMeta = { ...(data.systemMeta || {}), school };
if (found) { data.timeSource = 'system'; state.prefs.times = [...data.times]; }
return found > 0 || Boolean(school);
}
function extractSystemIdentity(data) {
const nameSelectors = ['.user-menu .fw-bold','.info-body.flex-grow-1.ms-3 h2','[data-clarity-mask="True"] .fw-bold'];
let name = '';
for (const selector of nameSelectors) {
name = clean(document.querySelector(selector)?.textContent || '');
if (name && !/مرحبا|تسجيل|الرئيسية/u.test(name)) break;
}
const subjects = collectUnique(data, lesson => lesson.subject);
return {
name,
school: clean(data.systemMeta?.school || ''),
region: findPageValue(['إدارة التعليم','الإدارة التعليمية','المنطقة التعليمية']),
term: findPageValue(['الفصل الدراسي']),
academicYear: findPageValue(['العام الدراسي']) || inferAcademicYear(),
stage: inferStage(data),
subject: isTeacher ? subjects.join('، ') : ''
};
}
function formatExtractionDate(date = new Date()) {
const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
return [
String(value.getDate()).padStart(2, '0'),
String(value.getMonth() + 1).padStart(2, '0'),
String(value.getFullYear())
].join('/');
}
/*
* تنظيف اسم المادة من وصف نوع اللقاء الذي تضيفه مدرستي
* داخل نفس عنصر اسم المادة في بعض جداول الطلاب.
*/
function cleanSubjectName(
value = ''
) {
return clean(value)
.replace(
/\s*[-–—]\s*غير\s+متزامن\s*$/u,
''
)
.replace(
/\s*[-–—]\s*متزامن\s*$/u,
''
)
.trim();
}
function canonical(
value = ''
) {
return clean(value)
.replace(
/[ًٌٍَُِّْـ]/g,
''
)
.replace(
/[()[\]{}]/g,
''
)
.replace(
/[–—]/g,
'-'
)
.trim();
}
function esc(
value = ''
) {
return String(value)
.replace(
/&/g,
'&amp;'
)
.replace(
/</g,
'&lt;'
)
.replace(
/>/g,
'&gt;'
)
.replace(
/"/g,
'&quot;'
)
.replace(
/'/g,
'&#039;'
);
}
function periodTitle(
label,
index
) {
const text =
clean(label);
if (!text) {
return (
`الحصة ${
ORDINALS[index] ||
index + 1
}`
);
}
return /^الحصة\s/.test(text)
? text
: `الحصة ${text}`;
}
function splitStudentMeta(
text
) {
const raw =
clean(text);
if (!raw) {
return {
className: '',
teacher: ''
};
}
const parts =
raw.split(
/\s+-\s+/
);
if (
parts.length >= 2
) {
return {
className:
clean(
parts.shift()
),
teacher:
clean(
parts.join(
' - '
)
)
};
}
return {
className: '',
teacher: raw
};
}
function extractSchedule() {
const table =
document.querySelector(
'#reservations'
);
if (!table) {
return null;
}
let periodLabels = [
...table.querySelectorAll(
'thead tr:first-child th'
)
]
.slice(1)
.map(
(
th,
index
) =>
clean(
th.textContent
) ||
`الحصة ${
ORDINALS[index] ||
index + 1
}`
);
const rows = [
...table.querySelectorAll(
'tbody > tr'
)
];
if (
!periodLabels.length &&
rows.length
) {
const count =
Math.max(
0,
rows[0]
.children
.length - 1
);
periodLabels =
Array.from(
{
length:
count
},
(
_,
index
) =>
`الحصة ${
ORDINALS[index] ||
index + 1
}`
);
}
const periods =
periodLabels.length;
const periodTimes =
Array.from(
{
length:
periods
},
() =>
new Set()
);
const days = [];
const classes = [];
rows.forEach(
(
row,
dayIndex
) => {
const cells = [
...row.querySelectorAll(
':scope > th, :scope > td'
)
];
if (!cells.length) {
return;
}
const dayName =
clean(
cells[0]
?.textContent
) ||
[
'الأحد',
'الاثنين',
'الثلاثاء',
'الأربعاء',
'الخميس'
][dayIndex] ||
`اليوم ${
dayIndex + 1
}`;
const lessons = [];
for (
let periodIndex = 0;
periodIndex < periods;
periodIndex++
) {
const cell =
cells[
periodIndex + 1
];
if (!cell) {
lessons.push({
subject: '',
secondary: '',
className: '',
teacher: '',
time: ''
});
continue;
}
/*
* جدول المعلم.
*/
if (
isTeacher
) {
const cards = [
...cell.querySelectorAll(
'.cs-lesson-card'
)
];
const subjects = [];
const classNames = [];
const targets =
cards.length
? cards
: [cell];
targets.forEach(
card => {
const subject =
clean(
card
.querySelector(
'.schedule-card .title h2'
)
?.textContent ||
''
);
const className =
clean(
card
.querySelector(
'.schedule-card small'
)
?.textContent ||
''
);
if (subject) {
subjects.push(
subject
);
}
if (className) {
classNames.push(
className
);
classes.push(
className
);
}
}
);
const uniqueSubjects = [
...new Set(
subjects
)
];
const uniqueClasses = [
...new Set(
classNames
)
];
lessons.push({
subject:
uniqueSubjects.join(
' / '
),
secondary:
uniqueClasses.join(
' / '
),
className:
uniqueClasses.join(
' / '
),
teacher: '',
time: ''
});
}
/*
* جدول الطالب.
*/
else {
const subject =
cleanSubjectName(
cell
.querySelector(
'h6.text-black.fw-bold'
)
?.textContent ||
cell
.querySelector(
'h6'
)
?.textContent ||
''
);
const meta =
splitStudentMeta(
cell
.querySelector(
'p.d-block'
)
?.textContent ||
''
);
const time =
clean(
cell
.querySelector(
'span[id^="xxx_"]'
)
?.textContent ||
''
);
if (time) {
periodTimes[
periodIndex
].add(
time
);
}
if (
meta.className
) {
classes.push(
meta.className
);
}
lessons.push({
subject,
secondary:
meta.teacher,
className:
meta.className,
teacher:
meta.teacher,
time
});
}
}
days.push({
name:
dayName,
lessons
});
}
);
const times =
periodTimes.map(
set =>
[...set][0] ||
''
);
/*
* جدول المعلم لا يعرض الوقت في الصفحة غالبًا،
* لذلك نعيد الأوقات المحفوظة من المستخدم.
*/
if (
Array.isArray(
state.prefs.times
)
) {
state.prefs.times
.forEach(
(
value,
index
) => {
if (
index < periods &&
value &&
!times[index]
) {
times[index] =
value;
}
}
);
}
const uniqueClasses = [
...new Set(
classes
.map(
clean
)
.filter(
Boolean
)
)
];
return {
type:
ROLE,
periods,
periodLabels,
times,
days,
commonClass:
uniqueClasses.length === 1
? uniqueClasses[0]
: '',
week:
clean(
document
.querySelector(
'#lblPeriodSchedule'
)
?.textContent ||
''
),
timeSource:
isStudent && times.some(Boolean)
? 'page'
: (times.some(Boolean) ? 'saved' : ''),
systemMeta: {}
};
}
function hydrateDefaults(
data
) {
const identity = extractSystemIdentity(data);
if (!state.prefs.name && identity.name) state.prefs.name = identity.name;
if (!state.prefs.school && identity.school) state.prefs.school = identity.school;
if (!state.prefs.region && identity.region) state.prefs.region = identity.region;
if (!state.prefs.term && identity.term) state.prefs.term = identity.term;
if (!state.prefs.academicYear && identity.academicYear) state.prefs.academicYear = identity.academicYear;
if (!state.prefs.stage && identity.stage) state.prefs.stage = identity.stage;
if (isTeacher && !state.prefs.specialty && identity.subject) state.prefs.specialty = identity.subject;
if (isStudent && !state.prefs.className && data.commonClass) state.prefs.className = data.commonClass;
if (!state.prefs.title) {
state.prefs.title =
isTeacher
? 'الجدول الدراسي الأسبوعي للمعلم'
: 'الجدول الدراسي الأسبوعي للطالب';
}
state.logoDataUrl =
state.prefs.logoDataUrl ||
'';
}
function collectUnique(
data,
getter
) {
const result = [];
const seen =
new Set();
data.days
.forEach(
day => {
day.lessons
.forEach(
lesson => {
const value =
clean(
getter(
lesson
)
);
const key =
canonical(
value
);
if (
value &&
!seen.has(
key
)
) {
seen.add(
key
);
result.push(
value
);
}
}
);
}
);
return result;
}
function computeScheduleStats(data) {
const colorCounts = new Map();
const subjectCounts = new Map();
const classes = new Set();
const teachers = new Set();
const daily = [];
let total = 0;
data.days.forEach(day => {
let dayTotal = 0;
day.lessons.forEach(lesson => {
if (!lesson.subject) return;
total++;
dayTotal++;
const subjectKey = canonical(lesson.subject);
if (subjectKey) subjectCounts.set(subjectKey, (subjectCounts.get(subjectKey) || 0) + 1);
if (lesson.className) classes.add(canonical(lesson.className));
if (lesson.teacher) teachers.add(canonical(lesson.teacher));
const colorKey = canonical(isTeacher ? lesson.className : lesson.subject);
if (colorKey) colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
});
daily.push({ name: day.name, count: dayTotal });
});
const busiest = daily.reduce(
(best, current) => current.count > best.count ? current : best,
{ name: '', count: 0 }
);
return {
total,
free: Math.max(0, data.days.length * data.periods - total),
subjects: subjectCounts.size,
classes: classes.size,
teachers: teachers.size,
busiestDay: busiest.name,
busiestCount: busiest.count,
colorCounts,
subjectCounts
};
}
function stablePaletteIndex(value, length, salt = '') {
if (!length) return 0;
const text = `${salt}|${canonical(value)}`;
let hash = 2166136261;
for (let index = 0; index < text.length; index++) {
hash ^= text.charCodeAt(index);
hash = Math.imul(hash, 16777619);
}
return (hash >>> 0) % length;
}
function assignDistinctIndexes(keys, length, salt = '') {
const normalizedKeys = [...new Set(keys.filter(Boolean).map(key => canonical(key)).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ar',{ numeric:true }));
const used = new Set();
const indexes = new Map();
normalizedKeys.forEach(key => {
let index = stablePaletteIndex(key, length, salt);
if (used.size < length) {
while (used.has(index)) index = (index + 1) % length;
used.add(index);
}
indexes.set(key, index);
});
return indexes;
}
function assignColors(keys) {
const indexes = assignDistinctIndexes(keys, PALETTE.length, 'schedule-color');
const map = new Map();
keys.filter(Boolean).forEach(key => {
const normalized = canonical(key);
if (!map.has(normalized)) map.set(normalized, PALETTE[indexes.get(normalized) ?? 0]);
});
return map;
}
function assignSubjectAccents(subjects) {
const indexes = assignDistinctIndexes(subjects, SUBJECT_ACCENTS.length, 'subject-accent');
const map = new Map();
subjects.filter(Boolean).forEach(subject => {
const normalized = canonical(subject);
if (!map.has(normalized)) map.set(normalized, SUBJECT_ACCENTS[indexes.get(normalized) ?? 0]);
});
return map;
}
function buildPreview() {
const data =
state.data;
const prefs =
state.prefs;
/*
* المعلم = الألوان حسب الفصول.
* الطالب = الألوان حسب المواد.
*/
const colorKeys =
isTeacher
? collectUnique(
data,
lesson =>
lesson.className
)
: collectUnique(
data,
lesson =>
lesson.subject
);
const colorMap =
assignColors(
colorKeys
);
const subjects =
collectUnique(
data,
lesson =>
lesson.subject
);
const subjectAccentMap =
assignSubjectAccents(
subjects
);
const multipleTeacherSubjects =
isTeacher &&
subjects.length > 1;
const stats = computeScheduleStats(data);
const metaItems = [];
if (
prefs.name
) {
metaItems.push({
label:
isTeacher
? 'المعلم'
: 'الطالب',
value:
prefs.name
});
}
if (
prefs.stage
) {
metaItems.push({
label:
'المرحلة',
value:
prefs.stage
});
}
if (
isStudent &&
prefs.className
) {
metaItems.push({
label:
'الصف / الفصل',
value:
prefs.className
});
}
if (
isTeacher &&
prefs.specialty
) {
metaItems.push({
label:
'المادة',
value:
prefs.specialty
});
}
if (
prefs.academicYear
) {
metaItems.push({
label:
'العام الدراسي',
value:
prefs.academicYear
});
}
if (
prefs.term
) {
metaItems.push({
label:
'الفصل الدراسي',
value:
prefs.term
});
}
const legend =
colorKeys
.map(
key => {
const color =
colorMap.get(
canonical(
key
)
);
return `
<span class="m0-legend-item">
<i
style="
background:${
prefs.monochrome
? '#777'
: color.accent
}
"
></i>
${esc(key)}
${prefs.showStats ? `<small class="m0-legend-count">(${stats.colorCounts.get(canonical(key)) || 0})</small>` : ''}
</span>
`;
}
)
.join('');
const subjectLegend =
multipleTeacherSubjects &&
prefs.showSubjectAccent
? `
<div class="m0-subject-legend">
<span class="m0-legend-title">
تمييز المواد:
</span>
${
subjects
.map(
subject => `
<span class="m0-legend-item tiny subject-key">
<i
style="
background:${
prefs.monochrome
? '#777'
: subjectAccentMap.get(
canonical(
subject
)
)
}
"
></i>
${esc(subject)}
</span>
`
)
.join('')
}
</div>
`
: '';
const statsHtml =
prefs.showStats
? `
<div class="m0-stats">
<div class="m0-stat-card"><small>الحصص</small><b>${stats.total}</b></div>
<div class="m0-stat-card"><small>${isTeacher ? 'الفصول' : 'المواد'}</small><b>${isTeacher ? stats.classes : stats.subjects}</b></div>
<div class="m0-stat-card"><small>${isTeacher ? 'المواد' : 'المعلمون'}</small><b>${isTeacher ? stats.subjects : stats.teachers}</b></div>
<div class="m0-stat-card"><small>${isStudent ? 'الفراغات' : 'الأكثر ازدحامًا'}</small><b>${isStudent ? stats.free : esc(stats.busiestDay || '—')}</b>${isTeacher && stats.busiestCount ? `<em>${stats.busiestCount} حصة</em>` : ''}</div>
</div>
`
: '';
const header =
data.periodLabels
.map(
(
label,
index
) => `
<th>
<div class="m0-period-title">
${
esc(
periodTitle(
label,
index
)
)
}
</div>
<div
class="
m0-period-time
${
data.times[index]
? ''
: 'empty'
}
"
contenteditable="true"
data-time-index="${index}"
title="اضغط لتعديل الوقت"
>
${
esc(
data.times[index] ||
'أضف الوقت'
)
}
</div>
</th>
`
)
.join('');
const body =
data.days
.map(
(
day,
dayIndex
) => {
const cells =
day.lessons
.map(
(
lesson,
periodIndex
) => {
if (
!lesson.subject
) {
return `
<td class="m0-empty-cell">
<span>—</span>
</td>
`;
}
const key =
isTeacher
? lesson.className
: lesson.subject;
const color =
colorMap.get(
canonical(
key
)
) ||
PALETTE[0];
const bg =
prefs.monochrome
? '#F5F5F5'
: color.bg;
const border =
prefs.monochrome
? '#BDBDBD'
: color.border;
const text =
prefs.monochrome
? '#222'
: color.text;
const accent =
prefs.monochrome
? '#666'
: (
subjectAccentMap.get(
canonical(
lesson.subject
)
) ||
color.accent
);
const secondary =
prefs.showSecondary &&
lesson.secondary
? `
<div
class="m0-lesson-secondary"
contenteditable="true"
data-edit="secondary"
data-day="${dayIndex}"
data-period="${periodIndex}"
>
${
esc(
lesson.secondary
)
}
</div>
`
: '';
const topAccent =
multipleTeacherSubjects &&
prefs.showSubjectAccent
? `
<span
class="m0-subject-accent"
style="
background:${accent}
"
></span>
`
: '';
return `
<td>
<div
class="m0-lesson-card"
style="
--cell-bg:${bg};
--cell-border:${border};
--cell-text:${text};
"
>
${topAccent}
<div
class="m0-lesson-subject"
contenteditable="true"
data-edit="subject"
data-day="${dayIndex}"
data-period="${periodIndex}"
>
${
esc(
lesson.subject
)
}
</div>
${secondary}
</div>
</td>
`;
}
)
.join('');
return `
<tr>
<th class="m0-day-cell">
<span>
${esc(day.name)}
</span>
</th>
${cells}
</tr>
`;
}
)
.join('');
const effectiveLogo =
state.logoDataUrl ||
(prefs.showBrandLogo ? DEFAULT_BRAND_LOGO_DATA_URL : '');
const logo =
effectiveLogo
? `
<img
class="m0-logo-img"
src="${effectiveLogo}"
alt="شعار مصمم الجدول الدراسي"
>
`
: '';
return `
<section
id="m0-print-area"
class="
m0-sheet
${prefs.dense ? 'dense' : ''}
${prefs.fitMode === 'one-page' ? ' fit-one-page' : prefs.fitMode === 'comfortable' ? ' fit-comfortable' : ' fit-auto'}
"
>
<div class="m0-topbar"></div>
<header class="m0-sheet-header">
<div class="m0-official-side">
<strong>المملكة العربية السعودية</strong>
<span>وزارة التعليم</span>
${prefs.region ? `<span>${esc(prefs.region)}</span>` : ''}
${prefs.school ? `<b>${esc(prefs.school)}</b>` : ''}
</div>
<div class="m0-title-side">
${logo}
<div class="m0-kicker">
${isTeacher ? 'جدول المعلم' : 'جدول الطالب'}
</div>
<h1>
${esc(prefs.title || '')}
</h1>
${metaItems.length ? `
<div class="m0-meta">
${metaItems.map(item => `
<span><b>${esc(item.label)}:</b> ${esc(item.value)}</span>
`).join('')}
</div>
` : ''}
</div>
<div class="m0-print-meta-side">
${prefs.term ? `<span>${esc(prefs.term)}</span>` : ''}
${prefs.academicYear ? `<span>العام الدراسي: <b>${esc(prefs.academicYear)}</b></span>` : ''}
<span>تاريخ الطباعة: <b>${esc(formatExtractionDate(state.extractedAt))}</b></span>
</div>
</header>
${prefs.showLegend &&
legend
? `
<div class="m0-legend">
<span class="m0-legend-title">
${
isTeacher
? 'ألوان الفصول:'
: 'ألوان المواد:'
}
</span>
${legend}
</div>
${subjectLegend}
`
: ''
}
${statsHtml}
<div class="m0-table-wrap">
<table class="m0-schedule-table">
<thead>
<tr>
<th class="m0-day-head">
اليوم
</th>
${header}
</tr>
</thead>
<tbody>
${body}
</tbody>
</table>
</div>
${
prefs.note
? `
<div class="m0-note">
${esc(prefs.note)}
</div>
`
: ''
}
<footer class="m0-footer">
<span>
تم استخراج الجدول بواسطة <strong>مصمم الجدول الدراسي</strong>
</span>
<span>
تاريخ الاستخراج: ${esc(formatExtractionDate(state.extractedAt))}
</span>
</footer>
</section>
`;
}
const BASE_CSS = `
#${APP_ID},
#${APP_ID} * {
box-sizing:border-box;
}
#${APP_ID} {
position:fixed;
inset:0;
z-index:2147483646;
direction:rtl;
font-family:Tahoma,Arial,sans-serif;
}
#${APP_ID} .m0-backdrop {
position:absolute;
inset:0;
background:rgba(15,23,42,.62);
backdrop-filter:blur(6px);
}
#${APP_ID} .m0-app {
position:absolute;
inset:2.3vh 1.4vw;
background:#F4F7FB;
border-radius:22px;
overflow:hidden;
display:grid;
grid-template-columns:340px minmax(0,1fr);
box-shadow:0 30px 80px rgba(0,0,0,.28);
}
#${APP_ID} .m0-panel {
background:#fff;
border-left:1px solid #E5EAF1;
overflow:auto;
padding:22px;
}
#${APP_ID} button {
font-family:inherit;
}
#${APP_ID} .m0-panel-head {
display:flex;
align-items:center;
justify-content:space-between;
gap:12px;
margin-bottom:18px;
}
#${APP_ID} .m0-panel-head h2 {
margin:0;
font-size:19px;
color:#142033;
}
#${APP_ID} .m0-close {
width:38px;
height:38px;
border:0;
border-radius:11px;
background:#F2F4F7;
color:#39475B;
cursor:pointer;
font-size:22px;
}
#${APP_ID} .m0-field {
margin-bottom:12px;
}
#${APP_ID} .m0-field label {
display:block;
font-size:12px;
color:#5B6677;
margin-bottom:6px;
font-weight:700;
}
#${APP_ID} .m0-field input,
#${APP_ID} .m0-field textarea {
width:100%;
border:1px solid #DCE2EA;
border-radius:10px;
padding:10px 11px;
outline:none;
background:#FBFCFE;
font:inherit;
font-size:13px;
color:#1F2937;
transition:.18s;
}
#${APP_ID} .m0-field input:focus,
#${APP_ID} .m0-field textarea:focus {
border-color:#3D7EB9;
box-shadow:0 0 0 3px rgba(85,168,200,.12);
background:#fff;
}
#${APP_ID} .m0-field textarea {
resize:vertical;
min-height:62px;
}
#${APP_ID} .m0-grid2 {
display:grid;
grid-template-columns:1fr 1fr;
gap:10px;
}
#${APP_ID} .m0-section-title {
margin:18px 0 10px;
font-size:13px;
color:#26364D;
font-weight:800;
display:flex;
align-items:center;
gap:7px;
}
#${APP_ID} .m0-section-title::before {
content:"";
width:4px;
height:14px;
border-radius:3px;
background:#0DA9A6;
}
#${APP_ID} .m0-check {
display:flex;
align-items:center;
gap:8px;
font-size:12px;
color:#455268;
margin:9px 0;
cursor:pointer;
}
#${APP_ID} .m0-check input {
accent-color:#0DA9A6;
}
#${APP_ID} .m0-times {
display:grid;
gap:7px;
}
#${APP_ID} .m0-time-row {
display:grid;
grid-template-columns:88px 1fr;
align-items:center;
gap:7px;
}
#${APP_ID} .m0-time-row span {
font-size:11px;
color:#687588;
}
#${APP_ID} .m0-time-row input {
width:100%;
border:1px solid #DCE2EA;
border-radius:8px;
padding:7px 8px;
font-size:11px;
}
#${APP_ID} .m0-upload {
display:flex;
gap:8px;
align-items:center;
flex-wrap:wrap;
}
#${APP_ID} .m0-upload input[type=file] {
display:none;
}
#${APP_ID} .m0-small-btn {
border:1px solid #D9E1EA;
background:#fff;
padding:8px 10px;
border-radius:9px;
cursor:pointer;
font:inherit;
font-size:12px;
color:#354154;
}
#${APP_ID} .m0-logo-status {
width:100%;
font-size:10px;
color:#778397;
overflow:hidden;
text-overflow:ellipsis;
white-space:nowrap;
}
#${APP_ID} .m0-update {
margin-top:18px;
}
#${APP_ID} .m0-update button {
width:100%;
border:0;
border-radius:12px;
padding:12px 10px;
cursor:pointer;
font-size:13px;
font-weight:900;
background:linear-gradient(
135deg,
#0DA9A6,
#238A7F
);
color:#fff;
box-shadow:0 7px 18px rgba(42,157,143,.18);
}
#${APP_ID} .m0-actions {
margin:14px -22px -22px;
padding:13px 18px;
background:#fff;
border-top:1px solid #E6EBF1;
display:grid;
grid-template-columns:1fr 1fr;
gap:8px;
position:sticky;
bottom:-22px;
z-index:5;
}
#${APP_ID} .m0-action {
border:0;
border-radius:11px;
padding:10px 8px;
cursor:pointer;
font-size:12px;
font-weight:800;
background:#EDF2F7;
color:#2B374A;
}
#${APP_ID} .m0-action.primary {
background:#123D5A;
color:#fff;
}
#${APP_ID} .m0-action.accent {
background:#0DA9A6;
color:#fff;
}
#${APP_ID} .m0-preview-area {
overflow:auto;
padding:28px;
display:flex;
justify-content:center;
align-items:flex-start;
}
#${APP_ID} .m0-hint {
position:absolute;
left:24px;
bottom:17px;
background:#1D2B3D;
color:#fff;
padding:7px 11px;
border-radius:9px;
font-size:11px;
opacity:.88;
pointer-events:none;
}
#${APP_ID} .m0-sheet {
width:1120px;
min-height:760px;
background:#fff;
border-radius:16px;
padding:34px 34px 20px;
box-shadow:0 18px 50px rgba(30,50,75,.12);
color:#172033;
position:relative;
overflow:hidden;
}
#${APP_ID} .m0-topbar {
position:absolute;
top:0;
right:0;
left:0;
height:7px;
background:linear-gradient(
90deg,
#15445A,
#0DA9A6,
#07A869
);
}
#${APP_ID} .m0-sheet-header {
display:grid;
grid-template-columns:120px 1fr 180px;
gap:18px;
align-items:center;
margin-bottom:16px;
}
#${APP_ID} .m0-brand-side {
display:flex;
align-items:center;
justify-content:flex-start;
}
#${APP_ID} .m0-logo-img,
#${APP_ID} .m0-logo-placeholder {
width:70px;
height:70px;
border-radius:16px;
background:#F2F6F8;
border:1px solid #E2E9EE;
object-fit:contain;
}
#${APP_ID} .m0-logo-placeholder {
display:grid;
place-items:center;
font-size:29px;
font-weight:900;
color:#0DA9A6;
}
#${APP_ID} .m0-title-side {
text-align:center;
}
#${APP_ID} .m0-kicker {
display:inline-block;
padding:4px 10px;
background:#EDF7F7;
border-radius:999px;
color:#287B77;
font-size:11px;
font-weight:800;
margin-bottom:7px;
}
#${APP_ID} .m0-title-side h1 {
margin:0 0 8px;
font-size:27px;
color:#153A55;
}
#${APP_ID} .m0-meta {
display:flex;
justify-content:center;
gap:6px 12px;
flex-wrap:wrap;
font-size:11px;
color:#58667A;
}
#${APP_ID} .m0-meta span {
white-space:nowrap;
}
#${APP_ID} .m0-meta b {
color:#26364A;
}
#${APP_ID} .m0-week-side {
display:flex;
justify-content:flex-end;
}
#${APP_ID} .m0-week-box {
min-width:145px;
border:1px solid #DDE7EC;
border-radius:13px;
padding:9px 11px;
text-align:center;
background:#F8FBFC;
}
#${APP_ID} .m0-week-box small {
display:block;
color:#7B8797;
font-size:10px;
margin-bottom:3px;
}
#${APP_ID} .m0-week-box strong {
display:block;
color:#2C475C;
font-size:12px;
}
#${APP_ID} .m0-legend,
#${APP_ID} .m0-subject-legend {
display:flex;
align-items:center;
justify-content:center;
gap:7px 12px;
flex-wrap:wrap;
margin:7px 0 12px;
font-size:10px;
}
#${APP_ID} .m0-subject-legend {
margin-top:-5px;
color:#6A7583;
}
#${APP_ID} .m0-legend-title {
font-weight:800;
color:#445064;
}
#${APP_ID} .m0-legend-item {
display:inline-flex;
align-items:center;
gap:5px;
white-space:nowrap;
color:#4C596A;
}
#${APP_ID} .m0-legend-item.tiny {
font-size:9px;
}
#${APP_ID} .m0-legend-item i {
width:9px;
height:9px;
border-radius:50%;
display:inline-block;
}
#${APP_ID} .m0-schedule-table {
width:100%;
table-layout:fixed;
border-collapse:separate;
border-spacing:6px;
}
#${APP_ID} .m0-schedule-table th,
#${APP_ID} .m0-schedule-table td {
text-align:center;
vertical-align:middle;
}
#${APP_ID} .m0-schedule-table thead th {
background:#15445A;
color:#fff;
border-radius:10px;
padding:9px 5px;
height:58px;
}
#${APP_ID} .m0-schedule-table thead .m0-day-head {
width:88px;
background:#102E45;
}
#${APP_ID} .m0-period-title {
font-size:11px;
font-weight:900;
line-height:1.2;
}
#${APP_ID} .m0-period-time {
font-size:9px;
margin-top:4px;
color:#DCEAF2;
font-weight:500;
outline:none;
min-height:13px;
}
#${APP_ID} .m0-period-time.empty {
color:#94ACBC;
}
#${APP_ID} .m0-period-time:focus {
background:rgba(255,255,255,.12);
border-radius:5px;
}
#${APP_ID} .m0-day-cell {
background:#EFF5F8;
color:#15445A;
border-radius:10px;
padding:8px 4px;
font-size:12px;
font-weight:900;
}
#${APP_ID} .m0-schedule-table td {
padding:0;
height:86px;
}
#${APP_ID} .m0-lesson-card {
height:100%;
min-height:82px;
background:var(--cell-bg);
border:1px solid var(--cell-border);
color:var(--cell-text);
border-radius:11px;
padding:10px 6px 8px;
display:flex;
flex-direction:column;
justify-content:center;
gap:6px;
position:relative;
overflow:hidden;
}
#${APP_ID} .m0-subject-accent {
position:absolute;
top:0;
right:0;
left:0;
height:4px;
}
#${APP_ID} .m0-lesson-subject {
font-size:12px;
font-weight:900;
line-height:1.35;
outline:none;
}
#${APP_ID} .m0-lesson-secondary {
font-size:10px;
font-weight:700;
line-height:1.35;
opacity:.82;
outline:none;
}
#${APP_ID} [contenteditable="true"]:focus {
box-shadow:inset 0 -1px 0 rgba(23,63,95,.35);
}
#${APP_ID} .m0-empty-cell {
background:#FAFBFC;
border:1px dashed #E3E8ED;
border-radius:11px;
color:#C1C8D0;
}
#${APP_ID} .m0-note {
margin-top:10px;
padding:8px 12px;
border-radius:9px;
background:#F8FAFC;
color:#586579;
font-size:10px;
border-right:3px solid #A8C7D0;
}
#${APP_ID} .m0-footer {
margin-top:12px;
padding-top:9px;
border-top:1px solid #E8EDF1;
display:flex;
align-items:center;
justify-content:space-between;
font-size:9px;
color:#8A94A2;
}
#${APP_ID} .m0-footer strong {
color:#526273;
letter-spacing:.4px;
}
#${APP_ID} .m0-sheet.dense {
padding-top:26px;
}
#${APP_ID} .m0-sheet.dense .m0-sheet-header {
margin-bottom:10px;
}
#${APP_ID} .m0-sheet.dense .m0-schedule-table {
border-spacing:4px;
}
#${APP_ID} .m0-sheet.dense .m0-schedule-table td {
height:72px;
}
#${APP_ID} .m0-sheet.dense .m0-lesson-card {
min-height:68px;
padding:7px 5px;
}
#${APP_ID} .m0-sheet.dense .m0-lesson-subject {
font-size:11px;
}
#${APP_ID} .m0-sheet.dense .m0-lesson-secondary {
font-size:9px;
}
#${APP_ID} .m0-legend-count { font-size:8.5px; font-weight:800; color:#8B98A6; }
#${APP_ID} .m0-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:8px 0 11px; }
#${APP_ID} .m0-stat-card { min-height:48px; display:flex; align-items:center; justify-content:center; gap:7px; padding:7px 9px; border:1px solid #E0EAED; border-radius:11px; background:#F8FBFC; color:#486271; text-align:center; }
#${APP_ID} .m0-stat-card b { font-size:16px; color:#15445A; }
#${APP_ID} .m0-stat-card small { font-size:9px; font-weight:800; line-height:1.35; }
#${APP_ID} .m0-fit-control { grid-column:1/-1; display:grid; grid-template-columns:1fr 145px; align-items:center; gap:10px; padding:9px; border:1px solid #DCE9EC; border-radius:10px; background:#F8FCFC; }
#${APP_ID} .m0-fit-control b,#${APP_ID} .m0-fit-control small { display:block; }
#${APP_ID} .m0-fit-control b { color:#355061; font-size:10.5px; margin-bottom:2px; }
#${APP_ID} .m0-fit-control small { color:#8C9AA3; font-size:8.8px; line-height:1.45; }
#${APP_ID} .m0-fit-control select { width:100%; border:1px solid #D7E5E8; border-radius:8px; padding:7px 8px; background:#fff; color:#244650; font:inherit; font-size:9.5px; }
#${APP_ID} .m0-sheet.fit-auto-compact .m0-sheet-header,#${APP_ID} .m0-sheet.fit-auto-tight .m0-sheet-header,#${APP_ID} .m0-sheet.fit-auto-ultra .m0-sheet-header,#${APP_ID} .m0-sheet.fit-one-page .m0-sheet-header { margin-bottom:10px; }
#${APP_ID} .m0-sheet.fit-auto-compact .m0-schedule-table,#${APP_ID} .m0-sheet.fit-auto-tight .m0-schedule-table,#${APP_ID} .m0-sheet.fit-auto-ultra .m0-schedule-table,#${APP_ID} .m0-sheet.fit-one-page .m0-schedule-table { border-spacing:4px; }
#${APP_ID} .m0-sheet.fit-auto-compact .m0-schedule-table td { height:78px; }
#${APP_ID} .m0-sheet.fit-auto-compact .m0-lesson-card { min-height:74px; padding:8px 5px; }
#${APP_ID} .m0-sheet.fit-auto-tight .m0-schedule-table td { height:70px; }
#${APP_ID} .m0-sheet.fit-auto-tight .m0-lesson-card { min-height:66px; padding:6px 5px; }
#${APP_ID} .m0-sheet.fit-auto-tight .m0-lesson-subject { font-size:11px; }
#${APP_ID} .m0-sheet.fit-auto-tight .m0-lesson-secondary { font-size:9px; }
#${APP_ID} .m0-sheet.fit-auto-ultra,#${APP_ID} .m0-sheet.fit-one-page { padding-top:25px; }
#${APP_ID} .m0-sheet.fit-auto-ultra .m0-schedule-table td,#${APP_ID} .m0-sheet.fit-one-page .m0-schedule-table td { height:64px; }
#${APP_ID} .m0-sheet.fit-auto-ultra .m0-lesson-card,#${APP_ID} .m0-sheet.fit-one-page .m0-lesson-card { min-height:60px; padding:5px 4px; gap:4px; }
#${APP_ID} .m0-sheet.fit-auto-ultra .m0-lesson-subject,#${APP_ID} .m0-sheet.fit-one-page .m0-lesson-subject { font-size:10.3px; }
#${APP_ID} .m0-sheet.fit-auto-ultra .m0-lesson-secondary,#${APP_ID} .m0-sheet.fit-one-page .m0-lesson-secondary { font-size:8.6px; }
#${APP_ID} .m0-sheet.fit-auto-tight .m0-stats,#${APP_ID} .m0-sheet.fit-auto-ultra .m0-stats,#${APP_ID} .m0-sheet.fit-one-page .m0-stats { margin:5px 0 7px; }

#${OPEN_ID} {
position:fixed;
left:22px;
bottom:22px;
z-index:2147483000;
border:0;
border-radius:14px;
background:linear-gradient(
135deg,
#15445A,
#0DA9A6
);
color:#fff;
padding:12px 17px;
font-family:Tahoma,Arial,sans-serif;
font-size:13px;
font-weight:800;
box-shadow:0 10px 30px rgba(23,63,95,.28);
cursor:pointer;
}
#${OPEN_ID}:hover {
transform:translateY(-1px);
box-shadow:0 13px 34px rgba(23,63,95,.34);
}
@media(max-width:900px) {
#${APP_ID} .m0-app {
grid-template-columns:300px minmax(760px,1fr);
overflow:auto;
}
#${APP_ID} .m0-preview-area {
justify-content:flex-start;
}
}
@media (max-width:760px) {
#${APP_ID} .m0-time-row {
grid-template-columns:1fr 1fr;
}
#${APP_ID} .m0-time-label {
grid-column:1/-1;
}
#${APP_ID} .m0-time-quick {
grid-template-columns:1fr 1fr;
}
#${APP_ID} .m0-time-quick-title,
#${APP_ID} #m0-btn-fill-times {
grid-column:1/-1;
}
}
`;
const PRINT_CSS = `
* {
box-sizing:border-box;
}
html,
body {
margin:0;
padding:0;
background:#fff;
direction:rtl;
font-family:Tahoma,Arial,sans-serif;
color:#172033;
}
@page {
size:A4 landscape;
margin:7mm;
}
body {
print-color-adjust:exact;
-webkit-print-color-adjust:exact;
}
.m0-sheet {
width:100%;
background:#fff;
padding:4mm 4mm 2mm;
position:relative;
overflow:hidden;
}
.m0-topbar {
position:absolute;
top:0;
right:0;
left:0;
height:2mm;
background:linear-gradient(
90deg,
#15445A,
#0DA9A6,
#07A869
);
}
.m0-sheet-header {
display:grid;
grid-template-columns:27mm 1fr 43mm;
gap:4mm;
align-items:center;
margin-bottom:3mm;
}
.m0-brand-side {
display:flex;
align-items:center;
}
.m0-logo-img,
.m0-logo-placeholder {
width:17mm;
height:17mm;
border-radius:4mm;
background:#F2F6F8;
border:1px solid #E2E9EE;
object-fit:contain;
}
.m0-logo-placeholder {
display:grid;
place-items:center;
font-size:8mm;
font-weight:900;
color:#0DA9A6;
}
.m0-title-side {
text-align:center;
}
.m0-kicker {
display:inline-block;
padding:1mm 3mm;
background:#EDF7F7;
border-radius:8mm;
color:#287B77;
font-size:7pt;
font-weight:800;
margin-bottom:1mm;
}
.m0-title-side h1 {
margin:0 0 1.5mm;
font-size:17pt;
color:#153A55;
}
.m0-meta {
display:flex;
justify-content:center;
gap:1mm 3mm;
flex-wrap:wrap;
font-size:7pt;
color:#58667A;
}
.m0-meta b {
color:#26364A;
}
.m0-week-side {
display:flex;
justify-content:flex-end;
}
.m0-week-box {
min-width:37mm;
border:1px solid #DDE7EC;
border-radius:3mm;
padding:2mm;
text-align:center;
background:#F8FBFC;
}
.m0-week-box small {
display:block;
color:#7B8797;
font-size:6.5pt;
}
.m0-week-box strong {
display:block;
color:#2C475C;
font-size:7.5pt;
margin-top:1mm;
}
.m0-legend,
.m0-subject-legend {
display:flex;
align-items:center;
justify-content:center;
gap:1mm 3mm;
flex-wrap:wrap;
margin:1.5mm 0 2.5mm;
font-size:6.7pt;
}
.m0-subject-legend {
margin-top:-1mm;
color:#6A7583;
}
.m0-legend-title {
font-weight:800;
color:#445064;
}
.m0-legend-item {
display:inline-flex;
align-items:center;
gap:1mm;
white-space:nowrap;
color:#4C596A;
}
.m0-legend-item.tiny {
font-size:6pt;
}
.m0-legend-item i {
width:2.2mm;
height:2.2mm;
border-radius:50%;
display:inline-block;
}
.m0-schedule-table {
width:100%;
table-layout:fixed;
border-collapse:separate;
border-spacing:1.2mm;
}
.m0-schedule-table th,
.m0-schedule-table td {
text-align:center;
vertical-align:middle;
}
.m0-schedule-table thead th {
background:#15445A;
color:#fff;
border-radius:2.2mm;
padding:2mm 1mm;
height:13mm;
}
.m0-schedule-table thead .m0-day-head {
width:19mm;
background:#102E45;
}
.m0-period-title {
font-size:7.4pt;
font-weight:900;
}
.m0-period-time {
font-size:6.2pt;
margin-top:1mm;
color:#DCEAF2;
}
.m0-period-time.empty {
color:#94ACBC;
}
.m0-day-cell {
background:#EFF5F8;
color:#15445A;
border-radius:2.2mm;
padding:2mm 1mm;
font-size:7.7pt;
font-weight:900;
}
.m0-schedule-table td {
padding:0;
height:18mm;
}
.m0-lesson-card {
height:100%;
min-height:17mm;
background:var(--cell-bg);
border:1px solid var(--cell-border);
color:var(--cell-text);
border-radius:2.2mm;
padding:2mm 1.2mm;
display:flex;
flex-direction:column;
justify-content:center;
gap:1mm;
position:relative;
overflow:hidden;
}
.m0-subject-accent {
position:absolute;
top:0;
right:0;
left:0;
height:1mm;
}
.m0-lesson-subject {
font-size:7.4pt;
font-weight:900;
line-height:1.25;
}
.m0-lesson-secondary {
font-size:6.3pt;
font-weight:700;
line-height:1.25;
opacity:.82;
}
.m0-empty-cell {
background:#FAFBFC;
border:1px dashed #E3E8ED;
border-radius:2.2mm;
color:#C1C8D0;
}
.m0-note {
margin-top:2mm;
padding:1.5mm 2.5mm;
border-radius:2mm;
background:#F8FAFC;
color:#586579;
font-size:6.4pt;
border-right:1mm solid #A8C7D0;
}
.m0-legend-count { font-size:5.8pt; font-weight:800; color:#8B98A6; }
.m0-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1.5mm; margin:1mm 0 2mm; }
.m0-stat-card { min-height:9mm; display:flex; align-items:center; justify-content:center; gap:1.5mm; padding:1mm 1.5mm; border:1px solid #E0EAED; border-radius:2mm; background:#F8FBFC; color:#486271; text-align:center; }
.m0-stat-card b { font-size:9pt; color:#15445A; }
.m0-stat-card small { font-size:5.8pt; font-weight:800; }
.fit-auto-compact .m0-schedule-table,.fit-auto-tight .m0-schedule-table,.fit-auto-ultra .m0-schedule-table,.fit-one-page .m0-schedule-table { border-spacing:.9mm; }
.fit-auto-compact .m0-schedule-table td { height:16mm; }
.fit-auto-compact .m0-lesson-card { min-height:15mm; padding:1.6mm 1mm; }
.fit-auto-tight .m0-schedule-table td { height:14.5mm; }
.fit-auto-tight .m0-lesson-card { min-height:13.5mm; padding:1.2mm .9mm; }
.fit-auto-tight .m0-lesson-subject { font-size:6.7pt; }
.fit-auto-tight .m0-lesson-secondary { font-size:5.7pt; }
.fit-auto-ultra .m0-sheet-header,.fit-one-page .m0-sheet-header { margin-bottom:1.5mm; }
.fit-auto-ultra .m0-schedule-table td,.fit-one-page .m0-schedule-table td { height:13mm; }
.fit-auto-ultra .m0-lesson-card,.fit-one-page .m0-lesson-card { min-height:12mm; padding:1mm .8mm; gap:.6mm; }
.fit-auto-ultra .m0-lesson-subject,.fit-one-page .m0-lesson-subject { font-size:6.2pt; }
.fit-auto-ultra .m0-lesson-secondary,.fit-one-page .m0-lesson-secondary { font-size:5.3pt; }
.fit-auto-tight .m0-stats,.fit-auto-ultra .m0-stats,.fit-one-page .m0-stats { margin:.7mm 0 1.2mm; }

.m0-footer {
margin-top:2.5mm;
padding-top:1.5mm;
border-top:1px solid #E8EDF1;
display:flex;
justify-content:space-between;
font-size:6pt;
color:#8A94A2;
}
.m0-footer strong {
color:#526273;
}
.dense .m0-schedule-table {
border-spacing:.9mm;
}
.dense .m0-schedule-table td {
height:15.5mm;
}
.dense .m0-lesson-card {
min-height:14.5mm;
padding:1.5mm 1mm;
}
.dense .m0-lesson-subject {
font-size:6.8pt;
}
.dense .m0-lesson-secondary {
font-size:5.9pt;
}
`;
const MODERN_CSS = `
:root {
--m0-primary:#0B7F88;
--m0-primary-2:#10A69D;
--m0-green:#2BB673;
--m0-navy:#15445A;
--m0-ink:#163047;
--m0-muted:#6F7F8F;
--m0-surface:#FFFFFF;
--m0-bg:#EFF5F7;
--m0-soft:#F6FAFB;
--m0-border:#DDE8EC;
--m0-success:#138A63;
}
body.${BODY_LOCK_CLASS} {
overflow:hidden !important;
}
#${OPEN_ID} {
position:relative !important;
inset:auto !important;
left:auto !important;
bottom:auto !important;
width:auto;
margin:12px 0 16px;
padding:13px 15px;
border:1px solid #D8E8EA;
border-radius:15px;
background:linear-gradient(135deg,#F8FCFD 0%,#F2FAF8 100%);
box-shadow:0 6px 20px rgba(23,63,95,.07);
display:flex;
align-items:center;
justify-content:space-between;
gap:16px;
direction:rtl;
font-family:Tahoma,Arial,sans-serif;
transform:none !important;
color:var(--m0-ink);
}
#${OPEN_ID}:hover {
transform:none !important;
box-shadow:0 8px 24px rgba(23,63,95,.09);
}
#${OPEN_ID} .m0-launch-copy {
display:flex;
align-items:center;
gap:11px;
min-width:0;
}
#${OPEN_ID} .m0-launch-mark {
width:39px;
height:39px;
border-radius:12px;
display:grid;
place-items:center;
flex:0 0 auto;
background:linear-gradient(135deg,var(--m0-primary),var(--m0-primary-2));
color:#fff;
font-size:21px;
box-shadow:0 6px 14px rgba(11,127,136,.18);
}
#${OPEN_ID} strong {
display:block;
font-size:13px;
color:#15445A;
margin-bottom:3px;
}
#${OPEN_ID} small {
display:block;
color:#72808D;
font-size:11px;
font-weight:500;
}
#${OPEN_ID} button {
border:0;
border-radius:11px;
padding:10px 15px;
color:#fff;
background:linear-gradient(135deg,var(--m0-primary),var(--m0-primary-2));
font:800 12px Tahoma,Arial,sans-serif;
cursor:pointer;
white-space:nowrap;
box-shadow:0 7px 16px rgba(11,127,136,.17);
}
#${APP_ID} .m0-backdrop {
background:rgba(13,37,53,.48);
backdrop-filter:blur(5px);
}
#${APP_ID} .m0-app {
inset:3vh 2vw;
max-width:1760px;
margin:auto;
border-radius:22px;
background:#F3F7F9;
border:1px solid rgba(255,255,255,.7);
display:grid;
grid-template-columns:minmax(315px,360px) minmax(0,1fr);
grid-template-rows:76px minmax(0,1fr) 76px;
grid-template-areas:
"head head"
"panel preview"
"export export";
box-shadow:0 32px 90px rgba(15,42,58,.30);
overflow:hidden;
}
#${APP_ID} .m0-workspace-head {
grid-area:head;
background:rgba(255,255,255,.97);
border-bottom:1px solid var(--m0-border);
display:grid;
grid-template-columns:auto 1fr auto;
align-items:center;
gap:18px;
padding:0 22px;
}
#${APP_ID} .m0-head-brand {
display:flex;
align-items:center;
gap:11px;
min-width:max-content;
}
#${APP_ID} .m0-brand-mark {
width:46px;
height:46px;
border-radius:13px;
display:grid;
place-items:center;
background:#fff;
border:1px solid #E2ECEF;
box-shadow:0 7px 16px rgba(11,127,136,.12);
overflow:hidden;
padding:3px;
}
#${APP_ID} .m0-brand-mark img {
width:100%;
height:100%;
object-fit:contain;
display:block;
}
#${APP_ID} .m0-head-brand small {
display:block;
color:var(--m0-primary);
font-size:10px;
font-weight:900;
margin-bottom:2px;
}
#${APP_ID} .m0-head-brand h1 {
margin:0;
color:var(--m0-navy);
font-size:17px;
line-height:1.25;
}
#${APP_ID} .m0-head-badges {
display:flex;
align-items:center;
justify-content:center;
flex-wrap:wrap;
gap:7px;
}
#${APP_ID} .m0-badge {
display:inline-flex;
align-items:center;
min-height:28px;
padding:4px 10px;
border:1px solid #E0E9EC;
border-radius:999px;
background:#F8FBFC;
color:#587080;
font-size:10px;
font-weight:800;
}
#${APP_ID} .m0-badge.role {
color:#245D83;
background:#EEF7FC;
border-color:#D7EAF4;
}
#${APP_ID} .m0-badge.success {
color:#167255;
background:#EEF9F4;
border-color:#D6EFE3;
}
#${APP_ID} .m0-head-actions {
display:flex;
align-items:center;
gap:7px;
}
#${APP_ID} .m0-head-actions button {
width:36px;
height:36px;
border:1px solid #DDE7EA;
border-radius:11px;
background:#fff;
color:#456070;
cursor:pointer;
font-weight:900;
font-size:16px;
}
#${APP_ID} .m0-head-actions button:hover {
background:#F2F8F8;
color:var(--m0-primary);
}
#${APP_ID} .m0-head-actions .close {
font-size:21px;
}
#${APP_ID} .m0-panel {
grid-area:panel;
border-left:1px solid var(--m0-border);
background:#F8FBFC;
padding:17px;
overflow:auto;
scrollbar-width:thin;
}
#${APP_ID} .m0-settings-intro {
padding:3px 2px 12px;
}
#${APP_ID} .m0-eyebrow {
color:var(--m0-primary);
font-size:10px;
font-weight:900;
}
#${APP_ID} .m0-settings-intro h2 {
margin:3px 0 5px;
color:var(--m0-ink);
font-size:16px;
}
#${APP_ID} .m0-settings-intro p {
margin:0;
color:#798894;
font-size:10.5px;
line-height:1.7;
}
#${APP_ID} .m0-accordion {
margin:0 0 9px;
border:1px solid var(--m0-border);
border-radius:14px;
background:#fff;
overflow:hidden;
box-shadow:0 3px 12px rgba(31,72,86,.035);
}
#${APP_ID} .m0-accordion summary {
list-style:none;
display:grid;
grid-template-columns:34px 1fr auto;
align-items:center;
gap:9px;
padding:11px 12px;
cursor:pointer;
user-select:none;
}
#${APP_ID} .m0-accordion summary::-webkit-details-marker { display:none; }
#${APP_ID} .m0-accordion summary > i { font-style:normal; color:#82929D; transition:.2s; }
#${APP_ID} .m0-accordion[open] summary > i { transform:rotate(180deg); }
#${APP_ID} .m0-summary-icon {
width:30px;
height:30px;
display:grid;
place-items:center;
border-radius:9px;
background:#EDF8F7;
color:var(--m0-primary);
font-size:14px;
font-weight:900;
}
#${APP_ID} .m0-accordion summary strong {
display:block;
color:#274255;
font-size:11.5px;
margin-bottom:2px;
}
#${APP_ID} .m0-accordion summary small {
display:block;
color:#8A98A2;
font-size:9px;
}
#${APP_ID} .m0-accordion-body {
border-top:1px solid #EDF2F4;
padding:12px;
}
#${APP_ID} .m0-field { margin-bottom:10px; }
#${APP_ID} .m0-field label { color:#627482; font-size:10px; margin-bottom:5px; }
#${APP_ID} .m0-field input,
#${APP_ID} .m0-field textarea {
border-color:#DCE7EA;
background:#FAFCFD;
border-radius:9px;
padding:9px 10px;
font-size:11px;
}
#${APP_ID} .m0-field input:focus,
#${APP_ID} .m0-field textarea:focus {
border-color:#7BC8C5;
box-shadow:0 0 0 3px rgba(16,166,157,.10);
}
#${APP_ID} .m0-check-grid { display:grid; gap:8px; }
#${APP_ID} .m0-check {
margin:0;
min-height:51px;
padding:8px 9px;
border:1px solid #E7EFF1;
border-radius:10px;
background:#FBFDFD;
align-items:flex-start;
}
#${APP_ID} .m0-check input { margin-top:3px; accent-color:var(--m0-primary-2); }
#${APP_ID} .m0-check span { min-width:0; }
#${APP_ID} .m0-check b { display:block; color:#355061; font-size:10.5px; margin-bottom:2px; }
#${APP_ID} .m0-check small { display:block; color:#8C9AA3; font-size:8.8px; line-height:1.45; }
#${APP_ID} .m0-inline-note {
margin-bottom:10px;
padding:8px 9px;
border-radius:9px;
background:#EFF8F8;
border-right:3px solid #54B7B0;
color:#597985;
font-size:9px;
line-height:1.6;
}
#${APP_ID} .m0-times { gap:6px; }
#${APP_ID} .m0-time-row { grid-template-columns:95px 1fr; }
#${APP_ID} .m0-time-row span { font-size:9.5px; color:#5E7482; }
#${APP_ID} .m0-time-row input { border-color:#DCE7EA; background:#FBFDFD; font-size:9.5px; }
#${APP_ID} .m0-section-caption { font-size:10px; color:#526978; font-weight:800; margin:4px 0 7px; }
#${APP_ID} .m0-advanced-logo { grid-column:1/-1; padding-top:3px; }
#${APP_ID} .m0-small-btn { border-color:#DDE8EB; border-radius:9px; font-size:9.5px; padding:7px 9px; }
#${APP_ID} .m0-logo-status { font-size:8.5px; }
#${APP_ID} .m0-time-row {
display:grid;
grid-template-columns:86px minmax(0,1fr) minmax(0,1fr);
align-items:end;
gap:7px;
padding:7px;
border:1px solid #E2ECEE;
border-radius:11px;
background:#FBFDFD;
}
#${APP_ID} .m0-time-label {
align-self:center;
font-size:10px;
font-weight:800;
color:#506776;
}
#${APP_ID} .m0-time-box {
display:grid;
gap:4px;
min-width:0;
}
#${APP_ID} .m0-time-box small {
font-size:8.5px;
color:#7A8C97;
font-weight:700;
}
#${APP_ID} .m0-time-row .m0-time-box input[type=time] {
width:100%;
min-width:0;
border:1px solid #D7E5E8;
border-radius:8px;
padding:7px 6px;
background:#fff;
color:#244650;
font-size:10px;
direction:ltr;
}
#${APP_ID} .m0-time-quick {
display:grid;
grid-template-columns:1fr 1fr 1fr auto;
gap:7px;
align-items:end;
padding:9px;
margin-bottom:9px;
border:1px solid #CFE9E5;
border-radius:12px;
background:#F2FBF9;
}
#${APP_ID} .m0-time-quick-title {
grid-column:1/-1;
font-size:10px;
font-weight:900;
color:#147D75;
}
#${APP_ID} .m0-time-quick label {
display:grid;
gap:4px;
min-width:0;
}
#${APP_ID} .m0-time-quick small {
font-size:8.5px;
color:#64808A;
font-weight:700;
}
#${APP_ID} .m0-time-quick input {
width:100%;
min-width:0;
border:1px solid #D5E7E7;
border-radius:8px;
background:#fff;
padding:7px;
font-size:10px;
direction:ltr;
}
#${APP_ID} .m0-time-quick label em {
display:none;
}
#${APP_ID} #m0-btn-fill-times {
border:0;
border-radius:9px;
background:#168F84;
color:#fff;
font-weight:800;
padding:8px 10px;
cursor:pointer;
white-space:nowrap;
}
#${APP_ID} .m0-update {
position:sticky;
bottom:-17px;
margin:13px -17px -17px;
padding:12px 17px 14px;
background:linear-gradient(to top,#F8FBFC 75%,rgba(248,251,252,0));
z-index:4;
}
#${APP_ID} .m0-update button {
border-radius:12px;
padding:11px 12px;
background:linear-gradient(135deg,var(--m0-primary),var(--m0-primary-2));
box-shadow:0 8px 17px rgba(11,127,136,.16);
}
#${APP_ID} .m0-update button span { margin-left:5px; }
#${APP_ID} .m0-update > small { display:block; text-align:center; margin-top:6px; color:#91A0A8; font-size:8.5px; }
#${APP_ID} .m0-preview-shell {
grid-area:preview;
min-width:0;
min-height:0;
display:grid;
grid-template-rows:55px minmax(0,1fr);
background:#EDF3F5;
}
#${APP_ID} .m0-preview-toolbar {
display:flex;
align-items:center;
justify-content:space-between;
gap:15px;
padding:0 20px;
background:#F8FBFC;
border-bottom:1px solid var(--m0-border);
}
#${APP_ID} .m0-preview-toolbar small { display:block; color:#83939D; font-size:9px; margin-bottom:2px; }
#${APP_ID} .m0-preview-toolbar strong { color:#26485B; font-size:12px; }
#${APP_ID} .m0-preview-status {
display:inline-flex;
align-items:center;
gap:5px;
border:1px solid #D9ECE4;
border-radius:999px;
background:#F1FAF6;
color:#257158;
padding:5px 9px;
font-size:9px;
font-weight:800;
}
#${APP_ID} .m0-preview-status.is-dirty {
color:#A46B16;
background:#FFF9EE;
border-color:#F3E4C1;
}
#${APP_ID} .m0-preview-area {
overflow:auto;
padding:28px 34px 42px;
background:
linear-gradient(90deg,rgba(255,255,255,.34) 1px,transparent 1px) 0 0/24px 24px,
linear-gradient(rgba(255,255,255,.34) 1px,transparent 1px) 0 0/24px 24px,
#EAF1F3;
}
#${APP_ID} #m0-preview { margin:auto; width:max-content; }
#${APP_ID} .m0-sheet { box-shadow:0 16px 44px rgba(31,72,86,.13); border:1px solid rgba(210,225,229,.7); }
#${APP_ID} .m0-export-bar {
grid-area:export;
display:flex;
align-items:center;
justify-content:space-between;
gap:20px;
padding:10px 22px;
background:#fff;
border-top:1px solid var(--m0-border);
}
#${APP_ID} .m0-export-state {
display:flex;
align-items:center;
gap:9px;
color:#2F5A6D;
}
#${APP_ID} .m0-export-state > span {
width:31px;
height:31px;
border-radius:50%;
display:grid;
place-items:center;
background:#EAF8F1;
color:#17815D;
font-weight:900;
}
#${APP_ID} .m0-export-state strong { display:block; font-size:11px; margin-bottom:2px; }
#${APP_ID} .m0-export-state small { display:block; color:#8A99A3; font-size:8.5px; }
#${APP_ID} .m0-export-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
#${APP_ID} .m0-export {
min-width:94px;
border:1px solid #DCE7EA;
border-radius:11px;
background:#F9FBFC;
color:#3B5868;
padding:9px 12px;
cursor:pointer;
font-size:10px;
font-weight:900;
}
#${APP_ID} .m0-export:hover { background:#F1F7F8; border-color:#C8DCDF; }
#${APP_ID} .m0-export.primary { color:#fff; background:linear-gradient(135deg,var(--m0-primary),var(--m0-primary-2)); border-color:transparent; }
#${APP_ID} .m0-export span { margin-left:4px; }
#${APP_ID} #m0-dialog-layer:empty { display:none; }
#${APP_ID} #m0-dialog-layer { position:absolute; inset:0; z-index:25; display:grid; place-items:center; padding:20px; }
#${APP_ID} .m0-dialog-backdrop { position:absolute; inset:0; background:rgba(17,45,60,.50); backdrop-filter:blur(5px); }
#${APP_ID} .m0-dialog {
position:relative;
width:min(520px,calc(100vw - 38px));
border:1px solid rgba(255,255,255,.72);
border-radius:22px;
background:#fff;
padding:28px;
text-align:center;
box-shadow:0 28px 70px rgba(15,50,65,.28);
color:#244557;
}
#${APP_ID} .m0-dialog-close { position:absolute; top:12px; left:12px; width:34px; height:34px; border:1px solid #DFE9EC; border-radius:10px; background:#fff; color:#54707F; cursor:pointer; font-size:19px; }
#${APP_ID} .m0-dialog-mark { width:86px; height:86px; margin:0 auto 10px; border-radius:22px; display:grid; place-items:center; background:#fff; border:1px solid #E1ECEF; box-shadow:0 10px 24px rgba(11,127,136,.16); overflow:hidden; padding:5px; }
#${APP_ID} .m0-dialog-mark img { width:100%; height:100%; object-fit:contain; display:block; }
#${APP_ID} .m0-dialog-kicker { color:var(--m0-primary); font-size:10px; font-weight:900; margin-top:7px; }
#${APP_ID} .m0-dialog h3 { margin:4px 0 7px; color:#15445A; font-size:21px; }
#${APP_ID} .m0-dialog > p { max-width:390px; margin:0 auto; color:#758791; font-size:11px; line-height:1.8; }
#${APP_ID} .m0-guide-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin:22px 0 14px; }
#${APP_ID} .m0-guide-steps > div { border:1px solid #E2ECEF; border-radius:13px; background:#F8FBFC; padding:12px 8px; }
#${APP_ID} .m0-guide-steps b { width:27px; height:27px; border-radius:50%; display:grid; place-items:center; margin:0 auto 7px; background:#E5F5F3; color:#16867E; font-size:10px; }
#${APP_ID} .m0-guide-steps strong { display:block; color:#31566A; font-size:10.5px; }
#${APP_ID} .m0-guide-steps small { display:block; color:#94A0A7; font-size:8.5px; margin-top:3px; }
#${APP_ID} .m0-format-row { display:flex; justify-content:center; gap:9px; color:#43828A; font-size:9px; margin:0 0 17px; }
#${APP_ID} .m0-format-row i { color:#B6C8CC; }
#${APP_ID} .m0-dialog-primary { width:100%; border:0; border-radius:12px; padding:11px 14px; color:#fff; background:linear-gradient(135deg,var(--m0-primary),var(--m0-primary-2)); font-size:11px; font-weight:900; cursor:pointer; box-shadow:0 8px 18px rgba(11,127,136,.17); }
#${APP_ID} .m0-version { color:#8A98A2 !important; font-size:9px !important; }
#${APP_ID} .m0-author-card { margin:18px auto 14px; padding:13px; border:1px solid #E3ECEF; border-radius:13px; background:#F8FBFC; }
#${APP_ID} .m0-author-card small,#${APP_ID} .m0-author-card strong,#${APP_ID} .m0-author-card span { display:block; }
#${APP_ID} .m0-author-card small { color:#8D9AA2; font-size:8.5px; }
#${APP_ID} .m0-author-card strong { color:#244B60; font-size:13px; margin:3px 0 2px; }
#${APP_ID} .m0-author-card span { color:#0B7F88; font-size:10px; font-weight:800; }
#${APP_ID} .m0-socials { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
#${APP_ID} .m0-socials a { text-decoration:none; border:1px solid #DFE9EC; border-radius:10px; padding:9px; color:#36596B; background:#fff; font-size:9.5px; font-weight:800; }
#${APP_ID} .m0-copyright { margin-top:15px; padding-top:12px; border-top:1px solid #EDF2F4; color:#87969F; font-size:8.5px; line-height:1.7; }
@media(max-width:1050px) {
#${APP_ID} .m0-app {
inset:1.5vh 1vw;
grid-template-columns:300px minmax(0,1fr);
}
#${APP_ID} .m0-head-badges .m0-badge:nth-last-child(-n+2) { display:none; }
}
@media(max-width:760px) {
#${OPEN_ID} { align-items:stretch; flex-direction:column; }
#${OPEN_ID} button { width:100%; }
#${APP_ID} .m0-app {
inset:0;
border-radius:0;
grid-template-columns:1fr;
grid-template-rows:auto auto minmax(55vh,1fr) auto;
grid-template-areas:"head" "panel" "preview" "export";
overflow:auto;
}
#${APP_ID} .m0-workspace-head { grid-template-columns:1fr auto; padding:10px 12px; min-height:64px; position:sticky; top:0; z-index:9; }
#${APP_ID} .m0-head-badges { display:none; }
#${APP_ID} .m0-head-brand h1 { font-size:14px; }
#${APP_ID} .m0-brand-mark { width:38px; height:38px; }
#${APP_ID} .m0-panel { max-height:none; overflow:visible; border-left:0; border-bottom:1px solid var(--m0-border); }
#${APP_ID} .m0-update { position:static; margin:12px 0 0; padding:0; background:none; }
#${APP_ID} .m0-preview-shell { min-height:65vh; }
#${APP_ID} .m0-preview-area { padding:18px 14px 30px; }
#${APP_ID} .m0-export-bar { align-items:stretch; flex-direction:column; padding:10px 12px 12px; position:sticky; bottom:0; z-index:8; }
#${APP_ID} .m0-export-state { display:none; }
#${APP_ID} .m0-export-actions { display:grid; grid-template-columns:1fr 1fr; }
#${APP_ID} .m0-export { min-width:0; }
#${APP_ID} .m0-guide-steps { grid-template-columns:1fr; }
#${APP_ID} .m0-socials { grid-template-columns:1fr; }
}
`;
function injectStyle() {
if (
document.getElementById(
STYLE_ID
)
) {
return;
}
const style =
document.createElement(
'style'
);
style.id =
STYLE_ID;
style.textContent =
BASE_CSS + MODERN_CSS;
document.head
.appendChild(
style
);
}
function field(
label,
key,
placeholder = ''
) {
return `
<div class="m0-field">
<label>
${esc(label)}
</label>
<input
data-pref="${key}"
value="${esc(state.prefs[key] || '')}"
placeholder="${esc(placeholder)}"
>
</div>
`;
}
function renderPanel() {
const timeRows =
state.data.periodLabels
.map(
(
label,
index
) => {
const parsed = parseTimeRange(state.data.times[index] || '');
return `
<div class="m0-time-row">
<span class="m0-time-label">
${esc(periodTitle(label, index))}
</span>
<label class="m0-time-box">
<small>البداية</small>
<input
type="time"
data-time-start="${index}"
value="${esc(parsed.start)}"
aria-label="بداية ${esc(periodTitle(label, index))}"
>
</label>
<label class="m0-time-box">
<small>النهاية</small>
<input
type="time"
data-time-end="${index}"
value="${esc(parsed.end)}"
aria-label="نهاية ${esc(periodTitle(label, index))}"
>
</label>
</div>
`;
}
)
.join('');
return `
<div class="m0-settings-intro">
<div>
<span class="m0-eyebrow">إعدادات الجدول</span>
<h2>خصص جدولك كما يناسبك</h2>
<p>تمت قراءة بيانات الجدول من مدرستي. عدّل ما تحتاجه فقط.</p>
</div>
</div>
<details class="m0-accordion" open>
<summary>
<span class="m0-summary-icon">▦</span>
<span>
<strong>بيانات الجدول</strong>
<small>العنوان وبيانات المعلم أو الطالب</small>
</span>
<i>⌄</i>
</summary>
<div class="m0-accordion-body">
${
field(
isTeacher ? 'اسم المعلم' : 'اسم الطالب',
'name',
isTeacher ? 'اسم المعلم' : 'اسم الطالب'
)
}
${field('اسم المدرسة','school','اسم المدرسة')}
${field('الإدارة / المنطقة التعليمية','region','اختياري — يُقرأ تلقائيًا إن توفر')}
<div class="m0-grid2">
${field('المرحلة','stage','ابتدائي / متوسط / ثانوي')}
${isStudent ? field('الصف / الفصل','className','مثال: الصف الثالث أ') : field('الفصل الدراسي','term','مثال: الفصل الدراسي الأول')}
</div>
${
isTeacher
? field('المادة','specialty','تُقرأ من الجدول تلقائيًا')
: ''
}
<div class="m0-grid2">
${field('العام الدراسي','academicYear','1448 هـ')}
${isStudent ? field('الفصل الدراسي','term','اختياري') : ''}
</div>
${
field(
'عنوان الجدول',
'title',
isTeacher
? 'الجدول الدراسي الأسبوعي للمعلم'
: 'الجدول الدراسي الأسبوعي للطالب'
)
}
<div class="m0-field">
<label>ملاحظة أسفل الجدول</label>
<textarea
data-pref="note"
placeholder="ملاحظة اختيارية تظهر أسفل الجدول"
>${esc(state.prefs.note || '')}</textarea>
</div>
</div>
</details>
<details class="m0-accordion" open>
<summary>
<span class="m0-summary-icon">◉</span>
<span>
<strong>المظهر</strong>
<small>طريقة عرض المواد والتفاصيل</small>
</span>
<i>⌄</i>
</summary>
<div class="m0-accordion-body m0-check-grid">
<label class="m0-check">
<input type="checkbox" data-check="showLegend" ${state.prefs.showLegend ? 'checked' : ''}>
<span><b>مفتاح الألوان</b><small>إظهار دليل الألوان أسفل العنوان</small></span>
</label>
<label class="m0-check">
<input type="checkbox" data-check="showStats" ${state.prefs.showStats !== false ? 'checked' : ''}>
<span><b>ملخص الجدول</b><small>إجمالي الحصص ومؤشرات سريعة مناسبة للدور</small></span>
</label>
<label class="m0-check">
<input type="checkbox" data-check="showSecondary" ${state.prefs.showSecondary ? 'checked' : ''}>
<span><b>${isTeacher ? 'الفصل داخل الحصة' : 'اسم المعلم داخل الحصة'}</b><small>إظهار المعلومة الثانوية داخل كل حصة</small></span>
</label>
<label class="m0-check">
<input type="checkbox" data-check="showBrandLogo" ${state.prefs.showBrandLogo !== false ? 'checked' : ''}>
<span><b>شعار مصمم الجدول الدراسي</b><small>إظهار الأيقونة الافتراضية في الجدول المطبوع والمصدّر</small></span>
</label>
${
isTeacher
? `
<label class="m0-check">
<input type="checkbox" data-check="showSubjectAccent" ${state.prefs.showSubjectAccent ? 'checked' : ''}>
<span><b>إبراز المواد</b><small>تمييز المواد عند تعددها داخل الحصة</small></span>
</label>
`
: ''
}
</div>
</details>
<details class="m0-accordion">
<summary>
<span class="m0-summary-icon">◷</span>
<span>
<strong>الأوقات</strong>
<small>أوقات الحصص في رأس الجدول</small>
</span>
<i>⌄</i>
</summary>
<div class="m0-accordion-body">
<div class="m0-inline-note">
${isTeacher ? (state.data.timeSource === 'system' ? '✓ تم اكتشاف أوقات الحصص تلقائيًا من بيانات مدرستي، ويمكن تعديلها عند الحاجة.' : 'لم تتوفر الأوقات تلقائيًا؛ يمكنك إدخالها أو استخدام التعبئة السريعة.') : 'الأوقات المكتشفة من صفحة الطالب تظهر هنا ويمكن تعديلها.'}
</div>
${
isTeacher
? `
<div class="m0-time-quick">
<div class="m0-time-quick-title">⚡ تعبئة الأوقات سريعًا</div>
<label><small>بداية الأولى</small><input type="time" id="m0-quick-start" value="07:00"></label>
<label><small>مدة الحصة</small><input type="number" id="m0-quick-duration" min="1" max="180" value="45"><em>دقيقة</em></label>
<label><small>الفاصل</small><input type="number" id="m0-quick-gap" min="0" max="120" value="5"><em>دقائق</em></label>
<button type="button" id="m0-btn-fill-times">تعبئة تلقائية</button>
</div>
`
: ''
}
<div class="m0-times">${timeRows}</div>
</div>
</details>
<details class="m0-accordion">
<summary>
<span class="m0-summary-icon">⚙</span>
<span>
<strong>إعدادات متقدمة</strong>
<small>خيارات إضافية للتصميم والحفظ</small>
</span>
<i>⌄</i>
</summary>
<div class="m0-accordion-body m0-check-grid">
<label class="m0-fit-control">
<span><b>احتواء صفحة A4</b><small>يضبط كثافة الجدول تلقائيًا عند الطباعة والتصدير.</small></span>
<select data-pref="fitMode">
<option value="auto" ${(state.prefs.fitMode || 'auto') === 'auto' ? 'selected' : ''}>تلقائي (موصى به)</option>
<option value="comfortable" ${state.prefs.fitMode === 'comfortable' ? 'selected' : ''}>مريح</option>
<option value="one-page" ${state.prefs.fitMode === 'one-page' ? 'selected' : ''}>صفحة واحدة</option>
</select>
</label>
<label class="m0-check">
<input type="checkbox" data-check="dense" ${state.prefs.dense ? 'checked' : ''}>
<span><b>وضع مضغوط</b><small>تقليل المسافات لعرض جدول أكثر كثافة</small></span>
</label>
<label class="m0-check">
<input type="checkbox" data-check="monochrome" ${state.prefs.monochrome ? 'checked' : ''}>
<span><b>أبيض وأسود</b><small>مناسب للطباعة الاقتصادية</small></span>
</label>
<label class="m0-check">
<input type="checkbox" data-check="remember" ${state.prefs.remember ? 'checked' : ''}>
<span><b>حفظ بياناتي</b><small>حفظ الإعدادات في هذا المتصفح</small></span>
</label>
<div class="m0-advanced-logo">
<div class="m0-section-caption">شعار مخصص (اختياري)</div>
<div class="m0-upload">
<label class="m0-small-btn" for="m0-logo-input">اختيار شعار مخصص</label>
<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" id="m0-logo-input">
<button type="button" class="m0-small-btn" id="m0-btn-remove-logo">إزالة</button>
<div id="m0-logo-status" class="m0-logo-status">${state.logoDataUrl ? 'شعار محفوظ' : 'لم يتم اختيار شعار'}</div>
</div>
</div>
</div>
</details>
<div class="m0-live-preview-note">
<span>✓</span>
<div><b>المعاينة تتحدث تلقائيًا</b><small>أي تغيير في البيانات أو المظهر أو الأوقات يظهر مباشرة.</small></div>
</div>
`;
}
function readControls(
root
) {
root
.querySelectorAll(
'[data-pref]'
)
.forEach(
input => {
const key =
(
input.dataset.pref ||
''
).trim();
if (key) {
state.prefs[
key
] =
input.value;
}
}
);
root
.querySelectorAll(
'[data-check]'
)
.forEach(
input => {
const key =
(
input.dataset.check ||
''
).trim();
if (key) {
state.prefs[
key
] =
input.checked;
}
}
);
const times =
Array.from(
{
length: state.data.periods
},
(_, index) => {
const start = root.querySelector(`[data-time-start="${index}"]`)?.value || '';
const end = root.querySelector(`[data-time-end="${index}"]`)?.value || '';
return formatTimeRange(start, end);
}
);
state.data.times = times;
state.prefs.times = [
...times
];
state.prefs.logoDataUrl =
state.logoDataUrl;
}
function applySmartFit(scope = document) {
const sheet =
scope.querySelector?.('#m0-print-area') ||
document.querySelector(`#${APP_ID} #m0-print-area`);
if (!sheet) return;
sheet.classList.remove(
'fit-auto-compact',
'fit-auto-tight',
'fit-auto-ultra'
);
const mode = state.prefs.fitMode || 'auto';
if (mode !== 'auto') return;
const targetHeight = 790;
for (const level of [
'fit-auto-compact',
'fit-auto-tight',
'fit-auto-ultra'
]) {
if (sheet.scrollHeight <= targetHeight) break;
sheet.classList.add(level);
void sheet.offsetHeight;
}
}
function renderPreview() {
const preview =
document.querySelector(
`#${APP_ID} #m0-preview`
);
if (preview) {
preview.innerHTML =
buildPreview();
requestAnimationFrame(() => applySmartFit(preview));
}
}
function toast(
message
) {
let element =
document.getElementById(
TOAST_ID
);
if (!element) {
element =
document.createElement(
'div'
);
element.id =
TOAST_ID;
Object.assign(
element.style,
{
position:
'fixed',
left:
'50%',
bottom:
'28px',
transform:
'translateX(-50%)',
zIndex:
'2147483647',
background:
'#172033',
color:
'#fff',
padding:
'10px 15px',
borderRadius:
'10px',
fontFamily:
'Tahoma,Arial,sans-serif',
fontSize:
'12px',
boxShadow:
'0 8px 25px rgba(0,0,0,.2)',
transition:
'opacity .2s'
}
);
document.body
.appendChild(
element
);
}
element.textContent =
message;
element.style.opacity =
'1';
clearTimeout(
element._timer
);
element._timer =
setTimeout(
() => {
element.style.opacity =
'0';
},
2400
);
}
function handleLogoFile(
file
) {
if (!file) {
return;
}
if (
!file.type
.startsWith(
'image/'
)
) {
toast(
'اختر ملف صورة صحيحًا.'
);
return;
}
const reader =
new FileReader();
reader.onload =
() => {
state.logoDataUrl =
String(
reader.result ||
''
);
const status =
document.querySelector(
`#${APP_ID} #m0-logo-status`
);
if (status) {
status.textContent =
`تم اختيار: ${file.name}`;
}
toast(
'تم تحميل الشعار. اضغط «تحديث المعاينة».'
);
};
reader.onerror =
() => {
toast(
'تعذر قراءة الشعار. جرّب PNG أو JPG.'
);
};
reader.readAsDataURL(
file
);
}
function removeLogo() {
state.logoDataUrl =
'';
state.prefs.logoDataUrl =
'';
const input =
document.querySelector(
`#${APP_ID} #m0-logo-input`
);
if (input) {
input.value =
'';
}
const status =
document.querySelector(
`#${APP_ID} #m0-logo-status`
);
if (status) {
status.textContent =
'لم يتم اختيار شعار';
}
renderPreview();
savePrefs();
toast(
'تمت إزالة الشعار.'
);
}
function closeDesigner() {
document.body.classList.remove(
BODY_LOCK_CLASS
);
document
.getElementById(
APP_ID
)
?.remove();
}
function setPreviewStatus(
root,
dirty = false
) {
const status =
root.querySelector(
'#m0-preview-status'
);
if (!status) return;
status.classList.toggle(
'is-dirty',
dirty
);
status.innerHTML = dirty
? '<span>●</span> توجد تغييرات غير مطبقة'
: '<span>✓</span> المعاينة محدثة';
}
function showDialog(
root,
type = 'guide'
) {
const layer =
root.querySelector(
'#m0-dialog-layer'
);
if (!layer) return;
const roleLabel =
isTeacher
? 'المعلم'
: 'الطالب';
if (type === 'about') {
layer.innerHTML = `
<div class="m0-dialog-backdrop" data-dialog-close></div>
<section class="m0-dialog m0-about-dialog" role="dialog" aria-modal="true" aria-label="حول الأداة">
<button class="m0-dialog-close" type="button" data-dialog-close>×</button>
<div class="m0-dialog-mark"><img src="${BRAND_ICON_DATA}" alt=""></div>
<div class="m0-dialog-kicker">حول الأداة</div>
<h3>مدرستي - مصمم الجدول الدراسي</h3>
<p class="m0-version">الإصدار 2.1.1</p>
<div class="m0-author-card">
<small>تصميم وتطوير</small>
<strong>Mohammed Almalki</strong>
<span>M0HM3D85</span>
</div>
<div class="m0-socials">
<a href="https://x.com/M0HM3D85" target="_blank" rel="noopener noreferrer">𝕏 &nbsp; X / Twitter</a>
<a href="https://www.snapchat.com/add/M0HM3D85" target="_blank" rel="noopener noreferrer">◉ &nbsp; Snapchat</a>
</div>
<div class="m0-copyright">© 2026 Mohammed Almalki (M0HM3D85)<br>جميع الحقوق محفوظة</div>
</section>
`;
} else {
const isWelcome =
type === 'welcome';
layer.innerHTML = `
<div class="m0-dialog-backdrop" ${isWelcome ? '' : 'data-dialog-close'}></div>
<section class="m0-dialog m0-guide-dialog" role="dialog" aria-modal="true" aria-label="طريقة الاستخدام">
${isWelcome ? '' : '<button class="m0-dialog-close" type="button" data-dialog-close>×</button>'}
<div class="m0-dialog-mark"><img src="${BRAND_ICON_DATA}" alt=""></div>
<div class="m0-dialog-kicker">${isWelcome ? 'مرحبًا بك' : 'طريقة الاستخدام'}</div>
<h3>مصمم الجدول الدراسي</h3>
<p>حوّل جدول ${roleLabel} في مدرستي إلى نسخة مرتبة وجاهزة للحفظ والطباعة والمشاركة.</p>
<div class="m0-guide-steps">
<div><b>1</b><strong>خصص</strong><small>عدّل البيانات والمظهر</small></div>
<div><b>2</b><strong>عاين</strong><small>راجع الجدول قبل الحفظ</small></div>
<div><b>3</b><strong>صدّر</strong><small>PNG أو PDF أو Excel أو نسخ</small></div>
</div>
<div class="m0-format-row"><span>PNG</span><i>•</i><span>PDF</span><i>•</i><span>Excel</span><i>•</i><span>نسخ</span></div>
<button type="button" class="m0-dialog-primary" id="m0-dialog-start">${isWelcome ? 'ابدأ تصميم جدولي' : 'فهمت، لنبدأ'}</button>
</section>
`;
}
layer
.querySelectorAll(
'[data-dialog-close]'
)
.forEach(
button =>
button.addEventListener(
'click',
() => {
layer.innerHTML = '';
}
)
);
layer
.querySelector(
'#m0-dialog-start'
)
?.addEventListener(
'click',
() => {
try {
localStorage.setItem(
ONBOARDING_KEY,
'1'
);
} catch (_) {}
layer.innerHTML = '';
}
);
}
function bindDesignerEvents(
root
) {
root
.querySelector(
'#m0-btn-close'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
closeDesigner();
}
);
root
.querySelector(
'.m0-backdrop'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
closeDesigner();
}
);
root
.querySelector(
'#m0-btn-help'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
showDialog(root, 'guide');
}
);
root
.querySelector(
'#m0-btn-about'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
showDialog(root, 'about');
}
);
const update =
() => {
readControls(root);
savePrefs();
renderPreview();
setPreviewStatus(root, false);
};
let liveUpdateTimer = 0;
const scheduleLiveUpdate = (delay = 140) => {
setPreviewStatus(root, true);
clearTimeout(liveUpdateTimer);
liveUpdateTimer = setTimeout(update, delay);
};
root.addEventListener(
'input',
event => {
if (
event.target.matches(
'[data-pref], [data-time-start], [data-time-end]'
)
) {
scheduleLiveUpdate();
}
}
);
root.addEventListener(
'change',
event => {
if (
event.target.matches(
'[data-check], [data-pref], [data-time-start], [data-time-end]'
)
) {
clearTimeout(liveUpdateTimer);
update();
}
}
);
root
.querySelector(
'#m0-btn-print'
)
?.addEventListener(
'click',
async event => {
event.preventDefault();
update();
await printSchedule();
}
);
root
.querySelector(
'#m0-btn-png'
)
?.addEventListener(
'click',
async event => {
event.preventDefault();
update();
await exportPng();
}
);
root
.querySelector(
'#m0-btn-copy'
)
?.addEventListener(
'click',
async event => {
event.preventDefault();
update();
await copySchedule();
}
);
root
.querySelector(
'#m0-btn-excel'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
update();
exportExcel();
}
);
root
.querySelector(
'#m0-btn-remove-logo'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
removeLogo();
}
);
root
.querySelector(
'#m0-btn-fill-times'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
const startValue = root.querySelector('#m0-quick-start')?.value || '';
const duration = Number(root.querySelector('#m0-quick-duration')?.value || 0);
const gap = Number(root.querySelector('#m0-quick-gap')?.value || 0);
const firstStart = timeToMinutes(startValue);
if (firstStart === null || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(gap) || gap < 0) {
toast('تحقق من وقت البداية ومدة الحصة والفاصل.');
return;
}
for (let index = 0; index < state.data.periods; index++) {
const startMinutes = firstStart + index * (duration + gap);
const endMinutes = startMinutes + duration;
const startInput = root.querySelector(`[data-time-start="${index}"]`);
const endInput = root.querySelector(`[data-time-end="${index}"]`);
if (startInput) startInput.value = minutesToTime(startMinutes);
if (endInput) endInput.value = minutesToTime(endMinutes);
}
readControls(root);
renderPreview();
markPreviewFresh();
savePrefs();
toast('تمت تعبئة أوقات الحصص، ويمكنك تعديل أي حصة يدويًا.');
}
);
root
.querySelector(
'#m0-logo-input'
)
?.addEventListener(
'change',
event => {
handleLogoFile(
event.target
.files?.[0]
);
}
);
root.addEventListener(
'keydown',
event => {
if (
event.key ===
'Enter' &&
event.target.matches(
'input:not([type=file])'
)
) {
event.preventDefault();
event.target.blur();
}
}
);
/*
* تعديل مباشر من داخل المعاينة.
*/
root.addEventListener(
'input',
event => {
const target =
event.target;
if (
!(
target instanceof
HTMLElement
)
) {
return;
}
if (
target.matches(
'[data-time-index]'
)
) {
const index =
Number(
(
target.dataset.timeIndex ||
''
).trim()
);
const value =
clean(
target.textContent ||
''
)
.replace(
/^أضف الوقت$/,
''
);
if (
Number.isInteger(
index
) &&
index >= 0 &&
index <
state.data.times.length
) {
state.data.times[
index
] =
value;
state.prefs.times = [
...state.data.times
];
const parsed =
parseTimeRange(value);
const startInput =
root.querySelector(
`[data-time-start="${index}"]`
);
const endInput =
root.querySelector(
`[data-time-end="${index}"]`
);
if (startInput) startInput.value = parsed.start;
if (endInput) endInput.value = parsed.end;
savePrefs();
}
}
if (
target.matches(
'[data-edit]'
)
) {
const field =
(
target.dataset.edit ||
''
).trim();
const day =
Number(
target.dataset.day
);
const period =
Number(
target.dataset.period
);
const lesson =
state.data
.days[day]
?.lessons[period];
if (
lesson &&
(
field ===
'subject' ||
field ===
'secondary'
)
) {
lesson[
field
] =
clean(
target.textContent ||
''
);
}
}
}
);
}
async function openDesigner() {
state.extractedAt =
new Date();
state.data =
extractSchedule();
if (!state.data) {
toast(
'لم أتمكن من العثور على جدول مدرستي في الصفحة الحالية.'
);
return;
}
if (isTeacher) {
try {
await enrichTeacherScheduleFromSystem(state.data);
} catch (error) {
console.info('[M0HM3D85 Schedule Userscript] automatic teacher times skipped:', error);
}
}
hydrateDefaults(
state.data
);
injectStyle();
document
.getElementById(
APP_ID
)
?.remove();
const root =
document.createElement(
'div'
);
root.id =
APP_ID;
const dayCount =
state.data.days.length;
const roleText =
isTeacher
? 'جدول المعلم'
: 'جدول الطالب';
root.innerHTML = `
<div class="m0-backdrop"></div>
<div class="m0-app">
<header class="m0-workspace-head">
<div class="m0-head-brand">
<div class="m0-brand-mark"><img src="${BRAND_ICON_DATA}" alt=""></div>
<div>
<small>مدرستي</small>
<h1>مصمم الجدول الدراسي</h1>
</div>
</div>
<div class="m0-head-badges">
<span class="m0-badge role">${roleText}</span>
<span class="m0-badge success">✓ تم قراءة الجدول</span>
<span class="m0-badge">${dayCount} أيام</span>
<span class="m0-badge">${state.data.periods} حصص</span>
</div>
<div class="m0-head-actions">
<button type="button" id="m0-btn-help" title="طريقة الاستخدام">؟</button>
<button type="button" id="m0-btn-about" title="حول الأداة">ⓘ</button>
<button type="button" class="close" id="m0-btn-close" title="إغلاق">×</button>
</div>
</header>
<aside class="m0-panel">
${renderPanel()}
</aside>
<main class="m0-preview-shell">
<div class="m0-preview-toolbar">
<div>
<small>المعاينة</small>
<strong>الجدول النهائي</strong>
</div>
<div id="m0-preview-status" class="m0-preview-status"><span>✓</span> المعاينة محدثة</div>
</div>
<div class="m0-preview-area">
<div id="m0-preview">
${buildPreview()}
</div>
</div>
</main>
<footer class="m0-export-bar">
<div class="m0-export-state">
<span>✓</span>
<div><strong>جاهز للتصدير</strong><small>اختر الصيغة المناسبة لجدولك</small></div>
</div>
<div class="m0-export-actions">
<button type="button" class="m0-export primary" id="m0-btn-png"><span>▧</span> PNG</button>
<button type="button" class="m0-export" id="m0-btn-print"><span>▣</span> طباعة / PDF</button>
<button type="button" class="m0-export" id="m0-btn-excel"><span>▦</span> Excel</button>
<button type="button" class="m0-export" id="m0-btn-copy"><span>▤</span> نسخ</button>
</div>
</footer>
</div>
<div id="m0-dialog-layer"></div>
`;
document.body
.appendChild(
root
);
document.body.classList.add(
BODY_LOCK_CLASS
);
bindDesignerEvents(
root
);
requestAnimationFrame(() => applySmartFit(root));
let onboarded = false;
try {
onboarded =
localStorage.getItem(
ONBOARDING_KEY
) === '1';
} catch (_) {}
if (!onboarded) {
showDialog(
root,
'welcome'
);
}
}
function clonePrintableArea() {
const source =
document.querySelector(
`#${APP_ID} #m0-print-area`
);
if (!source) {
return null;
}
const clone =
source.cloneNode(
true
);
clone
.querySelectorAll(
'[contenteditable]'
)
.forEach(
element => {
element.removeAttribute(
'contenteditable'
);
}
);
return clone;
}
async function printSchedule() {
const clone =
clonePrintableArea();
if (!clone) {
return;
}
const iframe =
document.createElement(
'iframe'
);
iframe.setAttribute(
'aria-hidden',
'true'
);
Object.assign(
iframe.style,
{
position:
'fixed',
width:
'1px',
height:
'1px',
right:
'0',
bottom:
'0',
opacity:
'0',
border:
'0',
pointerEvents:
'none'
}
);
document.body
.appendChild(
iframe
);
const doc =
iframe.contentDocument ||
iframe.contentWindow
.document;
doc.open();
doc.write(
`
<!doctype html>
<html
lang="ar"
dir="rtl"
>
<head>
<meta charset="utf-8">
<title>
${
esc(
state.prefs.title ||
'الجدول الدراسي'
)
}
</title>
<style>
${PRINT_CSS}
</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>
`
);
doc.close();
try {
if (doc.fonts?.ready) {
await Promise.race([
doc.fonts.ready,
new Promise(resolve => setTimeout(resolve, 1200))
]);
}
} catch (_) {}
await new Promise(
resolve => {
setTimeout(
resolve,
450
);
}
);
/*
* لا نحذف iframe فورًا لأن بعض المتصفحات
* تحتاجه حتى انتهاء نافذة الطباعة.
*/
const cleanup =
() => {
if (
iframe.isConnected
) {
iframe.remove();
}
};
try {
iframe.contentWindow
.addEventListener(
'afterprint',
cleanup,
{
once: true
}
);
iframe.contentWindow
.focus();
iframe.contentWindow
.print();
toast(
'تم فتح نافذة الطباعة. اختر «حفظ كملف PDF» عند الحاجة.'
);
} catch (
error
) {
console.error(
error
);
cleanup();
toast(
'تعذر فتح الطباعة في هذا المتصفح.'
);
return;
}
/*
* تنظيف احتياطي بعد دقيقة.
*/
setTimeout(
cleanup,
60000
);
}
function buildCopyText() {
const headers = [
'اليوم',
...state.data
.periodLabels
.map(
(
label,
index
) =>
`${
periodTitle(
label,
index
)
}${
state.data
.times[index]
? ` (${
state.data
.times[index]
})`
: ''
}`
)
];
const lines = [
headers.join(
'\t'
)
];
state.data.days
.forEach(
day => {
lines.push(
[
day.name,
...day.lessons
.map(
lesson => {
if (
!lesson.subject
) {
return '';
}
if (
state.prefs
.showSecondary &&
lesson.secondary
) {
return (
`${
lesson.subject
} - ${
lesson.secondary
}`
);
}
return (
lesson.subject
);
}
)
]
.join(
'\t'
)
);
}
);
return lines.join(
'\n'
);
}
function buildCopyHtml() {
const heads =
state.data
.periodLabels
.map(
(
label,
index
) => `
<th>
${
esc(
periodTitle(
label,
index
)
)
}
${
state.data
.times[index]
? `
<br>
${
esc(
state.data
.times[index]
)
}
`
: ''
}
</th>
`
)
.join('');
const rows =
state.data.days
.map(
day => `
<tr>
<th>
${esc(day.name)}
</th>
${
day.lessons
.map(
lesson => `
<td>
${
lesson.subject
? `
<b>
${esc(lesson.subject)}
</b>
${
state.prefs
.showSecondary &&
lesson.secondary
? `
<br>
${esc(lesson.secondary)}
`
: ''
}
`
: ''
}
</td>
`
)
.join('')
}
</tr>
`
)
.join('');
return `
<table
border="1"
cellspacing="0"
cellpadding="6"
>
<thead>
<tr>
<th>
اليوم
</th>
${heads}
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
`;
}
async function copySchedule() {
const text =
buildCopyText();
const html =
buildCopyHtml();
try {
if (
navigator.clipboard &&
window.ClipboardItem
) {
const item =
new ClipboardItem({
'text/plain':
new Blob(
[text],
{
type:
'text/plain'
}
),
'text/html':
new Blob(
[html],
{
type:
'text/html'
}
)
});
await navigator.clipboard
.write(
[item]
);
}
else if (
navigator.clipboard
?.writeText
) {
await navigator.clipboard
.writeText(
text
);
}
else {
throw new Error(
'clipboard fallback'
);
}
toast(
'تم نسخ الجدول.'
);
} catch (_) {
const textarea =
document.createElement(
'textarea'
);
textarea.value =
text;
textarea.style.position =
'fixed';
textarea.style.opacity =
'0';
document.body
.appendChild(
textarea
);
textarea.focus();
textarea.select();
document.execCommand(
'copy'
);
textarea.remove();
toast(
'تم نسخ الجدول.'
);
}
}
function exportExcel() {
const stats = computeScheduleStats(state.data);
const header = `
<tr>
<th>
اليوم
</th>
${
state.data
.periodLabels
.map(
(
label,
index
) => `
<th>
${
esc(
periodTitle(
label,
index
)
)
}
<br>
${
esc(
state.data
.times[index] ||
''
)
}
</th>
`
)
.join('')
}
</tr>
`;
const body =
state.data.days
.map(
day => `
<tr>
<th>
${esc(day.name)}
</th>
${
day.lessons
.map(
lesson => `
<td>
${
lesson.subject
? `
<b>
${esc(lesson.subject)}
</b>
${
state.prefs
.showSecondary &&
lesson.secondary
? `
<br>
${esc(lesson.secondary)}
`
: ''
}
`
: ''
}
</td>
`
)
.join('')
}
</tr>
`
)
.join('');
const html = `
<!doctype html>
<html
lang="ar"
dir="rtl"
>
<head>
<meta charset="utf-8">
<style>
body {
font-family:
Tahoma,
Arial;
}
table {
border-collapse:
collapse;
}
th,
td {
border:
1px solid #bbb;
padding:
8px;
text-align:
center;
}
th {
background:
#eaf2f7;
}
</style>
</head>
<body>
<h2>
${
esc(
state.prefs.title ||
'الجدول الدراسي'
)
}
</h2>
${state.prefs.showStats !== false ? `
<table style="margin-bottom:12px">
<tr>
<th>إجمالي الحصص</th>
<th>${isTeacher ? 'الفصول' : 'المواد'}</th>
<th>${isTeacher ? 'المواد' : 'المعلمون'}</th>
<th>${isTeacher ? 'الأكثر ازدحامًا' : 'الفراغات'}</th>
</tr>
<tr>
<td>${stats.total}</td>
<td>${isTeacher ? stats.classes : stats.subjects}</td>
<td>${isTeacher ? stats.subjects : stats.teachers}</td>
<td>${isTeacher ? esc(stats.busiestDay || '') : stats.free}</td>
</tr>
</table>
` : ''}
<table>
${header}
${body}
</table>
</body>
</html>
`;
downloadBlob(
new Blob(
[
'\ufeff',
html
],
{
type:
'application/vnd.ms-excel;charset=utf-8'
}
),
`الجدول-${
isTeacher
? 'معلم'
: 'طالب'
}.xls`
);
toast(
'تم إنشاء ملف Excel.'
);
}
function canvasRoundRectPath(ctx, x, y, width, height, radius = 0) {
const r = Math.max(0, Math.min(radius, width / 2, height / 2));
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.lineTo(x + width - r, y);
ctx.quadraticCurveTo(x + width, y, x + width, y + r);
ctx.lineTo(x + width, y + height - r);
ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
ctx.lineTo(x + r, y + height);
ctx.quadraticCurveTo(x, y + height, x, y + height - r);
ctx.lineTo(x, y + r);
ctx.quadraticCurveTo(x, y, x + r, y);
ctx.closePath();
}
function cssPx(value) {
const n = Number.parseFloat(String(value || '0'));
return Number.isFinite(n) ? n : 0;
}
function isTransparentColor(value) {
const v = String(value || '').replace(/\s+/g, '').toLowerCase();
return !v || v === 'transparent' || v === 'rgba(0,0,0,0)';
}
function elementCanvasRect(element, rootRect) {
const rect = element.getBoundingClientRect();
return {
x: rect.left - rootRect.left,
y: rect.top - rootRect.top,
width: rect.width,
height: rect.height
};
}
function paintElementBox(ctx, element, rootRect) {
const style = getComputedStyle(element);
if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return;
const rect = elementCanvasRect(element, rootRect);
if (rect.width <= 0 || rect.height <= 0) return;
const radius = Math.max(
cssPx(style.borderTopLeftRadius),
cssPx(style.borderTopRightRadius),
cssPx(style.borderBottomRightRadius),
cssPx(style.borderBottomLeftRadius)
);
ctx.save();
ctx.globalAlpha = Math.max(0, Math.min(1, Number.parseFloat(style.opacity || '1') || 1));
if (element.classList.contains('m0-topbar')) {
const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y);
gradient.addColorStop(0, '#15445A');
gradient.addColorStop(0.5, '#0DA9A6');
gradient.addColorStop(1, '#07A869');
canvasRoundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
ctx.fillStyle = gradient;
ctx.fill();
} else if (!isTransparentColor(style.backgroundColor)) {
canvasRoundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
ctx.fillStyle = style.backgroundColor;
ctx.fill();
}
const sides = [
['Top', rect.x, rect.y, rect.x + rect.width, rect.y],
['Right', rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
['Bottom', rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height],
['Left', rect.x, rect.y, rect.x, rect.y + rect.height]
];
sides.forEach(([side, x1, y1, x2, y2]) => {
const width = cssPx(style[`border${side}Width`]);
const borderStyle = style[`border${side}Style`];
const color = style[`border${side}Color`];
if (!width || borderStyle === 'none' || isTransparentColor(color)) return;
ctx.beginPath();
ctx.strokeStyle = color;
ctx.lineWidth = width;
ctx.setLineDash(borderStyle === 'dashed' ? [4, 3] : borderStyle === 'dotted' ? [1.5, 2.5] : []);
ctx.moveTo(x1, y1);
ctx.lineTo(x2, y2);
ctx.stroke();
});
ctx.restore();
}
function splitCanvasLines(ctx, text, maxWidth, preserveSingleLine = false) {
const normalized = String(text || '').replace(/\s+/g, ' ').trim();
if (!normalized) return [];
if (preserveSingleLine || maxWidth <= 8 || ctx.measureText(normalized).width <= maxWidth) return [normalized];
const words = normalized.split(' ');
const lines = [];
let current = '';
for (const word of words) {
const candidate = current ? `${current} ${word}` : word;
if (current && ctx.measureText(candidate).width > maxWidth) {
lines.push(current);
current = word;
} else {
current = candidate;
}
}
if (current) lines.push(current);
return lines;
}
function paintTextElement(ctx, element, rootRect) {
const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
if (!text) return;
const style = getComputedStyle(element);
if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return;
const rect = elementCanvasRect(element, rootRect);
if (rect.width <= 0 || rect.height <= 0) return;
const fontSize = cssPx(style.fontSize) || 12;
const fontWeight = style.fontWeight || '400';
const fontStyle = style.fontStyle || 'normal';
const family = style.fontFamily || 'Tahoma, Arial, sans-serif';
const lineHeight = style.lineHeight === 'normal' ? fontSize * 1.25 : (cssPx(style.lineHeight) || fontSize * 1.25);
const paddingLeft = cssPx(style.paddingLeft);
const paddingRight = cssPx(style.paddingRight);
const maxWidth = Math.max(4, rect.width - paddingLeft - paddingRight - 4);
const whiteSpace = String(style.whiteSpace || 'normal');
ctx.save();
ctx.globalAlpha = Math.max(0, Math.min(1, Number.parseFloat(style.opacity || '1') || 1));
ctx.fillStyle = style.color || '#172033';
ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${family}`;
ctx.direction = style.direction === 'ltr' ? 'ltr' : 'rtl';
ctx.textBaseline = 'alphabetic';
let align = style.textAlign;
if (align === 'start' || !align) align = ctx.direction === 'rtl' ? 'right' : 'left';
if (align === 'end') align = ctx.direction === 'rtl' ? 'left' : 'right';
if (!['left', 'right', 'center'].includes(align)) align = 'center';
ctx.textAlign = align;
const singleLine = whiteSpace.includes('nowrap');
const lines = splitCanvasLines(ctx, text, maxWidth, singleLine);
if (!lines.length) {
ctx.restore();
return;
}
const blockHeight = lines.length * lineHeight;
let baseline = rect.y + (rect.height - blockHeight) / 2 + fontSize;
let x;
if (align === 'center') x = rect.x + rect.width / 2;
else if (align === 'right') x = rect.x + rect.width - paddingRight;
else x = rect.x + paddingLeft;
lines.forEach(line => {
ctx.fillText(line, x, baseline, maxWidth);
baseline += lineHeight;
});
ctx.restore();
}
function loadCanvasImage(src) {
return new Promise((resolve, reject) => {
const image = new Image();
image.onload = () => resolve(image);
image.onerror = () => reject(new Error('تعذر قراءة صورة الشعار.'));
image.src = src;
});
}
async function paintImageElement(ctx, element, rootRect) {
const src = element.currentSrc || element.src;
if (!src) return;
const style = getComputedStyle(element);
const rect = elementCanvasRect(element, rootRect);
if (rect.width <= 0 || rect.height <= 0) return;
try {
const image = await loadCanvasImage(src);
const iw = image.naturalWidth || image.width || 1;
const ih = image.naturalHeight || image.height || 1;
const fit = style.objectFit || 'fill';
let dw = rect.width;
let dh = rect.height;
let dx = rect.x;
let dy = rect.y;
if (fit === 'contain') {
const ratio = Math.min(rect.width / iw, rect.height / ih);
dw = iw * ratio;
dh = ih * ratio;
dx += (rect.width - dw) / 2;
dy += (rect.height - dh) / 2;
} else if (fit === 'cover') {
const ratio = Math.max(rect.width / iw, rect.height / ih);
dw = iw * ratio;
dh = ih * ratio;
dx += (rect.width - dw) / 2;
dy += (rect.height - dh) / 2;
}
const radius = Math.max(
cssPx(style.borderTopLeftRadius),
cssPx(style.borderTopRightRadius),
cssPx(style.borderBottomRightRadius),
cssPx(style.borderBottomLeftRadius)
);
ctx.save();
if (radius > 0) {
canvasRoundRectPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
ctx.clip();
}
ctx.drawImage(image, dx, dy, dw, dh);
ctx.restore();
} catch (error) {
console.warn('[M0HM3D85 Schedule Userscript] logo render skipped:', error);
}
}
async function waitForDocumentFonts(timeout = 1600) {
if (!document.fonts?.ready) return;
await Promise.race([
document.fonts.ready.catch(() => null),
new Promise(resolve => setTimeout(resolve, timeout))
]);
}
async function renderPrintableToCanvas(source, scale = 2) {
const rootRect = source.getBoundingClientRect();
const width = Math.max(1, Math.ceil(source.offsetWidth || rootRect.width));
const height = Math.max(1, Math.ceil(source.scrollHeight || rootRect.height));
const canvas = document.createElement('canvas');
canvas.width = Math.max(1, Math.round(width * scale));
canvas.height = Math.max(1, Math.round(height * scale));
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('تعذر إنشاء لوحة الصورة.');
ctx.scale(scale, scale);
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, width, height);
const boxSelectors = [
'.m0-topbar',
'.m0-kicker',
'.m0-week-box',
'.m0-legend-item i',
'.m0-stat-card',
'.m0-schedule-table thead th',
'.m0-day-cell',
'.m0-lesson-card',
'.m0-subject-accent',
'.m0-empty-cell',
'.m0-note',
'.m0-footer'
];
source.querySelectorAll(boxSelectors.join(',')).forEach(element => {
paintElementBox(ctx, element, rootRect);
});
for (const image of source.querySelectorAll('img')) {
await paintImageElement(ctx, image, rootRect);
}
const textSelectors = [
'.m0-kicker',
'.m0-title-side h1',
'.m0-meta span',
'.m0-week-box small',
'.m0-week-box strong',
'.m0-legend-title',
'.m0-legend-item',
'.m0-stat-card b',
'.m0-stat-card small',
'.m0-period-title',
'.m0-period-time',
'.m0-day-cell span',
'.m0-lesson-subject',
'.m0-lesson-secondary',
'.m0-empty-cell span',
'.m0-note',
'.m0-footer span'
];
source.querySelectorAll(textSelectors.join(',')).forEach(element => {
paintTextElement(ctx, element, rootRect);
});
return canvas;
}
async function exportPng() {
const source = document.querySelector(`#${APP_ID} #m0-print-area`);
if (!source) return;
try {
toast('جارٍ إنشاء صورة PNG...');
await waitForDocumentFonts();
const canvas = await renderPrintableToCanvas(source, 2);
const blob = await new Promise((resolve, reject) => {
canvas.toBlob(result => {
if (result) resolve(result);
else reject(new Error('تعذر تحويل الجدول إلى PNG.'));
}, 'image/png', 1);
});
downloadBlob(blob, `الجدول-${isTeacher ? 'معلم' : 'طالب'}.png`);
toast('تم إنشاء صورة PNG.');
} catch (error) {
console.error('[M0HM3D85 Schedule Userscript] PNG export error:', error);
toast(`تعذر إنشاء PNG: ${error?.message || 'خطأ غير معروف'}`);
}
}
function downloadBlob(
blob,
filename
) {
const url =
URL.createObjectURL(
blob
);
const link =
document.createElement(
'a'
);
link.href =
url;
link.download =
filename;
link.style.display =
'none';
document.body
.appendChild(
link
);
link.click();
link.remove();
setTimeout(
() => {
URL.revokeObjectURL(
url
);
},
2000
);
}
function createOpenButton() {
if (
document.getElementById(
OPEN_ID
)
) {
return;
}
const table =
document.querySelector(
'#reservations'
);
if (!table) return;
const bar =
document.createElement(
'div'
);
bar.id =
OPEN_ID;
bar.innerHTML = `
<div class="m0-launch-copy">
<span class="m0-launch-mark">▦</span>
<div>
<strong>مصمم الجدول الدراسي</strong>
<small>خصص جدولك واحفظه للطباعة أو PNG أو Excel</small>
</div>
</div>
<button type="button">
<span>✦</span>
فتح مصمم الجدول
</button>
`;
bar
.querySelector(
'button'
)
?.addEventListener(
'click',
event => {
event.preventDefault();
event.stopPropagation();
openDesigner();
}
);
table.insertAdjacentElement(
'beforebegin',
bar
);
}
function boot() {
injectStyle();
const tryAdd =
() => {
if (
document.querySelector(
'#reservations'
)
) {
createOpenButton();
observer.disconnect();
}
};
const observer =
new MutationObserver(
tryAdd
);
observer.observe(
document.documentElement,
{
childList:
true,
subtree:
true
}
);
tryAdd();
setTimeout(
tryAdd,
1200
);
setTimeout(
tryAdd,
3500
);
}
boot();
})();
