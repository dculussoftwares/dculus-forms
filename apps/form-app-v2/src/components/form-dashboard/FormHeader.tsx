import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dculus/ui-v2';
import {
  BarChart3,
  Calendar,
  Eye,
  EyeOff,
  Link,
  MoreHorizontal,
  Share2,
  Trash2,
} from 'lucide-react';
import { useTranslate } from '../../i18n';

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

export const FormHeader = ({
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
}: FormHeaderProps) => {
  const t = useTranslate();

  const formatDate = (dateString: string) => {
    const timestamp =
      typeof dateString === 'string' && /^\d+$/.test(dateString)
        ? parseInt(dateString, 10)
        : dateString;
    const date = new Date(timestamp);
    return !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : t('formDashboard.header.dateUnavailable');
  };

  return (
    <div className="space-y-6">
      {/* Status Badge and Date */}
      <div className="flex items-center gap-3">
        <Badge
          variant={form.isPublished ? 'default' : 'secondary'}
          className={`gap-2 px-3 py-1 text-xs font-semibold ${
            form.isPublished
              ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
              : 'border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              form.isPublished ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          {form.isPublished
            ? t('formDashboard.header.statusLive')
            : t('formDashboard.header.statusDraft')}
        </Badge>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(form.createdAt)}</span>
        </div>
      </div>

      {/* Title and Description */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">{form.title}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          {form.description ||
            t('formDashboard.header.descriptionPlaceholder')}
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
            className="gap-2"
          >
            <EyeOff className="h-4 w-4" />
            {updateLoading
              ? t('formDashboard.header.unpublishing')
              : t('formDashboard.header.unpublish')}
          </Button>
        ) : (
          <Button
            onClick={onPublish}
            disabled={updateLoading}
            className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
          >
            <Eye className="h-4 w-4" />
            {updateLoading
              ? t('formDashboard.header.publishing')
              : t('formDashboard.header.publish')}
          </Button>
        )}

        {/* Get Link */}
        {form.isPublished && (
          <Button
            variant="outline"
            onClick={onCollectResponses}
            className="gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          >
            <Link className="h-4 w-4" />
            {t('formDashboard.header.getLink')}
          </Button>
        )}

        {/* Share */}
        {onShare && (
          <Button
            variant="outline"
            onClick={onShare}
            className="gap-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
          >
            <Share2 className="h-4 w-4" />
            {t('formDashboard.header.share')}
          </Button>
        )}

        {/* Preview */}
        <Button
          variant="outline"
          onClick={onPreview}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          {t('formDashboard.header.preview')}
        </Button>

        {/* View Analytics */}
        <Button
          variant="outline"
          onClick={onViewAnalytics}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          {t('formDashboard.header.analytics')}
        </Button>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">
                {t('formDashboard.header.moreActions')}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDelete} disabled={deleteLoading}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">
                {deleteLoading
                  ? t('formDashboard.header.deleting')
                  : t('formDashboard.header.delete')}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
