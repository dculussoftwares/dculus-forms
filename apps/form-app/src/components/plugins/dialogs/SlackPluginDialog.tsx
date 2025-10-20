import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Card,
} from '@dculus/ui';
import { MessageSquare, Sparkles } from 'lucide-react';

interface SlackPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SlackPluginDialog: React.FC<SlackPluginDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle>Slack Integration</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Post messages to Slack channels when form submissions or other events occur.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-12">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-4">
              <Sparkles className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Coming Soon
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Slack integration is currently in development. Soon you'll be able to:
            </p>
            <ul className="mt-4 text-left max-w-md mx-auto space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">•</span>
                <span>Post form submissions to Slack channels</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">•</span>
                <span>Customize message templates with form data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">•</span>
                <span>Send direct messages to team members</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 mt-0.5">•</span>
                <span>Include rich formatting and attachments</span>
              </li>
            </ul>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
