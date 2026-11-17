import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const apiPostMock = vi.fn();
vi.mock('@/shared/lib/api', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

import { useOpenColleagueDm } from '../hooks/useOpenColleagueDm';
import {
  WorkspaceDmContext,
  useOpenDmForColleague,
  type WorkspaceDmValue,
} from '../context/WorkspaceDmContext';

describe('useOpenColleagueDm', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    apiPostMock.mockReset();
    apiPostMock.mockResolvedValue({ id: 'dm-1' });
    pushSpy = vi.spyOn(window.history, 'pushState');
  });

  afterEach(() => {
    pushSpy.mockRestore();
  });

  it('inside workspace: hands the DM room to the callback and does not navigate', async () => {
    const onOpenRoom = vi.fn();
    const { result } = renderHook(() => useOpenColleagueDm('u1', onOpenRoom));

    await act(async () => {
      await result.current('u2');
    });

    expect(apiPostMock).toHaveBeenCalledWith('/v1/team-chat/rooms/', {
      kind: 'dm',
      member_ids: ['u1', 'u2'],
    });
    expect(onOpenRoom).toHaveBeenCalledWith({ id: 'dm-1' }, 'u2');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('legacy (no callback): falls back to /chat/:roomId navigation', async () => {
    const { result } = renderHook(() => useOpenColleagueDm('u1'));

    await act(async () => {
      await result.current('u2');
    });

    expect(pushSpy).toHaveBeenCalledWith({}, '', '/chat/dm-1');
  });

  it('clicking yourself is a no-op', async () => {
    const onOpenRoom = vi.fn();
    const { result } = renderHook(() => useOpenColleagueDm('u1', onOpenRoom));

    await act(async () => {
      await result.current('u1');
    });

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(onOpenRoom).not.toHaveBeenCalled();
  });
});

describe('useOpenDmForColleague', () => {
  it('uses the workspace provider when present', async () => {
    const openDm = vi.fn(async () => {});
    const value: WorkspaceDmValue = { openDm };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceDmContext.Provider value={value}>{children}</WorkspaceDmContext.Provider>
    );
    const { result } = renderHook(() => useOpenDmForColleague('u1'), { wrapper });

    await act(async () => {
      await result.current('u2');
    });

    expect(openDm).toHaveBeenCalledWith('u2');
  });
});
