import { randomUUID } from 'crypto';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { formRepository } from '../repositories/formRepository.js';
import { formPermissionRepository } from '../repositories/formPermissionRepository.js';
import { memberRepository } from '../repositories/memberRepository.js';
import { audit } from '../lib/audit.js';

// Permission levels mapping
export const PermissionLevel = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
  NO_ACCESS: 'NO_ACCESS',
} as const;

// Sharing scopes mapping
export const SharingScope = {
  PRIVATE: 'PRIVATE',
  SPECIFIC_MEMBERS: 'SPECIFIC_MEMBERS',
  ALL_ORG_MEMBERS: 'ALL_ORG_MEMBERS',
} as const;

export type Permission = (typeof PermissionLevel)[keyof typeof PermissionLevel];
export type Scope = (typeof SharingScope)[keyof typeof SharingScope];

export const PERMISSION_HIERARCHY: Record<string, number> = {
  [PermissionLevel.NO_ACCESS]: 0,
  [PermissionLevel.VIEWER]: 1,
  [PermissionLevel.EDITOR]: 2,
  [PermissionLevel.OWNER]: 3,
};

const checkPermissionLevel = (
  userPermission: Permission,
  requiredPermission: Permission
): boolean =>
  (PERMISSION_HIERARCHY[userPermission] ?? 0) >=
  (PERMISSION_HIERARCHY[requiredPermission] ?? 0);

/**
 * Resolve a user's effective permission on a form: organization membership is
 * checked first (even form owners lose access if they leave the org), then
 * ownership, then explicit `FormPermission` grants, then the form's
 * `ALL_ORG_MEMBERS` default sharing scope.
 */
export const checkFormAccess = async (
  userId: string,
  formId: string,
  requiredPermission: Permission = PermissionLevel.VIEWER
) => {
  const form = await formRepository.findByIdWithAccessContext(formId, userId);

  if (!form) {
    throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
  }

  // 🔒 SECURITY: Check organization membership FIRST (before owner check)
  // This ensures even form owners must be organization members to access forms
  const userMembership = form.organization.members.find(
    (member: any) => member.userId === userId
  );
  if (!userMembership) {
    // User is not a member of this organization - deny access even if they're the owner
    return { hasAccess: false, permission: PermissionLevel.NO_ACCESS, form };
  }

  // Check if user is the form owner (only reachable if user is org member)
  if (form.createdById === userId) {
    return { hasAccess: true, permission: PermissionLevel.OWNER, form };
  }

  // Check explicit permissions
  const explicitPermission = form.permissions.find((p: any) => p.userId === userId);
  if (explicitPermission) {
    const hasRequiredAccess = checkPermissionLevel(
      explicitPermission.permission as Permission,
      requiredPermission
    );
    return {
      hasAccess: hasRequiredAccess,
      permission: explicitPermission.permission as Permission,
      form,
    };
  }

  // Check sharing scope for organization members
  if (form.sharingScope === SharingScope.ALL_ORG_MEMBERS) {
    const hasRequiredAccess = checkPermissionLevel(
      form.defaultPermission as Permission,
      requiredPermission
    );
    return {
      hasAccess: hasRequiredAccess,
      permission: form.defaultPermission as Permission,
      form,
    };
  }

  // Default: no access
  return { hasAccess: false, permission: PermissionLevel.NO_ACCESS, form };
};

/** Every permission grant on a form — no access check (used by the `Form.permissions` field resolver). */
export const listFormPermissions = (formId: string) =>
  formPermissionRepository.findByForm(formId);

/** Owner-only listing of a form's permission grants, for the `formPermissions` query. */
export const getFormPermissions = async (userId: string, formId: string) => {
  const accessCheck = await checkFormAccess(userId, formId, PermissionLevel.OWNER);
  if (!accessCheck.hasAccess) {
    throw createGraphQLError('Access denied: Insufficient permissions', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  return listFormPermissions(formId);
};

export const listForms = async (params: {
  organizationId: string;
  category: string;
  userId: string;
  page?: number;
  limit?: number;
  filters?: { search?: string };
}) => {
  const { organizationId, category, userId, page = 1, limit = 10, filters } = params;

  // Validate pagination parameters
  const currentPage = Math.max(1, page);
  const pageLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
  const skip = (currentPage - 1) * pageLimit;

  const sharedAccessConditions = [
    {
      permissions: {
        some: {
          userId,
          permission: { not: PermissionLevel.NO_ACCESS },
        },
      },
    },
    {
      sharingScope: SharingScope.ALL_ORG_MEMBERS,
      defaultPermission: { not: PermissionLevel.NO_ACCESS },
    },
  ];

  const searchTerm = filters?.search?.trim();
  const searchFilter = searchTerm
    ? {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      }
    : null;

  let whereCondition: any;

  switch (category) {
    case 'OWNER': {
      whereCondition = {
        organizationId,
        createdById: userId,
        ...(searchFilter ? { AND: [searchFilter] } : {}),
      };
      break;
    }
    case 'SHARED': {
      whereCondition = {
        organizationId,
        createdById: { not: userId },
        AND: [{ OR: sharedAccessConditions }, ...(searchFilter ? [searchFilter] : [])],
      };
      break;
    }
    case 'ALL': {
      const ownerClause = searchFilter
        ? {
            createdById: userId,
            AND: [searchFilter],
          }
        : { createdById: userId };

      const sharedClause = {
        createdById: { not: userId },
        AND: [{ OR: sharedAccessConditions }, ...(searchFilter ? [searchFilter] : [])],
      };

      whereCondition = {
        organizationId,
        OR: [ownerClause, sharedClause],
      };
      break;
    }
    default: {
      throw createGraphQLError(
        `Invalid category: ${category}. Must be OWNER, SHARED, or ALL`,
        GRAPHQL_ERROR_CODES.BAD_USER_INPUT
      );
    }
  }

  whereCondition = { ...whereCondition, deletedAt: null };

  // Get total count for pagination
  const totalCount = await formRepository.count({
    where: whereCondition,
  });

  // Get paginated forms — include _count.responses for N+1-free responseCount resolution (P3-02)
  const forms = await formRepository.findMany({
    where: whereCondition,
    include: {
      organization: true,
      createdBy: true,
      permissions: {
        include: {
          user: true,
          grantedBy: true,
        },
      },
      _count: {
        select: { responses: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    skip,
    take: pageLimit,
  });

  const totalPages = Math.ceil(totalCount / pageLimit);

  return {
    forms,
    totalCount,
    page: currentPage,
    limit: pageLimit,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
};

export const listOrganizationMembersForSharing = async (organizationId: string) => {
  const members = await memberRepository.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  });

  return members.map((member: any) => member.user);
};

export const shareForm = async (
  userId: string,
  input: {
    formId: string;
    sharingScope: Scope;
    defaultPermission?: Permission;
    userPermissions?: Array<{ userId: string; permission: Permission }>;
  }
) => {
  // Check if user has permission to share the form (must be owner)
  const accessCheck = await checkFormAccess(userId, input.formId, PermissionLevel.OWNER);
  if (!accessCheck.hasAccess) {
    throw createGraphQLError(
      'Access denied: Insufficient permissions to share this form',
      GRAPHQL_ERROR_CODES.NO_ACCESS
    );
  }

  // Update form sharing settings
  const updatedForm = await formRepository.update({
    where: { id: input.formId },
    data: {
      sharingScope: input.sharingScope,
      defaultPermission: input.defaultPermission || PermissionLevel.VIEWER,
    },
  });

  // Handle user-specific permissions
  if (input.userPermissions && input.userPermissions.length > 0) {
    const userIds = input.userPermissions.map((up) => up.userId);

    // 🔒 SECURITY: Verify all target users are members of the form's organization
    const orgMembers = await memberRepository.findMany({
      where: {
        organizationId: accessCheck.form.organizationId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const validUserIds = new Set(orgMembers.map((m: any) => m.userId));
    const invalidUsers = userIds.filter((id) => !validUserIds.has(id));

    if (invalidUsers.length > 0) {
      throw createGraphQLError(
        `Cannot grant permissions to users outside organization: ${invalidUsers.join(', ')}`,
        GRAPHQL_ERROR_CODES.NO_ACCESS
      );
    }

    // Prevent callers from granting themselves a higher role than they currently hold
    const callerCurrentPermission = accessCheck.permission;
    const selfEscalation = input.userPermissions.find(
      (up) =>
        up.userId === userId &&
        (PERMISSION_HIERARCHY[up.permission] ?? 0) > (PERMISSION_HIERARCHY[callerCurrentPermission] ?? 0)
    );
    if (selfEscalation) {
      throw createGraphQLError(
        'Cannot grant yourself a higher permission level than you currently hold',
        GRAPHQL_ERROR_CODES.NO_ACCESS
      );
    }

    // Remove existing permissions for these users
    await formPermissionRepository.removeManyForUsers(input.formId, userIds);

    // Add new permissions
    const permissionsToCreate = input.userPermissions
      .filter((up) => up.permission !== PermissionLevel.NO_ACCESS)
      .map((up) => ({
        id: randomUUID(),
        formId: input.formId,
        userId: up.userId,
        permission: up.permission,
        grantedById: userId,
      }));

    if (permissionsToCreate.length > 0) {
      await formPermissionRepository.createManyForUsers(permissionsToCreate);
    }
  }

  // Return the updated sharing settings
  const permissions = await formPermissionRepository.findMany({
    where: { formId: input.formId },
    include: {
      user: true,
      grantedBy: true,
    },
  });

  await audit('permission.granted', 'FormPermission', input.formId, userId, {
    sharingScope: input.sharingScope,
    defaultPermission: input.defaultPermission,
    userPermissions: input.userPermissions,
  });

  return {
    sharingScope: updatedForm.sharingScope,
    defaultPermission: updatedForm.defaultPermission,
    permissions,
  };
};

export const updateFormPermission = async (
  grantedById: string,
  input: { formId: string; userId: string; permission: Permission }
) => {
  // Check if user has permission to manage permissions (must be owner)
  const accessCheck = await checkFormAccess(grantedById, input.formId, PermissionLevel.OWNER);
  if (!accessCheck.hasAccess) {
    throw createGraphQLError('Access denied: Insufficient permissions', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  // 🔒 SECURITY: Verify target user is a member of the form's organization
  const isMember = await memberRepository.findFirst({
    where: {
      organizationId: accessCheck.form.organizationId,
      userId: input.userId,
    },
  });

  if (!isMember) {
    throw createGraphQLError('Cannot grant permissions to users outside organization', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  // Prevent users from changing owner permissions
  if (accessCheck.form.createdById === input.userId) {
    throw createGraphQLError('Cannot change permissions for form owner', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  // Remove access if permission is NO_ACCESS
  if (input.permission === PermissionLevel.NO_ACCESS) {
    await formPermissionRepository.removeForUser(input.formId, input.userId);

    await audit('permission.granted', 'FormPermission', input.formId, grantedById, {
      targetUserId: input.userId,
      permission: PermissionLevel.NO_ACCESS,
    });

    return {
      id: '',
      formId: input.formId,
      userId: input.userId,
      permission: PermissionLevel.NO_ACCESS,
      grantedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: null,
      grantedBy: null,
    };
  }

  // Upsert permission
  const permission = await formPermissionRepository.upsertForUser(
    input.formId,
    input.userId,
    input.permission,
    grantedById
  );

  await audit('permission.granted', 'FormPermission', input.formId, grantedById, {
    targetUserId: input.userId,
    permission: input.permission,
  });

  return permission;
};

export const removeFormAccess = async (
  grantedById: string,
  formId: string,
  userId: string
) => {
  // Check if user has permission to manage permissions (must be owner)
  const accessCheck = await checkFormAccess(grantedById, formId, PermissionLevel.OWNER);
  if (!accessCheck.hasAccess) {
    throw createGraphQLError('Access denied: Insufficient permissions', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  // Prevent removing access from form owner
  if (accessCheck.form.createdById === userId) {
    throw createGraphQLError('Cannot remove access from form owner', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  const result = await formPermissionRepository.removeForUser(formId, userId);

  if (result.count > 0) {
    await audit('permission.granted', 'FormPermission', formId, grantedById, {
      targetUserId: userId,
      permission: PermissionLevel.NO_ACCESS,
    });
  }

  return result.count > 0;
};
