import { describe, expect, it } from 'vitest';
import { fileIconForName, parseRawFileTags, rawFileQuotePreview } from '../lib/rawFileTag';
import { extractChatEvents } from '../lib/chatEventLine';

describe('parseRawFileTags', () => {
  it('returns text unchanged when there is no tag', () => {
    expect(parseRawFileTags('سلام دوستان')).toEqual({ text: 'سلام دوستان', files: [] });
  });

  it('handles a name with spaces and a key on the same line', () => {
    const text =
      '[فایل: گزارش نهایی 1.pdf] mizito/general/chats/room1/files/گزارش نهایی 1.pdf';
    expect(parseRawFileTags(text)).toEqual({
      text: '',
      files: [
        {
          name: 'گزارش نهایی 1.pdf',
          key: 'mizito/general/chats/room1/files/گزارش نهایی 1.pdf',
          icon: 'picture_as_pdf',
        },
      ],
    });
  });

  it('handles a tag without key', () => {
    expect(parseRawFileTags('[فایل: a.jpg]')).toEqual({
      text: '',
      files: [{ name: 'a.jpg', key: null, icon: 'image' }],
    });
  });

  it('keeps caption lines after the tag line', () => {
    const text = '[فایل: clip.mp4] mizito/general/chats/r/files/clip.mp4\nمتن توضیح\nخط دوم';
    expect(parseRawFileTags(text)).toEqual({
      text: 'متن توضیح\nخط دوم',
      files: [
        { name: 'clip.mp4', key: 'mizito/general/chats/r/files/clip.mp4', icon: 'movie' },
      ],
    });
  });

  it('keeps caption text on the same line before the key', () => {
    const text = 'این فایل را ببینید [فایل: sheet.xlsx] mizito/general/chats/r/files/sheet.xlsx';
    expect(parseRawFileTags(text)).toEqual({
      text: 'این فایل را ببینید',
      files: [
        { name: 'sheet.xlsx', key: 'mizito/general/chats/r/files/sheet.xlsx', icon: 'description' },
      ],
    });
  });

  it('handles multiple tags: key attaches to the last tag on the line only', () => {
    const text = '[فایل: a.png] [فایل: b.pdf] mizito/general/chats/r/files/b.pdf';
    expect(parseRawFileTags(text)).toEqual({
      text: '',
      files: [
        { name: 'a.png', key: null, icon: 'image' },
        { name: 'b.pdf', key: 'mizito/general/chats/r/files/b.pdf', icon: 'picture_as_pdf' },
      ],
    });
  });

  it('returns empty caption when only the tag and key exist', () => {
    expect(parseRawFileTags('[فایل: x.zip] mizito/general/chats/r/files/x.zip').text).toBe('');
  });

  it('does not treat date-like tails as extensions', () => {
    const result = parseRawFileTags('[فایل: صورتجلسه 1403.06.31]');
    expect(result.files).toEqual([{ name: 'صورتجلسه 1403.06.31', key: null, icon: 'description' }]);
    expect(fileIconForName('report.1403')).toBe('description');
    expect(fileIconForName('report.31')).toBe('description');
    expect(fileIconForName('clip.MOV')).toBe('movie');
  });

  it('turns a bare key line with no tag into a chip', () => {
    const text = 'mizito/general/chats/r/files/x.pdf';
    expect(parseRawFileTags(text)).toEqual({
      text: '',
      files: [{ name: 'x.pdf', key: text, icon: 'picture_as_pdf' }],
    });
  });

  it('turns a tag-less key line with junk prefix into a chip and drops the prefix', () => {
    const text = '[Ali Reza(ali) (1 mizito/general/chats/r1/files/عکس 2.jpg';
    expect(parseRawFileTags(text)).toEqual({
      text: '',
      files: [
        { name: 'عکس 2.jpg', key: 'mizito/general/chats/r1/files/عکس 2.jpg', icon: 'image' },
      ],
    });
  });

  it('keeps caption lines around a junk-prefixed key line', () => {
    const text = 'سلام\n[Ali(ali) (1 mizito/general/chats/r1/files/sheet.xlsx\nخداحافظ';
    expect(parseRawFileTags(text)).toEqual({
      text: 'سلام\nخداحافظ',
      files: [
        { name: 'sheet.xlsx', key: 'mizito/general/chats/r1/files/sheet.xlsx', icon: 'description' },
      ],
    });
  });

  it('keeps a closed bracket prefix before a key as caption text', () => {
    const text = '[Ali] mizito/general/chats/r1/files/a.pdf';
    expect(parseRawFileTags(text)).toEqual({
      text: '[Ali]',
      files: [{ name: 'a.pdf', key: 'mizito/general/chats/r1/files/a.pdf', icon: 'picture_as_pdf' }],
    });
  });

  it('strips raw tag and key from a caption-only text (stream card use)', () => {
    expect(parseRawFileTags('عکس جلسه [فایل: m.jpg] mizito/general/chats/r/files/m.jpg').text).toBe('عکس جلسه');
  });

  it('parses a tag split over lines (multi-line tag + key on the next line)', () => {
    const text = '«مهدی قدیری» — 1403/04/14\n[فایل: عکس\n1.jpg] mizito/general/chats/r/files/عکس 1.jpg';
    expect(parseRawFileTags(text)).toEqual({
      text: '«مهدی قدیری» — 1403/04/14',
      files: [{ name: 'عکس 1.jpg', key: 'mizito/general/chats/r/files/عکس 1.jpg', icon: 'image' }],
    });
  });

  it('attaches a key on its own line right after a tag line', () => {
    const text = '[فایل: a.pdf]\nmizito/general/chats/r/files/a.pdf';
    expect(parseRawFileTags(text)).toEqual({
      text: '',
      files: [{ name: 'a.pdf', key: 'mizito/general/chats/r/files/a.pdf', icon: 'picture_as_pdf' }],
    });
  });

  it('parses a markdown link to the storage key', () => {
    const text = 'فایل [گزارش](mizito/general/chats/r/files/g.pdf) را ببینید';
    expect(parseRawFileTags(text)).toEqual({
      text: 'فایل را ببینید',
      files: [{ name: 'گزارش', key: 'mizito/general/chats/r/files/g.pdf', icon: 'picture_as_pdf' }],
    });
  });

  it('uses the key basename when the markdown link text is empty', () => {
    const text = '[](mizito/general/chats/r/files/b.mp4)';
    expect(parseRawFileTags(text)).toEqual({
      text: '',
      files: [{ name: 'b.mp4', key: 'mizito/general/chats/r/files/b.mp4', icon: 'movie' }],
    });
  });

  it('strips a URL in front of a key and keeps the key as the file', () => {
    const text = 'متن https://files.example.test/mizito/general/chats/r/files/c.jpg';
    expect(parseRawFileTags(text)).toEqual({
      text: 'متن',
      files: [
        {
          name: 'c.jpg',
          key: 'mizito/general/chats/r/files/c.jpg',
          icon: 'image',
        },
      ],
    });
    const withTag = '[فایل: c.jpg] https://files.example.test/mizito/general/chats/r/files/c.jpg';
    expect(parseRawFileTags(withTag).files).toEqual([
      { name: 'c.jpg', key: 'mizito/general/chats/r/files/c.jpg', icon: 'image' },
    ]);
  });

  it('keeps caption text before and after a key in one message', () => {
    const text = '[فایل: a.docx] متن mizito/general/chats/r/files/x.docx';
    expect(parseRawFileTags(text)).toEqual({
      text: 'متن',
      files: [
        { name: 'a.docx', key: null, icon: 'description' },
        { name: 'x.docx', key: 'mizito/general/chats/r/files/x.docx', icon: 'description' },
      ],
    });
  });

  it('turns a key after a tag line into a chip even when text follows it on the next line', () => {
    const text = '[فایل: a.pdf]\nmizito/general/chats/r/files/a.pdf\nخط توضیح';
    expect(parseRawFileTags(text)).toEqual({
      text: 'خط توضیح',
      files: [{ name: 'a.pdf', key: 'mizito/general/chats/r/files/a.pdf', icon: 'picture_as_pdf' }],
    });
  });
});

describe('rawFileQuotePreview', () => {
  it('returns plain quoted text unchanged', () => {
    expect(rawFileQuotePreview('سلام')).toBe('سلام');
  });

  it('returns the caption of a quoted tag message', () => {
    expect(rawFileQuotePreview('توضیح [فایل: a.pdf] mizito/general/chats/r/files/a.pdf')).toBe('توضیح');
  });

  it('returns a file label when the quote is only a tag and key', () => {
    expect(rawFileQuotePreview('[فایل: a.pdf] mizito/general/chats/r/files/a.pdf')).toBe('📎 فایل');
  });
});

describe('extractChatEvents', () => {
  it('splits an event line from following text', () => {
    expect(extractChatEvents('[رویداد: DeleteUser]\nمتن بعدی')).toEqual({
      labels: ['کاربر حذف شد'],
      rest: 'متن بعدی',
    });
  });

  it('returns no labels for plain text', () => {
    expect(extractChatEvents('سلام')).toEqual({ labels: [], rest: 'سلام' });
  });
});

describe('parseRawFileTags prod shapes (space in name, repeated trailing name)', () => {
  const key = 'mizito/general/chats/2024-01/files/abc_General schedule.xlsx General schedule.xlsx';

  it('single line: tag + key with spaces leaves no raw text and one chip', () => {
    const parsed = parseRawFileTags(`[فایل: General schedule.xlsx] ${key}`);
    expect(parsed.text).toBe('');
    expect(parsed.files).toEqual([
      { name: 'General schedule.xlsx', key, icon: 'description' },
    ]);
  });

  it('multi-line: tag line followed by key line leaves no raw text and one chip', () => {
    const parsed = parseRawFileTags(`[فایل: General schedule.xlsx]\n${key}`);
    expect(parsed.text).toBe('');
    expect(parsed.files).toEqual([
      { name: 'General schedule.xlsx', key, icon: 'description' },
    ]);
  });

  it('topic-comment shape: two tagged files keep no raw key text', () => {
    const text =
      '[فایل: CV Mechanical.pdf] mizito/general/chats/x/abc_CV Mechanical.pdf CV Mechanical.pdf\n[فایل: Works.xlsx] mizito/general/chats/y/z_Works.xlsx Works.xlsx';
    const parsed = parseRawFileTags(text);
    expect(parsed.text).toBe('');
    expect(parsed.files.map((f) => f.name)).toEqual(['CV Mechanical.pdf', 'Works.xlsx']);
  });
});
