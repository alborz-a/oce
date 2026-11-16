import { describe, expect, it } from 'vitest';
import { resolveReporter } from '../hooks/useProjectWorkspaceStream';

const IMPORTER = 'Mizito Importer';

describe('resolveReporter', () => {
  it('parses the «name» — date header and replaces the hidden importer name', () => {
    const result = resolveReporter(IMPORTER, '«میلاد کشمیری» — 1403/03/31 00:43 [فایل: a.jpg]');
    expect(result.name).toBe('میلاد کشمیری');
    expect(result.body).toBe('[فایل: a.jpg]');
  });

  it('strips the header from the body when the importer name is replaced', () => {
    const result = resolveReporter(IMPORTER, '«نیما عمرانی» — 1401/12/18 13:10 کار انجام شد');
    expect(result.name).toBe('نیما عمرانی');
    expect(result.body).toBe('کار انجام شد');
  });

  it('treats an empty name as hidden and uses the header name', () => {
    const result = resolveReporter('', '«مهدی قدیری» — 1403/12/10 10:53 متن');
    expect(result.name).toBe('مهدی قدیری');
    expect(result.body).toBe('متن');
  });

  it('keeps a non-importer name and body untouched even if the header is present', () => {
    const text = '«نیما عمرانی» — 1401/12/18 13:10 متن';
    const result = resolveReporter('علی رضایی', text);
    expect(result.name).toBe('علی رضایی');
    expect(result.body).toBe(text);
  });

  it('leaves text without a header untouched and uses the fallback for the hidden importer', () => {
    const result = resolveReporter(IMPORTER, 'متن بدون سرآیند');
    expect(result.name).toBe('همکار');
    expect(result.body).toBe('متن بدون سرآیند');
  });

  it('uses the provided fallback name when no header is found', () => {
    const result = resolveReporter('', 'متن ساده', 'کاربر');
    expect(result.name).toBe('کاربر');
    expect(result.body).toBe('متن ساده');
  });
});
