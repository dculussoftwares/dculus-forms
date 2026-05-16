import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface ViewsOverTimeData {
  date: string;
  views: number;
  sessions: number;
}

interface SubmissionsOverTimeData {
  date: string;
  submissions: number;
  sessions: number;
}

interface ViewsOverTimeChartProps {
  data: ViewsOverTimeData[];
  submissionData?: SubmissionsOverTimeData[];
  loading?: boolean;
  timeRange?: string;
}

const CustomTooltip = ({ active, payload, label, t }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return (
      <div className="bg-white p-3 rounded-lg" style={{ border: '1px solid rgba(81,76,84,0.12)', boxShadow: '0 4px 16px rgba(60,50,62,0.12)' }}>
        <p className="text-xs font-medium mb-2" style={{ color: '#3c323e' }}>{date}</p>
        <div className="space-y-1">
          {payload.map((entry: any) => {
            let color = entry.color;
            let label = entry.dataKey;
            if (entry.dataKey === 'views') { color = '#655d67'; label = t('legend.totalViews'); }
            else if (entry.dataKey === 'sessions') { color = '#177767'; label = t('legend.viewSessions'); }
            else if (entry.dataKey === 'submissions') { color = '#a25fba'; label = t('legend.submissions'); }
            else if (entry.dataKey === 'submissionSessions') { color = '#3c323e'; label = t('legend.subSessions'); }
            
            return (
              <p key={entry.dataKey} className="text-sm" style={{ color }}>
                {label}: {entry.value || 0}
              </p>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const formatXAxisDate = (tickItem: string) => {
  const date = new Date(tickItem);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

export const ViewsOverTimeChart: React.FC<ViewsOverTimeChartProps> = ({
  data,
  submissionData = [],
  loading = false,
  timeRange = '30d'
}) => {
  const { t } = useTranslation('viewsOverTimeChart');

  // Merge views and submission data by date
  // IMPORTANT: This hook must be called before any conditional returns
  const mergedData = React.useMemo(() => {
    const dataMap = new Map();
    
    // Add views data
    data.forEach(item => {
      dataMap.set(item.date, {
        date: item.date,
        views: item.views,
        sessions: item.sessions,
        submissions: 0,
        submissionSessions: 0
      });
    });
    
    // Add submission data
    submissionData.forEach(item => {
      if (dataMap.has(item.date)) {
        const existing = dataMap.get(item.date);
        existing.submissions = item.submissions;
        existing.submissionSessions = item.sessions;
      } else {
        dataMap.set(item.date, {
          date: item.date,
          views: 0,
          sessions: 0,
          submissions: item.submissions,
          submissionSessions: item.sessions
        });
      }
    });
    
    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, submissionData]);

  // Check loading state after all hooks are called
  if (loading) {
    return (
      <div className="rounded-xl p-5 animate-pulse bg-white" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
        <div className="h-4 rounded w-40 mb-5" style={{ backgroundColor: 'rgba(81,76,84,0.08)' }} />
        <div className="h-64 rounded-lg" style={{ backgroundColor: 'rgba(81,76,84,0.04)' }} />
      </div>
    );
  }

  if (!mergedData || mergedData.length === 0) {
    return (
      <div className="rounded-xl p-5 bg-white" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
        <div className="flex items-center gap-1.5 mb-4">
          <TrendingUp className="h-4 w-4" style={{ color: '#655d67' }} />
          <span className="text-sm font-medium" style={{ color: '#3c323e' }}>{t('title')}</span>
        </div>
        <div className="h-64 flex flex-col items-center justify-center">
          <Calendar className="h-10 w-10 mb-3" style={{ color: '#dedcde' }} />
          <p className="text-sm font-medium" style={{ color: '#4c414e' }}>No time-series data available</p>
          <p className="text-xs mt-1" style={{ color: '#655d67' }}>Data will appear once your form receives more activity</p>
        </div>
      </div>
    );
  }

  const totalViews = mergedData.reduce((sum, item) => sum + item.views, 0);
  const totalSessions = mergedData.reduce((sum, item) => sum + item.sessions, 0);
  const totalSubmissions = mergedData.reduce((sum, item) => sum + item.submissions, 0);
  const totalSubmissionSessions = mergedData.reduce((sum, item) => sum + item.submissionSessions, 0);
  const avgViewsPerDay = Math.round(totalViews / mergedData.length);
  const avgSubmissionsPerDay = Math.round(totalSubmissions / mergedData.length);

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '7d': return 'Past 7 days';
      case '30d': return 'Past 30 days';
      case '90d': return 'Past 90 days';
      default: return 'Custom range';
    }
  };

  /* Typeform chart palette */
  const TF = { views: '#655d67', sessions: '#177767', submissions: '#a25fba', subSessions: '#3c323e' };

  return (
    <div className="rounded-xl p-5 bg-white" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4" style={{ color: '#655d67' }} />
          <span className="text-sm font-medium" style={{ color: '#3c323e' }}>{t('title')}</span>
        </div>
        <span className="text-xs" style={{ color: '#655d67' }}>{getTimeRangeLabel()}</span>
      </div>

      {/* Chart */}
      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mergedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {Object.entries(TF).map(([key, color]) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.02}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(81,76,84,0.06)" />
            <XAxis dataKey="date" tickFormatter={formatXAxisDate} tick={{ fontSize: 11, fill: '#655d67' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#655d67' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip t={t} />} />
            <Area type="monotone" dataKey="views" stroke={TF.views} strokeWidth={2} fill={`url(#grad-views)`} />
            <Area type="monotone" dataKey="sessions" stroke={TF.sessions} strokeWidth={2} fill={`url(#grad-sessions)`} />
            <Area type="monotone" dataKey="submissions" stroke={TF.submissions} strokeWidth={2} fill={`url(#grad-submissions)`} />
            <Area type="monotone" dataKey="submissionSessions" stroke={TF.subSessions} strokeWidth={2} fill={`url(#grad-subSessions)`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-4" style={{ borderTop: '1px solid rgba(81,76,84,0.08)' }}>
        {[
          { value: totalViews, label: t('stats.totalViews'), color: TF.views },
          { value: totalSessions, label: t('stats.viewSessions'), color: TF.sessions },
          { value: totalSubmissions, label: t('stats.submissions'), color: TF.submissions },
          { value: totalSubmissionSessions, label: t('stats.submissionSessions'), color: TF.subSessions },
          { value: avgViewsPerDay, label: t('stats.avgViewsPerDay'), color: '#3c323e' },
          { value: avgSubmissionsPerDay, label: t('stats.avgSubsPerDay'), color: '#3c323e' },
        ].map(({ value, label, color }) => (
          <div key={label} className="text-center">
            <p className="text-lg font-light" style={{ color }}>{value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#655d67' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(81,76,84,0.08)' }}>
        {[
          { color: TF.views, label: t('legendItems.views') },
          { color: TF.sessions, label: t('legendItems.viewSessions') },
          { color: TF.submissions, label: t('legendItems.submissions') },
          { color: TF.subSessions, label: t('legendItems.submissionSessions') },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs" style={{ color: '#655d67' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};