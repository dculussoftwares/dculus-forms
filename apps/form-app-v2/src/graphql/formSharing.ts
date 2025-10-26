import { gql } from '@apollo/client';

// Fragments
export const FORM_PERMISSION_FRAGMENT = gql`
  fragment FormPermissionFragment on FormPermission {
    id
    formId
    userId
    permission
    grantedAt
    updatedAt
    user {
      id
      name
      email
      image
    }
    grantedBy {
      id
      name
      email
    }
  }
`;

export const FORM_SHARING_SETTINGS_FRAGMENT = gql`
  fragment FormSharingSettingsFragment on FormSharingSettings {
    sharingScope
    defaultPermission
    permissions {
      ...FormPermissionFragment
    }
  }
  ${FORM_PERMISSION_FRAGMENT}
`;

// Queries
export const GET_FORM_PERMISSIONS = gql`
  query GetFormPermissions($formId: ID!) {
    formPermissions(formId: $formId) {
      ...FormPermissionFragment
    }
  }
  ${FORM_PERMISSION_FRAGMENT}
`;

export const GET_ORGANIZATION_MEMBERS = gql`
  query GetOrganizationMembers($organizationId: ID!) {
    organizationMembers(organizationId: $organizationId) {
      id
      name
      email
      image
    }
  }
`;

// Mutations
export const SHARE_FORM = gql`
  mutation ShareForm($input: ShareFormInput!) {
    shareForm(input: $input) {
      ...FormSharingSettingsFragment
    }
  }
  ${FORM_SHARING_SETTINGS_FRAGMENT}
`;

export const UPDATE_FORM_PERMISSION = gql`
  mutation UpdateFormPermission($input: UpdateFormPermissionInput!) {
    updateFormPermission(input: $input) {
      ...FormPermissionFragment
    }
  }
  ${FORM_PERMISSION_FRAGMENT}
`;

export const REMOVE_FORM_ACCESS = gql`
  mutation RemoveFormAccess($formId: ID!, $userId: ID!) {
    removeFormAccess(formId: $formId, userId: $userId)
  }
`;

// Types for TypeScript
export interface FormPermission {
  id: string;
  formId: string;
  userId: string;
  permission: PermissionLevel;
  grantedAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  grantedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface FormSharingSettings {
  sharingScope: SharingScope;
  defaultPermission: PermissionLevel;
  permissions: FormPermission[];
}

export const SharingScope = {
  PRIVATE: 'PRIVATE',
  SPECIFIC_MEMBERS: 'SPECIFIC_MEMBERS',
  ALL_ORG_MEMBERS: 'ALL_ORG_MEMBERS',
} as const;

export type SharingScope =
  (typeof SharingScope)[keyof typeof SharingScope];

export const PermissionLevel = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
  NO_ACCESS: 'NO_ACCESS',
} as const;

export type PermissionLevel =
  (typeof PermissionLevel)[keyof typeof PermissionLevel];

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface ShareFormInput {
  formId: string;
  sharingScope: SharingScope;
  defaultPermission?: PermissionLevel;
  userPermissions?: UserPermissionInput[];
}

export interface UserPermissionInput {
  userId: string;
  permission: PermissionLevel;
}

export interface UpdateFormPermissionInput {
  formId: string;
  userId: string;
  permission: PermissionLevel;
}
