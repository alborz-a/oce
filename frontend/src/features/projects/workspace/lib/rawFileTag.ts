/**
 * Raw file tags left in imported chat text by the Mizito importer when the
 * file row could not be resolved. Shapes handled:
 * - `[فایل: <name>]` optionally followed by the storage key `mizito/general/chats/...`
 *   (key runs to end of line); the tag and key may be split over several lines;
 * - a key on its own line right after a tag line;
 * - a key with a junk prefix such as `[Name(login) (1 mizito/general/chats/...`;
 * - a markdown link `[text](mizito/general/chats/...)`;
 * - a URL that ends with the key (`https://host/.../mizito/general/chats/...`).
 * - a bare key anywhere, with or without a tag (chip; caption text before it is kept).
 * Pure functions only.
 */

export interface RawFileChip {
  /** File name taken from inside the tag (may contain spaces). */
  name: string;
  /** Storage key from the same line, or null when absent. */
  key: string | null;
  /** Material Icons ligature name chosen by extension. */
  icon: string;
}

export interface RawFileParseResult {
  /** Text with tags and keys removed; caption lines kept. */
  text: string;
  files: RawFileChip[];
}

const TAG_MARKER = '[فایل:';
const KEY_MARKER = 'mizito/general/chats/';
/** Junk left before a bare key: an opened but never closed bracket, e.g. `[Name(login) (1 `. */
const JUNK_PREFIX_RE = /^\s*\[[^\]\n]*$/;
/** A URL token at the end of the text before a key. */
const URL_TAIL_RE = /\S*https?:\/\/\S*$/;

const PDF_EXT = ['pdf'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];
const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'avi', 'webm', '3gp', 'm4v'];

/**
 * Material icon for a file name. Only a real extension counts: it must contain a
 * letter, so date-like tails such as `.31` or `.1403` fall back to `description`.
 */
export function fileIconForName(name: string): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name.trim());
  const ext = m && /[A-Za-z]/.test(m[1] ?? '') ? (m[1] ?? '').toLowerCase() : '';
  if (PDF_EXT.includes(ext)) return 'picture_as_pdf';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'movie';
  return 'description';
}

interface RawHit {
  kind: 'tag' | 'md' | 'key';
  start: number;
  end: number;
  /** Tag name (tag) or link text (md). */
  name: string;
  /** Storage key (md and key). */
  key: string;
}

function keyBasename(key: string): string {
  return key.slice(key.lastIndexOf('/') + 1).trim();
}

/**
 * Extract raw file tags from text. Returns the text unchanged (files empty) when no
 * file shape is found. Otherwise returns caption text without tags, keys and
 * blank lines, plus one chip per file.
 */
export function parseRawFileTags(text: string): RawFileParseResult {
  if (!text || (!text.includes(TAG_MARKER) && !text.includes(KEY_MARKER))) {
    return { text, files: [] };
  }

  const hitRe =
    /\[فایل:\s*([^\]]{0,300}?)\s*\]|\[([^[\]\n]{0,200})\]\((mizito\/general\/chats\/[^)\n]*)\)|mizito\/general\/chats\/[^\n]*/g;
  const hits: RawHit[] = [];
  for (let m = hitRe.exec(text); m; m = hitRe.exec(text)) {
    const start = m.index;
    const end = start + m[0].length;
    if (m[1] !== undefined) {
      hits.push({ kind: 'tag', start, end, name: m[1], key: '' });
    } else if (m[3] !== undefined) {
      hits.push({ kind: 'md', start, end, name: m[2] ?? '', key: m[3].trim() });
    } else {
      hits.push({ kind: 'key', start, end, name: '', key: m[0].trim() });
    }
  }

  const files: RawFileChip[] = [];
  const addFile = (name: string, key: string | null) => {
    if (!name) return;
    files.push({ name, key, icon: fileIconForName(name) });
  };

  let out = '';
  let cursor = 0;

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    if (!hit) continue;
    out += text.slice(cursor, hit.start);
    cursor = hit.end;

    if (hit.kind === 'tag') {
      const next = hits[i + 1];
      let key: string | null = null;
      // Key attaches to the tag when only whitespace (incl. line breaks) separates them.
      const gap = next?.kind === 'key' ? text.slice(hit.end, next.start) : '';
      if (next?.kind === 'key' && (/^\s*$/.test(gap) || /^\s*https?:\/\/\S*$/.test(gap))) {
        key = next.key;
        cursor = next.end;
        i++;
      }
      addFile(hit.name.replace(/\s*\n\s*/g, ' ').trim(), key);
      continue;
    }

    if (hit.kind === 'md') {
      addFile(hit.name.trim() || keyBasename(hit.key), hit.key);
      continue;
    }

    // Bare key: always a file. Drop a URL or junk prefix on its line; keep caption text.
    const lineStart = out.lastIndexOf('\n') + 1;
    const linePart = out.slice(lineStart);
    const hasUrl = URL_TAIL_RE.test(linePart);
    let kept = hasUrl ? linePart.replace(URL_TAIL_RE, '') : linePart;
    if (JUNK_PREFIX_RE.test(kept)) kept = '';
    out = out.slice(0, lineStart) + kept;
    addFile(keyBasename(hit.key), hit.key);
  }
  out += text.slice(cursor);

  if (files.length === 0) return { text, files: [] };

  const cleaned = out
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
  return { text: cleaned, files };
}

/**
 * Text to show for a quoted or replied message: parsed caption, or a short file
 * label when the quoted text is only a file tag or key.
 */
export function rawFileQuotePreview(text: string): string {
  const parsed = parseRawFileTags(text);
  if (parsed.text) return parsed.text;
  return parsed.files.length > 0 ? '📎 فایل' : text;
}
