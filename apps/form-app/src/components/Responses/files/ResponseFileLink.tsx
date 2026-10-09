import React from 'react';
import { Button } from '@dculus/ui';
import { Download, Loader2 } from 'lucide-react';
import { useResponseFileUrl } from '../../../hooks/useResponseFileUrl';
import { fileNameFromKey } from '../../../utils/responseFiles';

/**
 * One respondent file as a compact download link (table cells, detail panel).
 * The server names the download after the original upload, so the browser
 * saves it under the respondent's filename.
 */
export const ResponseFileLink: React.FC<{ fileKey: string }> = ({ fileKey }) => {
  const { download, pendingKey } = useResponseFileUrl();
  const name = fileNameFromKey(fileKey);
  const loading = pendingKey === fileKey;

  return (
    <Button
      onClick={(event) => {
        event.stopPropagation();
        void download(fileKey);
      }}
      disabled={loading}
      variant="ghost"
      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[220px] disabled:opacity-50 disabled:cursor-wait h-auto p-0 justify-start"
      title={name}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
      ) : (
        <Download className="h-3 w-3 flex-shrink-0" />
      )}
      <span className="truncate">{name}</span>
    </Button>
  );
};
