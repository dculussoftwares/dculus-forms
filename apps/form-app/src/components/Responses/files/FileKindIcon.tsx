import React from 'react';
import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@dculus/utils';
import { fileKind, type FileKind } from '../../../utils/responseFiles';

const KIND_STYLES: Record<FileKind, { icon: LucideIcon; tile: string; glyph: string }> = {
  image: { icon: FileImage, tile: 'bg-sky-50', glyph: 'text-sky-600' },
  pdf: { icon: FileText, tile: 'bg-red-50', glyph: 'text-red-600' },
  document: { icon: FileText, tile: 'bg-blue-50', glyph: 'text-blue-600' },
  spreadsheet: { icon: FileSpreadsheet, tile: 'bg-green-50', glyph: 'text-green-600' },
  presentation: { icon: Presentation, tile: 'bg-orange-50', glyph: 'text-orange-600' },
  archive: { icon: FileArchive, tile: 'bg-amber-50', glyph: 'text-amber-600' },
  audio: { icon: FileAudio, tile: 'bg-purple-50', glyph: 'text-purple-600' },
  video: { icon: FileVideo, tile: 'bg-pink-50', glyph: 'text-pink-600' },
  text: { icon: FileText, tile: 'bg-slate-100', glyph: 'text-slate-600' },
  other: { icon: File, tile: 'bg-slate-100', glyph: 'text-slate-500' },
};

/** Coloured file-type tile, following the app's icon-in-card pattern. */
export const FileKindIcon: React.FC<{ name: string; mimeType?: string | null; className?: string }> = ({
  name,
  mimeType,
  className,
}) => {
  const { icon: Icon, tile, glyph } = KIND_STYLES[fileKind(name, mimeType)];
  return (
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tile, className)}>
      <Icon className={cn('h-4 w-4', glyph)} aria-hidden="true" />
    </div>
  );
};
