import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

jest.mock('../../../i18n', () => ({
  useTranslate: jest.fn(),
}));

import { StatsGrid } from '../StatsGrid';
import { useTranslate } from '../../../i18n';

const mockUseTranslate = useTranslate as unknown as jest.MockedFunction<
  typeof useTranslate
>;

const buildStats = (
  overrides: Partial<ComponentProps<typeof StatsGrid>['stats']> = {},
) => ({
  totalResponses: 120,
  responseRate: '45%',
  averageCompletionTime: '02:30',
  responsesToday: 8,
  responsesThisWeek: 30,
  ...overrides,
});

describe('StatsGrid', () => {
  beforeEach(() => {
    mockUseTranslate.mockReturnValue(
      (key: string, replacements?: Record<string, unknown>) =>
        replacements ? `${key}:${JSON.stringify(replacements)}` : key,
    );
  });

  it('renders stat cards with formatted values', () => {
    render(<StatsGrid stats={buildStats()} />);

    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('02:30')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    expect(
      screen.getByText('formDashboard.stats.totalResponses.subtitle:{"count":8}'),
    ).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('8%')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('omits response trend badge when there are no new responses today', () => {
    render(<StatsGrid stats={buildStats({ responsesToday: 0 })} />);

    expect(screen.queryByText('12%')).not.toBeInTheDocument();
  });
});
