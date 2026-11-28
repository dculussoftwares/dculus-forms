import { useCallback } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { sanitizeDesignTokens } from '@dculus/types';
import type { FormDesignTokens } from '@dculus/types';
import { useAuthContext } from '../contexts/AuthContext';
import {
  DELETE_ORGANIZATION_BRAND_KIT,
  GET_ORGANIZATION_BRAND_KIT,
  SAVE_ORGANIZATION_BRAND_KIT,
} from '../graphql/brandKit';

interface BrandKitData {
  organizationBrandKit: { id: string; tokens: unknown; updatedAt: string } | null;
}

/** Organisation brand kit: any member can read it, only owners can save or remove it. */
export function useOrgBrandKit() {
  const { activeOrganization, user } = useAuthContext();
  const organizationId: string | undefined = activeOrganization?.id;
  const isOwner =
    activeOrganization?.members?.find((m: any) => m.user.id === user?.id)?.role === 'owner';

  const { data, loading } = useQuery<BrandKitData>(GET_ORGANIZATION_BRAND_KIT, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const [saveMutation, { loading: saving }] = useMutation(SAVE_ORGANIZATION_BRAND_KIT, {
    refetchQueries: [GET_ORGANIZATION_BRAND_KIT],
  });
  const [deleteMutation, { loading: deleting }] = useMutation(DELETE_ORGANIZATION_BRAND_KIT, {
    refetchQueries: [GET_ORGANIZATION_BRAND_KIT],
  });

  const kitTokens = sanitizeDesignTokens(data?.organizationBrandKit?.tokens);

  const save = useCallback(
    async (tokens: FormDesignTokens) => {
      if (!organizationId) return;
      await saveMutation({ variables: { organizationId, tokens } });
    },
    [organizationId, saveMutation]
  );

  const remove = useCallback(async () => {
    if (!organizationId) return;
    await deleteMutation({ variables: { organizationId } });
  }, [organizationId, deleteMutation]);

  return { kitTokens, loading, busy: saving || deleting, isOwner, save, remove, organizationId };
}
