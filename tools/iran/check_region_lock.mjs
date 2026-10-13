#!/usr/bin/env node
// [RSC-IRAN] Guard script to verify Region Lock settings
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

let errors = 0;

function check(desc, fn) {
  try {
    const ok = fn();
    if (ok) {
      console.log(`✓ ${desc}`);
    } else {
      console.error(`✗ FAIL: ${desc}`);
      errors++;
    }
  } catch (err) {
    console.error(`✗ ERROR: ${desc} - ${err.message}`);
    errors++;
  }
}

// 1. regionLock.ts exists and locks to fa/IRR/IR
check('frontend/src/app/regionLock.ts exists and locks to Iran defaults', () => {
  const content = fs.readFileSync(path.join(rootDir, 'frontend/src/app/regionLock.ts'), 'utf8');
  return content.includes("language: 'fa'") && content.includes("currency: 'IRR'") && content.includes("country: 'IR'");
});

// 2. index.html has lang="fa" and dir="rtl"
check('frontend/index.html sets lang="fa" and dir="rtl"', () => {
  const content = fs.readFileSync(path.join(rootDir, 'frontend/index.html'), 'utf8');
  return content.includes('lang="fa"') && content.includes('dir="rtl"');
});

// 3. backend/app/core/region_lock.py exists
check('backend/app/core/region_lock.py exists', () => {
  const content = fs.readFileSync(path.join(rootDir, 'backend/app/core/region_lock.py'), 'utf8');
  return content.includes('REGION_LOCK') && content.includes('LOCKED_LANGUAGE = "fa"');
});

// 4. Header.tsx hides LanguageSwitcher
check('Header.tsx hides LanguageSwitcher', () => {
  const content = fs.readFileSync(path.join(rootDir, 'frontend/src/app/layout/Header.tsx'), 'utf8');
  return content.includes('[RSC-IRAN] hidden: Region Lock');
});

if (errors > 0) {
  console.error(`\nFound ${errors} region lock violation(s).`);
  process.exit(1);
} else {
  console.log('\nAll region lock checks passed successfully!');
}
