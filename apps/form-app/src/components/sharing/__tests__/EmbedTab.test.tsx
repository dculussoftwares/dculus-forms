import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmbedTab } from '../EmbedTab';
import mockEnEmbed from '../../../locales/en/embed.json';

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: (namespace: string) => ({
    t: (key: string) => {
      const messages: Record<string, unknown> = { embed: mockEnEmbed };
      let node: unknown = messages[namespace];
      for (const segment of key.split('.')) {
        node = node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
      }
      return typeof node === 'string' ? node : key;
    },
  }),
}));

// Overrides the partial global mock in setupTests. Written out rather than
// spread over `requireActual`, because the real barrel pulls in
// react-resizable-panels, which ships ESM that this jest config does not
// transform — nothing to do with what is under test here.
jest.mock('@dculus/ui', () => {
  // jest.requireActual, not a bare require: a mock factory is hoisted above the
  // imports so it cannot close over the file's React binding, and the repo's
  // eslint config forbids require() style imports.
  const React = jest.requireActual('react');
  const passthrough =
    (tag: string) =>
    ({ children, ...props }: any) =>
      React.createElement(tag, props, children);

  return {
    Button: passthrough('button'),
    Input: (props: any) => React.createElement('input', props),
    Label: passthrough('label'),
    Switch: ({ checked, onCheckedChange, ...props }: any) =>
      React.createElement('input', {
        type: 'checkbox',
        checked,
        onChange: (e: any) => onCheckedChange?.(e.target.checked),
        ...props,
      }),
    RadioGroup: passthrough('div'),
    RadioGroupItem: (props: any) => React.createElement('input', { type: 'radio', ...props }),
    Tabs: passthrough('div'),
    TabsList: passthrough('div'),
    TabsTrigger: passthrough('button'),
    Tooltip: passthrough('div'),
    TooltipTrigger: passthrough('div'),
    TooltipContent: passthrough('div'),
    TooltipProvider: passthrough('div'),
    toastSuccess: jest.fn(),
    toastError: jest.fn(),
  };
});

// The preview mounts a live iframe against the form-viewer origin, which is
// neither available nor relevant here.
jest.mock('../EmbedPreview', () => ({
  EmbedPreview: () => <div data-testid="embed-preview-stub" />,
}));

const baseProps = {
  viewerOrigin: 'https://forms.dculus.com',
  shortUrl: 'aB3xY9',
  formTitle: 'Customer feedback',
  isPublished: true,
  pageCount: 1,
  accessControlEnabled: false,
  collectRespondentEmail: false,
  canEdit: true,
};

function setClipboard(writeText: jest.Mock | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
}

describe('EmbedTab — copy persists the configuration', () => {
  afterEach(() => {
    setClipboard(jest.fn().mockResolvedValue(undefined));
    jest.clearAllMocks();
  });

  it('saves the configuration when the snippet is copied', async () => {
    setClipboard(jest.fn().mockResolvedValue(undefined));
    const onPersist = jest.fn().mockResolvedValue(undefined);

    render(<EmbedTab {...baseProps} onPersist={onPersist} />);
    fireEvent.click(screen.getByTestId('embed-copy-snippet'));

    await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1));
    expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({ type: 'inline' }));
  });

  it('still saves when the clipboard is unavailable', async () => {
    // `navigator.clipboard` is absent in a non-secure context and can be denied
    // by permission policy. The owner has still told us which configuration
    // they want, and chaining the save to the clipboard silently discarded it —
    // they would reopen the panel to find none of their choices remembered.
    setClipboard(undefined);
    const onPersist = jest.fn().mockResolvedValue(undefined);

    render(<EmbedTab {...baseProps} onPersist={onPersist} />);
    fireEvent.click(screen.getByTestId('embed-copy-snippet'));

    await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1));
  });

  it('still saves when the clipboard write is rejected', async () => {
    setClipboard(jest.fn().mockRejectedValue(new Error('denied')));
    const onPersist = jest.fn().mockResolvedValue(undefined);

    render(<EmbedTab {...baseProps} onPersist={onPersist} />);
    fireEvent.click(screen.getByTestId('embed-copy-snippet'));

    await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1));
  });

  it('does not save for someone who cannot edit the form', async () => {
    setClipboard(jest.fn().mockResolvedValue(undefined));
    const onPersist = jest.fn().mockResolvedValue(undefined);

    render(<EmbedTab {...baseProps} canEdit={false} onPersist={onPersist} />);
    fireEvent.click(screen.getByTestId('embed-copy-snippet'));

    // A VIEWER can still take a snippet; they just cannot change the form.
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(onPersist).not.toHaveBeenCalled();
  });
});

describe('EmbedTab — the gated-form boundary', () => {
  beforeEach(() => setClipboard(jest.fn().mockResolvedValue(undefined)));

  it('disables the framed types and preselects Button when sign-in is required', () => {
    render(
      <EmbedTab {...baseProps} accessControlEnabled onPersist={jest.fn()} />
    );

    for (const type of ['inline', 'lightbox', 'iframe']) {
      expect(screen.getByTestId(`embed-type-${type}`)).toBeDisabled();
    }
    expect(screen.getByTestId('embed-type-button')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('embed-gated-warning')).toBeInTheDocument();
  });

  it('applies the same boundary when only a verified email is collected', () => {
    render(<EmbedTab {...baseProps} collectRespondentEmail onPersist={jest.fn()} />);
    expect(screen.getByTestId('embed-type-inline')).toBeDisabled();
  });

  it('leaves every type available for an ungated form', () => {
    render(<EmbedTab {...baseProps} onPersist={jest.fn()} />);
    for (const type of ['inline', 'lightbox', 'iframe', 'button']) {
      expect(screen.getByTestId(`embed-type-${type}`)).not.toBeDisabled();
    }
    expect(screen.queryByTestId('embed-gated-warning')).not.toBeInTheDocument();
  });
});

describe('EmbedTab — contextual warnings', () => {
  beforeEach(() => setClipboard(jest.fn().mockResolvedValue(undefined)));

  it('warns about a draft form', () => {
    render(<EmbedTab {...baseProps} isPublished={false} onPersist={jest.fn()} />);
    expect(screen.getByTestId('embed-draft-warning')).toBeInTheDocument();
  });

  it('says nothing about drafts once the form is published', () => {
    render(<EmbedTab {...baseProps} onPersist={jest.fn()} />);
    expect(screen.queryByTestId('embed-draft-warning')).not.toBeInTheDocument();
  });

  it('warns about a fixed height only on a multi-page form', () => {
    const { rerender } = render(
      <EmbedTab {...baseProps} pageCount={3} embed={{ heightMode: 'fixed' }} onPersist={jest.fn()} />
    );
    expect(screen.getByTestId('embed-fixed-height-warning')).toBeInTheDocument();

    // One page cannot overflow a frame sized for it, so the warning would be noise.
    rerender(
      <EmbedTab {...baseProps} pageCount={1} embed={{ heightMode: 'fixed' }} onPersist={jest.fn()} />
    );
    expect(screen.queryByTestId('embed-fixed-height-warning')).not.toBeInTheDocument();
  });

  it('says nothing about height when the frame fits its content', () => {
    render(<EmbedTab {...baseProps} pageCount={3} onPersist={jest.fn()} />);
    expect(screen.queryByTestId('embed-fixed-height-warning')).not.toBeInTheDocument();
  });
});
