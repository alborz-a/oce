import { describe, expect, it } from 'vitest';
import { assignableMembers, memberLabel } from '@/shared/lib/assignableMembers';

describe('assignableMembers', () => {
  it('keeps active named members', () => {
    const list = [{ user_id: 'u1', email: 'a@x.com', full_name: 'Ali', is_active: true }];
    expect(assignableMembers(list)).toEqual(list);
  });

  it('drops members with is_active false', () => {
    const list = [
      { user_id: 'u1', email: 'a@x.com', full_name: 'Ali', is_active: true },
      { user_id: 'u2', email: 'b@x.com', full_name: 'Bita', is_active: false },
    ];
    expect(assignableMembers(list).map((m) => m.user_id)).toEqual(['u1']);
  });

  it('drops deleted users whose email ends with .invalid', () => {
    const list = [{ user_id: 'u3', email: 'x@deleted.invalid', full_name: 'deleted' }];
    expect(assignableMembers(list)).toEqual([]);
  });

  it('keeps name-less active member with email and labels it by email', () => {
    const list = [{ user_id: 'u4', email: 'nn@x.com', full_name: '   ' }];
    expect(assignableMembers(list).map(memberLabel)).toEqual(['nn@x.com']);
  });

  it('treats undefined is_active as active', () => {
    const list = [{ user_id: 'u5', email: 'c@x.com', full_name: 'Cyrus' }];
    expect(assignableMembers(list)).toHaveLength(1);
  });
});
