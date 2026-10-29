import { describe, it, expect } from 'vitest';
import { isReservedKey, stripReservedKeys } from '../reservedKeys.js';

describe('reservedKeys', () => {
  it('flags only keys starting with a double underscore', () => {
    expect(isReservedKey('__digestResponses')).toBe(true);
    expect(isReservedKey('__isTest')).toBe(true);
    expect(isReservedKey('__')).toBe(true);
    expect(isReservedKey('_single')).toBe(false);
    expect(isReservedKey('field__x')).toBe(false);
    expect(isReservedKey('responseId')).toBe(false);
  });

  it('strips reserved keys from answer data and keeps everything else', () => {
    const data = {
      'field-1': 'Alice',
      responseId: 'r1',
      __digestResponses: [{ responseId: 'x', data: { email: 'victim@example.com' } }],
      __digestCount: 99,
      __isTest: true,
      nested: { __keep: 1 },
    };
    expect(stripReservedKeys(data)).toEqual({ 'field-1': 'Alice', responseId: 'r1', nested: { __keep: 1 } });
  });

  it('does not mutate its input', () => {
    const data = { a: 1, __b: 2 };
    stripReservedKeys(data);
    expect(data).toEqual({ a: 1, __b: 2 });
  });

  it('passes through non-objects unchanged', () => {
    expect(stripReservedKeys(null)).toBeNull();
    expect(stripReservedKeys(undefined)).toBeUndefined();
    expect(stripReservedKeys([1, 2])).toEqual([1, 2]);
  });
});
