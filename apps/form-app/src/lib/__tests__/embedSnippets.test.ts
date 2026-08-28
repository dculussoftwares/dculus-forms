import {
  buildEmbedUrl,
  buildFormUrl,
  buildPlatformSnippet,
  buildSnippet,
  platformsForType,
  resolveEmbedSettings,
  DEFAULT_BUTTON_LABEL,
  type SnippetContext,
} from '../embedSnippets';

const ctx = (overrides: Partial<SnippetContext['settings']> = {}): SnippetContext => ({
  viewerOrigin: 'https://forms.dculus.com',
  shortUrl: 'aB3xY9',
  formTitle: 'Customer feedback',
  settings: resolveEmbedSettings({ ...overrides }),
});

describe('resolveEmbedSettings', () => {
  test('clamps a fixed height into the range the input advertises', () => {
    // `min`/`max` on a number input only style the spinner; a typed or pasted
    // value still lands in state, and from there in the saved snippet.
    expect(resolveEmbedSettings({ heightPx: 4 }).heightPx).toBe(200);
    expect(resolveEmbedSettings({ heightPx: 99999 }).heightPx).toBe(4000);
    expect(resolveEmbedSettings({ heightPx: 850 }).heightPx).toBe(850);
    expect(resolveEmbedSettings({ heightPx: Number.NaN }).heightPx).toBe(600);
  });

  test('an absent embed config resolves to the documented defaults', () => {
    expect(resolveEmbedSettings(undefined)).toEqual({
      type: 'inline',
      width: '100%',
      heightMode: 'auto',
      heightPx: 600,
      transparentBackground: true,
      closeOnSubmit: true,
      buttonLabel: DEFAULT_BUTTON_LABEL,
    });
  });

  test('a whitespace-only button label falls back rather than producing an empty button', () => {
    expect(resolveEmbedSettings({ buttonLabel: '   ' }).buttonLabel).toBe(DEFAULT_BUTTON_LABEL);
  });

  test('explicit values win over defaults', () => {
    const resolved = resolveEmbedSettings({ width: '640px', heightMode: 'fixed', heightPx: 800 });
    expect(resolved.width).toBe('640px');
    expect(resolved.heightMode).toBe('fixed');
    expect(resolved.heightPx).toBe(800);
  });
});

describe('URLs', () => {
  test('the link snippet is the hosted form URL, not the builder URL', () => {
    expect(buildFormUrl(ctx())).toBe('https://forms.dculus.com/f/aB3xY9');
    expect(buildSnippet(ctx(), 'link')).toBe('https://forms.dculus.com/f/aB3xY9');
  });

  test('the embed URL always carries an explicit pixel height, even in auto mode', () => {
    // The no-JS iframe has nothing to resize it, so "fit content" still has to
    // resolve to a number here.
    const url = new URL(buildEmbedUrl(ctx({ heightMode: 'auto' })));
    expect(url.pathname).toBe('/embed/aB3xY9');
    expect(url.searchParams.get('mode')).toBe('iframe');
    expect(url.searchParams.get('h')).toBe('600');
    expect(url.searchParams.get('bg')).toBe('transparent');
  });

  test('a white background is carried into the embed URL', () => {
    const url = new URL(buildEmbedUrl(ctx({ transparentBackground: false })));
    expect(url.searchParams.get('bg')).toBe('white');
  });
});

describe('buildSnippet', () => {
  test('inline is the default and includes the loader plus a noscript fallback', () => {
    const snippet = buildSnippet(ctx(), 'inline');
    expect(snippet).toContain('data-dculus-form="aB3xY9"');
    expect(snippet).toContain('data-dculus-mode="inline"');
    expect(snippet).toContain('<script src="https://forms.dculus.com/embed.js" async></script>');
    expect(snippet).toContain('<noscript><a href="https://forms.dculus.com/f/aB3xY9">');
  });

  test('default options are omitted from the snippet', () => {
    const snippet = buildSnippet(ctx(), 'inline');
    expect(snippet).not.toContain('data-dculus-width');
    expect(snippet).not.toContain('data-dculus-height');
    expect(snippet).not.toContain('data-dculus-bg');
  });

  test('non-default options are emitted', () => {
    const snippet = buildSnippet(
      ctx({ width: '640px', heightMode: 'fixed', heightPx: 500, transparentBackground: false }),
      'inline'
    );
    expect(snippet).toContain('data-dculus-width="640px"');
    expect(snippet).toContain('data-dculus-height="500"');
    expect(snippet).toContain('data-dculus-bg="white"');
  });

  test('lightbox carries its trigger label', () => {
    const snippet = buildSnippet(ctx({ buttonLabel: 'Give feedback' }), 'lightbox');
    expect(snippet).toContain('data-dculus-mode="lightbox"');
    expect(snippet).toContain('data-dculus-label="Give feedback"');
  });

  test('lightbox carries the form title, so the overlay has a real accessible name', () => {
    const snippet = buildSnippet(ctx(), 'lightbox');
    expect(snippet).toContain('data-dculus-title="Customer feedback"');
  });

  test('inline does not carry a title — only the lightbox renders a dialog', () => {
    expect(buildSnippet(ctx(), 'inline')).not.toContain('data-dculus-title');
  });

  test('lightbox only spells out close-on-submit when it is turned off', () => {
    expect(buildSnippet(ctx({ closeOnSubmit: true }), 'lightbox')).not.toContain(
      'data-dculus-close-on-submit'
    );
    expect(buildSnippet(ctx({ closeOnSubmit: false }), 'lightbox')).toContain(
      'data-dculus-close-on-submit="false"'
    );
  });

  test('the plain iframe pins width and height and needs no script', () => {
    const snippet = buildSnippet(ctx({ heightMode: 'fixed', heightPx: 600 }), 'iframe');
    expect(snippet).toContain('height:600px');
    expect(snippet).toContain('width:100%');
    expect(snippet).toContain('title="Customer feedback"');
    expect(snippet).not.toContain('<script');
  });

  test('the button opens in a new tab with rel=noopener', () => {
    const snippet = buildSnippet(ctx({ buttonLabel: 'Open the form' }), 'button');
    expect(snippet).toContain('href="https://forms.dculus.com/f/aB3xY9"');
    expect(snippet).toContain('target="_blank"');
    expect(snippet).toContain('rel="noopener"');
  });
});

describe('escaping', () => {
  test('quotes in a label do not break out of the attribute', () => {
    const snippet = buildSnippet(ctx({ buttonLabel: 'Say "hello"' }), 'lightbox');
    expect(snippet).toContain('data-dculus-label="Say &quot;hello&quot;"');
    expect(snippet).not.toContain('data-dculus-label="Say "hello""');
  });

  test('angle brackets in a label cannot open a tag', () => {
    const snippet = buildSnippet(ctx({ buttonLabel: '<script>x</script>' }), 'button');
    expect(snippet).not.toContain('<script>x</script>');
    expect(snippet).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  test('a title with quotes stays inside the iframe title attribute', () => {
    const withTitle: SnippetContext = { ...ctx(), formTitle: 'The "big" survey' };
    expect(buildSnippet(withTitle, 'iframe')).toContain('title="The &quot;big&quot; survey"');
  });
});

describe('platform variants', () => {
  test('WordPress and Webflow take the identical HTML', () => {
    const c = ctx();
    const html = buildPlatformSnippet(c, 'html', 'inline');
    expect(buildPlatformSnippet(c, 'wordpress', 'inline')).toBe(html);
    expect(buildPlatformSnippet(c, 'webflow', 'inline')).toBe(html);
  });

  test('React injects the loader once and re-scans for late-mounted containers', () => {
    const snippet = buildPlatformSnippet(ctx(), 'react', 'inline');
    expect(snippet).toContain("const SRC = 'https://forms.dculus.com/embed.js'");
    expect(snippet).toContain('window.dculusForms?.refresh()');
    expect(snippet).toContain('data-dculus-form={"aB3xY9"}');
  });

  test('React props are JSON-quoted, so a label with quotes survives', () => {
    const snippet = buildPlatformSnippet(ctx({ buttonLabel: 'Say "hi"' }), 'react', 'lightbox');
    expect(snippet).toContain('data-dculus-label={"Say \\"hi\\""}');
  });

  test('a bare link has no platform variants; JS embeds have all four', () => {
    expect(platformsForType('link')).toEqual([]);
    expect(platformsForType('iframe')).toEqual(['html', 'wordpress', 'webflow']);
    expect(platformsForType('inline')).toEqual(['html', 'wordpress', 'react', 'webflow']);
  });
});
