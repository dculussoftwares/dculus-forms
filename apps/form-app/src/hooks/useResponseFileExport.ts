import { useCallback, useEffect, useRef, useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import type { ErrorLike } from '@apollo/client';
import { toastError, toastSuccess } from '@dculus/ui';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql';
import {
  GET_RESPONSE_FILE_EXPORT,
  GET_RESPONSE_FILE_EXPORT_DOWNLOAD_URL,
  START_RESPONSE_FILE_EXPORT,
  type ResponseFileExport,
  type ResponseFileGrouping,
  type ResponseFilterVariable,
} from '../graphql/responseFiles';
import { triggerDownload } from '../utils/responseFiles';
import { useTranslation } from './useTranslation';

export interface ResponseFileExportRequest {
  grouping?: ResponseFileGrouping;
  filters?: ResponseFilterVariable[] | null;
  filterLogic?: 'AND' | 'OR';
  responseIds?: string[];
  fileKeys?: string[];
}

const POLL_INTERVAL_MS = 1500;
const storageKey = (formId: string) => `dculus:responseFileExport:${formId}`;

// The in-flight export id survives a reload so progress picks up where it was.
const readStoredExportId = (formId: string): string | null => {
  try {
    return sessionStorage.getItem(storageKey(formId));
  } catch {
    return null;
  }
};

const storeExportId = (formId: string, id: string | null) => {
  try {
    if (id) sessionStorage.setItem(storageKey(formId), id);
    else sessionStorage.removeItem(storageKey(formId));
  } catch {
    // Storage unavailable (private mode): progress just won't survive a reload.
  }
};

const errorCode = (error: ErrorLike | undefined): string | undefined =>
  CombinedGraphQLErrors.is(error) ? (error.errors[0]?.extensions?.code as string | undefined) : undefined;

/**
 * Starts a "download files as ZIP" export, follows its progress and downloads
 * the archive as soon as it is ready. One export per form at a time — the
 * server resumes an in-flight one rather than starting a duplicate.
 */
export const useResponseFileExport = (formId: string | undefined) => {
  const { t } = useTranslation('responseFiles');
  const client = useApolloClient();
  // The tracked export belongs to one form; navigating to another form must not keep following it.
  const [tracked, setTracked] = useState<{ formId?: string; id: string | null }>(() => ({
    formId,
    id: formId ? readStoredExportId(formId) : null,
  }));
  const exportId = tracked.formId === formId ? tracked.id : null;
  const settledRef = useRef<string | null>(null);

  useEffect(() => {
    if (tracked.formId !== formId) {
      settledRef.current = null;
      setTracked({ formId, id: formId ? readStoredExportId(formId) : null });
    }
  }, [formId, tracked.formId]);

  const [startMutation, { loading: starting }] = useMutation(START_RESPONSE_FILE_EXPORT);

  const { data, error: pollError } = useQuery(GET_RESPONSE_FILE_EXPORT, {
    variables: { id: exportId ?? '' },
    skip: !exportId,
    pollInterval: POLL_INTERVAL_MS,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: false,
  });
  const activeExport: ResponseFileExport | null =
    exportId && data?.responseFileExport?.id === exportId && data.responseFileExport.formId === formId
      ? data.responseFileExport
      : null;

  const clear = useCallback(() => {
    setTracked({ formId, id: null });
    if (formId) storeExportId(formId, null);
  }, [formId]);

  // A remembered export the server no longer shows to this person (expired, removed,
  // or a different account on this tab) would otherwise poll forever.
  useEffect(() => {
    if (exportId && CombinedGraphQLErrors.is(pollError)) clear();
  }, [exportId, pollError, clear]);

  const downloadExport = useCallback(
    async (id: string) => {
      const { data: link, error } = await client
        .mutate({ mutation: GET_RESPONSE_FILE_EXPORT_DOWNLOAD_URL, variables: { id } })
        .catch((thrown: ErrorLike) => ({ data: undefined, error: thrown }));
      const result = link?.responseFileExportDownloadUrl;
      if (error || !result) {
        toastError(t('export.errors.title'), t('export.errors.downloadFailed'));
        return;
      }
      triggerDownload(result.downloadUrl, result.filename);
      toastSuccess(t('export.ready.title'), t('export.ready.description', { values: { filename: result.filename } }));
    },
    [client, t]
  );

  // Settle each export exactly once: download when it completes, explain when it fails.
  useEffect(() => {
    if (!activeExport || activeExport.status === 'running' || settledRef.current === activeExport.id) return;
    settledRef.current = activeExport.id;
    clear();
    if (activeExport.status === 'completed') void downloadExport(activeExport.id);
    else toastError(t('export.errors.title'), t('export.errors.generic'));
  }, [activeExport, clear, downloadExport, t]);

  const startExport = useCallback(
    async (request: ResponseFileExportRequest) => {
      if (!formId) return;
      const { data: started, error } = await startMutation({
        variables: {
          formId,
          grouping: request.grouping ?? 'QUESTION',
          filters: request.filters?.length ? request.filters : undefined,
          filterLogic: request.filters && request.filters.length > 1 ? request.filterLogic : undefined,
          responseIds: request.responseIds,
          fileKeys: request.fileKeys,
        },
      }).catch((thrown: ErrorLike) => ({ data: undefined, error: thrown }));

      const exportRow = started?.startResponseFileExport;
      if (error || !exportRow) {
        const code = errorCode(error);
        const message =
          code === GRAPHQL_ERROR_CODES.RATE_LIMITED
            ? t('export.errors.rateLimited')
            : code === GRAPHQL_ERROR_CODES.EXPORT_TOO_LARGE
              ? t('export.errors.tooLarge')
              : code === GRAPHQL_ERROR_CODES.NOT_FOUND
                ? t('export.errors.noFiles')
                : t('export.errors.generic');
        toastError(t('export.errors.title'), message);
        return;
      }

      settledRef.current = null;
      setTracked({ formId, id: exportRow.id });
      storeExportId(formId, exportRow.id);
    },
    [formId, startMutation, t]
  );

  return {
    startExport,
    /** The export being prepared, while it is still running. */
    activeExport: activeExport?.status === 'running' ? activeExport : null,
    isPreparing: starting || !!exportId,
  };
};

export type ResponseFileExportController = ReturnType<typeof useResponseFileExport>;
