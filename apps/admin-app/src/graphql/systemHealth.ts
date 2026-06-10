/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

export const ADMIN_SYSTEM_HEALTH_QUERY : TypedDocumentNode<any, any> = gql`
  query AdminSystemHealth {
    adminSystemHealth {
      label
      status
      latencyMs
      detail
    }
  }
`;

export interface SystemHealthItem {
  label: string;
  status: 'ok' | 'degraded' | 'error';
  latencyMs: number | null;
  detail: string | null;
}
