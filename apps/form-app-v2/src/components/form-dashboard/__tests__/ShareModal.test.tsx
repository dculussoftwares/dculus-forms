import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

jest.mock('@apollo/client', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  gql: jest.fn((strings: TemplateStringsArray) => strings.join('')),
}));

jest.mock('../../../i18n', () => ({
  useTranslate: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../lib/config', () => ({
  getFormViewerUrl: jest.fn(),
}));

jest.mock('../../../graphql/formSharing', () => {
  const actual = jest.requireActual('../../../graphql/formSharing');
  return {
    ...actual,
    GET_FORM_PERMISSIONS: 'GET_FORM_PERMISSIONS',
    GET_ORGANIZATION_MEMBERS: 'GET_ORGANIZATION_MEMBERS',
    SHARE_FORM: 'SHARE_FORM',
    UPDATE_FORM_PERMISSION: 'UPDATE_FORM_PERMISSION',
    REMOVE_FORM_ACCESS: 'REMOVE_FORM_ACCESS',
  };
});

import { useQuery, useMutation } from '@apollo/client';
import { toast } from '@dculus/ui-v2';
import { ShareModal, permissionIconFor, permissionLabelFor } from '../ShareModal';
import { useTranslate } from '../../../i18n';
import { useAuth } from '../../../contexts/AuthContext';
import { getFormViewerUrl } from '../../../lib/config';
import {
  SharingScope,
  PermissionLevel,
  type FormPermission,
  type User,
} from '../../../graphql/formSharing';

describe('permission helpers', () => {
  it('returns icons for known permissions and null for unknown', () => {
    const ownerIcon = permissionIconFor(PermissionLevel.OWNER);
    expect(ownerIcon).toBeTruthy();
    expect((ownerIcon as { props: { className: string } }).props.className).toContain(
      'text-yellow-500',
    );

    expect(permissionIconFor('NO_ACCESS' as PermissionLevel)).toBeNull();
  });

  it('returns translated labels with fallback', () => {
    const translate = ((key: string) => key) as unknown as ReturnType<typeof useTranslate>;
    expect(permissionLabelFor(PermissionLevel.OWNER, translate)).toBe(
      'shareModal.permissions.owner',
    );
    expect(permissionLabelFor('NO_ACCESS', translate)).toBe('No Access');
  });
});

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockUseTranslate = useTranslate as unknown as jest.MockedFunction<
  typeof useTranslate
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetFormViewerUrl = getFormViewerUrl as jest.MockedFunction<
  typeof getFormViewerUrl
>;
const toastMock = toast as unknown as jest.Mock;

type ShareModalProps = ComponentProps<typeof ShareModal>;

const baseProps: ShareModalProps = {
  open: true,
  onOpenChange: jest.fn(),
  formId: 'form-1',
  formTitle: 'Insight Survey',
  shortUrl: 'short-123',
};

const makeMember = (overrides: Partial<User> = {}): User => ({
  id: 'member-id',
  name: 'Helena Harper',
  email: 'helena@example.com',
  image: '',
  ...overrides,
});

const makePermission = (
  overrides: Partial<FormPermission> = {},
): FormPermission => ({
  id: `perm-${overrides.userId ?? 'base'}`,
  formId: 'form-1',
  userId: overrides.userId ?? 'owner-id',
  permission: overrides.permission ?? PermissionLevel.OWNER,
  grantedAt: 'now',
  updatedAt: 'now',
  user: {
    id: overrides.userId ?? 'owner-id',
    name: overrides.user?.name ?? 'Owner User',
    email: overrides.user?.email ?? 'owner@example.com',
    image: '',
  },
  grantedBy: {
    id: 'admin',
    name: 'Admin',
    email: 'admin@example.com',
  },
  ...overrides,
});

describe('ShareModal', () => {
  const user = userEvent.setup();
  let shareMutation: jest.Mock;
  let updatePermissionMutation: jest.Mock;
  let removeAccessMutation: jest.Mock;
  let refetchPermissions: jest.Mock;
  let clipboardWrite: jest.Mock;
  let baseMutationImplementation: (
    mutation: unknown,
    options?: any
  ) => [jest.Mock<any, [variables: unknown]>, { loading: boolean }];
  let shareShouldError: boolean;
  let updateShouldError: boolean;
  let removeShouldError: boolean;
  let shareLoadingState: boolean;
  let members: User[];

  const renderModal = (props: Partial<ShareModalProps> = {}) =>
    render(<ShareModal {...baseProps} {...props} />);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslate.mockReturnValue(
      (key: string, replacements?: Record<string, unknown>) =>
        replacements ? `${key}:${JSON.stringify(replacements)}` : key,
    );
    mockUseAuth.mockReturnValue({
      activeOrganization: {
        id: 'org-1',
        name: 'Acme Org',
        slug: 'acme-org',
        logo: null,
        members: [],
      },
      user: {
        id: 'current-user',
        name: 'Current User',
        email: 'self@example.com',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isAuthenticated: true,
      isLoading: false,
      organizationError: null,
    });
    mockGetFormViewerUrl.mockReturnValue('https://viewer/forms/short-123');
    refetchPermissions = jest.fn();

    const permissions: FormPermission[] = [
      makePermission({
        userId: 'owner-id',
        permission: PermissionLevel.OWNER,
        user: { id: 'owner-id', name: 'Owner User', email: 'owner@example.com' },
      }),
      makePermission({
        id: 'perm-collab',
        userId: 'collab-id',
        permission: PermissionLevel.VIEWER,
        user: {
          id: 'collab-id',
          name: 'Existing Collaborator',
          email: 'collab@example.com',
        },
      }),
      makePermission({
        id: 'perm-current',
        userId: 'current-user',
        permission: PermissionLevel.EDITOR,
        user: {
          id: 'current-user',
          name: 'Current User',
          email: 'self@example.com',
        },
      }),
    ];

    members = [
      makeMember({ id: 'current-user', name: 'Current User', email: 'self@example.com' }),
      makeMember({ id: 'member-1', name: 'Helena Harper', email: 'helena@example.com' }),
      makeMember({ id: 'member-2', name: 'Evan Lee', email: 'evan@example.com' }),
    ];

    mockUseQuery.mockImplementation(((query: unknown) => {
      if (query === 'GET_FORM_PERMISSIONS') {
        return {
          data: { formPermissions: permissions },
          loading: false,
          refetch: refetchPermissions,
        } as unknown;
      }
      if (query === 'GET_ORGANIZATION_MEMBERS') {
        return {
          data: { organizationMembers: members },
          loading: false,
        } as unknown;
      }
      return { data: undefined, loading: false } as unknown;
    }) as any);

    shareMutation = jest.fn();

    updatePermissionMutation = jest.fn();
    removeAccessMutation = jest.fn();
    shareShouldError = false;
    updateShouldError = false;
    removeShouldError = false;
    shareLoadingState = false;

    baseMutationImplementation = (
      mutation: unknown,
      options?: any,
    ) => {
      if (mutation === 'SHARE_FORM') {
        return [
          jest.fn(async (variables: unknown) => {
            shareMutation(variables);
            if (shareShouldError) {
              shareShouldError = false;
              options?.onError?.(new Error());
              return;
            }
            options?.onCompleted?.({});
          }),
          { loading: shareLoadingState },
        ];
      }
      if (mutation === 'UPDATE_FORM_PERMISSION') {
        return [
          jest.fn(async (variables: unknown) => {
            updatePermissionMutation(variables);
            if (updateShouldError) {
              updateShouldError = false;
              options?.onError?.(new Error());
              return;
            }
            options?.onCompleted?.({});
          }),
          { loading: false },
        ];
      }
      if (mutation === 'REMOVE_FORM_ACCESS') {
        return [
          jest.fn(async (variables: unknown) => {
            removeAccessMutation(variables);
            if (removeShouldError) {
              removeShouldError = false;
              options?.onError?.(new Error());
              return;
            }
            options?.onCompleted?.({});
          }),
          { loading: false },
        ];
      }
      throw new Error(`Unexpected mutation ${String(mutation)}`);
    };

    mockUseMutation.mockImplementation(baseMutationImplementation as any);

    clipboardWrite = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
  });

  it('copies share link and shows confirmation toast', async () => {
    renderModal();

    const copyButton = screen.getByRole('button', {
      name: 'shareModal.linkSection.copyButton',
    });

    await user.click(copyButton);
    await act(async () => Promise.resolve());

    expect(clipboardWrite).toHaveBeenCalledWith(
      'https://viewer/forms/short-123',
    );
    expect(copyButton).toHaveTextContent('shareModal.linkSection.copiedButton');
    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.linkCopied.title',
      expect.objectContaining({
        description: 'shareModal.toast.linkCopied.description',
      }),
    );
  });

  it('queues members for sharing and submits selection', async () => {
    renderModal();

    await user.click(
      screen.getByRole('button', {
        name: /shareModal.scopeSection.specific.title/i,
      }),
    );

    await user.type(
      screen.getByPlaceholderText('shareModal.addMembers.placeholder'),
      'Helena',
    );

    await user.click(screen.getByText('Helena Harper'));
    expect(screen.getByText('Helena Harper')).toBeInTheDocument();
    expect(screen.getByText('shareModal.addMembers.toBeAdded')).toBeInTheDocument();

    const queueContainer = screen.getByText('shareModal.addMembers.toBeAdded').nextElementSibling as HTMLElement;
    const queueSelectTrigger = within(queueContainer)
      .getAllByRole('button')
      .find((button) => !button.querySelector('.lucide-x'))!;
    await user.click(queueSelectTrigger);
    await user.click(screen.getAllByText('shareModal.permissions.editor')[0]);

    await user.click(screen.getByText('shareModal.footer.share'));

    expect(shareMutation).toHaveBeenCalledWith({
      variables: {
        input: {
          formId: 'form-1',
          sharingScope: SharingScope.SPECIFIC_MEMBERS,
          defaultPermission: undefined,
          userPermissions: [
            {
              userId: 'member-1',
              permission: PermissionLevel.EDITOR,
            },
          ],
        },
      },
    });
    expect(refetchPermissions).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.updateSuccess.title',
      expect.objectContaining({
        description: 'shareModal.toast.updateSuccess.description',
      }),
    );
    expect(
      screen.queryByText('shareModal.addMembers.toBeAdded'),
    ).not.toBeInTheDocument();
  });

  it('marks current user access in the permissions list', () => {
    renderModal();

    expect(screen.getByText('shareModal.currentAccess.youBadge')).toBeInTheDocument();
  });

  it('allows removing a queued member before sharing', async () => {
    renderModal();

    await user.click(
      screen.getByRole('button', {
        name: /shareModal.scopeSection.specific.title/i,
      }),
    );

    await user.type(
      screen.getByPlaceholderText('shareModal.addMembers.placeholder'),
      'Helena',
    );

    await user.click(screen.getByText('Helena Harper'));

    const queueLabel = screen.getByText('shareModal.addMembers.toBeAdded');
    const queueContainer = queueLabel.nextElementSibling as HTMLElement;

    const removeButton = within(queueContainer)
      .getAllByRole('button')
      .find((button) => button.querySelector('.lucide-x'));

    expect(removeButton).toBeDefined();
    await user.click(removeButton!);

    await waitFor(() =>
      expect(screen.queryByText('shareModal.addMembers.toBeAdded')).not.toBeInTheDocument(),
    );
  });

  it('falls back to placeholder data when a queued member is missing', async () => {
    const view = renderModal();

    await user.click(
      screen.getByRole('button', {
        name: /shareModal.scopeSection.specific.title/i,
      }),
    );

    await user.type(
      screen.getByPlaceholderText('shareModal.addMembers.placeholder'),
      'Helena',
    );

    await user.click(screen.getByText('Helena Harper'));

    members.splice(
      members.findIndex((member) => member.id === 'member-1'),
      1,
    );

    await act(async () => {
      view.rerender(<ShareModal {...baseProps} />);
    });

    expect(screen.getByText('Unknown member')).toBeInTheDocument();
  });

  it('handles missing query payloads safely', () => {
    const originalImplementation = mockUseQuery.getMockImplementation();

    mockUseQuery.mockImplementation(((query: unknown) => {
      if (query === 'GET_FORM_PERMISSIONS') {
        return {
          data: undefined,
          loading: false,
          refetch: refetchPermissions,
        } as any;
      }
      if (query === 'GET_ORGANIZATION_MEMBERS') {
        return {
          data: undefined,
          loading: false,
        } as any;
      }
      return originalImplementation ? (originalImplementation as any)(query) : { data: undefined, loading: false };
    }) as any);

    renderModal();

    expect(screen.queryByText('Existing Collaborator')).not.toBeInTheDocument();

    if (originalImplementation) {
      mockUseQuery.mockImplementation(originalImplementation as any);
    }
  });

  it('updates existing permission level and removes access', async () => {
    renderModal();

    const collaboratorRow = screen
      .getByText('Existing Collaborator')
      .closest('div')!.parentElement!.parentElement!.parentElement as HTMLElement;

    await user.click(
      within(collaboratorRow).getAllByText('shareModal.permissions.editor')[0],
    );

    expect(updatePermissionMutation).toHaveBeenCalledWith({
      variables: {
        input: {
          formId: 'form-1',
          userId: 'collab-id',
          permission: PermissionLevel.EDITOR,
        },
      },
    });
    expect(refetchPermissions).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.permissionUpdated.title',
      expect.objectContaining({
        description: 'shareModal.toast.permissionUpdated.description',
      }),
    );

    const removeButton = within(collaboratorRow)
      .getAllByRole('button')
      .find((button) => button.className?.includes('text-destructive'));

    await user.click(removeButton!);

    expect(removeAccessMutation).toHaveBeenCalledWith({
      variables: {
        formId: 'form-1',
        userId: 'collab-id',
      },
    });
    expect(refetchPermissions).toHaveBeenCalledTimes(2);
    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.accessRemoved.title',
      expect.objectContaining({
        description: 'shareModal.toast.accessRemoved.description',
      }),
    );
  });

  it('allows enabling organization-wide access and default permissions', async () => {
    renderModal();

    await user.click(
      screen.getByRole('button', {
        name: /shareModal.scopeSection.allOrg.title/i,
      }),
    );

    const defaultPermissionSection = screen
      .getByText('shareModal.defaultPermission.label')
      .parentElement as HTMLElement;

    await user.click(
      within(defaultPermissionSection).getAllByText('shareModal.permissions.editor')[0],
    );
    await user.click(screen.getByText('shareModal.footer.share'));

    expect(shareMutation).toHaveBeenCalledWith({
      variables: {
        input: {
          formId: 'form-1',
          sharingScope: SharingScope.ALL_ORG_MEMBERS,
          defaultPermission: PermissionLevel.EDITOR,
          userPermissions: undefined,
        },
      },
    });
    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.updateSuccess.title',
      expect.any(Object),
    );
  });

  it('shows the sharing state while the share mutation is loading', () => {
    shareLoadingState = true;

    renderModal();

    const loadingLabel = screen.getByText('shareModal.footer.sharing');
    expect(loadingLabel).toBeInTheDocument();
    expect(loadingLabel.closest('button')).toBeDisabled();
  });

  it('shows an error toast when share mutation fails', async () => {
    shareShouldError = true;

    renderModal();

    await user.click(screen.getByText('shareModal.footer.share'));

    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.updateError.title',
      expect.objectContaining({
        description: 'shareModal.toast.updateError.descriptionFallback',
      }),
    );
    expect(refetchPermissions).not.toHaveBeenCalled();
  });

  it('shows an error toast when updating permission fails', async () => {
    updateShouldError = true;

    renderModal();

    const collaboratorRow = screen
      .getByText('Existing Collaborator')
      .closest('div')!.parentElement!.parentElement!.parentElement as HTMLElement;

    await user.click(
      within(collaboratorRow).getAllByText('shareModal.permissions.editor')[0],
    );

    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.permissionError.title',
      expect.objectContaining({
        description: 'shareModal.toast.permissionError.descriptionFallback',
      }),
    );
    expect(refetchPermissions).not.toHaveBeenCalled();
  });

  it('shows an error toast when removing access fails', async () => {
    removeShouldError = true;

    renderModal();

    const collaboratorRow = screen
      .getByText('Existing Collaborator')
      .closest('div')!.parentElement!.parentElement!.parentElement as HTMLElement;

    const removeButton = within(collaboratorRow)
      .getAllByRole('button')
      .find((button) => button.className?.includes('text-destructive'));

    await user.click(removeButton!);

    expect(toastMock).toHaveBeenCalledWith(
      'shareModal.toast.removeError.title',
      expect.objectContaining({
        description: 'shareModal.toast.removeError.descriptionFallback',
      }),
    );
    expect(refetchPermissions).not.toHaveBeenCalled();
  });

  it('closes the modal when cancel is clicked', async () => {
    const onOpenChange = jest.fn();
    renderModal({ onOpenChange });

    await user.click(screen.getByText('shareModal.footer.cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
