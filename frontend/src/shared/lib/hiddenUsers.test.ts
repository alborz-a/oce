import { describe, it, expect } from 'vitest';
import { isHiddenSystemUser, visibleMembers } from './hiddenUsers';

const importer = { email: 'mizito-importer@royalstars.co', full_name: 'Mizito Importer', role: 'owner', is_owner: true };
const arash = { email: 'arash.pirnia@royalstars.co', full_name: 'Arash Pirnia', role: 'project_manager', is_owner: false };
const other = { email: 'p@royalstars.co', full_name: 'P', role: 'member', is_owner: false };

describe('hiddenUsers', () => {
  it('identifies the importer by email or name', () => {
    expect(isHiddenSystemUser(importer)).toBe(true);
    expect(isHiddenSystemUser({ full_name: ' mizito importer ' })).toBe(true);
    expect(isHiddenSystemUser(arash)).toBe(false);
  });
  it('admin sees everyone', () => {
    expect(visibleMembers([importer, arash], true)).toHaveLength(2);
  });
  it('non-admin loses importer and project_manager becomes owner', () => {
    const r = visibleMembers([importer, other, arash], false);
    expect(r.map((m) => m.email)).toEqual([other.email, arash.email]);
    expect(r.find((m) => m.email === arash.email)?.is_owner).toBe(true);
    expect(r.find((m) => m.email === other.email)?.is_owner).toBe(false);
  });
  it('does not mutate input and handles no project_manager', () => {
    const input = [importer, other];
    const r = visibleMembers(input, false);
    expect(input).toHaveLength(2);
    expect(r).toEqual([other]);
  });
});
