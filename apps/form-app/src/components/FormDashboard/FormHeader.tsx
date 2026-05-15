import React, { useMemo } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Badge,
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

    if (isNaN(date.getTime())) {
      return t('header.dateUnavailable');
    }

    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [form.createdAt, locale, t]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      {/* Main Content */}
      <div className="flex items-start justify-between gap-6 p-6">
        {/* Left: Form icon + info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <Badge
                data-testid="form-status-badge"
                variant={form.isPublished ? 'default' : 'secondary'}
                className={`${
                  form.isPublished
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200'
                } px-2.5 py-0.5 text-xs font-medium border`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    form.isPublished ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                {form.isPublished ? t('header.status.live') : t('header.status.draft')}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <Calendar className="w-3 h-3" />
                {formattedCreatedAt}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight dark:text-slate-100">
              {form.title}
            </h1>
            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              {form.description || t('header.descriptionFallback')}
            </p>
          </div>
        </div>

        {/* Right: Primary actions + overflow menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {form.isPublished ? (
            <>
              <Button
                data-testid="get-form-link-button"
                variant="outline"
                onClick={onCollectResponses}
                className="h-9 px-4 rounded-xl border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 text-blue-700 text-sm font-medium transition-all"
              >
                <Link className="mr-1.5 h-3.5 w-3.5" />
                {t('header.actions.getLink')}
              </Button>
              <Button
                data-testid="unpublish-form-button"
                variant="outline"
                onClick={onUnpublish}
                disabled={updateLoading}
                className="h-9 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all"
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
              className="h-9 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-sm transition-all"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              {updateLoading ? t('header.actions.publishing') : t('header.actions.publish')}
            </Button>
          )}

          {/* Three-dot overflow menu — sized and bordered for easy interaction */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-9 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 p-0 flex-shrink-0"
              >
                <MoreHorizontal className="h-4 w-4 text-slate-600" />
                <span className="sr-only">{t('header.actions.more')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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

      {/* Footer action strip */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-2.5 flex items-center gap-1 dark:border-slate-800 dark:bg-slate-800/40">
        <Button
          variant="ghost"
          onClick={onPreview}
          className="h-8 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          {t('header.actions.preview')}
        </Button>

        {onShare && (
          <Button
            variant="ghost"
            onClick={onShare}
            className="h-8 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            {t('header.actions.share')}
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={onViewAnalytics}
          className="h-8 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
        >
          <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
          {t('header.actions.analytics')}
        </Button>
      </div>
    </div>
  );
};
