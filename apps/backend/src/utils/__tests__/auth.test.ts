import { describe, it, expect } from 'vitest';
import {
  requireAdminRole,
  requireAuthentication,
  requireSuperAdminRole,
  requireSystemLevelRole,
  type AuthContext,
} from '../auth.js';
import { GraphQLError } from '#graphql-errors';

describe('Auth Utilities', () => {
  describe('requireAuthentication', () => {
    it('should return user when authenticated', () => {
      const context: AuthContext = {
        user: {
          id: 'user-123',
          role: 'user',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      const user = requireAuthentication(context);

      expect(user).toEqual(context.user);
      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
    });

    it('should throw GraphQLError when not authenticated', () => {
      const context: AuthContext = {};

      expect(() => requireAuthentication(context)).toThrow(GraphQLError);
      expect(() => requireAuthentication(context)).toThrow('Authentication required');
    });

    it('should throw GraphQLError when user is undefined', () => {
      const context: AuthContext = {
        user: undefined,
      };

      expect(() => requireAuthentication(context)).toThrow(GraphQLError);
      expect(() => requireAuthentication(context)).toThrow('Authentication required');
    });

    it('should work with different user roles', () => {
      const adminContext: AuthContext = {
        user: { id: '1', role: 'admin', email: 'admin@example.com' },
      };
      const superAdminContext: AuthContext = {
        user: { id: '2', role: 'superAdmin', email: 'super@example.com' },
      };
      const userContext: AuthContext = {
        user: { id: '3', role: 'user', email: 'user@example.com' },
      };

      expect(requireAuthentication(adminContext).role).toBe('admin');
      expect(requireAuthentication(superAdminContext).role).toBe('superAdmin');
      expect(requireAuthentication(userContext).role).toBe('user');
    });
  });

  describe('requireAdminRole', () => {
    it('should return user when user is admin', () => {
      const context: AuthContext = {
        user: {
          id: 'admin-123',
          role: 'admin',
          email: 'admin@example.com',
        },
      };

      const user = requireAdminRole(context);

      expect(user.role).toBe('admin');
      expect(user.id).toBe('admin-123');
    });

    it('should return user when user is superAdmin', () => {
      const context: AuthContext = {
        user: {
          id: 'superadmin-123',
          role: 'superAdmin',
          email: 'superadmin@example.com',
        },
      };

      const user = requireAdminRole(context);

      expect(user.role).toBe('superAdmin');
      expect(user.id).toBe('superadmin-123');
    });

    it('should throw GraphQLError when user is regular user', () => {
      const context: AuthContext = {
        user: {
          id: 'user-123',
          role: 'user',
          email: 'user@example.com',
        },
      };

      expect(() => requireAdminRole(context)).toThrow(GraphQLError);
      expect(() => requireAdminRole(context)).toThrow('Admin privileges required');
    });

    it('should throw GraphQLError when not authenticated', () => {
      const context: AuthContext = {};

      expect(() => requireAdminRole(context)).toThrow(GraphQLError);
      expect(() => requireAdminRole(context)).toThrow('Authentication required');
    });

    it('should throw GraphQLError when user is undefined', () => {
      const context: AuthContext = {
        user: undefined,
      };

      expect(() => requireAdminRole(context)).toThrow('Authentication required');
    });
  });

  describe('requireSuperAdminRole', () => {
    it('should return user when user is superAdmin', () => {
      const context: AuthContext = {
        user: {
          id: 'superadmin-123',
          role: 'superAdmin',
          email: 'superadmin@example.com',
          name: 'Super Admin',
        },
      };

      const user = requireSuperAdminRole(context);

      expect(user.role).toBe('superAdmin');
      expect(user.id).toBe('superadmin-123');
      expect(user.name).toBe('Super Admin');
    });

    it('should throw GraphQLError when user is admin (not superAdmin)', () => {
      const context: AuthContext = {
        user: {
          id: 'admin-123',
          role: 'admin',
          email: 'admin@example.com',
        },
      };

      expect(() => requireSuperAdminRole(context)).toThrow(GraphQLError);
      expect(() => requireSuperAdminRole(context)).toThrow('Super admin privileges required');
    });

    it('should throw GraphQLError when user is regular user', () => {
      const context: AuthContext = {
        user: {
          id: 'user-123',
          role: 'user',
          email: 'user@example.com',
        },
      };

      expect(() => requireSuperAdminRole(context)).toThrow(GraphQLError);
      expect(() => requireSuperAdminRole(context)).toThrow('Super admin privileges required');
    });

    it('should throw GraphQLError when not authenticated', () => {
      const context: AuthContext = {};

      expect(() => requireSuperAdminRole(context)).toThrow(GraphQLError);
      expect(() => requireSuperAdminRole(context)).toThrow('Authentication required');
    });
  });

  describe('requireSystemLevelRole', () => {
    it('should be an alias for requireAdminRole', () => {
      const adminContext: AuthContext = {
        user: {
          id: 'admin-123',
          role: 'admin',
          email: 'admin@example.com',
        },
      };

      // Both functions should behave identically
      expect(requireSystemLevelRole(adminContext)).toEqual(requireAdminRole(adminContext));
    });

    it('should return user when user is admin', () => {
      const context: AuthContext = {
        user: {
          id: 'admin-123',
          role: 'admin',
          email: 'admin@example.com',
        },
      };

      const user = requireSystemLevelRole(context);

      expect(user.role).toBe('admin');
    });

    it('should return user when user is superAdmin', () => {
      const context: AuthContext = {
        user: {
          id: 'superadmin-123',
          role: 'superAdmin',
          email: 'superadmin@example.com',
        },
      };

      const user = requireSystemLevelRole(context);

      expect(user.role).toBe('superAdmin');
    });

    it('should throw GraphQLError when user is regular user', () => {
      const context: AuthContext = {
        user: {
          id: 'user-123',
          role: 'user',
          email: 'user@example.com',
        },
      };

      expect(() => requireSystemLevelRole(context)).toThrow('Admin privileges required');
    });
  });

  describe('Edge Cases', () => {
    it('should handle context with null user', () => {
      const context: AuthContext = {
        user: null as any,
      };

      expect(() => requireAuthentication(context)).toThrow('Authentication required');
      expect(() => requireAdminRole(context)).toThrow('Authentication required');
      expect(() => requireSuperAdminRole(context)).toThrow('Authentication required');
    });

    it('should handle empty context object', () => {
      const context: AuthContext = {};

      expect(() => requireAuthentication(context)).toThrow('Authentication required');
      // Note: requireAdminRole checks authentication first, so it throws 'Authentication required'
      expect(() => requireAdminRole(context)).toThrow('Authentication required');
      expect(() => requireSuperAdminRole(context)).toThrow('Authentication required');
    });

    it('should preserve all user properties when returning', () => {
      const context: AuthContext = {
        user: {
          id: 'user-123',
          role: 'admin',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      };

      const user = requireAdminRole(context);

      expect(user).toHaveProperty('id', 'user-123');
      expect(user).toHaveProperty('role', 'admin');
      expect(user).toHaveProperty('email', 'admin@example.com');
      expect(user).toHaveProperty('name', 'Admin User');
    });
  });

  describe('Error Messages', () => {
    it('should throw specific error for authentication', () => {
      const context: AuthContext = {};

      try {
        requireAuthentication(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).message).toBe('Authentication required');
      }
    });

    it('should throw specific error for admin privileges', () => {
      const context: AuthContext = {
        user: { id: '1', role: 'user', email: 'user@example.com' },
      };

      try {
        requireAdminRole(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).message).toBe('Admin privileges required');
      }
    });

    it('should throw specific error for super admin privileges', () => {
      const context: AuthContext = {
        user: { id: '1', role: 'admin', email: 'admin@example.com' },
      };

      try {
        requireSuperAdminRole(context);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).message).toBe('Super admin privileges required');
      }
    });
  });
});
