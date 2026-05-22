import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, ScrollArea } from '@dculus/ui';
import { getMetadataViewer } from '../../plugins/core/registry';
import { useTranslation } from '../../hooks/useTranslation';
import '../../plugins/index';

interface MetadataViewerProps {
  metadata: Record<string, any>;
}

export const MetadataViewer: React.FC<MetadataViewerProps> = ({ metadata }) => {
  const { t } = useTranslation('metadataViewer');

  if (!metadata || Object.keys(metadata).length === 0) return null;

  return (
    <div className="space-y-4">
      {Object.entries(metadata).map(([pluginType, pluginMetadata]) => {
        const ViewerComponent = getMetadataViewer(pluginType);

        if (!ViewerComponent) {
          return (
            <Card key={pluginType}>
              <CardHeader>
                <CardTitle>{t('pluginMetadata.title', { values: { pluginType } })}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-60">
                  <pre className="text-xs bg-background p-3 rounded">
                    {JSON.stringify(pluginMetadata, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        }

        return <ViewerComponent key={pluginType} metadata={pluginMetadata} />;
      })}
    </div>
  );
};
