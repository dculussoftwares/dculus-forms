import { Button } from '@dculus/ui';
import { myResponseLabels as labels } from '../locales/myResponse';

interface MyResponseNoticeProps {
  message: string;
  description?: string;
  embedded?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}

/**
 * The strip under the account header that links a signed-in respondent to
 * their own response: after submitting, on a revisit, or while editing it.
 */
export default function MyResponseNotice({
  message,
  description,
  embedded = false,
  onView,
  onEdit,
  onCancel,
}: MyResponseNoticeProps) {
  return (
    <div
      className={[
        'flex w-full shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b text-sm',
        'border-emerald-100 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
        embedded ? 'px-4 py-2.5' : 'px-4 py-3 sm:px-6',
      ].join(' ')}
      role="status"
      data-testid="my-response-notice"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {description && <p className="text-xs opacity-80">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {onView && (
          <Button size="sm" variant="outline" onClick={onView} data-testid="my-response-view">
            {labels.viewResponse}
          </Button>
        )}
        {onEdit && (
          <Button size="sm" onClick={onEdit} data-testid="my-response-start-edit">
            {labels.editResponse}
          </Button>
        )}
        {onCancel && (
          <Button size="sm" variant="outline" onClick={onCancel} data-testid="my-response-cancel-edit">
            {labels.cancelEdit}
          </Button>
        )}
      </div>
    </div>
  );
}
