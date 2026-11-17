/**
 * Helpers for the migration service account ("Mizito Importer").
 * Imported chat/comment rows carry the importer as author; the real sender
 * name is written at the start of the text as «name» — <jalali date> <body>.
 * Pure functions only.
 */

export const IMPORTER_USER_ID = 'e4562db4-0f71-4cd4-a765-49b423f26cd2';

/** Shown when an importer row has no «name» prefix. */
export const IMPORTER_FALLBACK_NAME = 'کاربر قبلی';

type IdLike = string | number | null | undefined;

/** True when a user id (or an object carrying user_id / id) is the importer. */
export function isImporter(userOrId: IdLike | { user_id?: IdLike; id?: IdLike } | null | undefined): boolean {
  if (userOrId == null) return false;
  if (typeof userOrId === 'string' || typeof userOrId === 'number') {
    return String(userOrId).trim().toLowerCase() === IMPORTER_USER_ID;
  }
  const id = userOrId.user_id ?? userOrId.id;
  return id != null && String(id).trim().toLowerCase() === IMPORTER_USER_ID;
}

// «name» + optional " — 1404/06/31 17:50" tail. The trailing \s* is consumed
// so the rest starts at the body.
const IMPORTER_PREFIX_RE =
  /^«([^»]+)»\s*—\s*(?:[۰-۹0-9]{4}\/[۰-۹0-9]{1,2}\/[۰-۹0-9]{1,2}(?:\s+[۰-۹0-9]{1,2}:[۰-۹0-9]{2})?\s*)?/;

/**
 * Split an importer text into sender name and body.
 * No prefix: senderName null, rest = text unchanged.
 * Header only: rest ''.
 */
export function parseImporterPrefix(text: string): { senderName: string | null; rest: string } {
  const match = IMPORTER_PREFIX_RE.exec(text);
  if (!match) return { senderName: null, rest: text };
  const senderName = (match[1] ?? '').trim();
  if (!senderName) return { senderName: null, rest: text };
  return { senderName, rest: text.slice(match[0].length) };
}
