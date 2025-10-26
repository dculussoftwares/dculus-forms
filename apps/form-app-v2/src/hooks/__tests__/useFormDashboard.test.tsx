import { act, renderHook } from '@testing-library/react';
import { useFormDashboard } from '../useFormDashboard';
import { toast } from '@dculus/ui-v2';

type TestForm = {
  id: string;
  title: string;
  description?: string;
  shortUrl: string;
  isPublished: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string; slug: string };
  createdBy?: { id: string; name: string; email: string };
  metadata?: {
    pageCount?: number | null;
    fieldCount?: number | null;
    lastUpdated?: string | null;
    backgroundImageUrl?: string | null;
    backgroundImageKey?: string | null;
  };
  dashboardStats?: {
    averageCompletionTime: number | null;
    responseRate: number | null;
    responsesToday: number;
    responsesThisWeek: number;
    responsesThisMonth: number;
  };
};

type MutationUpdateFn = (
  cache: { updateQuery: jest.Mock },
  result: { data?: Record<string, unknown> }
) => void;

type MutationCompleteFn = (data: Record<string, unknown>) => void;

type MutationErrorFn = (error: { message?: string }) => void;

interface MutationInstance {
  mutation: unknown;
  options: {
    update?: MutationUpdateFn;
    onCompleted?: MutationCompleteFn;
    onError?: MutationErrorFn;
  };
  mutateFn: jest.Mock;
  result: { loading: boolean };
}

const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockTranslate = jest.fn();
const mockGetFormViewerUrl = jest.fn();

jest.mock('@apollo/client', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../i18n', () => ({
  useTranslate: () => mockTranslate,
}));

jest.mock('../../lib/config', () => ({
  getFormViewerUrl: (...args: unknown[]) => mockGetFormViewerUrl(...args),
}));

jest.mock('../../graphql/queries', () => ({
  GET_FORM_BY_ID: 'GET_FORM_BY_ID',
  GET_MY_FORMS_WITH_CATEGORY: 'GET_MY_FORMS_WITH_CATEGORY',
}));

jest.mock('../../graphql/mutations', () => ({
  DELETE_FORM: 'DELETE_FORM',
  UPDATE_FORM: 'UPDATE_FORM',
}));

const toastMock = toast as unknown as jest.Mock;
const clipboardWriteMock = jest.fn().mockResolvedValue(undefined);
let originalWindowOpen: typeof window.open;
const mutationMap = new Map<unknown, MutationInstance>();

function createForm(overrides: Partial<TestForm> = {}): TestForm {
  const { metadata, dashboardStats, ...rest } = overrides;
  const defaultMetadata = {
    pageCount: 2,
    fieldCount: 5,
    lastUpdated: null,
    backgroundImageUrl: null,
    backgroundImageKey: null,
  } satisfies NonNullable<TestForm['metadata']>;
  const defaultDashboardStats = {
    averageCompletionTime: 45,
    responseRate: 25.5,
    responsesToday: 2,
    responsesThisWeek: 5,
    responsesThisMonth: 7,
  } satisfies NonNullable<TestForm['dashboardStats']>;

  return {
    id: 'form-123',
    title: 'Sample Form',
    description: 'Sample description',
    shortUrl: 'sample-short',
    isPublished: false,
    responseCount: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    organization: { id: 'org-123', name: 'Org', slug: 'org' },
    createdBy: { id: 'user-1', name: 'User', email: 'user@example.com' },
    metadata: { ...defaultMetadata, ...metadata },
    dashboardStats: { ...defaultDashboardStats, ...dashboardStats },
    ...rest,
  };
}

interface RenderOptions {
  formId?: string | undefined;
  form?: TestForm | null | undefined;
  activeOrgId?: string | null;
  loading?: boolean;
  error?: Error | null;
}

const renderDashboardHook = (options: RenderOptions = {}) => {
  const resolvedFormId = Object.prototype.hasOwnProperty.call(options, 'formId')
    ? options.formId
    : 'form-123';
  const resolvedForm = Object.prototype.hasOwnProperty.call(options, 'form')
    ? options.form
    : createForm();
  const resolvedOrgId = Object.prototype.hasOwnProperty.call(options, 'activeOrgId')
    ? options.activeOrgId
    : 'org-123';
  const resolvedLoading = options.loading ?? false;
  const resolvedError = options.error ?? null;

  const data =
    resolvedForm === undefined
      ? undefined
      : resolvedForm === null
        ? { form: null }
        : { form: resolvedForm };

  mockUseAuth.mockReturnValue(
    resolvedOrgId ? { activeOrganization: { id: resolvedOrgId } } : { activeOrganization: null }
  );
  mockUseQuery.mockReturnValue({ data, loading: resolvedLoading, error: resolvedError });

  const { result } = renderHook(() => useFormDashboard(resolvedFormId));

  const deleteMutation = mutationMap.get('DELETE_FORM');
  const updateMutation = mutationMap.get('UPDATE_FORM');

  if (!deleteMutation || !updateMutation) {
    throw new Error('Expected mutation mocks to be registered');
  }

  return {
    result,
    deleteMutation,
    updateMutation,
  };
};

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWriteMock },
    configurable: true,
  });
  originalWindowOpen = window.open;
  window.open = jest.fn();
});

afterAll(() => {
  window.open = originalWindowOpen;
});

beforeEach(() => {
  mutationMap.clear();
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();
  mockUseAuth.mockReset();
  mockTranslate.mockReset();
  mockTranslate.mockImplementation((key: string) => key);
  mockGetFormViewerUrl.mockReset();
  mockNavigate.mockReset();
  toastMock.mockClear();
  clipboardWriteMock.mockClear();
  (window.open as jest.Mock).mockClear();

  mockUseMutation.mockImplementation((
    mutation: unknown,
    options: MutationInstance['options'] = {}
  ) => {
    const existing = mutationMap.get(mutation);
    if (existing) {
      existing.options = options;
      return [existing.mutateFn, existing.result];
    }

    const mutateFn = jest.fn();
    const result = { loading: false };
    const instance: MutationInstance = { mutation, options, mutateFn, result };
    mutationMap.set(mutation, instance);
    return [mutateFn, result];
  });
});

describe('useFormDashboard', () => {
  it('returns default dashboard state when form data is unavailable', () => {
    const { result, deleteMutation, updateMutation } = renderDashboardHook({
      formId: undefined,
      form: undefined,
    });

    expect(result.current.form).toBeUndefined();
    expect(result.current.dashboardStats).toEqual({
      totalResponses: 0,
      totalFields: 0,
      averageCompletionTime: '0 min',
      responseRate: '0%',
      responsesToday: 0,
      responsesThisWeek: 0,
    });

    act(() => {
      result.current.handleDelete();
      result.current.handlePublish();
      result.current.handleUnpublish();
      result.current.handleCopyLink();
      result.current.handleOpenFormViewer();
    });

    expect(deleteMutation.mutateFn).not.toHaveBeenCalled();
    expect(updateMutation.mutateFn).not.toHaveBeenCalled();
    expect(mockGetFormViewerUrl).not.toHaveBeenCalled();
    expect(clipboardWriteMock).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('computes dashboard stats with populated form data and seconds formatting', () => {
    const form = createForm({
      responseCount: 20,
      metadata: { fieldCount: 3 },
      dashboardStats: {
        averageCompletionTime: 45,
        responseRate: 32.45,
        responsesToday: 4,
        responsesThisWeek: 9,
        responsesThisMonth: 12,
      },
    });

    const { result } = renderDashboardHook({ form });

    expect(result.current.dashboardStats).toEqual({
      totalResponses: 20,
      totalFields: 3,
      averageCompletionTime: '45s',
      responseRate: '32.5%',
      responsesToday: 4,
      responsesThisWeek: 9,
    });
  });

  it('computes dashboard stats with minute formatting and fallback rate', () => {
    const form = createForm({
      metadata: { fieldCount: null },
      dashboardStats: {
        averageCompletionTime: 90,
        responseRate: null,
        responsesToday: 1,
        responsesThisWeek: 2,
        responsesThisMonth: 5,
      },
    });

    const { result } = renderDashboardHook({ form });

    expect(result.current.dashboardStats).toEqual({
      totalResponses: 10,
      totalFields: 0,
      averageCompletionTime: '1.5 min',
      responseRate: '0%',
      responsesToday: 1,
      responsesThisWeek: 2,
    });
  });

  it('falls back to zero-valued dashboard metrics when data is missing or zero', () => {
    const form = createForm({
      dashboardStats: {
        averageCompletionTime: null,
        responseRate: null,
        responsesToday: 0,
        responsesThisWeek: 0,
        responsesThisMonth: 0,
      },
    });

    const { result } = renderDashboardHook({ form });

    expect(result.current.dashboardStats).toEqual({
      totalResponses: 10,
      totalFields: 5,
      averageCompletionTime: '0 min',
      responseRate: '0%',
      responsesToday: 0,
      responsesThisWeek: 0,
    });
  });

  it('returns zero responses when response count is zero', () => {
    const form = createForm({ responseCount: 0 });

    const { result } = renderDashboardHook({ form });

    expect(result.current.dashboardStats.totalResponses).toBe(0);
  });

  it('invokes delete mutation, resets dialog state, and updates cache', () => {
    const formId = 'form-delete';
    const { result, deleteMutation } = renderDashboardHook({
      formId,
      form: createForm({ id: formId }),
    });

    act(() => {
      result.current.setShowDeleteDialog(true);
    });

    expect(result.current.showDeleteDialog).toBe(true);

    act(() => {
      result.current.handleDelete();
    });

    expect(deleteMutation.mutateFn).toHaveBeenCalledWith({ variables: { id: formId } });
    expect(result.current.showDeleteDialog).toBe(false);

  const cache = { updateQuery: jest.fn() };
  const updateHandler = deleteMutation.options.update;
  expect(updateHandler).toBeDefined();
  updateHandler?.(cache, { data: { deleteForm: true } });

    expect(cache.updateQuery).toHaveBeenCalledWith(
      {
        query: 'GET_MY_FORMS_WITH_CATEGORY',
        variables: { organizationId: 'org-123' },
      },
      expect.any(Function)
    );

    const updateFn = (cache.updateQuery as jest.Mock).mock.calls[0][1];
    const existingData = {
      formsWithCategory: {
        forms: [
          { id: formId },
          { id: 'keep-me' },
        ],
      },
    };

    expect(updateFn(existingData)).toEqual({
      formsWithCategory: {
        forms: [{ id: 'keep-me' }],
      },
    });
    expect(updateFn(undefined)).toBeUndefined();

  const cacheWithoutUpdate = { updateQuery: jest.fn() };
  updateHandler?.(cacheWithoutUpdate, { data: { deleteForm: false } });
    expect(cacheWithoutUpdate.updateQuery).not.toHaveBeenCalled();
  });

  it('shows success toast and navigates after delete completion', () => {
    const { deleteMutation } = renderDashboardHook();

    deleteMutation.options.onCompleted?.({ deleteForm: true });

    expect(toastMock).toHaveBeenCalledWith(
      'formDashboard.toast.deleteSuccess.title',
      expect.objectContaining({
        description: 'formDashboard.toast.deleteSuccess.description',
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows error toast when delete mutation fails', () => {
    const { deleteMutation } = renderDashboardHook();

    deleteMutation.options.onError?.(new Error('delete failure'));
    deleteMutation.options.onError?.({ message: '' } as Error);

    expect(toastMock).toHaveBeenNthCalledWith(
      1,
      'formDashboard.toast.deleteError.title',
      expect.objectContaining({ description: 'delete failure' })
    );
    expect(toastMock).toHaveBeenNthCalledWith(
      2,
      'formDashboard.toast.deleteError.title',
      expect.objectContaining({
        description: 'formDashboard.toast.deleteError.descriptionFallback',
      })
    );
  });

  it('invokes publish mutation with optimistic response and handles success', () => {
    const form = createForm({ isPublished: false });
    const { result, updateMutation } = renderDashboardHook({ form });

    act(() => {
      result.current.handlePublish();
    });

    expect(updateMutation.mutateFn).toHaveBeenCalledWith({
      variables: { id: 'form-123', input: { isPublished: true } },
      optimisticResponse: {
        updateForm: expect.objectContaining({
          id: 'form-123',
          isPublished: true,
          __typename: 'Form',
        }),
      },
    });

    updateMutation.options.onCompleted?.({ updateForm: { isPublished: true } });

    expect(toastMock).toHaveBeenCalledWith(
      'formDashboard.toast.publishSuccess.title',
      expect.objectContaining({
        description: 'formDashboard.toast.publishSuccess.description',
      })
    );
  });

  it('publishes with minimal optimistic payload when form data is unavailable', () => {
    const { result, updateMutation } = renderDashboardHook({
      formId: 'form-123',
      form: undefined,
    });

    act(() => {
      result.current.handlePublish();
    });

    expect(updateMutation.mutateFn).toHaveBeenCalledWith({
      variables: { id: 'form-123', input: { isPublished: true } },
      optimisticResponse: {
        updateForm: {
          isPublished: true,
          __typename: 'Form',
        },
      },
    });
  });

  it('invokes unpublish mutation, hides dialog, and handles success toast', () => {
    const form = createForm({ isPublished: true });
    const { result, updateMutation } = renderDashboardHook({ form });

    act(() => {
      result.current.setShowUnpublishDialog(true);
    });
    expect(result.current.showUnpublishDialog).toBe(true);

    act(() => {
      result.current.handleUnpublish();
    });

    expect(updateMutation.mutateFn).toHaveBeenCalledWith({
      variables: { id: 'form-123', input: { isPublished: false } },
      optimisticResponse: {
        updateForm: expect.objectContaining({
          id: 'form-123',
          isPublished: false,
          __typename: 'Form',
        }),
      },
    });
    expect(result.current.showUnpublishDialog).toBe(false);

    updateMutation.options.onCompleted?.({ updateForm: { isPublished: false } });

    expect(toastMock).toHaveBeenCalledWith(
      'formDashboard.toast.unpublishSuccess.title',
      expect.objectContaining({
        description: 'formDashboard.toast.unpublishSuccess.description',
      })
    );
  });

  it('shows error toast when update mutation fails', () => {
    const { updateMutation } = renderDashboardHook();

    updateMutation.options.onError?.(new Error('update failed'));
    updateMutation.options.onError?.({ message: '' } as Error);

    expect(toastMock).toHaveBeenNthCalledWith(
      1,
      'formDashboard.toast.updateError.title',
      expect.objectContaining({ description: 'update failed' })
    );
    expect(toastMock).toHaveBeenNthCalledWith(
      2,
      'formDashboard.toast.updateError.title',
      expect.objectContaining({
        description: 'formDashboard.toast.updateError.descriptionFallback',
      })
    );
  });

  it('opens collect responses dialog', () => {
    const { result } = renderDashboardHook();
    expect(result.current.showCollectResponsesDialog).toBe(false);

    act(() => {
      result.current.handleCollectResponses();
    });

    expect(result.current.showCollectResponsesDialog).toBe(true);
  });

  it('copies form viewer link and shows toast feedback', async () => {
    const form = createForm();
    mockGetFormViewerUrl.mockReturnValue('https://viewer.test/form');

    const { result } = renderDashboardHook({ form });

    await act(async () => {
      result.current.handleCopyLink();
      await Promise.resolve();
    });

    expect(mockGetFormViewerUrl).toHaveBeenCalledWith('sample-short');
    expect(clipboardWriteMock).toHaveBeenCalledWith('https://viewer.test/form');
    expect(toastMock).toHaveBeenCalledWith(
      'formDashboard.toast.copySuccess.title',
      expect.objectContaining({
        description: 'formDashboard.toast.copySuccess.description',
      })
    );
  });

  it('skips copy behavior when shortUrl is missing', () => {
    const form = createForm({ shortUrl: '' });
    const { result } = renderDashboardHook({ form });

    act(() => {
      result.current.handleCopyLink();
    });

    expect(mockGetFormViewerUrl).not.toHaveBeenCalled();
    expect(clipboardWriteMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('skips copy behavior when form data is unavailable', () => {
    const { result } = renderDashboardHook({
      formId: 'form-123',
      form: undefined,
    });

    act(() => {
      result.current.handleCopyLink();
    });

    expect(mockGetFormViewerUrl).not.toHaveBeenCalled();
    expect(clipboardWriteMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('opens form viewer in new tab', () => {
    const form = createForm();
    mockGetFormViewerUrl.mockReturnValue('https://viewer.test/form');

    const { result } = renderDashboardHook({ form });

    act(() => {
      result.current.handleOpenFormViewer();
    });

    expect(mockGetFormViewerUrl).toHaveBeenCalledWith('sample-short');
    expect(window.open).toHaveBeenCalledWith(
      'https://viewer.test/form',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('does not open new tab when shortUrl is unavailable', () => {
    const form = createForm({ shortUrl: '' });
    const { result } = renderDashboardHook({ form });

    act(() => {
      result.current.handleOpenFormViewer();
    });

    expect(mockGetFormViewerUrl).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });
});
