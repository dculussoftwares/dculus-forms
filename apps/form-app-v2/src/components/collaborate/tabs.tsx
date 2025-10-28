import { Fragment } from 'react';
import { ExternalLink } from 'lucide-react';
import type { FormPage } from '@dculus/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@dculus/ui-v2';
import { useTranslate } from '@/i18n';

export interface LayoutTabProps {
  pages: FormPage[];
  isConnected: boolean;
  selectedPageId: string | null;
  onSelectPage?: (pageId: string) => void;
}

export const LayoutTab = ({
  pages,
  isConnected,
  selectedPageId,
  onSelectPage,
}: LayoutTabProps) => {
  const t = useTranslate();

  return (
    <div className="flex h-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('collaborate.layout.title')}</CardTitle>
          <CardDescription>{t('collaborate.layout.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected
              ? t('collaborate.status.connected')
              : t('collaborate.status.connecting')}
          </Badge>
          <Badge variant="outline">
            {t('collaborate.layout.pageCount', { count: pages.length })}
          </Badge>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>{t('collaborate.layout.structureTitle')}</CardTitle>
          <CardDescription>{t('collaborate.layout.structureDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 overflow-y-auto pr-2">
          {pages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
              {t('collaborate.layout.emptyState')}
            </div>
          ) : (
            pages.map((page, index) => (
              <Fragment key={page.id}>
                <button
                  onClick={() => onSelectPage?.(page.id)}
                  className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-primary/5 ${selectedPageId === page.id ? 'border-primary bg-primary/5' : 'border-border/70'}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-tight">
                      {page.title || t('collaborate.layout.untitledPage', { index: index + 1 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('collaborate.layout.fieldCount', { count: page.fields.length })}
                    </p>
                  </div>
                </button>
              </Fragment>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export interface PageBuilderTabProps {
  isConnected: boolean;
}

export const PageBuilderTab = ({ isConnected }: PageBuilderTabProps) => {
  const t = useTranslate();

  return (
    <Card className="flex h-full flex-col items-center justify-center border-dashed">
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <Badge variant={isConnected ? 'default' : 'secondary'}>
          {isConnected
            ? t('collaborate.status.connected')
            : t('collaborate.status.connecting')}
        </Badge>
        <div>
          <h3 className="text-lg font-semibold">
            {t('collaborate.pageBuilder.placeholderTitle')}
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {t('collaborate.pageBuilder.placeholderDescription')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export interface PreviewTabProps {
  viewerUrl: string | null;
  shortUrl: string | null;
}

export const PreviewTab = ({ viewerUrl, shortUrl }: PreviewTabProps) => {
  const t = useTranslate();
  const hasPreview = Boolean(viewerUrl && shortUrl);

  return (
    <Card className="flex h-full flex-col items-center justify-center border-dashed">
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <div>
          <h3 className="text-lg font-semibold">
            {t('collaborate.preview.title')}
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasPreview
              ? t('collaborate.preview.description')
              : t('collaborate.preview.emptyDescription')}
          </p>
        </div>
        {hasPreview ? (
          <Button asChild>
            <a href={viewerUrl ?? '#'} target="_blank" rel="noopener noreferrer">
              {t('collaborate.preview.openButton')}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
};

export interface SettingsTabProps {
  formTitle: string;
}

export const SettingsTab = ({ formTitle }: SettingsTabProps) => {
  const t = useTranslate();

  return (
    <Card className="flex h-full flex-col items-center justify-center border-dashed">
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <div>
          <h3 className="text-lg font-semibold">
            {t('collaborate.settings.title')}
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {t('collaborate.settings.description', { title: formTitle })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
