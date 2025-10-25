import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Separator,
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

interface FormCardProps {
  form: FormsListItem;
  showPermissionBadge?: boolean;
  onOpenDashboard: (formId: string) => void;
  onOpenBuilder: (formId: string) => void;
  onOpenPreview: (form: FormsListItem) => void;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
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
  const pageCount = form.metadata?.pageCount ?? 0;
  const fieldCount = form.metadata?.fieldCount ?? 0;
  const lastUpdated = form.metadata?.lastUpdated ?? form.updatedAt;

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
      className="group flex h-full cursor-pointer flex-col border border-border/70 bg-background/60 shadow-sm outline-none transition hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={`Open dashboard for ${form.title}`}
    >
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
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                form.isPublished
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {form.isPublished ? 'Published' : 'Draft'}
            </span>
            {showPermissionBadge && form.userPermission && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {form.userPermission.toLowerCase()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Updated {formatDate(lastUpdated)}
          </span>
          <Separator orientation="vertical" className="hidden h-4 md:block" />
          <span className="inline-flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            {form.responseCount} responses
          </span>
          <Separator orientation="vertical" className="hidden h-4 md:block" />
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            {pageCount} pages · {fieldCount} fields
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 text-sm text-muted-foreground">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="font-medium text-foreground">Short link</p>
          <p className="truncate font-mono text-xs text-primary">
            {form.shortUrl}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t bg-muted/30 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:w-auto">
          <Button
            size="sm"
            className="gap-2"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDashboard(form.id);
            }}
          >
            View Dashboard
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={(event) => {
              event.stopPropagation();
              onOpenBuilder(form.id);
            }}
          >
            <PenSquare className="h-4 w-4" />
            Edit Form
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start gap-2 sm:w-auto"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPreview(form);
          }}
          disabled={!form.isPublished}
          title={
            form.isPublished
              ? 'Open form in viewer'
              : 'Publish the form to generate a preview link'
          }
        >
          <ExternalLink className="h-4 w-4" />
          {form.isPublished ? 'Preview' : 'Preview unavailable'}
        </Button>
      </CardFooter>
    </Card>
  );
};
