import { describe, expect, it } from 'vitest';
import {
  IMPORTER_USER_ID,
  isImporter,
  parseImporterPrefix,
} from '../lib/importerAuthor';

describe('isImporter', () => {
  it('matches the importer id as string, object and rejects others', () => {
    expect(isImporter(IMPORTER_USER_ID)).toBe(true);
    expect(isImporter({ user_id: IMPORTER_USER_ID })).toBe(true);
    expect(isImporter({ id: IMPORTER_USER_ID })).toBe(true);
    expect(isImporter('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(isImporter(null)).toBe(false);
    expect(isImporter(undefined)).toBe(false);
  });
});

describe('parseImporterPrefix', () => {
  it('parses «name» with date and time tail', () => {
    expect(parseImporterPrefix('«حسین عمران» — ۱۴۰۴/۰۶/۳۱ ۱۷:۵۰\nمتن پیام')).toEqual({
      senderName: 'حسین عمران',
      rest: 'متن پیام',
    });
  });

  it('parses ASCII date digits too', () => {
    expect(parseImporterPrefix('«نیما عمرانی» — 1401/12/18 13:10 کار انجام شد')).toEqual({
      senderName: 'نیما عمرانی',
      rest: 'کار انجام شد',
    });
  });

  it('parses name only (no date tail)', () => {
    expect(parseImporterPrefix('«میلاد کشمیری» — متن')).toEqual({
      senderName: 'میلاد کشمیری',
      rest: 'متن',
    });
  });

  it('returns empty rest for header-only text', () => {
    expect(parseImporterPrefix('«حسین عمران» — ۱۴۰۴/۰۶/۳۱ ۱۷:۵۰')).toEqual({
      senderName: 'حسین عمران',
      rest: '',
    });
  });

  it('returns null sender and unchanged text without prefix', () => {
    expect(parseImporterPrefix('متن بدون سرآیند')).toEqual({
      senderName: null,
      rest: 'متن بدون سرآیند',
    });
  });

  it('treats a blank «» name as no prefix', () => {
    expect(parseImporterPrefix('«   » — متن')).toEqual({
      senderName: null,
      rest: '«   » — متن',
    });
  });
});
