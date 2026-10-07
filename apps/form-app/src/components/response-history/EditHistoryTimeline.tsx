import React, { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ResponseEditHistory, EditType } from '@dculus/types';
import {
  Card,
  CardContent,
  UserAvatar,
  Badge,
  Separator,
  Button
} from '@dculus/ui';
import {
  Edit3,
  User as UserIcon,
  Clock,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { FieldChangeCard } from './FieldChangeCard';
import { useTranslation } from '../../hooks/useTranslation';

interface EditHistoryTimelineProps {
  editHistory: ResponseEditHistory[];
  isLoading?: boolean;
}

export const EditHistoryTimeline: React.FC<EditHistoryTimelineProps> = ({
  editHistory,
  isLoading = false
}) => {
  const { t } = useTranslation('responseHistory');
  const [expandedEdits, setExpandedEdits] = useState<Set<string>>(new Set());
  const [snapshotEdits, setSnapshotEdits] = useState<Set<string>>(new Set());

  const toggleExpanded = (editId: string) => {
    const newExpanded = new Set(expandedEdits);
    if (newExpanded.has(editId)) {
      newExpanded.delete(editId);
    } else {
      newExpanded.add(editId);
    }
    setExpandedEdits(newExpanded);
  };

  const toggleSnapshot = (editId: string) => {
    const newSnapshot = new Set(snapshotEdits);
    if (newSnapshot.has(editId)) {
      newSnapshot.delete(editId);
    } else {
      newSnapshot.add(editId);
    }
    setSnapshotEdits(newSnapshot);
  };

  const getEditTypeColor = (editType: EditType) => {
    switch (editType) {
      case EditType.MANUAL:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case EditType.SYSTEM:
        return 'bg-background text-primary border-[var(--tf-border-medium)]';
      case EditType.BULK:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-background text-primary border-[var(--tf-border-medium)]';
    }
  };

  const getEditTypeIcon = (editType: EditType) => {
    switch (editType) {
      case EditType.MANUAL:
        return <Edit3 className="h-4 w-4" />;
      case EditType.SYSTEM:
        return <UserIcon className="h-4 w-4" />;
      case EditType.BULK:
        return <Edit3 className="h-4 w-4" />;
      default:
        return <Edit3 className="h-4 w-4" />;
    }
  };


  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!editHistory || editHistory.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Edit3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">{t('editHistoryTimeline.empty.title')}</h3>
          <p className="text-muted-foreground">
            {t('editHistoryTimeline.empty.description')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {editHistory.map((edit, index) => {
        const isExpanded = expandedEdits.has(edit.id);
        const isSnapshotOpen = snapshotEdits.has(edit.id);
        const isLatest = index === 0;

        return (
          <Card key={edit.id} className={`relative ${isLatest ? 'ring-2 ring-blue-200 shadow-md' : ''}`}>
            <CardContent className="p-6">
              {/* Timeline connector line */}
              {index < editHistory.length - 1 && (
                <div className="absolute left-11 top-16 w-0.5 h-full bg-gray-200 -z-10" />
              )}

              <div className="flex items-start space-x-4">
                {/* User Avatar */}
                <div className="relative">
                  <UserAvatar
                    name={edit.editedBy.name}
                    email={edit.editedBy.email}
                    image={edit.editedBy.image}
                    size="lg"
                  />
                  {isLatest && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Edit Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-primary">
                        {edit.editedBy.name}
                      </h4>
                      <Badge
                        variant="outline"
                        className={getEditTypeColor(edit.editType)}
                      >
                        {getEditTypeIcon(edit.editType)}
                        <span className="ml-1">{edit.editType}</span>
                      </Badge>
                      {isLatest && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                          {t('editHistoryTimeline.badges.latest')}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {edit.fieldChanges && edit.fieldChanges.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSnapshot(edit.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isSnapshotOpen ? (
                            <EyeOff className="h-4 w-4 mr-1" />
                          ) : (
                            <Eye className="h-4 w-4 mr-1" />
                          )}
                          {isSnapshotOpen
                            ? t('editHistoryTimeline.buttons.hideSnapshot')
                            : t('editHistoryTimeline.buttons.view')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-3">
                    <Clock className="h-4 w-4" />
                    <span>
                      {edit.editedAt
                        ? formatDistanceToNow(new Date(edit.editedAt), { addSuffix: true })
                        : t('editHistoryTimeline.labels.unknownTime')
                      }
                    </span>
                    <span>•</span>
                    <span>
                      {edit.editedAt
                        ? format(new Date(edit.editedAt), 'MMM dd, yyyy \'at\' h:mm a')
                        : t('editHistoryTimeline.labels.unknownDate')
                      }
                    </span>
                  </div>

                  {/* Changes Summary */}
                  <div className="mb-3">
                    <p className="text-foreground">
                      {edit.changesSummary || t('editHistoryTimeline.labels.modifiedFields', { values: { count: edit.totalChanges } })}
                    </p>
                    {edit.editReason && (
                      <p className="text-sm text-foreground mt-1">
                        <span className="font-medium">{t('editHistoryTimeline.labels.reason')}</span> {edit.editReason}
                      </p>
                    )}
                  </div>

                  {/* Field Changes Toggle */}
                  {edit.fieldChanges && edit.fieldChanges.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(edit.id)}
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 mr-1" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-1" />
                        )}
                        {isExpanded ? t('editHistoryTimeline.buttons.hide') : t('editHistoryTimeline.buttons.show')} {t('editHistoryTimeline.labels.fieldChanges', { values: { count: edit.fieldChanges.length } })}
                      </Button>

                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          <Separator />
                          {edit.fieldChanges.map((fieldChange: any) => (
                            <FieldChangeCard
                              key={fieldChange.id}
                              fieldChange={fieldChange}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Snapshot diff panel */}
                  {isSnapshotOpen && edit.fieldChanges && edit.fieldChanges.length > 0 && (
                    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t('editHistoryTimeline.snapshot.title')}
                      </p>
                      {edit.fieldChanges.map((fc: any) => (
                        <div key={fc.id} className="grid grid-cols-[auto_1fr_1fr] items-start gap-3 text-sm">
                          <Badge
                            variant="outline"
                            className={
                              fc.changeType === 'ADD'
                                ? 'bg-green-50 text-green-700 border-green-200 shrink-0'
                                : fc.changeType === 'DELETE'
                                ? 'bg-red-50 text-red-700 border-red-200 shrink-0'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200 shrink-0'
                            }
                          >
                            {fc.changeType}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">{t('editHistoryTimeline.snapshot.before')}</p>
                            <p className="font-mono text-xs bg-background rounded px-2 py-1 break-all">
                              {fc.previousValue ?? <span className="italic text-muted-foreground">—</span>}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">{t('editHistoryTimeline.snapshot.after')}</p>
                            <p className="font-mono text-xs bg-background rounded px-2 py-1 break-all">
                              {fc.newValue ?? <span className="italic text-muted-foreground">—</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};