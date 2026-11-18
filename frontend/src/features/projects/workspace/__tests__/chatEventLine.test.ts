import { describe, expect, it } from 'vitest';
import { chatEventLabel } from '../lib/chatEventLine';

describe('chatEventLabel', () => {
  it('returns null for ordinary text and tags', () => {
    expect(chatEventLabel('سلام')).toBeNull();
    expect(chatEventLabel('[فایل: a.pdf]')).toBeNull();
    expect(chatEventLabel('متن [رویداد: AddUser] وسط')).toBeNull();
  });

  it('maps full and short Mizito action codes to Persian labels', () => {
    expect(chatEventLabel('[رویداد: messageActionChatAddUser]')).toBe('کاربر اضافه شد');
    expect(chatEventLabel('[رویداد: DeleteUser]')).toBe('کاربر حذف شد');
    expect(chatEventLabel('[رویداد: ChatCreate]')).toBe('گفتگو ایجاد شد');
    expect(chatEventLabel('[رویداد: CustomerInfoUpdated]')).toBe('اطلاعات مشتری به‌روزرسانی شد');
    expect(chatEventLabel('[رویداد: messageActionChatEditPhoto]')).toBe('عکس گفتگو تغییر کرد');
    expect(chatEventLabel('[رویداد: EditTitle]')).toBe('عنوان گفتگو تغییر کرد');
    expect(chatEventLabel('[رویداد: AddLabel]')).toBe('برچسب اضافه شد');
    expect(chatEventLabel('[رویداد: messageActionRemoveLabel]')).toBe('برچسب حذف شد');
  });

  it('falls back to the generic label for unknown codes', () => {
    expect(chatEventLabel('[رویداد: SomethingNew]')).toBe('رویداد گفتگو');
    expect(chatEventLabel('[رویداد: constructor]')).toBe('رویداد گفتگو');
  });
});
