/**
 * Raw file tags left in imported chat text by the Mizito importer when the
 * file row could not be resolved: `[فایل: <name>]` optionally followed on the
 * same line by the storage key `mizito/general/chats/...` (to end of line).
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

const TAG_RE = /\[فایل:\s*([^\]\n]*?)\s*\]/g;
const KEY_MARKER = 'mizito/general/chats/';
const TAG_MARKER = '[فایل:';
/** Junk left before a bare key: an opened but never closed bracket, e.g. `[Name(login) (1 `. */
const JUNK_PREFIX_RE = /^\s*\[[^\]\n]*$/;

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

/**
 * Extract raw file tags from text. Lines without a tag are returned unchanged.
 * A same-line key belongs to the last tag on that line; earlier tags get key null.
 * Lines left empty after removal are dropped.
 */
export function parseRawFileTags(text: string): RawFileParseResult {
  if (!text || (!text.includes(TAG_MARKER) && !text.includes(KEY_MARKER))) {
    return { text, files: [] };
  }

  const files: RawFileChip[] = [];
  const outLines: string[] = [];

  for (const line of text.split('\n')) {
    if (!line.includes(TAG_MARKER)) {
      // Tag-less key line with a junk prefix such as `[Name(login) (1 mizito/general/chats/...`:
      // the prefix is an unclosed bracket and is dropped; the file name comes from the key.
      const keyAt = line.indexOf(KEY_MARKER);
      if (keyAt > 0 && JUNK_PREFIX_RE.test(line.slice(0, keyAt))) {
        const key = line.slice(keyAt).trim();
        const name = key.slice(key.lastIndexOf('/') + 1).trim();
        if (name) files.push({ name, key, icon: fileIconForName(name) });
        continue;
      }
      outLines.push(line);
      continue;
    }

    const keyIdx = line.indexOf(KEY_MARKER);
    const head = keyIdx >= 0 ? line.slice(0, keyIdx) : line;
    const key = keyIdx >= 0 ? line.slice(keyIdx).trim() : null;

    const names: string[] = [];
    const cleaned = head.replace(TAG_RE, (_match, name: string) => {
      names.push(name.trim());
      return '';
    });

    if (names.length === 0) {
      // Key-only or malformed line: keep the original line untouched.
      outLines.push(line);
      continue;
    }

    names.forEach((name, idx) => {
      if (!name) return;
      const isLast = idx === names.length - 1;
      files.push({
        name,
        key: isLast ? key : null,
        icon: fileIconForName(name),
      });
    });

    const caption = cleaned.trim();
    if (caption) outLines.push(caption);
  }

  if (files.length === 0 && outLines.join('\n') === text) {
    return { text, files: [] };
  }
  return { text: outLines.join('\n').trim(), files };
}
