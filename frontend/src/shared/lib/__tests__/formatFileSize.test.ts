import { describe, it, expect } from 'vitest';
import { formatFileSize, formatBytes, formatSize, humanFileSize } from '../formatters';

describe('formatFileSize', () => {
  describe('English (en-US)', () => {
    it('formats bytes under 1 KiB', () => {
      expect(formatFileSize(0, 'en-US')).toBe('0 B');
      expect(formatFileSize(500, 'en-US')).toBe('500 B');
      expect(formatFileSize(1023, 'en-US')).toBe('1023 B');
    });

    it('formats kibibytes (KB)', () => {
      expect(formatFileSize(1024, 'en-US')).toBe('1.0 KB');
      expect(formatFileSize(1536, 'en-US')).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1024 - 1, 'en-US')).toBe('1,024.0 KB');
    });

    it('formats mebibytes (MB)', () => {
      expect(formatFileSize(1024 * 1024, 'en-US')).toBe('1.0 MB');
      expect(formatFileSize(27.9 * 1024 * 1024, 'en-US')).toBe('27.9 MB');
    });

    it('formats gibibytes (GB)', () => {
      expect(formatFileSize(1024 * 1024 * 1024, 'en-US')).toBe('1.0 GB');
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024, 'en-US')).toBe('2.5 GB');
    });
  });

  describe('Farsi (fa / fa-IR)', () => {
    it('wraps output in Unicode bidi isolate (U+2068 ... U+2069)', () => {
      const res = formatFileSize(27.9 * 1024 * 1024, 'fa-IR');
      expect(res.charCodeAt(0)).toBe(0x2068);
      expect(res.charCodeAt(res.length - 1)).toBe(0x2069);
    });

    it('formats 0 bytes in Farsi', () => {
      const res = formatFileSize(0, 'fa-IR');
      expect(res).toBe('\u2068۰ بایت\u2069');
    });

    it('formats small bytes under 1 KiB in Farsi', () => {
      const res = formatFileSize(512, 'fa-IR');
      expect(res).toBe('\u2068۵۱۲ بایت\u2069');
    });

    it('formats KB with Persian digits and Persian unit', () => {
      const res = formatFileSize(1536, 'fa-IR');
      expect(res).toContain('کیلوبایت');
      expect(res).toMatch(/\u2068.*کیلوبایت\u2069/);
    });

    it('formats 27.9 MB without bidi reversal, using Persian digits and decimal separator', () => {
      const res = formatFileSize(27.9 * 1024 * 1024, 'fa-IR');
      // Must contain Persian unit "مگابایت"
      expect(res).toContain('مگابایت');
      // Must contain Persian decimal separator ٫
      expect(res).toContain('٫');
      // Must NOT contain Latin "MB"
      expect(res).not.toContain('MB');
      // Full exact match
      expect(res).toBe('\u2068۲۷٫۹ مگابایت\u2069');
    });

    it('formats GB with Persian unit "گیگابایت"', () => {
      const res = formatFileSize(1.5 * 1024 * 1024 * 1024, 'fa-IR');
      expect(res).toContain('گیگابایت');
      expect(res).toBe('\u2068۱٫۵ گیگابایت\u2069');
    });
  });

  describe('Aliases', () => {
    it('aliases formatBytes, formatSize, and humanFileSize behave identically', () => {
      const bytes = 1024 * 1024 * 5;
      expect(formatBytes(bytes, 'en-US')).toBe('5.0 MB');
      expect(formatSize(bytes, 'en-US')).toBe('5.0 MB');
      expect(humanFileSize(bytes, 'en-US')).toBe('5.0 MB');

      expect(formatBytes(bytes, 'fa-IR')).toBe('\u2068۵٫۰ مگابایت\u2069');
    });
  });
});
