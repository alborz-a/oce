#!/usr/bin/env node
// [RSC-IRAN] Comprehensive Farsi localization, key parity, interpolation & engineering glossary checker
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const frontendEnPath = path.join(rootDir, 'frontend/src/app/locales/en.ts');
const frontendFaPath = path.join(rootDir, 'frontend/src/app/locales/fa.ts');
const backendEnPath = path.join(rootDir, 'backend/locales/en.json');
const backendFaPath = path.join(rootDir, 'backend/locales/fa.json');

console.log('====================================================');
console.log('   OCE Iranian Localization & Engineering QC Tool   ');
console.log('====================================================\n');

let totalErrors = 0;

// Helper: Flatten nested JSON objects to dot-separated keys
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

// Helper: Extract interpolation variables {{var}} and {var}
function extractPlaceholders(str) {
  if (!str) return [];
  const matches = [];
  const doubleBraces = str.match(/\{\{([^{}]+)\}\}/g) || [];
  for (const m of doubleBraces) {
    matches.push(m.replace(/\s+/g, ''));
  }
  const singleBraces = str.match(/(?<!\{)\{([^{}]+)\}(?!\})/g) || [];
  for (const m of singleBraces) {
    matches.push(m.replace(/\s+/g, ''));
  }
  return matches.sort();
}

async function runChecks() {
  console.log('[1/4] Checking Frontend Locale Parity...');
  const enModule = await import(pathToFileURL(frontendEnPath).href);
  const faModule = await import(pathToFileURL(frontendFaPath).href);
  const frontendEn = enModule.default.translation;
  const frontendFa = faModule.default.translation;

  const frontendEnKeys = Object.keys(frontendEn);
  const frontendFaKeys = Object.keys(frontendFa);
  const missingFrontendKeys = frontendEnKeys.filter(k => !(k in frontendFa));

  console.log(`  Frontend EN keys: ${frontendEnKeys.length}`);
  console.log(`  Frontend FA keys: ${frontendFaKeys.length}`);
  if (missingFrontendKeys.length > 0) {
    console.error(`  ❌ Missing in frontend FA: ${missingFrontendKeys.length} keys`);
    console.error(`     Sample: ${missingFrontendKeys.slice(0, 5).join(', ')}`);
    totalErrors += missingFrontendKeys.length;
  } else {
    console.log('  ✓ Frontend key coverage: 100% (0 missing keys)');
  }

  console.log('\n[2/4] Checking Backend Locale Parity...');
  const backendEn = flattenObject(JSON.parse(fs.readFileSync(backendEnPath, 'utf8')));
  const backendFa = flattenObject(JSON.parse(fs.readFileSync(backendFaPath, 'utf8')));
  const backendEnKeys = Object.keys(backendEn);
  const backendFaKeys = Object.keys(backendFa);
  const missingBackendKeys = backendEnKeys.filter(k => !(k in backendFa));

  console.log(`  Backend EN keys: ${backendEnKeys.length}`);
  console.log(`  Backend FA keys: ${backendFaKeys.length}`);
  if (missingBackendKeys.length > 0) {
    console.error(`  ❌ Missing in backend FA: ${missingBackendKeys.length} keys`);
    console.error(`     Sample: ${missingBackendKeys.slice(0, 5).join(', ')}`);
    totalErrors += missingBackendKeys.length;
  } else {
    console.log('  ✓ Backend key coverage: 100% (0 missing keys)');
  }

  console.log('\n[3/4] Checking Interpolation Variable Parity...');
  let interpolationMismatches = 0;
  // Check Frontend
  for (const k of frontendEnKeys) {
    if (!(k in frontendFa)) continue;
    const enVars = extractPlaceholders(frontendEn[k]);
    const faVars = extractPlaceholders(frontendFa[k]);
    if (enVars.join(',') !== faVars.join(',')) {
      interpolationMismatches++;
      if (interpolationMismatches <= 5) {
        console.error(`  ❌ Frontend interpolation mismatch on [${k}]: EN=[${enVars}] vs FA=[${faVars}]`);
      }
    }
  }
  // Check Backend
  for (const k of backendEnKeys) {
    if (!(k in backendFa)) continue;
    const enVars = extractPlaceholders(backendEn[k]);
    const faVars = extractPlaceholders(backendFa[k]);
    if (enVars.join(',') !== faVars.join(',')) {
      interpolationMismatches++;
      if (interpolationMismatches <= 5) {
        console.error(`  ❌ Backend interpolation mismatch on [${k}]: EN=[${enVars}] vs FA=[${faVars}]`);
      }
    }
  }

  if (interpolationMismatches > 0) {
    console.error(`  ❌ Total interpolation variable mismatches: ${interpolationMismatches}`);
    totalErrors += interpolationMismatches;
  } else {
    console.log('  ✓ Interpolation variable parity: 100% (0 mismatches)');
  }

  console.log('\n[4/4] Checking Engineering Glossary & Terminology Compliance...');
  const combinedFaContent = fs.readFileSync(frontendFaPath, 'utf8') + '\n' + fs.readFileSync(backendFaPath, 'utf8');

  const engineeringModules = [
    {
      module: 'Module 1: BOQ, Takeoff, Assemblies & Markups',
      terms: [
        { label: 'ردیف فهرست‌بها / آیتم کار', regex: /ردیف فهرست‌بها|آیتم کار/ },
        { label: 'فصل / سرفصل فهرست‌بها', regex: /فصل فهرست‌بها|سرفصل فهرست‌بها/ },
        { label: 'شماره ردیف', regex: /شماره ردیف/ },
        { label: 'بهای واحد', regex: /بهای واحد/ },
        { label: 'متره‌برداری (Takeoff) / ریزه‌متره', regex: /متره‌برداری|ریزه‌متره/ },
        { label: 'آنالیز بها / ترکیب منابع', regex: /آنالیز بها|ترکیب منابع/ },
        { label: 'ضرایب پیمان / بالاسری', regex: /ضرایب پیمان|بالاسری/ },
        { label: 'مقطوع (چکی)', regex: /مقطوع/ },
      ],
    },
    {
      module: 'Module 2: Architecture, BIM, CAD & Drawing Transmittals',
      terms: [
        { label: 'المان', regex: /المان/ },
        { label: 'بلاک اتوکد (Block)', regex: /بلاک اتوکد|بلاک/ },
        { label: 'شیت نقشه / پلان / برش (سکشن) / دتیل اجرایی / نما', regex: /شیت نقشه|دتیل اجرایی|برش \(سکشن\)/ },
        { label: 'تداخل‌سنجی (Clash Detection)', regex: /تداخل‌سنجی/ },
        { label: 'نقشه‌های کارگاهی (Shop Drawing)', regex: /نقشه‌های کارگاهی/ },
        { label: 'نقشه‌های چون‌ساخت (As-Built)', regex: /چون‌ساخت|چون ساخت/ },
        { label: 'مدارک ارسالی جهت تأیید (Submittal)', regex: /مدارک ارسالی/ },
        { label: 'برگه ارسال مدارک (Transmittal)', regex: /برگه ارسال مدارک|ارسال مدارک/ },
      ],
    },
    {
      module: 'Module 3: Civil Engineering, Jobsite Diary, HSE & Equipment',
      terms: [
        { label: 'کارگاه / سایت پروژه', regex: /کارگاه|سایت پروژه/ },
        { label: 'سرپرست کارگاه', regex: /سرپرست کارگاه/ },
        { label: 'گزارش روزانه کارگاه', regex: /گزارش روزانه کارگاه/ },
        { label: 'ماشین‌آلات و تجهیزات کارگاهی', regex: /ماشین‌آلات و تجهیزات/ },
        { label: 'درخواست استعلام فنی (RFI)', regex: /استعلام فنی|RFI/ },
        { label: 'گزارش عدم انطباق (NCR)', regex: /عدم انطباق|NCR/ },
        { label: 'لیست نواقص تحویل (Punch List)', regex: /لیست نواقص تحویل|لیست نواقص|Punch List/ },
        { label: 'قالب‌بندی / آرماتوربندی (میلگرد) / عمل‌آوری بتن (کیورینگ)', regex: /قالب‌بندی|آرماتوربندی|عمل‌آوری بتن/ },
        { label: 'شبهه‌حادثه (Near Miss)', regex: /شبهه‌حادثه|Near Miss/ },
      ],
    },
    {
      module: 'Module 4: Schedule, Jalali Gantt, CPM, EVM & Milestones',
      terms: [
        { label: 'شناوری کل / شناوری آزاد', regex: /شناوری کل|شناوری آزاد/ },
        { label: 'برنامه زمان‌بندی مبنا (Baseline)', regex: /زمان‌بندی مبنا|برنامه زمان‌بندی مبنا/ },
        { label: 'مسیر بحرانی (CPM)', regex: /مسیر بحرانی/ },
        { label: 'ارزش کسب‌شده (EVM)', regex: /ارزش کسب‌شده/ },
        { label: 'مایلستون (رویداد کلیدی)', regex: /مایلستون/ },
        { label: 'برنامه نگاه به آینده (Lookahead)', regex: /نگاه به آینده|Lookahead/ },
        { label: 'فصل (Zoom Quarter)', regex: /"schedule\.zoom_quarter":\s*"فصل"/ },
        { label: 'سال (Zoom Year)', regex: /"schedule\.zoom_year":\s*"سال"/ },
      ],
    },
    {
      module: 'Module 5: Contracts, Subcontractor Portal & Payments',
      terms: [
        { label: 'صورت‌وضعیت موقت', regex: /صورت‌وضعیت موقت/ },
        { label: 'صورت‌وضعیت قطعی', regex: /صورت‌وضعیت قطعی/ },
        { label: 'سپرده حسن انجام کار (کسورات وجه‌الضمان)', regex: /حسن انجام کار|وجه‌الضمان/ },
        { label: 'دستورکار تغییرات (الحاقیه / تغییر مقادیر)', regex: /دستورکار تغییرات|تغییر مقادیر/ },
        { label: 'ضمانت‌نامه انجام تعهدات / تضامین قرارداد', regex: /ضمانت‌نامه|تضامین قرارداد/ },
        { label: 'کسورات قانونی (مالیات تکلیفی و بیمه)', regex: /کسورات قانونی|مالیات تکلیفی/ },
        { label: 'مغایرت‌گیری', regex: /مغایرت‌گیری/ },
        { label: 'استعلام بها (RFQ) / پیش‌فاکتورخواهی', regex: /استعلام بها|RFQ/ },
        { label: 'رسید ورود به انبار (قبض انبار)', regex: /رسید ورود به انبار|قبض انبار/ },
      ],
    },
    {
      module: 'Preserved Latin Engineering Abbreviations',
      terms: [
        { label: 'BIM', regex: /\bBIM\b/ },
        { label: 'BOQ', regex: /\bBOQ\b/ },
        { label: 'CPM', regex: /\bCPM\b/ },
        { label: 'EVM', regex: /\bEVM\b/ },
        { label: 'RFI', regex: /\bRFI\b/ },
        { label: 'NCR', regex: /\bNCR\b/ },
        { label: 'HSE', regex: /\bHSE\b/ },
        { label: 'Gantt', regex: /\bGantt\b|گانت/ },
      ],
    },
  ];

  for (const group of engineeringModules) {
    console.log(`\n  --- ${group.module} ---`);
    for (const term of group.terms) {
      if (term.regex.test(combinedFaContent)) {
        console.log(`  ✓ ${term.label}`);
      } else {
        console.error(`  ❌ Missing term: ${term.label}`);
        totalErrors++;
      }
    }
  }

  console.log('\n====================================================');
  if (totalErrors === 0) {
    console.log('✅ ALL CHECKS PASSED: 100% Key Coverage & Engineering Quality!');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.error(`❌ FAILED: ${totalErrors} issue(s) detected. Fix before proceeding.`);
    console.log('====================================================');
    process.exit(1);
  }
}

runChecks().catch(err => {
  console.error('Fatal execution error in check_fa_keys:', err);
  process.exit(1);
});
