import { render, screen, fireEvent } from '@testing-library/react';
import { TranslationProvider } from '../../i18n';
import { FormDashboard } from '../FormDashboard';

const mockUseFormDashboard = jest.fn();
jest.mock('../../hooks/useFormDashboard', () => ({
  useFormDashboard: (formId: string | undefined) =>
    mockUseFormDashboard(formId),
}));

const mockNavigate = jest.fn();
const mockUseParams = jest.fn(() => ({ formId: 'form-123' }));

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useNavigate: () => mockNavigate,
  };
});

jest.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

const formHeaderMock = jest.fn(
  ({
    form,
    onPublish,
    onUnpublish,
    onDelete,
    onCollectResponses,
    onPreview,
    onViewAnalytics,
    onShare,
  }) => (
    <div data-testid="form-header">
      <span>{form.title}</span>
      <button onClick={onPublish}>publish</button>
      <button onClick={onUnpublish}>unpublish</button>
      <button onClick={onDelete}>delete</button>
      <button onClick={onCollectResponses}>collect</button>
      <button onClick={onPreview}>preview</button>
      <button onClick={onViewAnalytics}>analytics</button>
      <button onClick={onShare}>share</button>
    </div>
  )
);

const statsGridMock = jest.fn(({ stats }) => (
  <div data-testid="stats-grid">
    <span>{stats.totalResponses}</span>
  </div>
));

const quickActionsMock = jest.fn(({ formId }) => (
  <div data-testid="quick-actions">{formId}</div>
));

const deleteDialogMock = jest.fn(
  ({ open, onOpenChange, onConfirm, formTitle, loading }) => (
    <div
      data-testid="delete-dialog"
      data-open={open ? 'true' : 'false'}
      data-title={formTitle}
      data-loading={loading ? 'true' : 'false'}
    >
      <button onClick={() => onOpenChange(!open)}>toggle-delete</button>
      <button onClick={onConfirm}>confirm-delete</button>
    </div>
  )
);

const unpublishDialogMock = jest.fn(
  ({ open, onOpenChange, onConfirm, formTitle, loading }) => (
    <div
      data-testid="unpublish-dialog"
      data-open={open ? 'true' : 'false'}
      data-title={formTitle}
      data-loading={loading ? 'true' : 'false'}
    >
      <button onClick={() => onOpenChange(!open)}>toggle-unpublish</button>
      <button onClick={onConfirm}>confirm-unpublish</button>
    </div>
  )
);

const collectDialogMock = jest.fn(
  ({
    open,
    onOpenChange,
    formUrl,
    formTitle,
    onCopyLink,
    onOpenForm,
  }) => (
    <div
      data-testid="collect-dialog"
      data-open={open ? 'true' : 'false'}
      data-form-url={formUrl}
      data-title={formTitle}
    >
      <button onClick={() => onOpenChange(!open)}>toggle-collect</button>
      <button onClick={onCopyLink}>copy-link</button>
      <button onClick={onOpenForm}>open-form-viewer</button>
    </div>
  )
);

jest.mock('../../components/form-dashboard', () => ({
  FormHeader: (props: any) => formHeaderMock(props),
  StatsGrid: (props: any) => statsGridMock(props),
  QuickActions: (props: any) => quickActionsMock(props),
  DeleteDialog: (props: any) => deleteDialogMock(props),
  UnpublishDialog: (props: any) => unpublishDialogMock(props),
  CollectResponsesDialog: (props: any) => collectDialogMock(props),
}));

const shareModalMock = jest.fn(
  ({ open, onOpenChange, formId, formTitle, shortUrl }) => (
    <div
      data-testid="share-modal"
      data-open={open ? 'true' : 'false'}
      data-form-id={formId}
      data-form-title={formTitle}
      data-short-url={shortUrl ?? ''}
    >
      <button onClick={() => onOpenChange(false)}>close-share</button>
    </div>
  )
);

jest.mock('../../components/form-dashboard/ShareModal', () => ({
  ShareModal: (props: any) => shareModalMock(props),
}));

const renderFormDashboard = () =>
  render(
    <TranslationProvider>
      <FormDashboard />
    </TranslationProvider>
  );

const createHookState = (overrides: Record<string, unknown> = {}) => ({
  form: {
    id: 'form-123',
    title: 'Test Form',
    shortUrl: 'share/test-form',
    isPublished: true,
    responseCount: 42,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  },
  dashboardStats: {
    totalResponses: 42,
    totalFields: 10,
    averageCompletionTime: '2 min',
    responseRate: '80%',
    responsesToday: 5,
    responsesThisWeek: 12,
  },
  formLoading: false,
  deleteLoading: false,
  updateLoading: false,
  formError: null,
  showDeleteDialog: false,
  setShowDeleteDialog: jest.fn(),
  showUnpublishDialog: false,
  setShowUnpublishDialog: jest.fn(),
  showCollectResponsesDialog: false,
  setShowCollectResponsesDialog: jest.fn(),
  handleDelete: jest.fn(),
  handlePublish: jest.fn(),
  handleUnpublish: jest.fn(),
  handleCollectResponses: jest.fn(),
  handleCopyLink: jest.fn(),
  handleOpenFormViewer: jest.fn(),
  ...overrides,
});

describe('FormDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ formId: 'form-123' });
    mockNavigate.mockReset();
    window.open = jest.fn();
  });

  it('renders loading skeleton when form data is loading', () => {
    mockUseFormDashboard.mockReturnValue(
      createHookState({
        formLoading: true,
      })
    );

    renderFormDashboard();

    expect(screen.getAllByTestId('skeleton')).toHaveLength(10);
  });

  it('renders an error state when form data is unavailable', () => {
    mockUseFormDashboard.mockReturnValue(
      createHookState({
        form: undefined,
        formError: new Error('not found'),
      })
    );

    renderFormDashboard();

    expect(screen.getByText('Form Not Found')).toBeInTheDocument();
    expect(
      screen.getByText(
        "The form you're looking for doesn't exist or you don't have permission to view it."
      )
    ).toBeInTheDocument();
  });

  it('renders dashboard content and wires primary interactions', () => {
    const handlePublish = jest.fn();
    const setShowUnpublishDialog = jest.fn();
    const setShowDeleteDialog = jest.fn();
    const setShowCollectResponsesDialog = jest.fn();
    const handleDelete = jest.fn();
    const handleCollectResponses = jest.fn();
    const handleCopyLink = jest.fn();
    const handleOpenFormViewer = jest.fn();
    const handleUnpublish = jest.fn();

    mockUseFormDashboard.mockImplementation(() =>
      createHookState({
        handlePublish,
        setShowUnpublishDialog,
        setShowDeleteDialog,
        setShowCollectResponsesDialog,
        handleDelete,
        handleCollectResponses,
        handleCopyLink,
        handleOpenFormViewer,
        handleUnpublish,
      })
    );

    renderFormDashboard();

    expect(screen.getByText('Performance Overview')).toBeInTheDocument();
    expect(screen.getByTestId('stats-grid')).toHaveTextContent('42');
    expect(screen.getByTestId('quick-actions')).toHaveTextContent('form-123');
    expect(shareModalMock).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'form-123', formTitle: 'Test Form' })
    );
    expect(collectDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        formUrl: 'http://localhost:5173/f/share/test-form',
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'publish' }));
    expect(handlePublish).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'unpublish' }));
    expect(setShowUnpublishDialog).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(setShowDeleteDialog).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'collect' }));
    expect(handleCollectResponses).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'preview' }));
    expect(window.open).toHaveBeenCalledWith(
      'http://localhost:5173/f/share/test-form',
      '_blank',
      'noopener,noreferrer'
    );

    fireEvent.click(screen.getByRole('button', { name: 'analytics' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/dashboard/form/form-123/analytics'
    );

    expect(screen.getByTestId('share-modal')).toHaveAttribute(
      'data-open',
      'false'
    );
    fireEvent.click(screen.getByRole('button', { name: 'share' }));
    expect(screen.getByTestId('share-modal')).toHaveAttribute(
      'data-open',
      'true'
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'confirm-delete' })
    );
    expect(handleDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'confirm-unpublish' })
    );
    expect(handleUnpublish).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'toggle-collect' })
    );
    expect(setShowCollectResponsesDialog).toHaveBeenCalledWith(true);

    fireEvent.click(
      screen.getByRole('button', { name: 'copy-link' })
    );
    expect(handleCopyLink).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'open-form-viewer' })
    );
    expect(handleOpenFormViewer).toHaveBeenCalledTimes(1);
  });

  it('handles forms without a short url by avoiding preview navigation', () => {
    const handleCollectResponses = jest.fn();

    mockUseFormDashboard.mockReturnValue(
      createHookState({
        form: {
          id: 'form-123',
          title: 'No Short URL',
          shortUrl: '',
          isPublished: false,
          responseCount: 0,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
        handleCollectResponses,
      })
    );

    renderFormDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'preview' }));
    expect(window.open).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('collect-dialog')
    ).toHaveAttribute('data-form-url', '');
    expect(screen.getByTestId('share-modal')).toHaveAttribute(
      'data-short-url',
      ''
    );
  });
});
