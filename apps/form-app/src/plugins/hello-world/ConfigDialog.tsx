/**
 * Hello World Plugin - Configuration Dialog
 *
 * Simple dialog that allows users to configure the custom message
 * that will be logged on the backend when a form is submitted.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@dculus/ui';

interface HelloWorldConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: {
    message: string;
  };
  onSave: (config: { message: string; isEnabled: boolean }) => Promise<void>;
  isEditing?: boolean;
}

export function HelloWorldConfigDialog({
  open,
  onOpenChange,
  initialConfig,
  onSave,
  isEditing = false,
}: HelloWorldConfigDialogProps) {
  const [message, setMessage] = useState(
    initialConfig?.message || 'Hello from my form!'
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!message.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        message: message.trim(),
        isEnabled: true,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving plugin config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit' : 'Install'} Hello World Plugin
          </DialogTitle>
          <DialogDescription>
            Configure the message that will be logged on the backend console
            when your form is submitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Custom Message</Label>
            <Input
              id="message"
              placeholder="Enter your custom message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              autoFocus
            />
            <p className="text-xs text-slate-500">
              This message will be logged to the backend console every time
              someone submits your form.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
            <p className="text-sm font-medium text-slate-900 mb-2">
              Example Output:
            </p>
            <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-words">
              {`==================================================
🎉 HELLO WORLD PLUGIN TRIGGERED!
==================================================
📝 Message: ${message || 'Hello from my form!'}
📋 Form ID: abc123
🆔 Response ID: xyz789
⏰ Timestamp: ${new Date().toLocaleString()}
==================================================`}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !message.trim()}>
            {isSaving
              ? 'Saving...'
              : isEditing
              ? 'Save Changes'
              : 'Install Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
