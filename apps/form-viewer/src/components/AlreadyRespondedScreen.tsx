import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dculus/ui';
import { myResponseLabels as labels } from '../locales/myResponse';
import { formatDate } from '../lib/dateFormat';

interface AlreadyRespondedScreenProps {
  submittedAt: string;
  embedded?: boolean;
  onView: () => void;
  onEdit?: () => void;
}

/** Shown instead of the form when it accepts one response per person and this one is in. */
export default function AlreadyRespondedScreen({ submittedAt, embedded = false, onView, onEdit }: AlreadyRespondedScreenProps) {
  return (
    <div
      className={`w-full flex items-center justify-center px-4 ${embedded ? 'py-10' : 'flex-1 min-h-0'}`}
      data-testid="already-responded"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{labels.alreadyRespondedTitle}</CardTitle>
          <CardDescription>{labels.alreadyRespondedDescription(formatDate(submittedAt))}</CardDescription>
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
