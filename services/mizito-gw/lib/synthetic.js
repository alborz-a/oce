// Gateway-only filter: hide synthetic Mizito-import tasks from Mizito-facing lists, counts and progress.
// Flag MIZITO_HIDE_SYNTHETIC_TASKS: default on, '0' disables. OCE data is not touched.
// Variant B (fit 20/35 projects on 2026-11-25): metadata.source in mizito-album|mizito-album-pilot, or title exactly «گفتگوی پروژه».
const SOURCES = new Set(['mizito-album', 'mizito-album-pilot']);
const TITLE = 'گفتگوی پروژه';

function enabled() { return process.env.MIZITO_HIDE_SYNTHETIC_TASKS !== '0'; }

function isSynthetic(t) {
  if (!enabled() || !t) return false;
  const src = t.metadata && t.metadata.source;
  return SOURCES.has(src) || t.title === TITLE;
}

function filterSynthetic(list) { return list.filter(t => !isSynthetic(t)); }

// Mizito formula: progress = round(completed / total * 100, 1)
function progressCounts(list) {
  const ts = filterSynthetic(list);
  const n = ts.length, c = ts.filter(k => k.status === 'completed').length;
  return { n, c, p: n ? Math.round(c / n * 1000) / 10 : 0 };
}

module.exports = { SOURCES, TITLE, enabled, isSynthetic, filterSynthetic, progressCounts };
