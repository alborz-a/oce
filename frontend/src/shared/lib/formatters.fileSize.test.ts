import { describe, expect, it, vi } from 'vitest';
import { formatFileSize } from './formatters';

const state = vi.hoisted(() => ({ locale: 'en-US' }));

vi.mock('@/stores/usePreferencesStore', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getNumberLocale: () => state.locale,
}));

describe('formatFileSize', () => {
  it('keeps the English form', () => {
    state.locale = 'en-US';
    expect(formatFileSize(523)).toBe('523 B');
    expect(formatFileSize(12.4 * 1024)).toBe('12.4 KB');
    expect(formatFileSize(27.9 * 1024 * 1024)).toBe('27.9 MB');
    expect(formatFileSize(1.5 * 1024 ** 3)).toBe('1.5 GB');
  });

  it('writes Persian digits, separator, unit and a bidi isolate in fa', () => {
    state.locale = 'fa-IR';
    const out = formatFileSize(27.9 * 1024 * 1024);
    expect(out.startsWith('⁨')).toBe(true);
    expect(out.endsWith('⁩')).toBe(true);
    expect(out).toContain('۲۷٫۹');
    expect(out).toContain('مگابایت');
    expect(out).not.toMatch(/MB|[0-9]/);
    expect(formatFileSize(500)).toContain('۵۰۰');
  });
});
