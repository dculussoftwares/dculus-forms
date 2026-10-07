import { render, screen, fireEvent } from '@testing-library/react';
import AccessControlSettings from '../AccessControlSettings';
import mockEnAccessControl from '../../../locales/en/accessControlSettings.json';

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      let node: unknown = mockEnAccessControl;
      for (const segment of key.split('.')) {
        node = node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
      }
      return typeof node === 'string' ? node : key;
    },
  }),
}));

jest.mock('@dculus/ui', () => {
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
    toastError: jest.fn(),
  };
});

const renderPanel = (overrides: Partial<React.ComponentProps<typeof AccessControlSettings>> = {}) => {
  const props: React.ComponentProps<typeof AccessControlSettings> = {
    settings: { enabled: false, requireSignIn: false, allowedDomains: [] },
    collectRespondentEmail: false,
    isSaving: false,
    onUpdate: jest.fn(),
    onUpdateCollectRespondentEmail: jest.fn(),
    saveProgressEnabled: true,
    onUpdateSaveProgress: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
  render(<AccessControlSettings {...props} />);
  return props;
};

describe('AccessControlSettings — save progress', () => {
  it('hides the toggle on anonymous forms, where drafts cannot exist', () => {
    renderPanel();
    expect(screen.queryByTestId('save-progress-checkbox')).not.toBeInTheDocument();
  });

  it('shows the effective state once respondents are signed in', () => {
    renderPanel({ collectRespondentEmail: true, saveProgressEnabled: true });
    expect(screen.getByTestId('save-progress-checkbox')).toBeChecked();
    expect(screen.getByText(mockEnAccessControl.saveProgress.title)).toBeInTheDocument();
  });

  it('reports the new value when toggled off', () => {
    const props = renderPanel({
      settings: { enabled: true, requireSignIn: true, allowedDomains: [] },
      saveProgressEnabled: true,
    });
    fireEvent.click(screen.getByTestId('save-progress-checkbox'));
    expect(props.onUpdateSaveProgress).toHaveBeenCalledWith(false);
  });
});
