import { describe, expect, it } from 'vitest';
import {
  collectLightboxPhotos,
  extractImageUrls,
  isBareImageUrlMessage,
  wrapIndex,
} from '../lib/chatPhotoUrls';

describe('chatPhotoUrls', () => {
  it('detects image URLs incl. presigned query strings and uppercase extensions', () => {
    const text = 'see https://s3.example.com/a/IMG_1.JPG?X-Amz-Signature=abc and https://x.test/b.png.';
    expect(extractImageUrls(text)).toEqual([
      'https://s3.example.com/a/IMG_1.JPG?X-Amz-Signature=abc',
      'https://x.test/b.png',
    ]);
  });

  it('ignores non-image URLs and empty input', () => {
    expect(extractImageUrls('https://example.com/page')).toEqual([]);
    expect(extractImageUrls(null)).toEqual([]);
  });

  it('marks URL-only messages as bare, not mixed text', () => {
    expect(isBareImageUrlMessage('  https://x.test/a.webp  ')).toBe(true);
    expect(isBareImageUrlMessage('hello https://x.test/a.webp')).toBe(false);
    expect(isBareImageUrlMessage('hello')).toBe(false);
  });

  it('dedupes lightbox photos by id and keeps order', () => {
    const refs = [
      { id: '1', url: 'a', name: 'a' },
      { id: '2', url: 'b', name: 'b' },
      { id: '1', url: 'a', name: 'a' },
    ];
    expect(collectLightboxPhotos(refs).map((r) => r.id)).toEqual(['1', '2']);
  });

  it('wraps lightbox index both ways', () => {
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(wrapIndex(0, 1, 0)).toBe(0);
  });
});
