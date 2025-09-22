import React, { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ResponseEditHistory, EditType, User } from '@dculus/types';
import {
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  AvatarImage,
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
  RotateCcw,
  Eye
} from 'lucide-react';
import { FieldChangeCard } from './FieldChangeCard';

interface EditHistoryTimelineProps {
  editHistory: ResponseEditHistory[];
  onViewSnapshot?: (editId: string) => void;
  onRestoreFromEdit?: (editId: string) => void;
  isLoading?: boolean;
}

export const EditHistoryTimeline: React.FC<EditHistoryTimelineProps> = ({
  editHistory,
  onViewSnapshot,
  onRestoreFromEdit,
  isLoading = false
}) => {
  const [expandedEdits, setExpandedEdits] = useState<Set<string>>(new Set());

  const toggleExpanded = (editId: string) => {
    const newExpanded = new Set(expandedEdits);
    if (newExpanded.has(editId)) {
      newExpanded.delete(editId);
    } else {
      newExpanded.add(editId);
    }
    setExpandedEdits(newExpanded);
  };

  const getEditTypeColor = (editType: EditType) => {
    switch (editType) {
      case EditType.MANUAL:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case EditType.SYSTEM:
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case EditType.BULK:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const getUserInitials = (user: User) => {
    return user.name
      .split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
          <Edit3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Edit History</h3>
          <p className="text-gray-500">
            This response hasn't been edited yet. Any changes will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {editHistory.map((edit, index) => {
        const isExpanded = expandedEdits.has(edit.id);
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
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={edit.editedBy.image}
                      alt={edit.editedBy.name}
                    />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {getUserInitials(edit.editedBy)}
                    </AvatarFallback>
                  </Avatar>
                  {isLatest && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Edit Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">
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
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Latest
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewSnapshot?.(edit.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRestoreFromEdit?.(edit.id)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore
                      </Button>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                    <Clock className="h-4 w-4" />
                    <span>
                      {edit.editedAt
                        ? formatDistanceToNow(new Date(edit.editedAt), { addSuffix: true })
                        : 'Unknown time'
                      }
                    </span>
                    <span>•</span>
                    <span>
                      {edit.editedAt
                        ? format(new Date(edit.editedAt), 'MMM dd, yyyy \'at\' h:mm a')
                        : 'Unknown date'
                      }
                    </span>
                  </div>

                  {/* Changes Summary */}
                  <div className="mb-3">
                    <p className="text-gray-700">
                      {edit.changesSummary || `Modified ${edit.totalChanges} field${edit.totalChanges !== 1 ? 's' : ''}`}
                    </p>
                    {edit.editReason && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Reason:</span> {edit.editReason}
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
                        {isExpanded ? 'Hide' : 'Show'} {edit.fieldChanges.length} field change{edit.fieldChanges.length !== 1 ? 's' : ''}
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
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};