import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { Globe2, Layers, Square, Code2, Link2 } from 'lucide-react';
import type { EmbedHostStats, TrafficSourceStats } from '../../hooks/useFormAnalytics';
import { useTranslation } from '../../hooks/useTranslation';

interface TrafficSourceChartProps {
  sources: TrafficSourceStats[];
  hosts: EmbedHostStats[];
  loading?: boolean;
}

const CONTEXT_ICONS: Record<string, React.ElementType> = {
  direct: Link2,
  inline: Layers,
  lightbox: Square,
  iframe: Code2,
};

/** One colour per context, reused by the bar and its dot so they read as a pair. */
const CONTEXT_COLORS: Record<string, string> = {
  direct: '#7C3AAE',
  inline: '#0F766E',
  lightbox: '#D97706',
  iframe: '#2563EB',
};

/**
 * "Where are these views coming from?" — the hosted page, or an embed, and if
 * an embed, on whose site.
 *
 * Deliberately a simple proportion bar rather than a chart: there are at most
 * four contexts and the only question is their relative size.
 */
export const TrafficSourceChart: React.FC<TrafficSourceChartProps> = ({
  sources,
  hosts,
  loading = false,
}) => {
  const { t } = useTranslation('formAnalytics');

  // Every view is 'direct' until something is embedded. Showing a single
  // full-width "direct 100%" bar to every owner who has never embedded
  // anything is noise, so the card stays out of the way until it has
  // something to say.
  const hasEmbeddedTraffic = sources.some((s) => s.context !== 'direct' && s.count > 0);

  if (loading || !hasEmbeddedTraffic) return null;

  const ordered = [...sources].sort((a, b) => b.count - a.count);

  return (
    <Card data-testid="traffic-source-chart">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="bg-blue-50 p-3 rounded-xl">
            <Globe2 className="h-5 w-5 text-blue-600" />
          </div>
          {t('trafficSources.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {ordered.map((source) => (
              <div
                key={source.context}
                style={{
                  width: `${source.percentage}%`,
                  backgroundColor: CONTEXT_COLORS[source.context] ?? '#94a3b8',
                }}
                title={`${source.context}: ${source.count}`}
              />
            ))}
          </div>

          <ul className="mt-3 space-y-2">
            {ordered.map((source) => {
              const Icon = CONTEXT_ICONS[source.context] ?? Globe2;
              return (
                <li key={source.context} className="flex items-center gap-2.5 text-sm">
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: CONTEXT_COLORS[source.context] ?? '#94a3b8' }}
                  />
                  <span className="flex-1 min-w-0 truncate text-foreground">
                    {t(`trafficSources.context.${source.context}`)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {source.count} ({source.percentage.toFixed(1)}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {hosts.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {t('trafficSources.topHosts')}
            </p>
            <ul className="space-y-1.5">
              {hosts.map((host) => (
                <li key={host.host} className="flex items-center gap-2.5 text-sm">
                  <span className="flex-1 min-w-0 truncate font-mono text-foreground" title={host.host}>
                    {host.host}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{host.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrafficSourceChart;
