import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dculus/ui';
import { myResponseLabels as labels } from '../locales/myResponse';
import { formatDate } from '../lib/dateFormat';

interface AlreadyRespondedScreenProps {
  submittedAt: string;
  /** The form stopped taking responses (closed or full), rather than allowing one per person. */
  closed?: boolean;
  embedded?: boolean;
  onView: () => void;
  onEdit?: () => void;
}

/**
 * Shown instead of the form when this respondent's answer is in and no new
 * one can be started: the form takes one response per person, or it has
 * closed since they responded.
 */
export default function AlreadyRespondedScreen({
  submittedAt,
  closed = false,
  embedded = false,
  onView,
  onEdit,
}: AlreadyRespondedScreenProps) {
  const submittedOn = formatDate(submittedAt);
  return (
    <div
      className={`w-full flex items-center justify-center px-4 ${embedded ? 'py-10' : 'flex-1 min-h-0'}`}
      data-testid="already-responded"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{closed ? labels.closedTitle : labels.alreadyRespondedTitle}</CardTitle>
          <CardDescription>
            {closed ? labels.closedDescription(submittedOn) : labels.alreadyRespondedDescription(submittedOn)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button variant={onEdit ? 'outline' : 'default'} onClick={onView} data-testid="already-responded-view">
            {labels.viewResponse}
          </Button>
          {onEdit && (
            <Button onClick={onEdit} data-testid="already-responded-edit">
              {labels.editResponse}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
