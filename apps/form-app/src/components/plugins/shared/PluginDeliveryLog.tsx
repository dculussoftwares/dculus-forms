import React from 'react';
import { useQuery } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Badge,
  Card,
  LoadingSpinner,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@dculus/ui';
import { CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react';
import { GET_PLUGIN_DELIVERIES } from '../../../graphql/plugins';
import { formatDistanceToNow } from 'date-fns';

interface PluginDeliveryLogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pluginId: string;
  pluginName: string;
}

export const PluginDeliveryLog: React.FC<PluginDeliveryLogProps> = ({
  open,
  onOpenChange,
  pluginId,
  pluginName,
}) => {
  const { data, loading, error, refetch } = useQuery(GET_PLUGIN_DELIVERIES, {
    variables: { pluginId, limit: 50 },
    skip: !open,
    fetchPolicy: 'network-only',
  });

  React.useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="default" className="bg-red-100 text-red-800">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onCloseAutoFocus={(e) => {
        // Ensure body pointer-events is reset when dialog closes
        e.preventDefault();
        document.body.style.pointerEvents = '';
      }}>
        <DialogHeader>
          <DialogTitle>Delivery Log - {pluginName}</DialogTitle>
          <DialogDescription>
            View execution history and debug plugin deliveries
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading && (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {error && (
            <Card className="p-8 text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="mb-2 text-xl font-semibold">Error Loading Deliveries</h3>
              <p className="text-slate-600">{error.message}</p>
            </Card>
          )}

          {!loading && !error && data?.pluginDeliveries?.length === 0 && (
            <Card className="p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="mb-2 text-xl font-semibold">No Deliveries Yet</h3>
              <p className="text-slate-600">
                This plugin hasn't been triggered yet. Test it or wait for an event to
                occur.
              </p>
            </Card>
          )}

          {!loading && !error && data?.pluginDeliveries?.length > 0 && (
            <div className="space-y-3">
              {data.pluginDeliveries.map((delivery: any) => (
                <Collapsible key={delivery.id}>
                  <Card className="p-4">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div className="mt-1">{getStatusIcon(delivery.status)}</div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">
                                {delivery.eventType}
                              </h4>
                              {getStatusBadge(delivery.status)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{formatTimestamp(delivery.deliveredAt)}</span>
                              <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                            </div>
                          </div>

                          {/* Error Message (if failed) */}
                          {delivery.status === 'failed' && delivery.errorMessage && (
                            <div className="mb-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                              {delivery.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="mt-4 space-y-4 pl-9">
                        {/* Payload */}
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">
                            Payload
                          </h5>
                          <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto border">
                            {JSON.stringify(delivery.payload, null, 2)}
                          </pre>
                        </div>

                        {/* Response */}
                        {delivery.response && (
                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">
                              Response
                            </h5>
                            <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto border">
                              {typeof delivery.response === 'string'
                                ? delivery.response
                                : JSON.stringify(delivery.response, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Delivery ID */}
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-1">
                            Delivery ID
                          </h5>
                          <code className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                            {delivery.id}
                          </code>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
