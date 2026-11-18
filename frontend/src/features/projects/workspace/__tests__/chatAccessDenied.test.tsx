import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectStreamList } from '../components/ProjectStreamList';

vi.mock('@/shared/lib/api', () => ({
  downloadWithAuth: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

const DENIED_TEXT = 'شما اجازهٔ مشاهدهٔ گفتگوی این پروژه را ندارید. با مدیر پروژه تماس بگیرید.';

describe('ProjectStreamList access denied state', () => {
  it('shows the permission message instead of the empty state on 403', () => {
    render(<ProjectStreamList projectId="p-1" items={[]} accessDenied onReply={vi.fn()} onReact={vi.fn()} />);

    expect(screen.getByTestId('stream-access-denied')).toHaveTextContent(DENIED_TEXT);
    expect(screen.queryByTestId('stream-empty')).not.toBeInTheDocument();
  });

  it('keeps the normal empty state when access is not denied', () => {
    render(<ProjectStreamList projectId="p-1" items={[]} onReply={vi.fn()} onReact={vi.fn()} />);

    expect(screen.getByTestId('stream-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('stream-access-denied')).not.toBeInTheDocument();
  });
});
