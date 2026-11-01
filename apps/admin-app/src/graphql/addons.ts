/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';
import type { AdminPlanLimits, AdminPlanPrice } from './plans';

export const ADMIN_ADDONS_QUERY: TypedDocumentNode<any, any> = gql`
  query AdminAddons {
    adminAddons {
      id
      name
      description
      status
      prices {
        id
        currency
        period
        priceInSmallestUnit
        status
      }
      grants {
        views
        submissions
        emails
        aiCredits
      }
    }
  }
`;

export const ADMIN_CREATE_ADDON_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminCreateAddon($input: AdminCreateAddonInput!) {
    adminCreateAddon(input: $input) {
      id
    }
  }
`;

export const ADMIN_UPDATE_ADDON_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminUpdateAddon($input: AdminUpdateAddonInput!) {
    adminUpdateAddon(input: $input) {
      id
    }
  }
`;

export const ADMIN_ARCHIVE_ADDON_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminArchiveAddon($addonId: String!) {
    adminArchiveAddon(addonId: $addonId)
  }
`;

export const ADMIN_UNARCHIVE_ADDON_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminUnarchiveAddon($addonId: String!) {
    adminUnarchiveAddon(addonId: $addonId)
  }
`;

export interface AdminAddon {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  prices: AdminPlanPrice[];
  /** Per-unit capacity; null = the add-on does not grant that meter. */
  grants: AdminPlanLimits;
}

export interface AdminAddonsQueryData {
  adminAddons: AdminAddon[];
}
