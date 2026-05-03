import { describe, expect, it } from 'vitest';
import { NotMemberError, syncRole } from './role-sync.js';

const cfg = { memberGroup: 'velvet-scoop-users', adminGroup: 'velvet-scoop-admins' };

describe('syncRole', () => {
  it('throws NotMemberError when groups array is empty', () => {
    expect(() => syncRole([], cfg)).toThrow(NotMemberError);
  });

  it('throws NotMemberError when groups are present but neither matches', () => {
    expect(() => syncRole(['some-other-group'], cfg)).toThrow(NotMemberError);
  });

  it('returns role=member when only the member group is present', () => {
    expect(syncRole(['velvet-scoop-users'], cfg)).toEqual({ role: 'member' });
  });

  it('returns role=admin when admin group is present alongside member', () => {
    expect(syncRole(['velvet-scoop-users', 'velvet-scoop-admins'], cfg)).toEqual({ role: 'admin' });
  });

  it('returns role=admin even without explicit member group', () => {
    expect(syncRole(['velvet-scoop-admins'], cfg)).toEqual({ role: 'admin' });
  });

  it('ignores unrelated groups', () => {
    expect(syncRole(['velvet-scoop-users', 'random', 'another'], cfg)).toEqual({ role: 'member' });
  });
});
