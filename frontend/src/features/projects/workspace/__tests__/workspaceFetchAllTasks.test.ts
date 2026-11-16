import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sharedApi from '@/shared/lib/api';
import { fetchAllTasks, type Task } from '@/features/tasks/api';

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api')>();
  return { ...actual, apiGet: vi.fn() };
});

function makeTasks(count: number, start = 0): Task[] {
  return Array.from({ length: count }, (_, i) => ({ id: `task-${start + i}` }) as unknown as Task);
}

function offsetOf(url: string): number {
  return Number(new URL(url, 'http://x').searchParams.get('offset'));
}

describe('fetchAllTasks', () => {
  const apiGet = vi.mocked(sharedApi.apiGet);

  beforeEach(() => {
    apiGet.mockReset();
  });

  it('pages through 3 pages of a 1147-task project using offsets 0, 500, 1000', async () => {
    apiGet.mockImplementation(async (url: string) => {
      const offset = offsetOf(url);
      const size = Math.min(500, 1147 - offset);
      return { items: makeTasks(size, offset), total: 1147, offset, limit: 500 };
    });

    const result = await fetchAllTasks({ project_id: 'p-1' });

    expect(apiGet).toHaveBeenCalledTimes(3);
    expect(apiGet.mock.calls.map(([url]) => offsetOf(String(url)))).toEqual([0, 500, 1000]);
    expect(result).toHaveLength(1147);
    expect(String(apiGet.mock.calls[0][0])).toContain('project_id=p-1');
    expect(String(apiGet.mock.calls[0][0])).toContain('limit=500');
  });

  it('stops after the first page when total is already reached', async () => {
    apiGet.mockResolvedValue({ items: makeTasks(10), total: 10, offset: 0, limit: 500 });

    const result = await fetchAllTasks({ project_id: 'p-1' });

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(10);
  });

  it('stops when a page returns no items even if total says more', async () => {
    apiGet
      .mockResolvedValueOnce({ items: makeTasks(500), total: 900, offset: 0, limit: 500 })
      .mockResolvedValueOnce({ items: [], total: 900, offset: 500, limit: 500 });

    const result = await fetchAllTasks({ project_id: 'p-1' });

    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(500);
  });

  it('respects maxPages', async () => {
    apiGet.mockImplementation(async (url: string) => {
      const offset = offsetOf(url);
      return { items: makeTasks(5, offset), total: 10_000, offset, limit: 5 };
    });

    const result = await fetchAllTasks({ project_id: 'p-1' }, 5, 3);

    expect(apiGet).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(15);
  });
});
