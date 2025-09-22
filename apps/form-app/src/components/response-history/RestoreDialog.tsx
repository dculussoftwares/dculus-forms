import React, { useState } from 'react';
import { format } from 'date-fns';
import { ResponseSnapshot, RestoreResponseInput } from '@dculus/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  Separator,
  Badge
} from '@dculus/ui';
import {
  RotateCcw,
  AlertTriangle,
  Clock,
  User,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { toastSuccess, toastError } from '@dculus/ui';

interface RestoreDialogProps {
  snapshots: ResponseSnapshot[];
  responseId: string;
  onRestore: (input: RestoreResponseInput) => Promise<void>;
  trigger?: React.ReactNode;
  isLoading?: boolean;
}

export const RestoreDialog: React.FC<RestoreDialogProps> = ({
  snapshots,
  responseId,
  onRestore,
  trigger
}) => {
  const [open, setOpen] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [restoreReason, setRestoreReason] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const selectedSnapshot = snapshots.find(s => s.id === selectedSnapshotId);
  const restorableSnapshots = snapshots.filter(s => s.isRestorable);

  const handleRestore = async () => {
    if (!selectedSnapshotId) {
      toastError('Please select a snapshot to restore');
      return;
    }

    try {
      setIsRestoring(true);

      await onRestore({
        responseId,
        snapshotId: selectedSnapshotId,
        restoreReason: restoreReason.trim() || undefined
      });

      toastSuccess(
        'Response restored successfully',
        'The response has been restored to the selected version'
      );

      setOpen(false);
      setSelectedSnapshotId('');
      setRestoreReason('');
    } catch (error) {
      toastError(
        'Failed to restore response',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const getSnapshotTypeColor = (type: string) => {
    switch (type) {
      case 'EDIT':
        return 'bg-blue-100 text-blue-800';
      case 'MANUAL':
        return 'bg-green-100 text-green-800';
      case 'SCHEDULED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderSnapshotPreview = (snapshot: ResponseSnapshot) => {
    const data = snapshot.snapshotData;
    const fieldCount = Object.keys(data).length;
    const sampleFields = Object.entries(data).slice(0, 3);

    return (
      <div className="mt-3 p-3 bg-gray-50 rounded border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Preview ({fieldCount} fields)</span>
          <Badge className={getSnapshotTypeColor(snapshot.snapshotType)}>
            {snapshot.snapshotType}
          </Badge>
        </div>
        <div className="space-y-1 text-xs">
          {sampleFields.map(([fieldId, value]) => (
            <div key={fieldId} className="flex items-start space-x-2">
              <span className="font-mono text-gray-600 min-w-0 flex-shrink-0">
                {fieldId}:
              </span>
              <span className="text-gray-800 truncate">
                {Array.isArray(value)
                  ? `[${value.length} items]`
                  : typeof value === 'object'
                  ? '[object]'
                  : String(value).substring(0, 50)
                }{String(value).length > 50 ? '...' : ''}
              </span>
            </div>
          ))}
          {fieldCount > 3 && (
            <div className="text-gray-500 italic">
              ...and {fieldCount - 3} more fields
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore Response
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <RotateCcw className="h-5 w-5" />
            <span>Restore Response</span>
          </DialogTitle>
          <DialogDescription>
            Select a previous version to restore this response. This action will replace the current response data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Restoring will overwrite the current response data.
              A snapshot of the current state will be created automatically before restoration.
            </AlertDescription>
          </Alert>

          {/* Snapshot Selection */}
          <div className="space-y-3">
            <Label htmlFor="snapshot-select">
              Select Version to Restore ({restorableSnapshots.length} available)
            </Label>

            {restorableSnapshots.length === 0 ? (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  No restorable snapshots are available for this response.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                value={selectedSnapshotId}
                onValueChange={setSelectedSnapshotId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a snapshot to restore..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="max-h-64 overflow-y-auto">
                    {restorableSnapshots.map((snapshot) => (
                      <SelectItem key={snapshot.id} value={snapshot.id}>
                        <div className="flex items-center space-x-2 py-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>
                            {snapshot.snapshotAt
                              ? format(new Date(snapshot.snapshotAt), 'MMM dd, yyyy \'at\' h:mm a')
                              : 'Unknown date'
                            }
                          </span>
                          {snapshot.createdBy && (
                            <>
                              <span className="text-gray-400">•</span>
                              <div className="flex items-center space-x-1">
                                <User className="h-3 w-3 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {snapshot.createdBy.name}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected Snapshot Preview */}
          {selectedSnapshot && (
            <div className="space-y-3">
              <Label>Snapshot Preview</Label>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">
                      {selectedSnapshot.snapshotAt
                        ? format(new Date(selectedSnapshot.snapshotAt), 'MMMM dd, yyyy \'at\' h:mm a')
                        : 'Unknown date'
                      }
                    </span>
                  </div>
                  {selectedSnapshot.createdBy && (
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <User className="h-4 w-4" />
                      <span>{selectedSnapshot.createdBy.name}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-3" />

                {renderSnapshotPreview(selectedSnapshot)}
              </div>
            </div>
          )}

          {/* Restore Reason */}
          <div className="space-y-3">
            <Label htmlFor="restore-reason">
              Restore Reason (Optional)
            </Label>
            <Textarea
              id="restore-reason"
              placeholder="Why are you restoring this version? (e.g., 'Reverting accidental changes', 'Rolling back to previous state')"
              value={restoreReason}
              onChange={(e) => setRestoreReason(e.target.value)}
              rows={3}
              disabled={isRestoring}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isRestoring}
            >
              Cancel
            </Button>

            <Button
              onClick={handleRestore}
              disabled={!selectedSnapshotId || isRestoring || restorableSnapshots.length === 0}
              className="min-w-[120px]"
            >
              {isRestoring ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Restoring...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Restore Response
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};