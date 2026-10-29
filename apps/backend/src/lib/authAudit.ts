/**
 * Pure mapping from a better-auth admin/organization endpoint call to an audit
 * event. Only whitelisted, non-sensitive fields are ever copied out of the request
 * body (never passwords, tokens or free-form user data).
 */
export interface AuthAuditEvent {
  action: string;
  resourceType: string;
  resourceId: string;
  organizationId?: string;
  metadata: Record<string, unknown>;
}

type Body = Record<string, unknown>;

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, 200) : undefined;

const pick = (body: Body, keys: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = body[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 200);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.filter((v) => typeof v === 'string').slice(0, 20);
  }
  return out;
};

interface Rule {
  action: string;
  resourceType: string;
  /** Body key holding the affected resource id. */
  idKey?: string;
  /** Body keys safe to record. */
  fields?: string[];
}

const RULES: Record<string, Rule> = {
  '/admin/set-role': { action: 'admin.user_role_set', resourceType: 'User', idKey: 'userId', fields: ['role'] },
  '/admin/ban-user': {
    action: 'admin.user_banned',
    resourceType: 'User',
    idKey: 'userId',
    fields: ['banReason', 'banExpiresIn'],
  },
  '/admin/unban-user': { action: 'admin.user_unbanned', resourceType: 'User', idKey: 'userId' },
  '/admin/impersonate-user': { action: 'admin.impersonation_started', resourceType: 'User', idKey: 'userId' },
  '/admin/stop-impersonating': { action: 'admin.impersonation_stopped', resourceType: 'Session' },
  '/admin/remove-user': { action: 'admin.user_removed', resourceType: 'User', idKey: 'userId' },
  '/admin/revoke-user-sessions': { action: 'admin.sessions_revoked', resourceType: 'User', idKey: 'userId' },
  '/admin/revoke-user-session': { action: 'admin.session_revoked', resourceType: 'User' },
  '/admin/set-user-password': { action: 'admin.user_password_set', resourceType: 'User', idKey: 'userId' },
  '/admin/create-user': { action: 'admin.user_created', resourceType: 'User', fields: ['email', 'role'] },
  '/admin/update-user': { action: 'admin.user_updated', resourceType: 'User', idKey: 'userId' },
  '/organization/update-member-role': {
    action: 'org.member_role_updated',
    resourceType: 'Member',
    idKey: 'memberId',
    fields: ['role'],
  },
  '/organization/remove-member': { action: 'org.member_removed', resourceType: 'Member', idKey: 'memberIdOrEmail' },
  '/organization/invite-member': {
    action: 'org.member_invited',
    resourceType: 'Invitation',
    fields: ['email', 'role'],
  },
  '/organization/cancel-invitation': {
    action: 'org.invitation_cancelled',
    resourceType: 'Invitation',
    idKey: 'invitationId',
  },
  '/organization/leave': { action: 'org.member_left', resourceType: 'Organization', idKey: 'organizationId' },
  '/organization/update': { action: 'org.updated', resourceType: 'Organization', idKey: 'organizationId' },
  '/organization/create-role': { action: 'org.role_created', resourceType: 'Organization', idKey: 'organizationId' },
  '/organization/update-role': { action: 'org.role_updated', resourceType: 'Organization', idKey: 'organizationId' },
  '/organization/delete-role': { action: 'org.role_deleted', resourceType: 'Organization', idKey: 'organizationId' },
};

export const isAuditedAuthPath = (path: string | undefined): boolean => Boolean(path && RULES[path]);

export const buildAuthAuditEvent = (
  path: string | undefined,
  rawBody: unknown,
  options: { sessionOrganizationId?: string | null; actorId?: string | null; returnedId?: string } = {}
): AuthAuditEvent | null => {
  const rule = path ? RULES[path] : undefined;
  if (!rule) return null;

  const body: Body = rawBody && typeof rawBody === 'object' ? (rawBody as Body) : {};
  const metadata = pick(body, rule.fields ?? []);

  // Organization updates: record which attributes changed, not their values.
  if (path === '/organization/update' && body.data && typeof body.data === 'object') {
    metadata.changedFields = Object.keys(body.data as Body).slice(0, 20);
  }

  const organizationId = str(body.organizationId) ?? options.sessionOrganizationId ?? undefined;
  const resourceId =
    (rule.idKey ? str(body[rule.idKey]) : undefined) ??
    options.returnedId ??
    str(body.sessionToken ? undefined : body.email) ??
    options.actorId ??
    organizationId ??
    'unknown';

  return {
    action: rule.action,
    resourceType: rule.resourceType,
    resourceId,
    ...(organizationId ? { organizationId } : {}),
    metadata,
  };
};
