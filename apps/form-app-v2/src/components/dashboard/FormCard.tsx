import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator
} from '@dculus/ui-v2';
import {
  ArrowUpRight,
  BarChart3,
  Calendar,
  ExternalLink,
  FileText,
  PenSquare,
  Users,
} from 'lucide-react';
import type { FormsListItem } from '../../hooks/useFormsDashboard';
import { useTranslate } from '../../i18n';

interface FormCardProps {
  form: FormsListItem;
  showPermissionBadge?: boolean;
  onOpenDashboard: (formId: string) => void;
  onOpenBuilder: (formId: string) => void;
  onOpenPreview: (form: FormsListItem) => void;
}

const formatDate = (value: string, fallback: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const FormCard = ({
  form,
  showPermissionBadge,
  onOpenDashboard,
  onOpenBuilder,
  onOpenPreview,
}: FormCardProps) => {
  const t = useTranslate();

  const pageCount = form.metadata?.pageCount ?? 0;
  const fieldCount = form.metadata?.fieldCount ?? 0;
  const lastUpdated = form.metadata?.lastUpdated ?? form.updatedAt;
  const backgroundImageUrl = form.metadata?.backgroundImageUrl ?? null;
  const formattedDate = formatDate(lastUpdated, t('formCard.unknownDate'));

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpenDashboard(form.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDashboard(form.id);
        }
      }}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden border border-border/70 bg-background/60 shadow-sm outline-none transition hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={t('formCard.openDashboardAria', { title: form.title })}
    >
      <div className="relative h-40 w-full">
        <div className="absolute inset-0">
          {backgroundImageUrl ? (
            <div
              className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
              style={{ backgroundImage: `url(${backgroundImageUrl})` }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background transition-colors duration-300">
              <FileText className="h-10 w-10 text-primary/70" />
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
              form.isPublished
                ? 'bg-emerald-500/90 text-white'
                : 'bg-amber-500/90 text-white'
            }`}
          >
            {form.isPublished
              ? t('formCard.statusPublished')
              : t('formCard.statusDraft')}
          </span>
          {showPermissionBadge && form.userPermission && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur">
              <Users className="h-3.5 w-3.5" />
              {form.userPermission.toLowerCase()}
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 bg-white/80 backdrop-blur hover:bg-primary hover:text-primary-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDashboard(form.id);
            }}
            aria-label={t('formCard.button.openDashboard')}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 bg-white/80 backdrop-blur hover:bg-primary hover:text-primary-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onOpenBuilder(form.id);
            }}
            aria-label={t('formCard.button.editForm')}
          >
            <PenSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 bg-white/80 backdrop-blur hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            onClick={(event) => {
              event.stopPropagation();
              onOpenPreview(form);
            }}
            aria-label={
              form.isPublished
                ? t('formCard.button.previewForm')
                : t('formCard.button.previewUnavailable')
            }
            disabled={!form.isPublished}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-start gap-2 text-lg font-semibold">
              <FileText className="mt-1 h-4 w-4 shrink-0 text-primary/80" />
              <span className="line-clamp-2">{form.title}</span>
            </CardTitle>
            {form.description && (
              <CardDescription className="line-clamp-2">
                {form.description}
              </CardDescription>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {t('formCard.updatedLabel', { date: formattedDate })}
          </span>
          <Separator orientation="vertical" className="hidden h-4 md:block" />
          <span className="inline-flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            {t('formCard.responsesCount', { count: form.responseCount })}
          </span>
          <Separator orientation="vertical" className="hidden h-4 md:block" />
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            {t('formCard.structureSummary', {
              pages: pageCount,
              fields: fieldCount,
            })}
          </span>
        </div>
      </CardHeader>
    </Card>
  );
};
