import React, { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  Button,
  Checkbox,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@dculus/ui';
import { cn } from '@dculus/utils';
import { AlertCircle, Download, Eye, FileDown, Folder, FolderOpen, Info, Loader2, Search, Upload, X } from 'lucide-react';
import {
  GET_RESPONSE_FILES,
  type ResponseFile,
  type ResponseFileGrouping,
  type ResponseFilterVariable,
} from '../../../graphql/responseFiles';
import type { ResponseFileExportController } from '../../../hooks/useResponseFileExport';
import { useResponseFileUrl } from '../../../hooks/useResponseFileUrl';
import { useTranslation } from '../../../hooks/useTranslation';
import { buildFileFolders, formatBytes, isPreviewable, responseLabel } from '../../../utils/responseFiles';
import { FileKindIcon } from './FileKindIcon';
import { ResponseFilePreviewDialog } from './ResponseFilePreviewDialog';

const ALL_FOLDER = '__all__';

interface ResponseFilesViewProps {
  formId: string;
  filters: ResponseFilterVariable[] | null;
  filterLogic: 'AND' | 'OR';
  /** Editors and owners may download in bulk; viewers download one file at a time. */
  canBulkDownload: boolean;
  fileExport: ResponseFileExportController;
}

const sumBytes = (files: ResponseFile[]) => files.reduce((total, file) => total + (file.size ?? 0), 0);

/**
 * Folder-style browser over every file respondents uploaded: grouped by
 * question or by response (the same layout the ZIP uses), searchable,
 * previewable, and downloadable one by one or in bulk as a ZIP.
 */
export const ResponseFilesView: React.FC<ResponseFilesViewProps> = ({
  formId,
  filters,
  filterLogic,
  canBulkDownload,
  fileExport,
}) => {
  const { t, locale } = useTranslation('responseFiles');
  const [grouping, setGrouping] = useState<ResponseFileGrouping>('QUESTION');
  const [folderId, setFolderId] = useState<string>(ALL_FOLDER);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const { download, pendingKey } = useResponseFileUrl();

  const { data, previousData, loading, error } = useQuery(GET_RESPONSE_FILES, {
    variables: {
      formId,
      filters,
      filterLogic: filters && filters.length > 1 ? filterLogic : undefined,
    },
    fetchPolicy: 'cache-and-network',
  });
  const catalog = data?.responseFiles ?? previousData?.responseFiles;

  const folders = useMemo(
    () => (catalog ? buildFileFolders(catalog.files, catalog.questions, grouping) : []),
    [catalog, grouping]
  );
  const activeFolder = folders.find((folder) => folder.id === folderId);
  const folderFiles = activeFolder?.files ?? catalog?.files ?? [];

  const visibleFiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    if (!query) return folderFiles;
    return folderFiles.filter((file) =>
      [file.originalName, file.fieldLabel, file.respondentEmail ?? ''].some((text) =>
        text.toLocaleLowerCase(locale).includes(query)
      )
    );
  }, [folderFiles, search, locale]);

  const previewableFiles = useMemo(() => visibleFiles.filter((file) => isPreviewable(file.mimeType)), [visibleFiles]);
  const selectedFiles = useMemo(
    () => (catalog?.files ?? []).filter((file) => selected.has(file.key)),
    [catalog, selected]
  );

  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every((file) => selected.has(file.key));
  const someVisibleSelected = !allVisibleSelected && visibleFiles.some((file) => selected.has(file.key));

  const toggleFile = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const file of visibleFiles) {
        if (allVisibleSelected) next.delete(file.key);
        else next.add(file.key);
      }
      return next;
    });

  const changeGrouping = (value: string) => {
    if (value !== 'QUESTION' && value !== 'RESPONSE') return;
    setGrouping(value);
    setFolderId(ALL_FOLDER);
  };

  const isScoped = folderId !== ALL_FOLDER || search.trim() !== '';
  // "All" with no folder or search exports by filter server-side, so it is not
  // limited to the files listed here; anything narrower sends the exact files.
  const downloadVisible = () =>
    void fileExport.startExport(
      isScoped
        ? { grouping, fileKeys: visibleFiles.map((file) => file.key) }
        : { grouping, filters, filterLogic }
    );

  const downloadSelected = () =>
    void fileExport.startExport({ grouping, fileKeys: selectedFiles.map((file) => file.key) });

  const openFile = (file: ResponseFile) => {
    const index = previewableFiles.indexOf(file);
    if (index >= 0) setPreviewIndex(index);
    else void download(file.key);
  };

  if (error && !catalog) {
    return (
      <EmptyState
        variant="error"
        className="flex-1"
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title={t('errors.load.title')}
        description={t('errors.load.description')}
      />
    );
  }

  if (!catalog) return <FilesSkeleton />;

  if (catalog.questions.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={<Upload className="h-6 w-6 text-muted-foreground" />}
        title={t('empty.noFields.title')}
        description={t('empty.noFields.description')}
      />
    );
  }

  const hasFilters = !!filters?.length;
  const bulkDisabledReason = canBulkDownload ? undefined : t('actions.editorsOnly');
  const downloadLabel =
    search.trim() !== ''
      ? t('actions.downloadMatching', { values: { count: visibleFiles.length } })
      : folderId !== ALL_FOLDER
        ? t('actions.downloadFolder')
        : t('actions.downloadAll');

  return (
    <div className="flex flex-1 min-h-0 w-full border-t" style={{ borderColor: 'var(--tf-border-medium)' }}>
      {/* Folder tree */}
      <nav
        aria-label={t('folders.ariaLabel')}
        className="hidden md:flex w-64 shrink-0 flex-col border-r overflow-y-auto"
        style={{ borderColor: 'var(--tf-border-medium)' }}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--tf-border-light)' }}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">{t('groupBy.label')}</p>
          <ToggleGroup type="single" value={grouping} onValueChange={changeGrouping} className="w-full" size="sm" variant="outline">
            <ToggleGroupItem value="QUESTION" className="flex-1 text-xs">{t('groupBy.question')}</ToggleGroupItem>
            <ToggleGroupItem value="RESPONSE" className="flex-1 text-xs">{t('groupBy.response')}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ul className="p-2 space-y-0.5">
          <FolderItem
            label={t('folders.all')}
            count={catalog.totalCount}
            active={folderId === ALL_FOLDER}
            onSelect={() => setFolderId(ALL_FOLDER)}
          />
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              label={folder.label}
              detail={folder.detail}
              count={folder.files.length}
              active={folderId === folder.id}
              onSelect={() => setFolderId(folder.id)}
            />
          ))}
        </ul>
      </nav>

      {/* File list */}
      <section className="flex flex-1 min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2.5 border-b" style={{ borderColor: 'var(--tf-border-light)' }}>
          {/* Folder picker on small screens */}
          <div className="flex w-full gap-2 md:hidden">
            <Select value={grouping} onValueChange={changeGrouping}>
              <SelectTrigger className="h-8 w-32 text-xs" aria-label={t('groupBy.label')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QUESTION">{t('groupBy.question')}</SelectItem>
                <SelectItem value="RESPONSE">{t('groupBy.response')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger className="h-8 flex-1 min-w-0 text-xs" aria-label={t('folders.ariaLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FOLDER}>{`${t('folders.all')} (${catalog.totalCount})`}</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>{`${folder.label} (${folder.files.length})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 min-w-[140px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="h-8 pl-9 text-xs"
            />
          </div>

          <span className="text-xs text-muted-foreground tabular-nums">
            {t('summary', { values: { count: visibleFiles.length, size: formatBytes(sumBytes(visibleFiles), locale) } })}
          </span>

          <BulkButton disabledReason={bulkDisabledReason} className="ml-auto">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={downloadVisible}
              disabled={!canBulkDownload || visibleFiles.length === 0 || fileExport.isPreparing}
            >
              {fileExport.isPreparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              {downloadLabel}
            </Button>
          </BulkButton>
        </div>

        {(hasFilters || catalog.truncated) && (
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs text-muted-foreground bg-[var(--tf-faint)] border-b" style={{ borderColor: 'var(--tf-border-light)' }}>
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              {catalog.truncated
                ? t('truncated', { values: { shown: catalog.files.length, total: catalog.totalCount } })
                : t('filtered')}
            </span>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 text-xs font-medium bg-[#f0f7ff] border-b border-[rgb(189,221,249)]">
            <span className="text-[#01487f]">
              {t('selection.count', { values: { count: selectedFiles.length, size: formatBytes(sumBytes(selectedFiles), locale) } })}
            </span>
            <BulkButton disabledReason={bulkDisabledReason}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={downloadSelected}
                disabled={!canBulkDownload || fileExport.isPreparing}
              >
                <FileDown className="h-3 w-3" />
                {t('actions.downloadSelected')}
              </Button>
            </BulkButton>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 ml-auto" onClick={() => setSelected(new Set())}>
              <X className="h-3 w-3" />
              {t('actions.clearSelection')}
            </Button>
          </div>
        )}

        {visibleFiles.length === 0 ? (
          <EmptyState
            className="flex-1"
            icon={<FolderOpen className="h-6 w-6 text-muted-foreground" />}
            title={catalog.totalCount === 0 && !hasFilters ? t('empty.noFiles.title') : t('empty.noMatches.title')}
            description={catalog.totalCount === 0 && !hasFilters ? t('empty.noFiles.description') : t('empty.noMatches.description')}
          />
        ) : (
          <div className={cn('flex-1 overflow-y-auto', loading && 'opacity-70 transition-opacity')}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white dark:bg-card">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground" style={{ borderColor: 'var(--tf-border-light)' }}>
                  <th className="w-10 pl-3 sm:pl-4 py-2 font-medium">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleVisible}
                      aria-label={t('actions.selectAll')}
                    />
                  </th>
                  <th className="py-2 font-medium">{t('columns.name')}</th>
                  <th className="hidden lg:table-cell py-2 font-medium">{grouping === 'QUESTION' ? t('columns.response') : t('columns.question')}</th>
                  <th className="hidden sm:table-cell py-2 font-medium text-right">{t('columns.size')}</th>
                  <th className="w-24 pr-3 sm:pr-4 py-2"><span className="sr-only">{t('columns.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.map((file) => (
                  <FileRow
                    key={file.key}
                    file={file}
                    grouping={grouping}
                    selected={selected.has(file.key)}
                    downloading={pendingKey === file.key}
                    onToggle={() => toggleFile(file.key)}
                    onOpen={() => openFile(file)}
                    onDownload={() => void download(file.key)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ResponseFilePreviewDialog files={previewableFiles} index={previewIndex} onIndexChange={setPreviewIndex} />
    </div>
  );
};

const FolderItem: React.FC<{
  label: string;
  detail?: string | null;
  count: number;
  active: boolean;
  onSelect: () => void;
}> = ({ label, detail, count, active, onSelect }) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
        active ? 'bg-[var(--tf-tab-bg)] font-semibold text-foreground' : 'text-muted-foreground hover:bg-[var(--tf-faint)] hover:text-foreground',
        count === 0 && !active && 'opacity-60'
      )}
    >
      {active ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate" title={label}>{label}</span>
        {detail && <span className="block truncate text-[10px] font-normal text-muted-foreground" title={detail}>{detail}</span>}
      </span>
      <span className="shrink-0 tabular-nums text-[11px]">{count}</span>
    </button>
  </li>
);

const FileRow: React.FC<{
  file: ResponseFile;
  grouping: ResponseFileGrouping;
  selected: boolean;
  downloading: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDownload: () => void;
}> = ({ file, grouping, selected, downloading, onToggle, onOpen, onDownload }) => {
  const { t, locale } = useTranslation('responseFiles');
  const label = responseLabel(file.responseId, file.submittedAt);
  const context = grouping === 'QUESTION' ? label : file.fieldLabel;

  return (
    <tr
      className={cn(
        'group border-b transition-colors hover:bg-[var(--tf-faint)]',
        selected && 'bg-[#f6fafd]'
      )}
      style={{ borderColor: 'var(--tf-border-light)' }}
    >
      <td className="pl-3 sm:pl-4 py-2 align-middle">
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={t('actions.selectFile', { values: { name: file.originalName } })} />
      </td>
      <td className="py-2 pr-3 align-middle max-w-0 w-full">
        <button type="button" onClick={onOpen} className="flex w-full min-w-0 items-center gap-3 text-left">
          <FileKindIcon name={file.originalName} mimeType={file.mimeType} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-foreground group-hover:underline" title={file.originalName}>
              {file.originalName}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground lg:hidden">
              {[context, formatBytes(file.size, locale)].join(' · ')}
            </span>
            {file.respondentEmail && (
              <span className="hidden lg:block truncate text-[11px] text-muted-foreground">{file.respondentEmail}</span>
            )}
          </span>
        </button>
      </td>
      <td className="hidden lg:table-cell py-2 pr-3 align-middle text-xs text-muted-foreground whitespace-nowrap">{context}</td>
      <td className="hidden sm:table-cell py-2 pr-3 align-middle text-xs text-muted-foreground text-right tabular-nums whitespace-nowrap">
        {formatBytes(file.size, locale)}
      </td>
      <td className="pr-3 sm:pr-4 py-2 align-middle">
        <div className="flex items-center justify-end gap-1">
          {isPreviewable(file.mimeType) && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpen} aria-label={t('actions.preview')} title={t('actions.preview')}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDownload}
            disabled={downloading}
            aria-label={t('actions.download')}
            title={t('actions.download')}
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </td>
    </tr>
  );
};

/** Wraps a bulk action so viewers see why it is unavailable. */
const BulkButton: React.FC<{ disabledReason?: string; className?: string; children: React.ReactElement }> = ({
  disabledReason,
  className,
  children,
}) =>
  disabledReason ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn('inline-flex', className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{disabledReason}</TooltipContent>
    </Tooltip>
  ) : (
    <span className={cn('inline-flex', className)}>{children}</span>
  );

const FilesSkeleton: React.FC = () => (
  <div className="flex flex-1 min-h-0 border-t" style={{ borderColor: 'var(--tf-border-medium)' }}>
    <div className="hidden md:block w-64 border-r p-3 space-y-2" style={{ borderColor: 'var(--tf-border-medium)' }}>
      {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-7 w-full" />)}
    </div>
    <div className="flex-1 p-4 space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  </div>
);
