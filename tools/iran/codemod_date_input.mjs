#!/usr/bin/env node
// [RSC-IRAN] Codemod: <input type="date" .../> -> <JalaliDateInput .../>
// Usage: node tools/iran/codemod_date_input.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/src');
const DRY = process.argv.includes('--dry');
const IMPORT_LINE = "import { JalaliDateInput } from '@/shared/ui/JalaliDateInput';";
const MARKER = '// [RSC-IRAN] Jalali: type="date" → JalaliDateInput (codemod tools/iran/codemod_date_input.mjs)';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      walk(p, out);
    } else if (e.name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(e.name) && !/shared\/ui\/JalaliDateInput/.test(p)) out.push(p);
  }
  return out;
}

// Scan a JSX tag starting at `start` (at '<'). Returns {end, masked} or null.
function scanTag(src, start) {
  let i = start + 1;
  let depth = 0;
  const masked = src.split('');
  let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\' && quote !== null && depth > 0) { masked[i] = ' '; i++; masked[i] = ' '; continue; }
      if (c === quote) { quote = null; continue; }
      masked[i] = ' ';
      continue;
    }
    if (c === '"' || c === "'" || (c === '`' && depth > 0)) { quote = c; continue; }
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; continue; }
    if (depth > 0) { masked[i] = ' '; if (c === '`') quote = '`'; continue; }
    if (c === '>') return { end: i, masked: masked.join('') };
  }
  return null;
}

let replaced = 0;
const skipped = [];
const warned = [];
const changedFiles = [];

for (const file of walk(root)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/type\s*=\s*(["'{])/.test(src) || !/date/.test(src)) continue;
  const rel = path.relative(path.resolve(root, '..'), file);
  const lineOf = (idx, s) => s.slice(0, idx).split('\n').length;
  let out = '';
  let pos = 0;
  let n = 0;
  const re = /<input(?=[\s/>])/g;
  let m;
  while ((m = re.exec(src))) {
    const tag = scanTag(src, m.index);
    if (!tag) continue;
    const orig = src.slice(m.index, tag.end + 1);
    const mk = tag.masked.slice(m.index, tag.end + 1);
    const tm = /\stype=(["'])/.exec(mk);
    const tdyn = /\stype=\{/.exec(mk);
    let isDate = false;
    if (tm) {
      const q = tm[1];
      const vs = tm.index + tm[0].length;
      const ve = orig.indexOf(q, vs);
      isDate = orig.slice(vs, ve) === 'date';
    } else if (tdyn) {
      if (/\bdate\b/.test(orig.slice(tdyn.index, tdyn.index + 80)) && !/datetime/.test(orig.slice(tdyn.index, tdyn.index + 40)))
        skipped.push(`${rel}:${lineOf(m.index, src)} dynamic type`);
      continue;
    }
    if (!isDate) continue;
    if (!/\/\s*>$/.test(orig)) {
      skipped.push(`${rel}:${lineOf(m.index, src)} not self-closing`);
      continue;
    }
    if (/\sref=/.test(mk)) {
      skipped.push(`${rel}:${lineOf(m.index, src)} has ref= (JalaliDateInput has no ref forwarding)`);
      continue;
    }
    let repl = orig.replace(/^<input/, '<JalaliDateInput');
    // remove type="date" attr using masked offsets
    const off = tm.index;
    const q = tm[1];
    const vs = off + tm[0].length;
    const ve = orig.indexOf(q, vs) + 1;
    repl = '<JalaliDateInput' + orig.slice('<input'.length, off) + orig.slice(ve);
    repl = repl.replace(/^(<JalaliDateInput)[ \t]*\n[ \t]+\n/, '$1\n').replace(/^(<JalaliDateInput)[ \t]{2,}/, '$1 ');
    out += src.slice(pos, m.index) + repl;
    pos = tag.end + 1;
    n++;
  }
  if (!n) continue;
  out += src.slice(pos);
  if (!out.includes("shared/ui/JalaliDateInput'")) {
    const impRe = /^import\s+(?:type\s+)?[^'";]*?\sfrom\s+['"][^'"]+['"];?[ \t]*$|^import\s+['"][^'"]+['"];?[ \t]*$/gm;
    let last = -1, im;
    while ((im = impRe.exec(out))) last = im.index + im[0].length;
    if (last < 0) out = `${IMPORT_LINE}\n${MARKER}\n${out}`;
    else out = `${out.slice(0, last)}\n${IMPORT_LINE}\n${MARKER}${out.slice(last)}`;
  } else if (!out.includes(MARKER)) {
    const k = out.indexOf("shared/ui/JalaliDateInput'");
    const eol = out.indexOf('\n', k);
    out = `${out.slice(0, eol)}\n${MARKER}${out.slice(eol)}`;
  }
  if (!DRY) fs.writeFileSync(file, out);
  replaced += n;
  changedFiles.push(rel);
}

console.log(`files changed: ${changedFiles.length}`);
console.log(`replaced: ${replaced}`);
console.log(`skipped (${skipped.length}):\n${skipped.join('\n')}`);
console.log(`warnings (${warned.length}):\n${warned.join('\n')}`);
if (process.env.CODEMOD_LIST) fs.writeFileSync(process.env.CODEMOD_LIST, changedFiles.join('\n') + '\n');
