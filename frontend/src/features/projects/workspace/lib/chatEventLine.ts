/**
 * Imported Mizito chat event lines: a whole message `[رویداد: X]` where X is a
 * Mizito message-action code (full or short form). Pure functions only.
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

/** Centered system line label for a whole-message event tag; null when the text is not an event line. */
export function chatEventLabel(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = EVENT_LINE_RE.exec(text);
  if (!m) return null;
  const code = m[1] ?? '';
  return Object.prototype.hasOwnProperty.call(EVENT_LABELS, code)
    ? (EVENT_LABELS[code] ?? UNKNOWN_EVENT_LABEL)
    : UNKNOWN_EVENT_LABEL;
}
