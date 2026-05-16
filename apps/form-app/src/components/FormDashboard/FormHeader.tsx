import React, { useMemo } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@dculus/ui';
import {
  Eye,
  BarChart3,
  EyeOff,
  Link,
  Trash2,
  MoreHorizontal,
  Share2,
  Calendar,
  Copy,
  FileText,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface FormHeaderProps {
  form: {
    id: string;
    title: string;
    description?: string;
    isPublished: boolean;
    createdAt: string;
    shortUrl: string;
  };
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onCollectResponses: () => void;
  onPreview: () => void;
  onViewAnalytics: () => void;
  onShare?: () => void;
  onDuplicate: () => void;
  updateLoading: boolean;
  deleteLoading: boolean;
  duplicateLoading: boolean;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  form,
  onPublish,
  onUnpublish,
  onDelete,
  onCollectResponses,
  onPreview,
  onViewAnalytics,
  onShare,
  onDuplicate,
  updateLoading,
  deleteLoading,
  duplicateLoading,
}) => {
  const { t, locale } = useTranslation('formDashboard');

  const formattedCreatedAt = useMemo(() => {
    const timestamp =
      typeof form.createdAt === 'string' && /^\d+$/.test(form.createdAt)
        ? parseInt(form.createdAt, 10)
        : form.createdAt;
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return t('header.dateUnavailable');
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }, [form.createdAt, locale, t]);

  return (
    <div
      className="bg-white dark:bg-card rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}
    >
      {/* Main section */}
      <div className="flex items-start justify-between gap-6 p-5">

        {/* Left: icon + info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Form icon — Typeform salmon field-icon style */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#f8cdd8' }}
          >
            <FileText className="w-5 h-5" style={{ color: '#3c323e' }} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Status badge + date row */}
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                data-testid="form-status-badge"
                style={form.isPublished
                  ? { backgroundColor: 'rgba(23,119,103,0.08)', color: '#177767', border: '1px solid rgba(23,119,103,0.16)' }
                  : { backgroundColor: 'rgba(190,153,58,0.08)', color: '#9c7818', border: '1px solid rgba(190,153,58,0.16)' }
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: form.isPublished ? '#177767' : '#be993a' }}
                />
                {form.isPublished ? t('header.status.live') : t('header.status.draft')}
              </span>

              <span className="flex items-center gap-1 text-xs" style={{ color: '#655d67' }}>
                <Calendar className="w-3 h-3" />
                {formattedCreatedAt}
              </span>
            </div>

            <h1 className="text-xl font-semibold leading-tight tracking-tight" style={{ color: '#3c323e' }}>
              {form.title}
            </h1>

            {(form.description) && (
              <p className="text-sm mt-1" style={{ color: '#655d67' }}>
                {form.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: primary actions + overflow */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {form.isPublished ? (
            <>
              <Button
                data-testid="get-form-link-button"
                variant="outline"
                onClick={onCollectResponses}
                className="h-8 px-3 text-sm"
              >
                <Link className="mr-1.5 h-3.5 w-3.5" />
                {t('header.actions.getLink')}
              </Button>
              <Button
                data-testid="unpublish-form-button"
                variant="outline"
                onClick={onUnpublish}
                disabled={updateLoading}
                className="h-8 px-3 text-sm"
              >
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                {updateLoading ? t('header.actions.unpublishing') : t('header.actions.unpublish')}
              </Button>
            </>
          ) : (
            <Button
              data-testid="publish-form-button"
              onClick={onPublish}
              disabled={updateLoading}
              className="h-8 px-4 text-sm"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              {updateLoading ? t('header.actions.publishing') : t('header.actions.publish')}
            </Button>
          )}

          {/* Overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" style={{ color: '#655d67' }} />
                <span className="sr-only">{t('header.actions.more')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onDuplicate} disabled={duplicateLoading}>
                <Copy className="mr-2 h-4 w-4" />
                {duplicateLoading ? t('header.actions.duplicating') : t('header.actions.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                disabled={deleteLoading}
                className="text-red-600 focus:text-red-700 focus:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteLoading ? t('header.actions.deleting') : t('header.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Footer action strip — Typeform-style ghost tab bar */}
      <div
        className="flex items-center gap-0.5 px-4 py-1.5"
        style={{ borderTop: '1px solid rgba(81,76,84,0.08)', backgroundColor: 'rgba(81,76,84,0.02)' }}
      >
        <button
          onClick={onPreview}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
          style={{ color: '#655d67' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#3c323e'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#655d67'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <Eye className="h-3.5 w-3.5" />
          {t('header.actions.preview')}
        </button>

        {onShare && (
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
            style={{ color: '#655d67' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#3c323e'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#655d67'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Share2 className="h-3.5 w-3.5" />
            {t('header.actions.share')}
          </button>
        )}

        <button
          onClick={onViewAnalytics}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
          style={{ color: '#655d67' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#3c323e'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#655d67'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {t('header.actions.analytics')}
        </button>
      </div>
    </div>
  );
};
