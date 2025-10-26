import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormCard } from '../FormCard';
import type { FormsListItem } from '../../../hooks/useFormsDashboard';
import { TranslationProvider } from '../../../i18n';

const baseForm: FormsListItem = {
  id: 'form-123',
  title: 'Customer Feedback',
  description: 'Collect feedback from customers',
  shortUrl: 'feedback-form',
  isPublished: true,
  responseCount: 12,
  createdAt: '2025-01-01T12:00:00.000Z',
  updatedAt: '2025-01-05T08:30:00.000Z',
  metadata: {
    pageCount: 3,
    fieldCount: 9,
    lastUpdated: '2025-01-06T11:45:00.000Z',
    backgroundImageUrl: null,
    backgroundImageKey: null,
  },
  userPermission: 'EDITOR',
};

const renderFormCard = (
  overrideProps: Partial<ComponentProps<typeof FormCard>> = {},
) => {
  const onOpenDashboard = jest.fn();
  const onOpenBuilder = jest.fn();
  const onOpenPreview = jest.fn();

  render(
    <TranslationProvider>
      <FormCard
        form={baseForm}
        showPermissionBadge={false}
        onOpenDashboard={onOpenDashboard}
        onOpenBuilder={onOpenBuilder}
        onOpenPreview={onOpenPreview}
        {...overrideProps}
      />
    </TranslationProvider>,
  );

  return { onOpenDashboard, onOpenBuilder, onOpenPreview };
};

describe('FormCard', () => {
  it('renders key form details and responds to card clicks', async () => {
    const user = userEvent.setup();
    const { onOpenDashboard } = renderFormCard();

    expect(
      screen.getByRole('button', {
        name: /open dashboard for customer feedback/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Customer Feedback')).toBeInTheDocument();
    expect(
      screen.getByText('Collect feedback from customers'),
    ).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('12 responses')).toBeInTheDocument();
    expect(screen.getByText('3 pages · 9 fields')).toBeInTheDocument();
    expect(screen.getByText(/Updated/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: /open dashboard for customer feedback/i,
      }),
    );

    expect(onOpenDashboard).toHaveBeenCalledWith('form-123');
  });

  it('invokes action buttons without triggering the card click handler', async () => {
    const user = userEvent.setup();
    const { onOpenDashboard, onOpenBuilder, onOpenPreview } = renderFormCard();

    await user.click(
      screen.getByRole('button', { name: 'Open dashboard' }),
    );
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /edit form/i }));
    expect(onOpenBuilder).toHaveBeenCalledWith('form-123');
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /preview form/i }));
    expect(onOpenPreview).toHaveBeenCalledWith(baseForm);
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);
  });

  it('disables preview when the form is not published', async () => {
    const user = userEvent.setup();
    const { onOpenPreview } = renderFormCard({
      form: { ...baseForm, isPublished: false },
    });

    const previewButton = screen.getByRole('button', {
      name: /preview unavailable/i,
    });
    expect(previewButton).toBeDisabled();

    await user.click(previewButton);
    expect(onOpenPreview).not.toHaveBeenCalled();
  });

  it('shows a permission badge when enabled', () => {
    renderFormCard({ showPermissionBadge: true });

    expect(screen.getByText('editor')).toBeInTheDocument();
  });

  it('falls back to the unknown date label when last updated is invalid', () => {
    renderFormCard({
      form: {
        ...baseForm,
        metadata: { ...baseForm.metadata, lastUpdated: 'invalid date' },
      },
    });

    expect(screen.getByText(/Updated Unknown/i)).toBeInTheDocument();
  });

  it('supports keyboard activation via Enter and Space keys', async () => {
    const user = userEvent.setup();
    const { onOpenDashboard } = renderFormCard();
    const card = screen.getByRole('button', {
      name: /open dashboard for customer feedback/i,
    });

    card.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onOpenDashboard).toHaveBeenCalledTimes(2);
  });
});
