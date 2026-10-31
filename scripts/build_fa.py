#!/usr/bin/env python3
"""Apply finished Farsi chunk translations to the OCE fork. Deterministic, no model.

Usage: python3 scripts/build_fa.py [--inv DIR] [--dry]
  DIR = translate-fa dir (default /root/RSC/docs/translation/inventory/translate-fa)

Reads chunks/c*.out.tsv ("id<TAB>farsi", "=" keeps), chunks/_map.json (id -> en + yaml_key),
../inventory.jsonl (yaml_key -> real locale key). An id is applied only if its yaml_key resolves
to a real key whose English value equals the id's English text in:
  frontend/src/app/locales/en.ts  -> fa.ts (flat dotted keys)
  backend/locales/en.json         -> fa.json (nested, or flat literal keys)
Other ids (hardcoded strings, yaml-only) are "unmapped".
Placeholder-mismatching keys are reverted to the previous fa value.
Edits are in place, value-only: the diff is only changed values.
"""
import sys, os, re, json, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FE = os.path.join(ROOT, 'frontend/src/app/locales')
BE = os.path.join(ROOT, 'backend/locales')
TR = '/root/RSC/docs/translation/inventory/translate-fa'
if '--inv' in sys.argv: TR = sys.argv[sys.argv.index('--inv') + 1]
DRY = '--dry' in sys.argv

LINE = re.compile(r'^(\s*)("(?:[^"\\]|\\.)*")(:\s*)("(?:[^"\\]|\\.)*")(,?\s*)$')
KEEP = set('API BIM BOQ IFC YAML PDF CSV P50 P80 P95 4D 5D'.lower().split())
PH = re.compile(r'\{\{[^{}]*\}\}|\{\s*\w+\s*,\s*(?:plural|select|selectordinal)\s*,|\{\w+\}|%[sd]|</?[A-Za-z0-9]+[^<>]*>')
ICU_KW = re.compile(r'\b(?:zero|one|two|few|many|other|=\d+)\s*\{')


def unesc(s):
    return re.sub(r'\\(.)', lambda m: {'n': '\n', 't': '\t', 'r': '\r', '\\': '\\'}.get(m.group(1), m.group(0)), s)


def fix_yk(s):
    return s.replace('ي', 'ی').replace('ك', 'ک')


def toks(s):
    return sorted(PH.findall(s) + ICU_KW.findall(s)) + ['{%d}' % s.count('{'), '}%d' % s.count('}')]


def load_ts(path):
    """-> (lines, {key: [line idx]}, {key: value})"""
    lines = open(path, encoding='utf8').read().split('\n')
    idx = collections.defaultdict(list); val = {}
    for i, l in enumerate(lines):
        m = LINE.match(l)
        if m:
            k = json.loads(m[2]); idx[k].append(i); val[k] = json.loads(m[4])
    return lines, idx, val


def flat_paths(d, p=()):
    """yield (path tuple, value) for leaf strings; literal dotted keys stay one path element."""
    for k, v in d.items():
        if isinstance(v, dict): yield from flat_paths(v, p + (k,))
        else: yield p + (k,), v


def main():
    idmap = json.load(open(os.path.join(TR, 'chunks/_map.json'), encoding='utf8'))
    got = {}; badfmt = 0
    for p in sorted(glob.glob(os.path.join(TR, 'chunks/c*.out.tsv'))):
        for line in open(p, encoding='utf8').read().splitlines():
            if not line.strip(): continue
            a = line.split('\t')
            if len(a) != 2 or a[0].strip() not in idmap or not a[1].strip(): badfmt += 1; continue
            got[a[0].strip()] = unesc(a[1])
    # yaml_key -> candidate real keys
    y2k = collections.defaultdict(set)
    for l in open(os.path.join(TR, '..', 'inventory.jsonl'), encoding='utf8'):
        r = json.loads(l)
        if r.get('key'):
            y2k[r['yaml_key']].add((r['file'], r['key']))
    # english sources
    en_lines, en_idx, en_val = load_ts(os.path.join(FE, 'en.ts'))
    fa_lines, fa_idx, fa_val = load_ts(os.path.join(FE, 'fa.ts'))
    be_en = json.load(open(os.path.join(BE, 'en.json'), encoding='utf8'))
    fa_raw = open(os.path.join(BE, 'fa.json'), encoding='utf8').read()
    be_fa = json.loads(fa_raw)
    if json.dumps(be_fa, ensure_ascii=False, indent=2) + '\n' != fa_raw and json.dumps(be_fa, ensure_ascii=False, indent=2) != fa_raw:
        sys.exit('fa.json does not round-trip with indent=2: refusing to rewrite')
    trail = '\n' if fa_raw.endswith('\n') else ''
    be_en_paths = {p: v for p, v in flat_paths(be_en)}
    be_fa_paths = {p: v for p, v in flat_paths(be_fa)}
    def be_path(key):
        if (key,) in be_en_paths: return (key,)
        t = tuple(key.split('.'))
        return t if t in be_en_paths else None

    new_fe = {}; new_be = {}      # key/path -> (en, fa)
    kept = unmapped = missing = 0
    for sid, fa in got.items():
        r = idmap[sid]; en = r['en']
        if fa == '=': kept += 1; continue
        fa = fix_yk(fa)
        hit = False
        for f, i, yk in r['locs']:
            for file, key in y2k.get(yk, ()):
                if file.endswith('en.ts') or file.startswith('frontend'):
                    if key in en_val and en_val[key] == en:
                        hit = True
                        if key in fa_val: new_fe[key] = (en, fa)
                        else: missing += 1
                elif file == 'backend/locales/en.json':
                    pt = be_path(key)
                    if pt and be_en_paths[pt] == en:
                        hit = True
                        if pt in be_fa_paths: new_be[pt] = (en, fa)
                        else: missing += 1
        if not hit: unmapped += 1

    # validate
    reverted = []; sc = 0; latin = collections.Counter(); latin_keys = set()
    def validate(label, en, fa):
        nonlocal sc
        if toks(en) != toks(fa): return False
        return True
    for store, tag in ((new_fe, 'fe'), (new_be, 'be')):
        for k in list(store):
            en, fa = store[k]
            if not validate(k, en, fa): reverted.append((tag, k)); del store[k]; continue
            if '؛' in fa: sc += 1
            body = PH.sub(' ', fa)
            for w in re.findall(r'[A-Za-z]{3,}', body):
                if w.lower() not in KEEP: latin[w] += 1; latin_keys.add((tag, str(k)))

    # apply: only genuinely changed values
    applied = 0
    for k, (en, fa) in new_fe.items():
        if fa == fa_val[k]: continue
        for i in fa_idx[k]:
            m = LINE.match(fa_lines[i])
            fa_lines[i] = m[1] + m[2] + m[3] + json.dumps(fa, ensure_ascii=False) + m[5]
        applied += 1
    for pt, (en, fa) in new_be.items():
        if fa == be_fa_paths[pt]: continue
        d = be_fa
        for q in pt[:-1]: d = d[q]
        d[pt[-1]] = fa; applied += 1
    if not DRY:
        open(os.path.join(FE, 'fa.ts'), 'w', encoding='utf8').write('\n'.join(fa_lines))
        open(os.path.join(BE, 'fa.json'), 'w', encoding='utf8').write(json.dumps(be_fa, ensure_ascii=False, indent=2) + trail)
    print(f'ids read {len(got)} (bad lines {badfmt}); keep "=" {kept}; unmapped(non-locale-key) {unmapped}; '
          f'missing-in-fa {missing}')
    print(f'candidate keys fe {len(new_fe) + sum(1 for t, _ in reverted if t == "fe")} be {len(new_be) + sum(1 for t, _ in reverted if t == "be")}')
    print(f'applied {applied}; placeholder-reverted {len(reverted)}; semicolon(؛) {sc}; '
          f'latin-flagged keys {len(latin_keys)} words {sum(latin.values())}')
    for t, k in reverted[:20]: print('  REVERT', t, k)
    print('  top latin:', latin.most_common(15))


if __name__ == '__main__':
    main()
