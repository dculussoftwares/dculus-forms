import { isToolFailed, isToolSettled } from '../aiAgentTypes';

describe('AI tool part status helpers', () => {
  it('treats a tool that returned { error } as failed, not as a change', () => {
    const part = { state: 'output-available', output: { error: 'Field f-9 not found' } };
    expect(isToolSettled(part)).toBe(true);
    expect(isToolFailed(part)).toBe(true);
  });

  it('treats an SDK execution error as settled and failed', () => {
    const part = { state: 'output-error', errorText: 'boom' };
    expect(isToolSettled(part)).toBe(true);
    expect(isToolFailed(part)).toBe(true);
  });

  it('treats an operation output as a successful step', () => {
    const part = { state: 'output-available', output: { type: 'ADD_FIELD' } };
    expect(isToolSettled(part)).toBe(true);
    expect(isToolFailed(part)).toBe(false);
  });

  it('treats in-flight parts as unsettled', () => {
    expect(isToolSettled({ state: 'input-streaming' })).toBe(false);
    expect(isToolSettled({ state: 'input-available' })).toBe(false);
    expect(isToolFailed({ state: 'input-available' })).toBe(false);
  });
});
