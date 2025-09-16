import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@dculus/ui';
import {
  FileText,
  TrendingUp,
  Clock,
  Calendar,
} from 'lucide-react';

interface DashboardStats {
  totalResponses: number;
  responseRate: string;
  averageCompletionTime: string;
  responsesToday: number;
  responsesThisWeek: number;
}

interface StatsGridProps {
  stats: DashboardStats;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalResponses}</div>
          <p className="text-xs text-muted-foreground">
            +{stats.responsesToday} from today
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.responseRate}</div>
          <p className="text-xs text-muted-foreground">Views converted to responses</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Avg. Completion Time
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.averageCompletionTime}</div>
          <p className="text-xs text-muted-foreground">
            Average time to complete form
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.responsesThisWeek}</div>
          <p className="text-xs text-muted-foreground">Responses this week</p>
        </CardContent>
      </Card>
    </div>
  );
};