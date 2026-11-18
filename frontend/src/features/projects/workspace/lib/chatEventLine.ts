/**
 * Imported Mizito chat event lines: `[رویداد: X]` where X is a Mizito message-action
 * code (full or short form). An event line may sit alone, with other text, or
 * on several lines of one message. Pure functions only.
 */

const EVENT_LABELS: Record<string, string> = {
  messageActionChatAddUser: 'کاربر اضافه شد',
  messageActionChatDeleteUser: 'کاربر حذف شد',
  messageActionChatCreate: 'گفتگو ایجاد شد',
  messageActionCustomerInfoUpdated: 'اطلاعات مشتری به‌روزرسانی شد',
  messageActionChatEditPhoto: 'عکس گفتگو تغییر کرد',
  messageActionChatEditTitle: 'عنوان گفتگو تغییر کرد',
  messageActionAddLabel: 'برچسب اضافه شد',
  messageActionRemoveLabel: 'برچسب حذف شد',
  AddUser: 'کاربر اضافه شد',
  DeleteUser: 'کاربر حذف شد',
  ChatCreate: 'گفتگو ایجاد شد',
  CustomerInfoUpdated: 'اطلاعات مشتری به‌روزرسانی شد',
  EditPhoto: 'عکس گفتگو تغییر کرد',
  EditTitle: 'عنوان گفتگو تغییر کرد',
  AddLabel: 'برچسب اضافه شد',
  RemoveLabel: 'برچسب حذف شد',
};

const UNKNOWN_EVENT_LABEL = 'رویداد گفتگو';
const EVENT_LINE_RE = /^\s*\[رویداد:\s*([^\]\n]*?)\s*\]\s*$/;

function labelForCode(code: string): string {
  return Object.prototype.hasOwnProperty.call(EVENT_LABELS, code)
    ? (EVENT_LABELS[code] ?? UNKNOWN_EVENT_LABEL)
    : UNKNOWN_EVENT_LABEL;
}

/** Centered system line label for a whole-message event tag; null when the text is not an event line. */
export function chatEventLabel(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = EVENT_LINE_RE.exec(text);
  if (!m) return null;
  return labelForCode(m[1] ?? '');
}

/**
 * Splits event lines out of a message: every line that is only an event tag becomes
 * a label; the remaining lines stay as `rest` (trimmed, blank lines dropped).
 */
export function extractChatEvents(text: string | null | undefined): { labels: string[]; rest: string } {
  if (!text) return { labels: [], rest: '' };
  if (!text.includes('[رویداد:')) return { labels: [], rest: text };
  const labels: string[] = [];
  const kept = text.split('\n').filter((line) => {
    const m = EVENT_LINE_RE.exec(line);
    if (!m) return true;
    labels.push(labelForCode(m[1] ?? ''));
    return false;
  });
  return { labels, rest: kept.join('\n').trim() };
}
