import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { QuizGradingMetadataViewer } from '../plugins/response-table/quiz/QuizGradingMetadataViewer';

// Registry mapping plugin types to viewer components
const METADATA_VIEWERS: Record<string, React.ComponentType<any>> = {
  'quiz-grading': QuizGradingMetadataViewer,
  // Add other plugin metadata viewers here as they are implemented
};

interface MetadataViewerProps {
  metadata: Record<string, any>;
}

export const MetadataViewer: React.FC<MetadataViewerProps> = ({ metadata }) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {Object.entries(metadata).map(([pluginType, pluginMetadata]) => {
        const ViewerComponent = METADATA_VIEWERS[pluginType];

        if (!ViewerComponent) {
          // Fallback for unknown plugin types
          return (
            <Card key={pluginType}>
              <CardHeader>
                <CardTitle>Plugin Metadata: {pluginType}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
                  {JSON.stringify(pluginMetadata, null, 2)}
                </pre>
              </CardContent>
            </Card>
          );
        }

        return <ViewerComponent key={pluginType} metadata={pluginMetadata} />;
      })}
    </div>
  );
};
