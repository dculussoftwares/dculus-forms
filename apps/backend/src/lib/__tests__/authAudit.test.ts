import { describe, expect, it } from 'vitest';
import { buildAuthAuditEvent, isAuditedAuthPath } from '../authAudit.js';

describe('authAudit', () => {
  it('only audits privileged admin/organization paths', () => {
    expect(isAuditedAuthPath('/admin/set-role')).toBe(true);
    expect(isAuditedAuthPath('/organization/remove-member')).toBe(true);
    expect(isAuditedAuthPath('/sign-in/email')).toBe(false);
    expect(isAuditedAuthPath(undefined)).toBe(false);
    expect(buildAuthAuditEvent('/sign-in/email', { password: 'x' })).toBeNull();
  });

  it('records role changes with the target user and new role', () => {
    const event = buildAuthAuditEvent('/admin/set-role', { userId: 'u1', role: 'admin' });
    expect(event).toMatchObject({
      action: 'admin.user_role_set',
      resourceType: 'User',
      resourceId: 'u1',
      metadata: { role: 'admin' },
    });
  });

  it('never copies passwords or unknown fields into metadata', () => {
    const event = buildAuthAuditEvent('/admin/set-user-password', {
      userId: 'u2',
      newPassword: 'hunter2hunter2',
      token: 'secret',
    });
    expect(event?.metadata).toEqual({});
    expect(JSON.stringify(event)).not.toContain('hunter2');
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('scopes organization actions to the body organization, else the active one', () => {
    expect(
      buildAuthAuditEvent('/organization/update-member-role', { memberId: 'm1', role: 'owner', organizationId: 'o1' })
    ).toMatchObject({ organizationId: 'o1', resourceId: 'm1', metadata: { role: 'owner' } });

    expect(
      buildAuthAuditEvent('/organization/cancel-invitation', { invitationId: 'i1' }, { sessionOrganizationId: 'o2' })
    ).toMatchObject({ organizationId: 'o2', resourceId: 'i1' });
  });

  it('records only the names of changed organization attributes', () => {
    const event = buildAuthAuditEvent('/organization/update', {
      organizationId: 'o1',
      data: { name: 'Acme', logo: 'x' },
    });
    expect(event?.metadata).toEqual({ changedFields: ['name', 'logo'] });
  });

  it('falls back to the created user id from the response', () => {
    const event = buildAuthAuditEvent('/admin/create-user', { email: 'a@b.c', role: 'user' }, { returnedId: 'new-id' });
    expect(event).toMatchObject({ resourceId: 'new-id', metadata: { email: 'a@b.c', role: 'user' } });
  });

  it('truncates oversized string values', () => {
    const event = buildAuthAuditEvent('/admin/ban-user', { userId: 'u', banReason: 'x'.repeat(1000) });
    expect((event?.metadata.banReason as string).length).toBe(200);
  });
});
