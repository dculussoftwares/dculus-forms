import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../i18n', () => ({
  useTranslate: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

import { QuickActions } from '../QuickActions';
import { useNavigate } from 'react-router-dom';
import { useTranslate } from '../../../i18n';

const mockUseNavigate = useNavigate as jest.MockedFunction<typeof useNavigate>;
const mockUseTranslate = useTranslate as unknown as jest.MockedFunction<
  typeof useTranslate
>;

describe('QuickActions', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslate.mockReturnValue((key: string) => key);
    mockUseNavigate.mockReturnValue(jest.fn());
  });

  it('renders all action cards with translated text', () => {
    render(<QuickActions formId="form-123" />);

    const titles = [
      'formDashboard.quickActions.collaborate.title',
      'formDashboard.quickActions.responses.title',
      'formDashboard.quickActions.analytics.title',
      'formDashboard.quickActions.plugins.title',
      'formDashboard.quickActions.settings.title',
    ];

    for (const title of titles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    expect(
      screen.getByText('formDashboard.quickActions.sectionTitle'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('formDashboard.quickActions.sectionDescription'),
    ).toBeInTheDocument();
  });

  it('navigates to the correct route when an action is clicked', async () => {
    const navigateSpy = jest.fn();
    mockUseNavigate.mockReturnValue(navigateSpy);
    render(<QuickActions formId="abc" />);

    await user.click(
      screen.getByText('formDashboard.quickActions.analytics.title'),
    );

    expect(navigateSpy).toHaveBeenCalledWith('/dashboard/form/abc/analytics');
  });
});
