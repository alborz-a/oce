// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Vitest component tests for the TeamStrip.
 *
 * The component renders avatar circles for up to 6 members and a
 * "+N more" chip after that, plus an "Add member" button that opens a
 * modal. These tests cover the four explicit cases in the spec:
 *
 *   1. empty members → "No members yet" placeholder rendered
 *   2. 3 members → exactly 3 avatars, no overflow chip
 *   3. 8 members → 6 avatars + "+2 more" chip
 *   4. clicking "+" opens the Add Member modal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamStrip, type ProjectMember, getInitials } from '../components/TeamStrip';
import { apiDelete } from '@/shared/lib/api';
import { listTeams, updateMemberRole } from '@/features/teams/api';

vi.mock('@/features/teams/api', () => ({
  listTeams: vi.fn(),
  updateMemberRole: vi.fn(),
}));

// Avoid hitting the network — the TeamStrip's useQuery is short-circuited
// when `initialMembers` is passed via props (see component source).
vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

// UserSearchInput hits /v1/users/ via React Query — stub it out so the
// Add-Member modal renders without firing a real request.
vi.mock('@/shared/ui/UserSearchInput', () => ({
  UserSearchInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (id: string, name: string) => void;
  }) => (
    <input
      data-testid="mock-user-search"
      value={value}
      onChange={(e) => onChange(e.target.value, e.target.value)}
    />
  ),
}));

function makeMember(i: number): ProjectMember {
  return {
    user_id: `user-${i}`,
    email: `user${i}@example.com`,
    full_name: `User ${i} Lastname`,
    role: i === 0 ? 'owner' : 'estimator',
    is_owner: i === 0,
  };
}

function renderStrip(members: ProjectMember[], canManage = true) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TeamStrip
        projectId="proj-test-1"
        canManage={canManage}
        initialMembers={members}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TeamStrip', () => {
  describe('getInitials helper', () => {
    it('returns two-letter uppercase initials from first+last name', () => {
      expect(
        getInitials({ full_name: 'Jane Doe', email: 'jd@example.com' }),
      ).toBe('JD');
    });

    it('falls back to first two letters of single-word name', () => {
      expect(
        getInitials({ full_name: 'Madonna', email: 'm@example.com' }),
      ).toBe('MA');
    });

    it('falls back to email local part when name is empty', () => {
      expect(
        getInitials({ full_name: '', email: 'art@datadriven.io' }),
      ).toBe('AR');
    });

    it('returns ? when both name and email are empty', () => {
      expect(getInitials({ full_name: '', email: '' })).toBe('?');
    });
  });

  it('renders the empty placeholder when no members exist', () => {
    renderStrip([]);
    expect(screen.getByTestId('team-strip-empty')).toBeInTheDocument();
    expect(screen.queryAllByTestId('team-strip-avatar')).toHaveLength(0);
    // The + button is still rendered so the owner can invite the first
    // member — the spec wires it to the add-member modal.
    expect(screen.getByTestId('team-strip-add-button')).toBeInTheDocument();
  });

  it('renders exactly 3 avatars when there are 3 members', () => {
    const members = [0, 1, 2].map(makeMember);
    renderStrip(members);
    expect(screen.getAllByTestId('team-strip-avatar')).toHaveLength(3);
    // No overflow chip below the 7-member threshold.
    expect(screen.queryByTestId('team-strip-more')).toBeNull();
  });

  it('renders 6 avatars + "+2 more" chip when there are 8 members', () => {
    const members = Array.from({ length: 8 }, (_, i) => makeMember(i));
    renderStrip(members);
    expect(screen.getAllByTestId('team-strip-avatar')).toHaveLength(6);
    const moreChip = screen.getByTestId('team-strip-more');
    expect(moreChip).toBeInTheDocument();
    expect(moreChip.textContent).toMatch(/۲\+|\+2/);
  });

  it('opens the Add Member modal when the "+" button is clicked', () => {
    renderStrip([makeMember(0)]);
    // Modal isn't mounted initially.
    expect(screen.queryByTestId('team-strip-add-modal')).toBeNull();
    fireEvent.click(screen.getByTestId('team-strip-add-button'));
    // Modal becomes visible with the role selector + user search.
    expect(screen.getByTestId('team-strip-add-modal')).toBeInTheDocument();
    expect(screen.getByTestId('mock-user-search')).toBeInTheDocument();
    expect(screen.getByTestId('team-strip-add-submit')).toBeInTheDocument();
  });

  it('asks for confirmation before removing a member', () => {
    renderStrip([makeMember(0), makeMember(1)]);
    fireEvent.click(screen.getByTestId('team-strip-manage'));
    fireEvent.click(screen.getByTestId('team-strip-remove-btn'));
    // Confirm dialog opens; DELETE not sent yet.
    expect(apiDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(apiDelete).toHaveBeenCalledWith('/v1/projects/proj-test-1/members/user-1/');
  });

  it('changes a member role through the default team', async () => {
    vi.mocked(listTeams).mockResolvedValue([
      { id: 'team-default', is_default: true } as never,
    ]);
    renderStrip([makeMember(0), makeMember(1)]);
    fireEvent.click(screen.getByTestId('team-strip-manage'));
    await waitFor(() =>
      expect(screen.getAllByTestId('team-strip-role-select-row')).toHaveLength(1),
    );
    fireEvent.change(screen.getByTestId('team-strip-role-select-row'), {
      target: { value: 'viewer' },
    });
    expect(updateMemberRole).toHaveBeenCalledWith('team-default', 'user-1', 'viewer');
  });

  it('hides the add controls when canManage is false', () => {
    renderStrip([makeMember(0), makeMember(1)], false);
    expect(screen.queryByTestId('team-strip-add-button')).toBeNull();
    expect(screen.queryByTestId('team-strip-manage')).toBeNull();
    // Avatars still render in read-only mode.
    expect(screen.getAllByTestId('team-strip-avatar')).toHaveLength(2);
  });

  it('follows the live initialMembers prop after an empty first render', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const ui = (members: ProjectMember[]) => (
      <QueryClientProvider client={qc}>
        <TeamStrip projectId="proj-test-1" canManage initialMembers={members} />
      </QueryClientProvider>
    );
    const { rerender } = render(ui([]));
    expect(screen.getByTestId('team-strip-empty')).toBeInTheDocument();

    rerender(ui([0, 1, 2].map(makeMember)));
    expect(screen.queryByTestId('team-strip-empty')).toBeNull();
    expect(screen.getAllByTestId('team-strip-avatar')).toHaveLength(3);
  });

  it('summary variant shows every avatar with no +N chip, no add or manage buttons; pencil opens the manage modal', () => {
    const members = Array.from({ length: 8 }, (_, i) => makeMember(i));
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <TeamStrip projectId="proj-test-1" canManage initialMembers={members} variant="summary" />
      </QueryClientProvider>,
    );
    expect(screen.getAllByTestId('team-strip-avatar')).toHaveLength(8);
    expect(screen.queryByTestId('team-strip-more')).toBeNull();
    expect(screen.queryByTestId('team-strip-add-button')).toBeNull();
    expect(screen.queryByTestId('team-strip-manage')).toBeNull();
    fireEvent.click(screen.getByTestId('team-strip-edit'));
    expect(screen.getAllByTestId('team-strip-remove-btn').length).toBeGreaterThan(0);
  });
});
