import { describe, expect, it } from 'vitest';
import { fileIconForName, parseRawFileTags } from '../lib/rawFileTag';

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

  it('leaves a line with no tag untouched even when a key appears alone', () => {
    const text = 'mizito/general/chats/r/files/x.pdf';
    expect(parseRawFileTags(text)).toEqual({ text, files: [] });
  });
});
