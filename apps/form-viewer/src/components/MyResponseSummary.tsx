import { useMemo } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dculus/ui';
import type { FormSchema } from '@dculus/types';
import { myResponseLabels as labels } from '../locales/myResponse';
import { listAnsweredQuestions } from '../lib/answerFormat';
import { formatDate } from '../lib/dateFormat';
import type { MyResponseData } from '../graphql/queries';

interface MyResponseSummaryProps {
  formTitle: string;
  formSchema: FormSchema;
  response: MyResponseData;
  embedded?: boolean;
  onBack: () => void;
  onEdit?: () => void;
}

/** A read-only copy of the respondent's own submitted answers. */
export default function MyResponseSummary({
  formTitle,
  formSchema,
  response,
  embedded = false,
  onBack,
  onEdit,
}: MyResponseSummaryProps) {
  const questions = useMemo(
    () => listAnsweredQuestions(formSchema, response.data, labels),
    [formSchema, response.data]
  );

  return (
    <div
      className={`w-full flex justify-center ${embedded ? 'px-4 py-6' : 'flex-1 min-h-0 overflow-y-auto px-4 py-10'}`}
      data-testid="my-response-summary"
    >
      <Card className="w-full max-w-2xl h-fit">
        <CardHeader>
          <CardTitle>{formTitle}</CardTitle>
          <CardDescription>{labels.respondedOn(formatDate(response.submittedAt))}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="space-y-4">
            {questions.map(({ fieldId, label, answer }) => (
              <div key={fieldId} className="space-y-1">
                <dt className="text-sm font-medium text-foreground">{label}</dt>
                <dd
                  className={`text-sm whitespace-pre-wrap break-words ${answer ? 'text-foreground' : 'italic text-muted-foreground'}`}
                >
                  {answer ?? labels.noAnswer}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onBack}>
              {labels.hideResponse}
            </Button>
            {onEdit && (
              <Button onClick={onEdit} data-testid="my-response-edit">
                {labels.editResponse}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
