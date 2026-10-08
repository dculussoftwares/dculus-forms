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
    respondentOptions: { saveProgress: true, oneResponsePerRespondent: false, allowRespondentEdit: false },
    isQuiz: false,
    onUpdateRespondentOptions: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
  render(<AccessControlSettings {...props} />);
  return props;
};

const signInRequired = { enabled: true, requireSignIn: true, allowedDomains: [] };

describe('AccessControlSettings — respondent options', () => {
  it('offers only save progress on forms that do not require sign-in, where respondents are unknown', () => {
    renderPanel();
    expect(screen.getByTestId('save-progress-checkbox')).toBeChecked();
    expect(screen.getByText(mockEnAccessControl.saveProgress.descriptionOptionalSignIn)).toBeInTheDocument();
    expect(screen.queryByTestId('one-response-per-respondent-checkbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('allow-respondent-edit-checkbox')).not.toBeInTheDocument();
  });

  it('shows the effective state once respondents are signed in', () => {
    renderPanel({
      collectRespondentEmail: true,
      respondentOptions: { saveProgress: true, oneResponsePerRespondent: true, allowRespondentEdit: false },
    });
    expect(screen.getByTestId('save-progress-checkbox')).toBeChecked();
    expect(screen.getByTestId('one-response-per-respondent-checkbox')).toBeChecked();
    expect(screen.getByTestId('allow-respondent-edit-checkbox')).not.toBeChecked();
    expect(screen.getByText(mockEnAccessControl.saveProgress.title)).toBeInTheDocument();
  });

  it('reports each change as a settings patch', () => {
    const props = renderPanel({ settings: signInRequired });
    fireEvent.click(screen.getByTestId('save-progress-checkbox'));
    fireEvent.click(screen.getByTestId('one-response-per-respondent-checkbox'));
    fireEvent.click(screen.getByTestId('allow-respondent-edit-checkbox'));
    expect(props.onUpdateRespondentOptions).toHaveBeenNthCalledWith(1, { saveProgress: { enabled: false } });
    expect(props.onUpdateRespondentOptions).toHaveBeenNthCalledWith(2, { oneResponsePerRespondent: true });
    expect(props.onUpdateRespondentOptions).toHaveBeenNthCalledWith(3, { allowRespondentEdit: true });
  });

  it('locks respondent edits off on quiz forms and says why', () => {
    renderPanel({
      settings: signInRequired,
      isQuiz: true,
      respondentOptions: { saveProgress: true, oneResponsePerRespondent: false, allowRespondentEdit: true },
    });
    const toggle = screen.getByTestId('allow-respondent-edit-checkbox');
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(mockEnAccessControl.allowRespondentEdit.unavailableForQuiz)).toBeInTheDocument();
  });
});
