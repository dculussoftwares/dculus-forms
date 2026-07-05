/**
 * Create Responses Columns Utility
 *
 * Generates dynamic table columns for the responses table based on:
 * - Form schema (base columns + field columns)
 * - Enabled plugins (plugin-specific columns)
 * - Actions column
 */

import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import type { Column, Row } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router';
import { gql } from '@apollo/client'
import type { TypedDocumentNode } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dculus/ui';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AtSign,
  Calendar,
  CheckSquare,
  Clock,
  Download,
  Edit,
  Eye,
  Hash,
  History,
  List,
  Loader2,
  MoreHorizontal,
  Tag,
  Type,
  Upload,
  X,
} from 'lucide-react';
import {
  deserializeFormSchema,
  FieldType,
  FillableFormField,
  FormResponse,
  FormSchema,
} from '@dculus/types';
import { formatFieldValue as formatFieldValueUtil } from '@dculus/utils';
import { getPluginColumns, PluginInstance } from '../plugins/core/registry';
import { TagsCell } from '../components/Responses/TagsCell';
import '../plugins/index';

interface ResponseTagItem {
  id: string;
  name: string;
  color: string;
}

interface CreateResponsesColumnsOptions {
  formSchema: any; // serialized form schema
  formId: string;
  pluginsData: any;
  locale: string;
  formTags?: ResponseTagItem[];
  onPluginClick: (
    pluginType: string,
    metadata: any,
    responseId: string
  ) => void;
  onDeleteResponse: (responseId: string) => void;
  responses?: FormResponse[];
  t: (
    key: string,
    options?: {
      values?: Record<string, string | number>;
      defaultValue?: string;
    }
  ) => string;
}

const fieldIconStyle = (fieldType: FieldType): { bg: string; color: string } => {
  switch (fieldType) {
    case FieldType.DATE_FIELD:
      return { bg: '#f4faf8', color: '#0f7a63' };
    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      return { bg: '#ddd6fa', color: '#6d4fc6' };
    case FieldType.FILE_UPLOAD_FIELD:
      return { bg: '#f8cdd8', color: '#c4436d' };
    case FieldType.EMAIL_FIELD:
      return { bg: '#dbeafe', color: '#1d4ed8' };
    case FieldType.NUMBER_FIELD:
      return { bg: '#fef3c7', color: '#b45309' };
    default:
      return { bg: '#dedcde', color: '#655d67' };
  }
};

const CHIP_STYLE: React.CSSProperties = { width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0, overflow: 'hidden' };

const fieldIconNode = (fieldType: FieldType) => {
  switch (fieldType) {
    case FieldType.CHECKBOX_FIELD:    return <CheckSquare className="h-4 w-4" />;
    case FieldType.DATE_FIELD:        return <Calendar className="h-4 w-4" />;
    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:       return <List className="h-4 w-4" />;
    case FieldType.FILE_UPLOAD_FIELD: return <Upload className="h-4 w-4" />;
    case FieldType.EMAIL_FIELD:       return <AtSign className="h-4 w-4" />;
    case FieldType.NUMBER_FIELD:      return <Hash className="h-4 w-4" />;
    default:                          return <Type className="h-4 w-4" />;
  }
};

const FieldIconChip: React.FC<{ fieldType: FieldType }> = ({ fieldType }) => {
  const { bg, color } = fieldIconStyle(fieldType);
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ ...CHIP_STYLE, backgroundColor: bg, color }}
    >
      {fieldIconNode(fieldType)}
    </span>
  );
};

const BaseIconChip: React.FC<{ bg: string; color: string; children: React.ReactNode }> = ({ bg, color, children }) => (
  <span
    className="inline-flex items-center justify-center"
    style={{ ...CHIP_STYLE, backgroundColor: bg, color }}
  >
    {children}
  </span>
);

const TFColumnHeader: React.FC<{
  column: Column<FormResponse, unknown>;
  icon: React.ReactNode;
  title: string;
}> = ({ column, icon, title }) => (
  <button
    className="flex items-center gap-2 group/th text-left w-full"
    onClick={() => column.getCanSort() && column.toggleSorting(column.getIsSorted() === 'asc')}
  >
    {icon}
    <span className="text-[13px] font-normal text-[#3c323e] truncate">{title}</span>
    {column.getCanSort() && (
      column.getIsSorted() === 'desc' ? (
        <ArrowDown className="h-3 w-3 text-[#4c414e] flex-shrink-0 ml-0.5" />
      ) : column.getIsSorted() === 'asc' ? (
        <ArrowUp className="h-3 w-3 text-[#4c414e] flex-shrink-0 ml-0.5" />
      ) : (
        <ArrowUpDown className="h-3 w-3 text-[#655d67] flex-shrink-0 ml-0.5 opacity-0 group-hover/th:opacity-50 transition-opacity" />
      )
    )}
  </button>
);

const getFieldIcon = (fieldType: FieldType) => {
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
      return <Type className="h-4 w-4" />;
    case FieldType.CHECKBOX_FIELD:
      return <CheckSquare className="h-4 w-4" />;
    case FieldType.DATE_FIELD:
      return <Calendar className="h-4 w-4" />;
    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      return <List className="h-4 w-4" />;
    case FieldType.FILE_UPLOAD_FIELD:
      return <Upload className="h-4 w-4" />;
    default:
      return <Type className="h-4 w-4" />;
  }
};

/**
 * Create base columns (ID, Submitted At, Edit Status)
 */
const createBaseColumns = (
  locale: string,
  t: CreateResponsesColumnsOptions['t']
): ColumnDef<FormResponse>[] => {
  return [
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <TFColumnHeader
          column={column}
          icon={<BaseIconChip bg="#dedcde" color="#655d67"><Hash className="h-4 w-4" /></BaseIconChip>}
          title={t('table.columns.responseId')}
        />
      ),
      cell: ({ row }) => {
        const id = row.getValue('id') as string;
        return (
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-medium bg-slate-100/80 text-slate-800 border border-[var(--tf-border-medium)]/60 rounded-lg">
              {id?.slice(-6) || 'N/A'}
            </span>
          </div>
        );
      },
      enableSorting: true,
      enableHiding: false,
      size: 140,
    },
    {
      accessorKey: 'submittedAt',
      header: ({ column }) => (
        <TFColumnHeader
          column={column}
          icon={<BaseIconChip bg="#f4faf8" color="#0f7a63"><Clock className="h-4 w-4" /></BaseIconChip>}
          title={t('table.columns.submittedAt')}
        />
      ),
      cell: ({ row }) => {
        const submittedAt = row.getValue('submittedAt') as string | number;
        // Date constructor handles both ISO strings and Unix timestamps
        const date = new Date(submittedAt);

        if (isNaN(date.getTime())) {
          return (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">{t('errors.invalidDate')}</span>
            </div>
          );
        }

        return (
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {date.toLocaleDateString(locale, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {date.toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        );
      },
      enableSorting: true,
      size: 180,
    },
    {
      accessorKey: 'hasBeenEdited',
      header: ({ column }) => (
        <TFColumnHeader
          column={column}
          icon={<BaseIconChip bg="#fff7ed" color="#b45309"><History className="h-4 w-4" /></BaseIconChip>}
          title={t('table.columns.editStatus')}
        />
      ),
      cell: ({ row }) => {
        const response = row.original;
        const hasBeenEdited = response.hasBeenEdited;
        const totalEdits = response.totalEdits || 0;
        const lastEditedAt = response.lastEditedAt;
        const lastEditedBy = response.lastEditedBy;

        if (!hasBeenEdited) {
          return (
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-primary rounded-full" />
              <span className="text-sm text-muted-foreground">
                {t('table.editStatus.original')}
              </span>
            </div>
          );
        }

        return (
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 bg-orange-500 rounded-full" />
            <div className="flex flex-col">
              <div className="flex items-center space-x-1">
                <Badge
                  variant="outline"
                  className="bg-orange-50 text-orange-700 border-orange-200"
                >
                  <History className="h-3 w-3 mr-1" />
                  {totalEdits === 1
                    ? t('table.editStatus.editBadge', {
                        values: { count: totalEdits },
                      })
                    : t('table.editStatus.editBadgePlural', {
                        values: { count: totalEdits },
                      })}
                </Badge>
              </div>
              {lastEditedAt && (
                <div className="flex items-center space-x-1 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lastEditedAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {lastEditedBy && (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {t('table.editStatus.editedBy')}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {lastEditedBy.name}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      },
      enableSorting: true,
      size: 200,
    },
  ];
};

const GET_RESPONSE_FILE_DOWNLOAD_URL : TypedDocumentNode<any, any> = gql`
  query GetResponseFileDownloadUrl($key: String!) {
    getResponseFileDownloadUrl(key: $key)
  }
`;

/**
 * A single file download link that fetches a pre-signed URL on click.
 * Files are stored in the private R2 bucket and have no public CDN URL.
 */
const FileDownloadLink: React.FC<{ s3Key: string }> = ({ s3Key }) => {
  const client = useApolloClient();
  const [loading, setLoading] = useState(false);
  const name = extractFileName(s3Key);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await client.query<{
        getResponseFileDownloadUrl: string;
      }>({
        query: GET_RESPONSE_FILE_DOWNLOAD_URL,
        variables: { key: s3Key },
        fetchPolicy: 'no-cache', // always get a fresh signed URL
      });
      const signedUrl = data?.getResponseFileDownloadUrl ?? '';
      // Trigger browser download via a temporary anchor
      const anchor = document.createElement('a');
      anchor.href = signedUrl;
      anchor.download = name;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      // Silent fail — user will see nothing downloaded
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="ghost"
      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[180px] disabled:opacity-50 disabled:cursor-wait h-auto p-0"
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

/**
 * Extract a user-friendly display name from an R2 key.
 * Key format: files/form-response/{formId}/{timestamp}-{uuid}-{sanitizedName}{ext}
 */
function extractFileName(key: string): string {
  const segment = key.split('/').pop() || key;
  // Strip leading "{13-digit timestamp}-{UUID v4}-"
  return segment.replace(/^\d{13}-[0-9a-f-]{36}-/, '') || segment;
}

/**
 * Create field columns based on form schema — three groups:
 * 1. Active fields (sortable)
 * 2. Soft-deleted fields (amber "deleted" badge, no sort)
 * 3. Orphan field IDs present in response data but absent from schema (historical deletions)
 */
const createFieldColumns = (
  formSchema: FormSchema,
  responses: FormResponse[],
  t: CreateResponsesColumnsOptions['t']
): ColumnDef<FormResponse>[] => {
  const activeColumns: ColumnDef<FormResponse>[] = [];
  const deletedColumns: ColumnDef<FormResponse>[] = [];

  // --- Group 1: active fields; Group 2: soft-deleted fields ---
  formSchema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if (!(field instanceof FillableFormField)) return;

      const isDeleted = field.deleted === true;

      // TFColumnHeader only accepts title: string, so deleted columns use a custom header
      const col: ColumnDef<FormResponse> = {
        accessorKey: `data.${field.id}`,
        id: `field-${field.id}`,
        header: isDeleted
          ? () => (
              <div className="flex items-center gap-1.5">
                <FieldIconChip fieldType={field.type} />
                <span className="text-[13px] text-muted-foreground italic truncate">{field.label}</span>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  deleted
                </span>
              </div>
            )
          : ({ column }) => (
              <TFColumnHeader
                column={column}
                icon={<FieldIconChip fieldType={field.type} />}
                title={field.label}
              />
            ),
        cell: ({ row }) => {
          const value = row.original.data[field.id];

          if (field.type === FieldType.FILE_UPLOAD_FIELD) {
            const keys: string[] = Array.isArray(value) ? value : [];
            if (keys.length === 0) {
              return (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm italic">{t('table.fieldResponses.noResponse')}</span>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-1">
                {keys.map((key, idx) => (
                  <FileDownloadLink key={idx} s3Key={key} />
                ))}
              </div>
            );
          }

          const formattedValue = formatFieldValueUtil(value, field.type);
          if (!formattedValue) {
            return (
              <div className="flex items-center space-x-2 text-muted-foreground">
                {getFieldIcon(field.type)}
                <span className="text-sm italic">{t('table.fieldResponses.noResponse')}</span>
              </div>
            );
          }
          return (
            <div className="flex items-center space-x-2">
              <div className="text-muted-foreground">{getFieldIcon(field.type)}</div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block" title={formattedValue}>
                  {formattedValue}
                </span>
              </div>
            </div>
          );
        },
        enableSorting: !isDeleted,
        enableHiding: true,
        size: 200,
      };

      if (isDeleted) {
        deletedColumns.push(col);
      } else {
        activeColumns.push(col);
      }
    });
  });

  // --- Group 3: orphan field IDs (historical deletions before this feature) ---
  const knownFieldIds = new Set(
    formSchema.pages.flatMap((p) => p.fields.map((f) => f.id))
  );

  // Safety guard: if the schema has no fields at all, it likely hasn't finished
  // loading yet. Skip orphan detection entirely to prevent all response field IDs
  // from being incorrectly classified as "Unknown field (deleted)" before the real
  // schema arrives (race condition between GET_FORM_BY_ID and GET_FORM_RESPONSES).
  const schemaHasFields = knownFieldIds.size > 0;
  const orphanIds = new Set(
    schemaHasFields
      ? responses.flatMap((r) => Object.keys(r.data)).filter((id) => !knownFieldIds.has(id))
      : []
  );

  const orphanColumns: ColumnDef<FormResponse>[] = Array.from(orphanIds).map((fieldId) => ({
    accessorKey: `data.${fieldId}`,
    id: `orphan-${fieldId}`,
    header: () => (
      <span className="text-muted-foreground italic flex items-center gap-1.5">
        Unknown field
        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 not-italic">
          deleted
        </span>
      </span>
    ),
    cell: ({ row }) => {
      const value = row.original.data[fieldId];
      if (value === undefined || value === null || value === '') {
        return <span className="text-sm italic text-muted-foreground">—</span>;
      }
      return (
        <span className="text-sm font-medium truncate block" title={String(value)}>
          {String(value)}
        </span>
      );
    },
    enableSorting: false,
    enableHiding: true,
    size: 200,
  }));

  return [...activeColumns, ...deletedColumns, ...orphanColumns];
};

const ResponsesActionsCell: React.FC<{
  row: Row<FormResponse>;
  formId: string;
  onDeleteResponse: (responseId: string) => void;
  t: CreateResponsesColumnsOptions['t'];
}> = ({ row, formId, onDeleteResponse, t }) => {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/dashboard/form/${formId}/responses/${row.original.id}/edit`);
          }}
        >
          <Eye className="h-4 w-4" />
          <span className="sr-only">{t('table.actions.viewResponse')}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{t('table.actions.moreActions')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                navigate(
                  `/dashboard/form/${formId}/responses/${row.original.id}/edit`
                )
              }
            >
              <Edit className="mr-2 h-4 w-4" />
              {t('table.actions.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                navigate(
                  `/dashboard/form/${formId}/responses/${row.original.id}/history`
                )
              }
              disabled={!row.original.hasBeenEdited}
            >
              <History className="mr-2 h-4 w-4" />
              {t('table.actions.editHistory')}
              {(row.original.totalEdits || 0) > 0 && (
                <Badge
                  variant="outline"
                  className="ml-2 bg-orange-50 text-orange-700 border-orange-200 text-xs"
                >
                  {row.original.totalEdits}
                </Badge>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              {t('table.actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('table.actions.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('table.actions.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              {t('table.actions.deleteConfirmCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteDialog(false);
                onDeleteResponse(row.original.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('table.actions.deleteConfirmConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/**
 * Create actions column
 * Note: This uses a React component internally that needs navigate context
 */
const createActionsColumn = (
  formId: string,
  onDeleteResponse: (responseId: string) => void,
  t: CreateResponsesColumnsOptions['t']
): ColumnDef<FormResponse> => {
  return {
    id: 'actions',
    header: () => (
      <div className="text-center">{t('table.columns.actions')}</div>
    ),
    cell: ({ row }) => (
      <ResponsesActionsCell
        row={row}
        formId={formId}
        onDeleteResponse={onDeleteResponse}
        t={t}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 80,
  };
};

/**
 * Main function to create all columns for the responses table
 */
export const createResponsesColumns = ({
  formSchema,
  formId,
  pluginsData,
  locale,
  formTags = [],
  onPluginClick,
  onDeleteResponse,
  responses = [],
  t,
}: CreateResponsesColumnsOptions): ColumnDef<FormResponse>[] => {
  if (!formSchema) return [];

  const deserializedSchema: FormSchema = deserializeFormSchema(formSchema);

  const [idColumn, ...metaColumns] = createBaseColumns(locale, t);

  const selectColumn: ColumnDef<FormResponse> = {
    id: 'select',
    header: ({ table }) => (
      <div className="flex items-center justify-center px-1" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center px-1" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 44,
  };

  const tagsColumn: ColumnDef<FormResponse> = {
    id: 'tags',
    accessorFn: (row) => (row as any).tags,
    header: ({ column }) => (
      <TFColumnHeader
        column={column}
        icon={
          <BaseIconChip bg="#f0fdf4" color="#16a34a">
            <Tag className="h-4 w-4" />
          </BaseIconChip>
        }
        title={t('table.columns.tags')}
      />
    ),
    cell: ({ row }) => (
      <TagsCell
        response={row.original as any}
        formId={formId}
        formTags={formTags}
        t={t}
      />
    ),
    enableSorting: false,
    enableHiding: true,
    size: 220,
  };

  // Field columns
  const fieldColumns = createFieldColumns(deserializedSchema, responses, t);

  // Plugin columns — pass full plugin instances so column titles can be
  // derived from each plugin's stored config (e.g. quiz columnName setting)
  const enabledPluginInstances: PluginInstance[] =
    pluginsData?.formPlugins
      ?.filter((plugin: any) => plugin.enabled)
      ?.map((plugin: any) => ({
        type: plugin.type,
        id: plugin.id,
        config: plugin.config ?? {},
      })) || [];

  const pluginColumns = getPluginColumns<FormResponse>(
    enabledPluginInstances,
    onPluginClick
  );

  // Actions column
  const actionsColumn = createActionsColumn(formId, onDeleteResponse, t);

  // Checkbox first, then Response ID, tags, field/plugin columns, Submitted At + Edit Status, actions
  return [selectColumn, idColumn, tagsColumn, ...fieldColumns, ...pluginColumns, ...metaColumns, actionsColumn];
};
