/**
 * Design tokens persist in the Y.js layout map, and reset must delete the key
 * (updateLayout ignores `undefined`). Real Y.Doc, same style as updateFieldClear.test.ts.
 */
jest.unmock('@dculus/types');
jest.unmock('zustand');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
import { createLayoutSlice } from '../layoutSlice';

function setup() {
  const ydoc = new Y.Doc();
  const store = create<any>()((set, get) => ({
    _getYDoc: () => ydoc,
    _isYJSReady: () => true,
    ...createLayoutSlice(set, get),
  }));
  const yLayout = () => ydoc.getMap('formSchema').get('layout') as Y.Map<any> | undefined;
  return { store, yLayout };
}

describe('layout design tokens', () => {
  test('updateLayout writes tokens to Y.js', () => {
    const { store, yLayout } = setup();
    const tokens = { version: 1, primaryColor: '#1d4ed8', radius: 'lg' };
    store.getState().updateLayout({ tokens });
    expect(store.getState().layout.tokens).toEqual(tokens);
    expect(yLayout()?.get('tokens')).toEqual(tokens);
  });

  test('updateLayout with undefined does not delete tokens', () => {
    const { store, yLayout } = setup();
    store.getState().updateLayout({ tokens: { version: 1, primaryColor: '#1d4ed8' } });
    store.getState().updateLayout({ tokens: undefined });
    expect(yLayout()?.has('tokens')).toBe(true);
  });

  test('clearLayoutKey removes tokens from state and Y.js, leaving other keys', () => {
    const { store, yLayout } = setup();
    store.getState().updateLayout({ tokens: { version: 1, primaryColor: '#1d4ed8' }, spacing: 'compact' });
    store.getState().clearLayoutKey('tokens');
    expect('tokens' in store.getState().layout).toBe(false);
    expect(store.getState().layout.spacing).toBe('compact');
    expect(yLayout()?.has('tokens')).toBe(false);
    expect(yLayout()?.get('spacing')).toBe('compact');
  });

  test('clearLayoutKey works without a Y.js layout map', () => {
    const { store } = setup();
    expect(() => store.getState().clearLayoutKey('tokens')).not.toThrow();
  });
});
