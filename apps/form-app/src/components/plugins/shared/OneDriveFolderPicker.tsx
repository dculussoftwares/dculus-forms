import React, { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, toastError } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { buildPickerUrl, type OneDrivePickerSession, type PickedFolder } from '../../../lib/oneDrivePicker';

interface OneDriveFolderPickerProps {
  session: OneDrivePickerSession | null;
  onClose: () => void;
  onPicked: (folder: PickedFolder) => void;
}

interface PickerMessage {
  type: string;
  id?: string;
  data?: {
    command?: string;
    resource?: string;
    items?: Array<{ id: string; name?: string }>;
  };
}

const IFRAME_NAME = 'onedrive-folder-picker';

/** Hosts the OneDrive File Picker v8 in an iframe and answers its postMessage commands. */
export const OneDriveFolderPicker: React.FC<OneDriveFolderPickerProps> = ({ session, onClose, onPicked }) => {
  const { t } = useTranslation('pluginDestination');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let port: MessagePort | undefined;
    const channelId = crypto.randomUUID();

    const handleCommand = async (message: PickerMessage) => {
      const reply = (data: unknown) => port?.postMessage({ type: 'result', id: message.id, data });
      port?.postMessage({ type: 'acknowledge', id: message.id });

      const command = message.data;
      switch (command?.command) {
        case 'authenticate':
          try {
            reply({ result: 'token', token: await session.getToken(command.resource, false) });
          } catch (error) {
            reply({ result: 'error', error: { code: 'unableToObtainToken', message: (error as Error).message } });
          }
          break;
        case 'close':
          onClose();
          break;
        case 'pick': {
          const item = command.items?.[0];
          if (!item) {
            reply({ result: 'error', error: { code: 'unusableItem', message: 'No folder selected' } });
            break;
          }
          reply({ result: 'success' });
          try {
            onPicked({ id: item.id, name: item.name ?? (await session.getFolderName(item.id)) });
          } catch (error) {
            toastError(t('errors.pickFailed'), (error as Error).message);
            onClose();
          }
          break;
        }
        default:
          reply({ result: 'error', error: { code: 'unsupportedCommand', message: String(command?.command) } });
      }
    };

    const onWindowMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; channelId?: string } | undefined;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (data?.type !== 'initialize' || data.channelId !== channelId) return;

      port = event.ports[0];
      port.addEventListener('message', (portEvent: MessageEvent<PickerMessage>) => {
        if (portEvent.data.type === 'command') void handleCommand(portEvent.data);
      });
      port.start();
      port.postMessage({ type: 'activate' });
    };
    window.addEventListener('message', onWindowMessage);

    // The picker page loads from a form POST so the access token never appears in a URL.
    const launch = async () => {
      let token: string;
      try {
        token = await session.getToken(session.baseUrl, false);
      } catch {
        if (!cancelled) setNeedsSignIn(true);
        return;
      }
      if (cancelled) return;
      setNeedsSignIn(false);

      // The dialog content mounts through a portal, so the iframe may not exist on the first tick.
      for (let frames = 0; frames < 30 && !iframeRef.current; frames++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      if (cancelled || !iframeRef.current) return;

      const form = document.createElement('form');
      form.method = 'POST';
      form.target = IFRAME_NAME;
      form.action = buildPickerUrl(session, channelId, t('oneDrive.title'));
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'access_token';
      input.value = token;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      form.remove();
    };
    void launch();

    return () => {
      cancelled = true;
      window.removeEventListener('message', onWindowMessage);
      port?.close();
    };
  }, [session, attempt]);

  const handleSignIn = async () => {
    if (!session) return;
    try {
      await session.getToken(session.baseUrl, true);
      setAttempt((value) => value + 1);
    } catch (error) {
      toastError(t('errors.pickFailed'), (error as Error).message);
    }
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1100px] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{t('oneDrive.title')}</DialogTitle>
        {needsSignIn && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">{t('oneDrive.signInHint')}</p>
            <Button type="button" onClick={handleSignIn}>
              {t('oneDrive.signInButton')}
            </Button>
          </div>
        )}
        <iframe
          ref={iframeRef}
          name={IFRAME_NAME}
          title={t('oneDrive.title')}
          className={needsSignIn ? 'hidden' : 'w-full h-[680px] border-0'}
        />
      </DialogContent>
    </Dialog>
  );
};
