#!/usr/bin/env node
// [RSC-IRAN] Check Farsi translations and glossary compliance
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const faPath = path.join(rootDir, 'frontend/src/app/locales/fa.ts');

console.log('Analyzing frontend/src/app/locales/fa.ts...');
const content = fs.readFileSync(faPath, 'utf8');

// Key terms check
const glossary = [
  { term: 'ریال', regex: /ریال|﷼/ },
  { term: 'برآورد', regex: /برآورد/ },
  { term: 'فهرست مقادیر', regex: /فهرست مقادیر/ },
  { term: 'پیمانکار', regex: /پیمانکار/ },
  { term: 'مناقصه', regex: /مناقصه/ },
];

let allTermsFound = true;
for (const item of glossary) {
  if (item.regex.test(content)) {
    console.log(`✓ Glossary term found: «${item.term}»`);
  } else {
    console.warn(`! Glossary term missing or low coverage: «${item.term}»`);
    allTermsFound = false;
  }
}

console.log('\nFarsi translation analysis complete.');
