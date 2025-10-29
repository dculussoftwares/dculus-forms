import React, { useMemo } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Badge,
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
  updateLoading: boolean;
  deleteLoading: boolean;
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
  updateLoading,
  deleteLoading,
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
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <Badge
          variant={form.isPublished ? "default" : "secondary"}
          className={`${
            form.isPublished
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200'
          } px-3 py-1 text-xs font-medium border`}
        >
          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
            form.isPublished ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
          {form.isPublished ? t('header.status.live') : t('header.status.draft')}
        </Badge>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedCreatedAt}</span>
        </div>
      </div>

      {/* Title and Description */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
          {form.title}
        </h1>
        <p className="text-lg text-slate-600 max-w-3xl">
          {form.description || t('header.descriptionFallback')}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Primary Action - Publish/Unpublish */}
        {form.isPublished ? (
          <Button
            variant="outline"
            onClick={onUnpublish}
            disabled={updateLoading}
            className="h-10 px-5 rounded-lg border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-all"
          >
            <EyeOff className="mr-2 h-4 w-4" />
            {updateLoading ? t('header.actions.unpublishing') : t('header.actions.unpublish')}
          </Button>
        ) : (
          <Button
            onClick={onPublish}
            disabled={updateLoading}
            className="h-10 px-5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-sm hover:shadow transition-all"
          >
            <Eye className="mr-2 h-4 w-4" />
            {updateLoading ? t('header.actions.publishing') : t('header.actions.publish')}
          </Button>
        )}

        {/* Secondary Actions */}
        {form.isPublished && (
          <Button
            variant="outline"
            onClick={onCollectResponses}
            className="h-10 px-5 rounded-lg border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 text-blue-700 font-medium transition-all"
          >
            <Link className="mr-2 h-4 w-4" />
            {t('header.actions.getLink')}
          </Button>
        )}

        {onShare && (
          <Button
            variant="outline"
            onClick={onShare}
            className="h-10 px-5 rounded-lg border-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50 text-purple-700 font-medium transition-all"
          >
            <Share2 className="mr-2 h-4 w-4" />
            {t('header.actions.share')}
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onPreview}
          className="h-10 px-5 rounded-lg border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-all"
        >
          <Eye className="mr-2 h-4 w-4" />
          {t('header.actions.preview')}
        </Button>

        <Button
          variant="outline"
          onClick={onViewAnalytics}
          className="h-10 px-5 rounded-lg border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition-all"
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          {t('header.actions.analytics')}
        </Button>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-10 w-10 rounded-lg border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 p-0"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{t('header.actions.more')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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
  );
};
