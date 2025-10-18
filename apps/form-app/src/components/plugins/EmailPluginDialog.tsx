import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Card,
} from '@dculus/ui';
import { Mail, Sparkles } from 'lucide-react';

interface EmailPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmailPluginDialog: React.FC<EmailPluginDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Email Notification</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Send email notifications to team members or submitters when form events occur.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-12">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Coming Soon
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Email notifications are currently in development. Soon you'll be able to:
            </p>
            <ul className="mt-4 text-left max-w-md mx-auto space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Send notifications to team members on form submission</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Auto-reply to form submitters with custom messages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Include form data in email templates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Configure multiple recipients and CC/BCC</span>
              </li>
            </ul>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
