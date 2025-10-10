import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { CREATE_FORM_PLUGIN, UPDATE_FORM_PLUGIN } from '../graphql/plugins.graphql';
import { Mail } from 'lucide-react';

interface EmailPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  plugin?: any;
  onSuccess?: () => void;
}

export const EmailPluginModal: React.FC<EmailPluginModalProps> = ({
  isOpen,
  onClose,
  formId,
  plugin,
  onSuccess,
}) => {
  const isEditMode = !!plugin;

  const [config, setConfig] = useState({
    recipientEmail: '',
    subject: '',
    message: '',
    sendToSubmitter: false,
    submitterEmailFieldId: '',
  });

  useEffect(() => {
    if (plugin) {
      setConfig({
        recipientEmail: plugin.config.recipientEmail || '',
        subject: plugin.config.subject || '',
        message: plugin.config.message || '',
        sendToSubmitter: plugin.config.sendToSubmitter || false,
        submitterEmailFieldId: plugin.config.submitterEmailFieldId || '',
      });
    } else {
      setConfig({
        recipientEmail: '',
        subject: '',
        message: '',
        sendToSubmitter: false,
        submitterEmailFieldId: '',
      });
    }
  }, [plugin, isOpen]);

  const [createPlugin, { loading: creating }] = useMutation(CREATE_FORM_PLUGIN, {
    onCompleted: () => {
      toastSuccess('Email plugin created', 'The email plugin has been configured successfully');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toastError('Failed to create plugin', error.message);
    },
  });

  const [updatePlugin, { loading: updating }] = useMutation(UPDATE_FORM_PLUGIN, {
    onCompleted: () => {
      toastSuccess('Email plugin updated', 'The email plugin configuration has been updated');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toastError('Failed to update plugin', error.message);
    },
  });

  const handleSave = async () => {
    if (!config.recipientEmail || !config.subject || !config.message) {
      toastError('Missing fields', 'Please fill in all required fields');
      return;
    }

    const pluginConfig = {
      recipientEmail: config.recipientEmail,
      subject: config.subject,
      message: config.message,
      sendToSubmitter: config.sendToSubmitter,
      ...(config.submitterEmailFieldId && { submitterEmailFieldId: config.submitterEmailFieldId }),
    };

    if (isEditMode) {
      await updatePlugin({
        variables: {
          input: {
            id: plugin.id,
            config: pluginConfig,
            triggerEvents: plugin.triggerEvents,
          },
        },
      });
    } else {
      await createPlugin({
        variables: {
          input: {
            formId,
            pluginId: 'email',
            config: pluginConfig,
            triggerEvents: ['form.submitted'],
          },
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            {isEditMode ? 'Edit Email Plugin' : 'Configure Email Plugin'}
          </DialogTitle>
          <DialogDescription>
            Send automated email notifications when forms are submitted. Use {`{{fieldId}}`} to insert form field values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">
              Recipient Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="recipientEmail"
              type="email"
              placeholder="admin@example.com"
              value={config.recipientEmail}
              onChange={(e) => setConfig({ ...config, recipientEmail: e.target.value })}
            />
            <p className="text-xs text-slate-500">Email address that will receive form submissions</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">
              Email Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="New Form Submission: {{name}}"
              value={config.subject}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
            />
            <p className="text-xs text-slate-500">Use {`{{fieldId}}`} to insert form field values</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              Email Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="message"
              placeholder="You received a new form submission from {{name}}"
              value={config.message}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-slate-500">Custom message to include in the email</p>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sendToSubmitter">Send copy to submitter</Label>
                <p className="text-xs text-slate-500">Send a confirmation email to the form submitter</p>
              </div>
              <Switch
                id="sendToSubmitter"
                checked={config.sendToSubmitter}
                onCheckedChange={(checked: boolean) => setConfig({ ...config, sendToSubmitter: checked })}
              />
            </div>

            {config.sendToSubmitter && (
              <div className="space-y-2">
                <Label htmlFor="submitterEmailFieldId">Submitter Email Field ID</Label>
                <Input
                  id="submitterEmailFieldId"
                  placeholder="email"
                  value={config.submitterEmailFieldId}
                  onChange={(e) => setConfig({ ...config, submitterEmailFieldId: e.target.value })}
                />
                <p className="text-xs text-slate-500">Field ID that contains the submitter's email address</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating || updating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={creating || updating}>
            {creating || updating ? 'Saving...' : isEditMode ? 'Update Plugin' : 'Create Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
