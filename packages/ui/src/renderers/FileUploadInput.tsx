import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { isFileTypeAllowed } from '@dculus/types';

const WRAP_TEXT_CLASS = 'leading-snug break-words [overflow-wrap:anywhere]';

export interface FileUploadInputProps {
  fieldId: string;
  /** Stored keys (already uploaded) mixed with newly picked File objects. */
  value: unknown;
  onChange: (next: (string | File)[]) => void;
  maxFiles: number;
  maxMb: number;
  allowedMimeTypes: string[];
  isInteractive: boolean;
  hasError: boolean;
}

const nameFromKey = (k: string) => (k.split('/').pop() ?? k).replace(/^\d{13}-[0-9a-f-]{36}-/i, '');

const FileChip: React.FC<{ name: string; onRemove?: () => void }> = ({ name, onRemove }) => (
  <div
    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
    style={{ backgroundColor: '#f7f7f8', border: '1px solid rgba(81,76,84,0.12)', color: '#4c414e' }}
  >
    <span data-testid="file-upload-chip-name" className={`min-w-0 ${WRAP_TEXT_CLASS}`}>{name}</span>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="ml-2 flex-shrink-0 transition-colors text-lg leading-none"
        style={{ color: '#655d67' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ce5d55'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#655d67'}
      >
        &times;
      </button>
    )}
  </div>
);

/**
 * File upload control. Files that break the size, type or count limits are
 * not silently dropped: the reason is shown under the drop zone.
 */
export const FileUploadInput: React.FC<FileUploadInputProps> = ({
  fieldId,
  value,
  onChange,
  maxFiles,
  maxMb,
  allowedMimeTypes,
  isInteractive,
  hasError,
}) => {
  const [rejections, setRejections] = useState<string[]>([]);

  const raw: (string | File)[] = Array.isArray(value) ? value : [];
  const existing = raw.filter((v): v is string => typeof v === 'string');
  const pending = raw.filter((v): v is File => v instanceof File);
  const total = existing.length + pending.length;

  const onFiles = (files: FileList | null) => {
    if (!files || !isInteractive) return;
    const problems: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(files)) {
      if (file.size > maxMb * 1024 * 1024) {
        problems.push(`"${file.name}" is larger than ${maxMb} MB and was not added.`);
      } else if (!isFileTypeAllowed(file.type, allowedMimeTypes)) {
        problems.push(`"${file.name}" is not an allowed file type and was not added.`);
      } else {
        accepted.push(file);
      }
    }

    const room = Math.max(maxFiles - total, 0);
    if (accepted.length > room) {
      const skipped = accepted.length - room;
      problems.push(
        `Only ${maxFiles} file${maxFiles > 1 ? 's are' : ' is'} allowed here. ${skipped} extra file${skipped > 1 ? 's were' : ' was'} not added.`
      );
    }

    setRejections(problems);
    if (accepted.length > 0) {
      onChange([...existing, ...pending, ...accepted.slice(0, room)]);
    }
  };

  const remove = (next: (string | File)[]) => {
    setRejections([]);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {existing.map((key, i) => (
        <FileChip
          key={key}
          name={nameFromKey(key)}
          onRemove={isInteractive ? () => remove([...existing.filter((_, j) => j !== i), ...pending]) : undefined}
        />
      ))}
      {pending.map((file, i) => (
        <FileChip
          key={i}
          name={file.name}
          onRemove={isInteractive ? () => remove([...existing, ...pending.filter((_, j) => j !== i)]) : undefined}
        />
      ))}

      {isInteractive && total < maxFiles && (
        <label
          htmlFor={`ff-${fieldId}`}
          data-testid={`file-upload-drop-zone-${fieldId}`}
          className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-150 block"
          style={{
            borderColor: hasError || rejections.length ? '#ce5d55' : 'rgba(81,76,84,0.18)',
            backgroundColor: hasError ? 'rgba(206,93,85,0.03)' : '#f7f7f8',
          }}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); onFiles(e.dataTransfer.files); }}
        >
          <Upload className="w-7 h-7 mx-auto mb-2" style={{ color: '#dedcde' }} />
          <p className="text-sm font-medium" style={{ color: '#655d67' }}>
            {existing.length > 0 ? 'Add more files' : 'Click or drag files here'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#655d67', opacity: 0.65 }}>
            Up to {maxFiles} file{maxFiles > 1 ? 's' : ''} · max {maxMb} MB each
            {allowedMimeTypes.length > 0 && ` · ${allowedMimeTypes.join(', ')}`}
          </p>
          <input
            id={`ff-${fieldId}`}
            data-testid={`file-upload-input-${fieldId}`}
            type="file"
            multiple={maxFiles > 1}
            accept={allowedMimeTypes.length ? allowedMimeTypes.join(',') : undefined}
            className="hidden"
            disabled={!isInteractive}
            onChange={e => {
              onFiles(e.target.files);
              // Lets the same file be picked again after it was rejected or removed.
              e.target.value = '';
            }}
          />
        </label>
      )}

      {rejections.length > 0 && (
        <div role="alert" data-testid={`file-upload-rejections-${fieldId}`} className="space-y-0.5">
          {rejections.map((message, i) => (
            <p key={i} className="text-xs" style={{ color: '#ce5d55' }}>{message}</p>
          ))}
        </div>
      )}

      {!isInteractive && total === 0 && (
        <div
          className="border-2 border-dashed rounded-xl p-5 text-center opacity-50 cursor-not-allowed"
          style={{ borderColor: 'rgba(81,76,84,0.18)', backgroundColor: '#f7f7f8' }}
        >
          <Upload className="w-7 h-7 mx-auto mb-1.5" style={{ color: '#dedcde' }} />
          <p className="text-sm" style={{ color: '#655d67' }}>File upload</p>
        </div>
      )}
    </div>
  );
};
