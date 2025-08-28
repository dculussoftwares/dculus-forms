import { getAuthUrl } from '../lib/config';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  emailVerified?: boolean;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  user: User;
  session: {
    id: string;
    userId: string;
    expiresAt: string;
    activeOrganizationId?: string;
  };
}

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getAuthUrl();
  }

  async getSession(): Promise<Session | null> {
    try {
      const response = await fetch(`${this.baseUrl}/get-session`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Sign in failed' };
      }

      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'Network error occurred' };
    }
  }

  async signOut(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sign-out`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  isAdmin(user: User): boolean {
    // Check if user has admin role - we'll enhance this based on the role system implementation
    return user.role === 'admin' || user.role === 'superAdmin';
  }

  isSuperAdmin(user: User): boolean {
    return user.role === 'superAdmin';
  }
}

export const authService = new AuthService();