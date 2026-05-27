import { useState, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL as string;

export interface AIStreamCallbacks {
  onTextDelta: (delta: string) => void;
  onOperation: (op: unknown) => void;
  onDone: (messageId: string) => void;
  onError: (error: string) => void;
  onStatus: (text: string) => void;
}

export function useAIStream(organizationId: string, callbacks: AIStreamCallbacks) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const sendMessage = useCallback(
    async (conversationId: string, content: string, currentPageId?: string) => {
      if (isStreaming) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      try {
        const response = await fetch(`${API_URL}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ conversationId, organizationId, content, currentPageId }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => ({}));
          callbacksRef.current.onError((body as any).error ?? 'Request failed');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as { type: string; delta?: string; op?: unknown; messageId?: string; error?: string; text?: string };
              if (chunk.type === 'text') callbacksRef.current.onTextDelta(chunk.delta ?? '');
              if (chunk.type === 'operation' && chunk.op !== undefined) callbacksRef.current.onOperation(chunk.op);
              if (chunk.type === 'done') callbacksRef.current.onDone(chunk.messageId ?? '');
              if (chunk.type === 'error') callbacksRef.current.onError(chunk.error ?? 'Unknown error');
              if (chunk.type === 'status') callbacksRef.current.onStatus(chunk.text ?? '');
            } catch {
              // malformed line — skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          callbacksRef.current.onError('Stream failed. Please try again.');
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, organizationId]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isStreaming, sendMessage, cancel };
}
