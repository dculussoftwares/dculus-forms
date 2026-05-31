import { gql } from '@apollo/client';

export const ADMIN_SYSTEM_HEALTH_QUERY = gql`
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
