import { useCallback, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { toastError } from '@dculus/ui';
import { GET_RESPONSE_FILE_URL } from '../graphql/responseFiles';
import { triggerDownload } from '../utils/responseFiles';
import { useTranslation } from './useTranslation';

/**
 * Fetches a fresh short-lived link for one respondent file. Files live in a
 * private bucket, so every download or preview asks the server for a new
 * pre-signed URL rather than caching one.
 */
export const useResponseFileUrl = () => {
  const client = useApolloClient();
  const { t } = useTranslation('responseFiles');
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const getUrl = useCallback(
    async (key: string, preview = false): Promise<string | null> => {
      const { data, error } = await client.query({
        query: GET_RESPONSE_FILE_URL,
        variables: { key, preview },
        fetchPolicy: 'no-cache',
      });
      return error ? null : (data?.getResponseFileDownloadUrl ?? null);
    },
    [client]
  );

  const download = useCallback(
    async (key: string) => {
      setPendingKey(key);
      try {
        const url = await getUrl(key);
        if (url) triggerDownload(url);
        else toastError(t('file.errors.title'), t('file.errors.download'));
      } finally {
        setPendingKey(null);
      }
    },
    [getUrl, t]
  );

  return { getUrl, download, pendingKey };
};
