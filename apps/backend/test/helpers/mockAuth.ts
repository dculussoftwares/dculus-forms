import { User, Organization, Member } from '@prisma/client';

export interface MockAuthContext {
  user: User | null;
  session: any | null;
  organization: Organization | null;
  membership: Member | null;
}

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  emailVerified: true,
  image: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  banned: false,
  banReason: null,
  banExpires: null,
  ...overrides,
});

export const createMockOrganization = (
  overrides?: Partial<Organization>
): Organization => ({
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  logo: null,
  createdAt: new Date('2024-01-01'),
  metadata: null,
  ...overrides,
});

export const createMockMember = (overrides?: Partial<Member>): Member => ({
  id: 'member-123',
  organizationId: 'org-123',
  userId: 'user-123',
  role: 'owner',
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

export const createMockAuthContext = (
  overrides?: Partial<MockAuthContext>
): MockAuthContext => ({
  user: createMockUser(),
  session: { id: 'session-123', userId: 'user-123' },
  organization: createMockOrganization(),
  membership: createMockMember(),
  ...overrides,
});

// Helper for unauthenticated context
export const createUnauthenticatedContext = (): MockAuthContext => ({
  user: null,
  session: null,
  organization: null,
  membership: null,
});

// Helper for different roles
export const createAdminAuthContext = () =>
  createMockAuthContext({
    user: createMockUser({ role: 'admin' }),
  });

export const createSuperAdminAuthContext = () =>
  createMockAuthContext({
    user: createMockUser({ role: 'superAdmin' }),
  });

export const createEditorAuthContext = () =>
  createMockAuthContext({
    membership: createMockMember({ role: 'member' }),
  });
