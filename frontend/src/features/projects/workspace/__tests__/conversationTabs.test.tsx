import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConversationTabs } from '../components/ConversationTabs';
import {
  filterConversations,
  parseConversationTab,
  type ConversationTab,
} from '../utils/filterConversations';
import type { ChatRoom, Colleague } from '@/modules/team-chat/types';

const ROOMS: ChatRoom[] = [
  { id: 'r-dm', kind: 'dm', name: 'آلیس', unread: 0 },
  { id: 'r-proj', kind: 'project', name: 'پروژه آلفا', unread: 0 },
  { id: 'r-group', kind: 'group', name: 'تیم فروش', unread: 0 },
];

const COLLEAGUES: Colleague[] = [
  { id: 'c1', full_name: 'آلیس', job_title: 'مدیر پروژه' },
  { id: 'c2', full_name: 'بوب', job_title: null },
];

describe('parseConversationTab', () => {
  it('maps known values and falls back to all', () => {
    expect(parseConversationTab('groups')).toBe('groups');
    expect(parseConversationTab('members')).toBe('members');
    expect(parseConversationTab('all')).toBe('all');
    expect(parseConversationTab('bogus')).toBe('all');
    expect(parseConversationTab(null)).toBe('all');
  });
});

describe('filterConversations', () => {
  it('all tab shows non-direct rooms plus every colleague', () => {
    const out = filterConversations('all', '', ROOMS, COLLEAGUES);
    expect(out.rooms.map((r) => r.id)).toEqual(['r-proj', 'r-group']);
    expect(out.colleagues.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('groups tab keeps only non-direct rooms and no colleagues', () => {
    const out = filterConversations('groups', '', ROOMS, COLLEAGUES);
    expect(out.rooms.map((r) => r.id)).toEqual(['r-proj', 'r-group']);
    expect(out.colleagues).toEqual([]);
  });

  it('members tab keeps colleagues only and no rooms', () => {
    const out = filterConversations('members', '', ROOMS, COLLEAGUES);
    expect(out.rooms).toEqual([]);
    expect(out.colleagues.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('query matches room name and colleague name or job title, case-insensitively', () => {
    expect(filterConversations('all', 'آلفا', ROOMS, COLLEAGUES).rooms.map((r) => r.id)).toEqual(['r-proj']);
    expect(filterConversations('all', 'آلفا', ROOMS, COLLEAGUES).colleagues).toEqual([]);
    expect(filterConversations('members', 'مدیر', ROOMS, COLLEAGUES).colleagues.map((c) => c.id)).toEqual(['c1']);
    expect(filterConversations('all', '  ', ROOMS, COLLEAGUES).colleagues).toHaveLength(2);
    expect(filterConversations('all', 'zzz', ROOMS, COLLEAGUES)).toEqual({ rooms: [], colleagues: [] });
  });
});

function Harness({ onChange }: { onChange?: (t: ConversationTab) => void }) {
  const [value, setValue] = useState<ConversationTab>('all');
  return (
    <ConversationTabs
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe('ConversationTabs', () => {
  it('renders three tabs with aria-selected on the active one only', () => {
    render(<Harness />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByTestId('conversation-tab-all')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('conversation-tab-groups')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('conversation-tab-members')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('conversation-tab-groups')).toHaveTextContent('گروه‌ها');
    expect(screen.getByTestId('conversation-tab-members')).toHaveTextContent('اعضا');
  });

  it('switches the selected tab on click and reports the value', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByTestId('conversation-tab-members'));
    expect(onChange).toHaveBeenCalledWith('members');
    expect(screen.getByTestId('conversation-tab-members')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('conversation-tab-all')).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(screen.getByTestId('conversation-tab-groups'));
    expect(onChange).toHaveBeenLastCalledWith('groups');
    expect(screen.getByTestId('conversation-tab-groups')).toHaveAttribute('aria-selected', 'true');
  });
});
