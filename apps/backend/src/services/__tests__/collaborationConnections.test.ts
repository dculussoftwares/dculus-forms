import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  closeFormCollaborationConnections,
  registerHocuspocusServer,
} from '../collaborationConnections.js';

describe('closeFormCollaborationConnections (S13-01)', () => {
  it('is a no-op before a server is registered', () => {
    expect(() => closeFormCollaborationConnections('form-1')).not.toThrow();
  });

  it('closes live connections for the form document', () => {
    const closeConnections = vi.fn();
    registerHocuspocusServer({ closeConnections } as any);

    closeFormCollaborationConnections('form-1');

    expect(closeConnections).toHaveBeenCalledWith('form-1');
  });

  it('swallows errors from the server', () => {
    registerHocuspocusServer({
      closeConnections: () => {
        throw new Error('boom');
      },
    } as any);

    expect(() => closeFormCollaborationConnections('form-1')).not.toThrow();
  });
});
