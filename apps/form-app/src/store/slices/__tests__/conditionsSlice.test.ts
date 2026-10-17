/**
 * Condition writes report whether they reached the shared document, and never
 * touch local state when they didn't. Runs against a real Y.Doc.
 */
jest.unmock('@dculus/types');
jest.unmock('zustand');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
import type { ConditionalRule } from '@dculus/types';
import { createConditionsSlice } from '../conditionsSlice';

const rule = (id: string, overrides: Partial<ConditionalRule> = {}): ConditionalRule => ({
  id,
  enabled: true,
  combinator: 'all',
  terms: [{ fieldId: 'f1', operator: 'equals', value: 'x' }],
  actions: [{ type: 'showField', fieldIds: ['f2'] }],
  ...overrides,
});

function setup(ready = true) {
  const ydoc = new Y.Doc();
  const store = create<any>()((set, get) => ({
    _getYDoc: () => ydoc,
    _isYJSReady: () => ready,
    ...createConditionsSlice(set, get),
  }));
  const yjsIds = () => {
    const arr = ydoc.getMap('formSchema').get('conditions') as Y.Array<any> | undefined;
    return arr ? arr.toArray().map((entry) => entry.id) : [];
  };
  return { store, yjsIds, state: () => store.getState() };
}

describe('conditionsSlice writes', () => {
  it('addCondition writes Y.js and local state', () => {
    const { state, yjsIds } = setup();
    expect(state().addCondition(rule('a'))).toBe(true);
    expect(state().conditions.map((r: ConditionalRule) => r.id)).toEqual(['a']);
    expect(yjsIds()).toEqual(['a']);
  });

  it('adding the same id twice leaves a single entry on both sides', () => {
    const { state, yjsIds } = setup();
    state().addCondition(rule('a'));
    expect(state().addCondition(rule('a'))).toBe(true);
    expect(state().conditions).toHaveLength(1);
    expect(yjsIds()).toEqual(['a']);
  });

  it('does not touch local state when collaboration is not ready', () => {
    const { state, yjsIds } = setup(false);
    expect(state().addCondition(rule('a'))).toBe(false);
    expect(state().conditions).toEqual([]);
    expect(yjsIds()).toEqual([]);
  });

  it('update and remove are no-ops that return false when not ready', () => {
    const ready = setup();
    ready.state().addCondition(rule('a'));
    // Same store, but the connection drops.
    const offline = create<any>()((set, get) => ({
      _getYDoc: () => null,
      _isYJSReady: () => false,
      ...createConditionsSlice(set, get),
      conditions: [rule('a')],
    }));
    expect(offline.getState().updateCondition('a', rule('a', { enabled: false }))).toBe(false);
    expect(offline.getState().removeCondition('a')).toBe(false);
    expect(offline.getState().setConditionEnabled('a', false)).toBe(false);
    expect(offline.getState().conditions).toEqual([rule('a')]);
  });

  it('updateCondition replaces in place and keeps order', () => {
    const { state, yjsIds } = setup();
    state().addCondition(rule('a'));
    state().addCondition(rule('b'));
    expect(state().updateCondition('a', rule('a', { combinator: 'any' }))).toBe(true);
    expect(yjsIds()).toEqual(['a', 'b']);
    expect(state().conditions[0].combinator).toBe('any');
  });

  it('updateCondition on a missing rule returns false and does not resurrect it', () => {
    const { state, yjsIds } = setup();
    state().addCondition(rule('a'));
    expect(state().removeCondition('a')).toBe(true);
    expect(state().updateCondition('a', rule('a'))).toBe(false);
    expect(state().conditions).toEqual([]);
    expect(yjsIds()).toEqual([]);
  });

  it('setConditionEnabled reports success and failure', () => {
    const { state } = setup();
    state().addCondition(rule('a'));
    expect(state().setConditionEnabled('a', false)).toBe(true);
    expect(state().conditions[0].enabled).toBe(false);
    expect(state().setConditionEnabled('missing', true)).toBe(false);
  });
});
