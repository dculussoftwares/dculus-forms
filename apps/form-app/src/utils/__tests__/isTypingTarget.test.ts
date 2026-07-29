import { isTypingTarget } from '../isTypingTarget';

describe('isTypingTarget', () => {
  it('returns false for null', () => {
    expect(isTypingTarget(null)).toBe(false);
  });

  it('returns true for an INPUT element', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
  });

  it('returns true for a TEXTAREA element', () => {
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
  });

  it('returns true for a contentEditable element', () => {
    const div = document.createElement('div');
    // jsdom doesn't implement isContentEditable as a reflected property (it
    // requires layout), so stub the getter directly rather than relying on
    // `div.contentEditable = 'true'`.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isTypingTarget(div)).toBe(true);
  });

  it('returns false for an ordinary, non-editable element', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
  });
});
