import { describe, it, expect } from 'vitest';
import { getPhotoTopic, groupPhotosByTopic, type PhotoItem } from '../api';

function photo(id: string, taken_at: string, topic?: { id: string; text: string }): PhotoItem {
  return {
    id,
    project_id: 'proj-1',
    document_id: null,
    filename: `${id}.jpg`,
    caption: null,
    gps_lat: null,
    gps_lon: null,
    tags: [],
    taken_at,
    category: 'site',
    metadata: topic ? { topic } : {},
    created_by: 'u1',
    created_at: taken_at,
    updated_at: taken_at,
  };
}

describe('getPhotoTopic', () => {
  it('reads a well-formed topic and trims the text', () => {
    expect(getPhotoTopic(photo('a', '2026-06-05T10:00:00Z', { id: 't1', text: '  بتن‌ریزی  ' }))).toEqual({
      id: 't1',
      text: 'بتن‌ریزی',
    });
  });

  it('returns null for missing or malformed topics', () => {
    expect(getPhotoTopic(photo('a', '2026-06-05T10:00:00Z'))).toBeNull();
    const bad = photo('b', '2026-06-05T10:00:00Z');
    bad.metadata = { topic: { id: 't1', text: '   ' } };
    expect(getPhotoTopic(bad)).toBeNull();
  });
});

describe('groupPhotosByTopic', () => {
  it('groups one batch together and keeps first-appearance order', () => {
    const groups = groupPhotosByTopic([
      photo('a', '2026-06-05T12:00:00Z', { id: 't2', text: 'second' }),
      photo('b', '2026-06-05T11:00:00Z', { id: 't1', text: 'first' }),
      photo('c', '2026-06-05T10:00:00Z', { id: 't2', text: 'second' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['second', 'first']);
    expect(groups[0]?.photos.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('puts topic-less photos in one untitled group per day', () => {
    const groups = groupPhotosByTopic([
      photo('a', '2026-06-05T12:00:00Z'),
      photo('b', '2026-06-04T12:00:00Z'),
      photo('c', '2026-06-05T08:00:00Z'),
    ]);
    expect(groups.map((g) => [g.title, g.date])).toEqual([
      [null, '2026-06-05'],
      [null, '2026-06-04'],
    ]);
    expect(groups[0]?.photos.map((p) => p.id)).toEqual(['a', 'c']);
  });
});
