import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

jest.mock('../../../i18n', () => ({
  useTranslate: jest.fn(),
}));

import { FormHeader } from '../FormHeader';
import { useTranslate } from '../../../i18n';

const mockUseTranslate = useTranslate as unknown as jest.MockedFunction<
  typeof useTranslate
>;

const baseForm = {
  id: 'form-1',
  title: 'Demo Form',
  description: 'Sample description',
  isPublished: true,
  createdAt: '1700000000000',
  shortUrl: 'demo',
};

const renderHeader = (props: Partial<ComponentProps<typeof FormHeader>> = {}) => {
  const onPublish = jest.fn();
  const onUnpublish = jest.fn();
  const onDelete = jest.fn();
  const onCollectResponses = jest.fn();
  const onPreview = jest.fn();
  const onViewAnalytics = jest.fn();
  const onShare = jest.fn();

  render(
    <FormHeader
      form={baseForm}
      onPublish={onPublish}
      onUnpublish={onUnpublish}
      onDelete={onDelete}
      onCollectResponses={onCollectResponses}
      onPreview={onPreview}
      onViewAnalytics={onViewAnalytics}
      onShare={onShare}
      updateLoading={false}
      deleteLoading={false}
      {...props}
    />,
  );

  return {
    onPublish,
    onUnpublish,
    onDelete,
    onCollectResponses,
    onPreview,
    onViewAnalytics,
    onShare,
  };
};

describe('FormHeader', () => {
  const user = userEvent.setup();
  let dateSpy: jest.SpyInstance<string, Parameters<Date['toLocaleDateString']>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslate.mockReturnValue(
      (key: string, replacements?: Record<string, unknown>) =>
        replacements ? `${key}:${JSON.stringify(replacements)}` : key,
    );
    dateSpy = jest
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('Mock Date');
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('renders published state actions and fires callbacks', async () => {
    const callbacks = renderHeader();

    expect(screen.getByText('formDashboard.header.statusLive')).toBeInTheDocument();
    expect(screen.getByText('Mock Date')).toBeInTheDocument();

    await user.click(screen.getByText('formDashboard.header.getLink'));
    expect(callbacks.onCollectResponses).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('formDashboard.header.share'));
    expect(callbacks.onShare).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('formDashboard.header.preview'));
    expect(callbacks.onPreview).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('formDashboard.header.analytics'));
    expect(callbacks.onViewAnalytics).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('formDashboard.header.delete'));
    expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders draft state with fallback values and publish flow', async () => {
    const callbacks = renderHeader({
      form: {
        ...baseForm,
        isPublished: false,
        description: undefined,
        createdAt: 'not-a-date',
      },
    });

    expect(screen.getByText('formDashboard.header.statusDraft')).toBeInTheDocument();
    expect(
      screen.getByText('formDashboard.header.descriptionPlaceholder'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('formDashboard.header.dateUnavailable'),
    ).toBeInTheDocument();

    await user.click(screen.getByText('formDashboard.header.publish'));
    expect(callbacks.onPublish).toHaveBeenCalledTimes(1);
  });

  it('shows loading states when update or delete actions are pending', () => {
    renderHeader({
      updateLoading: true,
      deleteLoading: true,
    });

    expect(
      screen.getByText('formDashboard.header.unpublishing').closest('button'),
    ).toBeDisabled();
    expect(
      screen.getByText('formDashboard.header.deleting').closest('button'),
    ).toBeDisabled();
  });

  it('omits share button when handler is not provided', () => {
    renderHeader({
      onShare: undefined,
    });

    expect(
      screen.queryByText('formDashboard.header.share'),
    ).not.toBeInTheDocument();
  });
});
