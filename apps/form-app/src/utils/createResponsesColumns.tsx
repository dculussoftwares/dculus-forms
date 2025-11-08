/**
 * Create Responses Columns Utility
 *
 * Generates dynamic table columns for the responses table based on:
 * - Form schema (base columns + field columns)
 * - Enabled plugins (plugin-specific columns)
 * - Actions column
 */

import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dculus/ui';
import {
  Calendar,
  CheckSquare,
  Edit,
  Eye,
  Hash,
  History,
  List,
  MoreHorizontal,
  Type,
  X,
} from 'lucide-react';
import { deserializeFormSchema, FieldType, FillableFormField, FormResponse, FormSchema } from '@dculus/types';
import { formatFieldValue as formatFieldValueUtil } from '@dculus/utils';
import { getPluginColumns } from '../components/plugins/response-table';

interface CreateResponsesColumnsOptions {
  formSchema: any; // serialized form schema
  formId: string;
  pluginsData: any;
  locale: string;
  onPluginClick: (pluginType: string, metadata: any, responseId: string) => void;
  t: (key: string, options?: { values?: Record<string, string | number>; defaultValue?: string }) => string;
}

/**
 * Helper function to get field type icon
 */
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
        <DataTableColumnHeader column={column} title={t('table.columns.responseId')} />
      ),
      cell: ({ row }) => {
        const id = row.getValue('id') as string;
        return (
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-medium bg-slate-100/80 text-slate-800 border border-slate-200/60 rounded-md">
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
        <DataTableColumnHeader column={column} title={t('table.columns.submittedAt')} />
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
        <DataTableColumnHeader column={column} title={t('table.columns.editStatus')} />
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
              <div className="h-2 w-2 bg-green-500 rounded-full" />
              <span className="text-sm text-muted-foreground">{t('table.editStatus.original')}</span>
            </div>
          );
        }

        return (
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 bg-orange-500 rounded-full" />
            <div className="flex flex-col">
              <div className="flex items-center space-x-1">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <History className="h-3 w-3 mr-1" />
                  {totalEdits === 1
                    ? t('table.editStatus.editBadge', { values: { count: totalEdits } })
                    : t('table.editStatus.editBadgePlural', { values: { count: totalEdits } })}
                </Badge>
              </div>
              {lastEditedAt && (
                <div className="flex items-center space-x-1 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lastEditedAt), { addSuffix: true })}
                  </span>
                  {lastEditedBy && (
                    <>
                      <span className="text-xs text-muted-foreground">{t('table.editStatus.editedBy')}</span>
                      <span className="text-xs font-medium text-muted-foreground">{lastEditedBy.name}</span>
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

/**
 * Create field columns based on form schema
 */
const createFieldColumns = (
  formSchema: FormSchema,
  t: CreateResponsesColumnsOptions['t']
): ColumnDef<FormResponse>[] => {
  const fieldColumns: ColumnDef<FormResponse>[] = [];

  formSchema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if (field instanceof FillableFormField) {
        fieldColumns.push({
          accessorKey: `data.${field.id}`,
          id: `field-${field.id}`,
          header: ({ column }) => (
            <div className="flex items-center space-x-2">
              <div className="text-muted-foreground">{getFieldIcon(field.type)}</div>
              <DataTableColumnHeader column={column} title={field.label} />
            </div>
          ),
          cell: ({ row }) => {
            const value = row.original.data[field.id];
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
          enableSorting: true,
          enableHiding: true,
          size: 200,
        });
      }
    });
  });

  return fieldColumns;
};

/**
 * Create actions column
 * Note: This uses a React component internally that needs navigate context
 */
const createActionsColumn = (
  formId: string,
  t: CreateResponsesColumnsOptions['t']
): ColumnDef<FormResponse> => {
  return {
    id: 'actions',
    header: () => <div className="text-center">{t('table.columns.actions')}</div>,
    cell: ({ row }) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const navigate = useNavigate();

      return (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              console.log('View response:', row.original.id);
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
                className="h-8 w-8 p-0 hover:bg-slate-50"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t('table.actions.moreActions')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigate(`/dashboard/form/${formId}/responses/${row.original.id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Response
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/dashboard/form/${formId}/responses/${row.original.id}/history`)}
                disabled={!row.original.hasBeenEdited}
              >
                <History className="mr-2 h-4 w-4" />
                {t('table.actions.editHistory')}
                {(row.original.totalEdits || 0) > 0 && (
                  <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-700 border-orange-200 text-xs">
                    {row.original.totalEdits}
                  </Badge>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Delete response:', row.original.id)}>
                <X className="mr-2 h-4 w-4" />
                {t('table.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
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
  onPluginClick,
  t,
}: CreateResponsesColumnsOptions): ColumnDef<FormResponse>[] => {
  if (!formSchema) return [];

  const deserializedSchema: FormSchema = deserializeFormSchema(formSchema);

  // Base columns
  const baseColumns = createBaseColumns(locale, t);

  // Field columns
  const fieldColumns = createFieldColumns(deserializedSchema, t);

  // Plugin columns
  const enabledPluginTypes = pluginsData?.formPlugins
    ?.filter((plugin: any) => plugin.enabled)
    ?.map((plugin: any) => plugin.type) || [];

  const pluginColumns = getPluginColumns<FormResponse>(enabledPluginTypes, onPluginClick);

  // Actions column
  const actionsColumn = createActionsColumn(formId, t);

  return [...baseColumns, ...fieldColumns, ...pluginColumns, actionsColumn];
};
