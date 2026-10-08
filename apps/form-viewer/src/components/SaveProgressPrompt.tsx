import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@dculus/ui';
import SignInOptions from './SignInOptions';
import { saveProgressLabels } from '../locales/saveProgress';
import { stashPendingAnswers } from '../lib/pendingAnswers';

interface SaveProgressPromptProps {
  formId: string;
  /** Called once the respondent has signed in without leaving the page. */
  onSignedIn: () => void;
}

function SaveIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 16V4m0 0L8 8m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Google Forms-style invitation on forms that don't require sign-in: a strip
 * above the form offering to save the respondent's progress to an account.
 * Signing in is optional and never blocks submitting. The email code flow
 * stays on the page, so answers typed so far are kept; Google sign-in leaves
 * the page, so they are stashed first and restored on return.
 */
export default function SaveProgressPrompt({ formId, onSignedIn }: SaveProgressPromptProps) {
  const [open, setOpen] = useState(false);

  const handleSignedIn = () => {
    setOpen(false);
    onSignedIn();
  };

  return (
    <>
      <div
        className="flex w-full shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 sm:px-6"
        data-testid="save-progress-prompt"
        role="region"
        aria-label={saveProgressLabels.promptTitle}
      >
        <SaveIcon />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{saveProgressLabels.promptTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{saveProgressLabels.promptDescription}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="save-progress-sign-in">
          {saveProgressLabels.promptAction}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="save-progress-dialog">
          <DialogHeader>
            <DialogTitle>{saveProgressLabels.dialogTitle}</DialogTitle>
            <DialogDescription>{saveProgressLabels.dialogDescription}</DialogDescription>
          </DialogHeader>
          <SignInOptions onSignedIn={handleSignedIn} onBeforeGoogleRedirect={() => stashPendingAnswers(formId)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
