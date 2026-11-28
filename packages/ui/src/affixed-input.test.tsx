import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AffixedTextarea } from './affixed-input';

const classOf = (html: string, tag: 'div' | 'textarea') =>
  html.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`))?.[1] ?? '';

describe('AffixedTextarea', () => {
  it('puts className on the frame and controlClassName on the textarea when addons are present', () => {
    const html = renderToStaticMarkup(
      <AffixedTextarea prefixText="$" className="frame-token" controlClassName="control-size" />
    );
    expect(classOf(html, 'div')).toContain('frame-token');
    expect(classOf(html, 'div')).not.toContain('control-size');
    expect(classOf(html, 'textarea')).toContain('control-size');
    expect(classOf(html, 'textarea')).not.toContain('frame-token');
  });

  it('applies both class names to the textarea without addons', () => {
    const html = renderToStaticMarkup(<AffixedTextarea className="frame-token" controlClassName="control-size" />);
    expect(classOf(html, 'textarea')).toContain('frame-token');
    expect(classOf(html, 'textarea')).toContain('control-size');
  });
});
