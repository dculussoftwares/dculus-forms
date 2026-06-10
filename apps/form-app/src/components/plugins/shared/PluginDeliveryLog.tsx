import React from 'react';
import { useQuery } from '@apollo/client/react';
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
import { useTranslation } from '../../../hooks/useTranslation';

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
  const { t } = useTranslation('pluginDeliveryLog');
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
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-primary/10 text-primary">
            {t('status.success')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="default" className="bg-[var(--tf-error-bg)] text-destructive">
            {t('status.failed')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{t('status.unknown')}</Badge>;
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
          <DialogTitle>{t('header.title', { values: { name: pluginName } })}</DialogTitle>
          <DialogDescription>
            {t('header.description')}
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
              <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h3 className="mb-2 text-xl font-semibold">{t('error.title')}</h3>
              <p className="text-foreground">{error.message}</p>
            </Card>
          )}

          {!loading && !error && data?.pluginDeliveries?.length === 0 && (
            <Card className="p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="mb-2 text-xl font-semibold">{t('empty.title')}</h3>
              <p className="text-foreground">
                {t('empty.message')}
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
                              <h4 className="font-semibold text-primary">
                                {delivery.eventType}
                              </h4>
                              {getStatusBadge(delivery.status)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{formatTimestamp(delivery.deliveredAt)}</span>
                              <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                            </div>
                          </div>

                          {/* Error Message (if failed) */}
                          {delivery.status === 'failed' && delivery.errorMessage && (
                            <div className="mb-2 text-sm text-destructive bg-[var(--tf-error-bg)] px-3 py-2 rounded">
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
                          <h5 className="text-sm font-semibold text-foreground mb-2">
                            {t('details.payload')}
                          </h5>
                          <pre className="text-xs bg-background p-3 rounded overflow-x-auto border">
                            {JSON.stringify(delivery.payload, null, 2)}
                          </pre>
                        </div>

                        {/* Response */}
                        {delivery.response && (
                          <div>
                            <h5 className="text-sm font-semibold text-foreground mb-2">
                              {t('details.response')}
                            </h5>
                            <pre className="text-xs bg-background p-3 rounded overflow-x-auto border">
                              {typeof delivery.response === 'string'
                                ? delivery.response
                                : JSON.stringify(delivery.response, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Delivery ID */}
                        <div>
                          <h5 className="text-sm font-semibold text-foreground mb-1">
                            {t('details.deliveryId')}
                          </h5>
                          <code className="text-xs text-foreground bg-background px-2 py-1 rounded">
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
