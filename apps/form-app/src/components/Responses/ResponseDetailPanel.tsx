import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@dculus/ui';
import { FillableFormField, FormResponse, FieldType } from '@dculus/types';
import { formatFieldValue } from '@dculus/utils';
import { Download, Edit2, Trash2 } from 'lucide-react';
import { TagsCell } from './TagsCell';
import { GeneratePdfButton } from './GeneratePdfButton';
import { GET_FORM_TAGS } from '../../graphql/queries';

const GET_RESPONSE_FILE_DOWNLOAD_URL : TypedDocumentNode<any, any> = gql`
  query GetResponseFileDownloadUrl($key: String!) {
    getResponseFileDownloadUrl(key: $key)
  }
`;

interface ResponseDetailPanelProps {
  response: FormResponse | null;
  fillableFields: FillableFormField[];
  formId: string;
  open: boolean;
  onClose: () => void;
  onDelete: (responseId: string) => void;
  t: (key: string, options?: { values?: Record<string, string | number> }) => string;
}

const FileDownloadCell: React.FC<{ s3Key: string }> = ({ s3Key }) => {
  const client = useApolloClient();
  const [loading, setLoading] = useState(false);
  const filename = s3Key.split('/').pop() || s3Key;

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data } = await client.query<{ getResponseFileDownloadUrl: string }>({
        query: GET_RESPONSE_FILE_DOWNLOAD_URL,
        variables: { key: s3Key },
        fetchPolicy: 'no-cache',
      });
      const a = document.createElement('a');
      a.href = data?.getResponseFileDownloadUrl ?? '';
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      <Download className="h-3 w-3" />
      {filename}
    </button>
  );
};

const FieldValueDisplay: React.FC<{
  field: FillableFormField;
  value: unknown;
  noResponseLabel: string;
}> = ({ field, value, noResponseLabel }) => {
  if (value === undefined || value === null || value === '') {
    return <span className="text-xs italic text-muted-foreground">{noResponseLabel}</span>;
  }

  if (field.type === FieldType.FILE_UPLOAD_FIELD) {
    const keys: string[] = Array.isArray(value) ? value : [String(value)];
    return (
      <div className="flex flex-col gap-1">
        {keys.map((key, idx) => (
          <FileDownloadCell key={idx} s3Key={key} />
        ))}
      </div>
    );
  }

  const formatted = formatFieldValue(value, field.type);
  return <span className="text-sm">{formatted || <span className="italic text-muted-foreground">{noResponseLabel}</span>}</span>;
};

export const ResponseDetailPanel: React.FC<ResponseDetailPanelProps> = ({
  response,
  fillableFields,
  formId,
  open,
  onClose,
  onDelete,
  t,
}) => {
  const navigate = useNavigate();

  const { data: tagsData } = useQuery(GET_FORM_TAGS, {
    variables: { formId },
    skip: !open || !formId,
  });
  const formTags = tagsData?.formTags ?? [];

  if (!response) return null;

  const submittedDate = new Date(response.submittedAt);
  const formattedDate = submittedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleEdit = () => {
    onClose();
    navigate(`/dashboard/form/${formId}/responses/${response.id}/edit`);
  };

  const handleDelete = () => {
    onDelete(response.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="text-sm font-semibold truncate">
            {t('table.columns.responseId')}: <span className="font-mono text-xs text-muted-foreground">{response.id}</span>
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
          {response.hasBeenEdited && (
            <p className="text-xs text-muted-foreground">
              {t('table.editStatus.editBadgePlural', { values: { count: response.totalEdits ?? 0 } })}
            </p>
          )}
        </SheetHeader>

        {/* Tags section */}
        <div className="px-5 py-3 border-b">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('table.columns.tags')}</p>
          <div className="group">
            <TagsCell
              response={response as any}
              formId={formId}
              formTags={formTags}
              t={t}
            />
          </div>
        </div>

        {/* Field values */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {fillableFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('table.empty.noFields')}</p>
          ) : (
            fillableFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground truncate" title={field.label}>
                  {field.label || field.id}
                </p>
                <div className="text-sm">
                  <FieldValueDisplay
                    field={field}
                    value={(response.data as Record<string, unknown>)?.[field.id]}
                    noResponseLabel={t('table.fieldResponses.noResponse')}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-4 border-t">
          <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
            <Edit2 className="h-3.5 w-3.5" />
            {t('table.actions.edit')}
          </Button>
          <GeneratePdfButton formId={formId} responseId={response.id} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('table.actions.delete')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
