// frontend/src/shared/lib/parseChatEntityMarkers.ts
export type ChatSegment =
  | { kind: 'text'; text: string }
  | { kind: 'task'; title: string }
  | { kind: 'minute'; subject: string }
  | { kind: 'file'; name: string; storageKey: string | null }
  | { kind: 'call' }
  | { kind: 'event'; action: string }
  | { kind: 'deleted' };

export interface ParsedChatMessage {
  importedSender?: string;
  importedDate?: string;
  segments: ChatSegment[];
}

const HEADER_RE = /^«([^»]*)»\s*—\s*([^\n]+)\n?/;
const MARKER_LINE_RE =
  /^\[(وظیفه|صورتجلسه|فایل|رویداد):\s*([^\]]+)\](?:\s+(.+))?$|^\[(تماس|پیام حذف‌شده)\]$/;

export function parseChatEntityMarkers(raw: string): ParsedChatMessage {
  let body = raw ?? '';
  let importedSender: string | undefined;
  let importedDate: string | undefined;

  const headerMatch = body.match(HEADER_RE);
  if (headerMatch) {
    importedSender = headerMatch[1]?.trim() || undefined;
    importedDate = headerMatch[2]?.trim() || undefined;
    body = body.slice(headerMatch[0].length);
  }

  const segments: ChatSegment[] = [];
  const textBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length > 0) {
      const joined = textBuffer.join('\n').trim();
      if (joined) segments.push({ kind: 'text', text: joined });
      textBuffer.length = 0;
    }
  };

  for (const line of body.split('\n')) {
    const m = line.trim().match(MARKER_LINE_RE);
    if (!m) {
      textBuffer.push(line);
      continue;
    }
    flushText();
    const tag = m[1] || m[4];
    const value = (m[2] ?? '').trim();
    const extra = (m[3] ?? '').trim();

    if (tag === 'وظیفه') {
      segments.push({ kind: 'task', title: value });
    } else if (tag === 'صورتجلسه') {
      segments.push({ kind: 'minute', subject: value });
    } else if (tag === 'فایل') {
      const storageKey = extra && extra !== '(کلید نامشخص)' ? extra : null;
      segments.push({ kind: 'file', name: value, storageKey });
    } else if (tag === 'تماس') {
      segments.push({ kind: 'call' });
    } else if (tag === 'رویداد') {
      segments.push({ kind: 'event', action: value });
    } else if (tag === 'پیام حذف‌شده') {
      segments.push({ kind: 'deleted' });
    }
  }
  flushText();

  return { importedSender, importedDate, segments };
}
