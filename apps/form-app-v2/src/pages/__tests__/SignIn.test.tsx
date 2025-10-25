import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { SignIn } from '../SignIn';
import { signIn } from '../../lib/auth-client';
import { toast } from '@dculus/ui-v2';

jest.mock('../../lib/auth-client', () => ({
  signIn: {
    email: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: jest.fn(),
  };
});

const renderWithRouter = () =>
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>
  );

describe('SignIn page', () => {
  const navigateMock = jest.fn();
  const signInEmailMock = signIn.email as unknown as jest.Mock;
  const toastMock = toast as unknown as jest.Mock;

  beforeEach(() => {
    (useNavigate as jest.Mock).mockReturnValue(navigateMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('submits credentials and shows success state on successful login', async () => {
    signInEmailMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderWithRouter();

    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'password123',
        callbackURL: '/',
      });
    });

    expect(toastMock).toHaveBeenCalledWith('Login successful', {
      description: 'Welcome back!',
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('shows validation error toast when signIn returns an error payload', async () => {
    signInEmailMock.mockResolvedValue({
      error: { message: 'Invalid credentials' },
    });
    const user = userEvent.setup();

    renderWithRouter();

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalled();
    });

    expect(toastMock).toHaveBeenCalledWith('Login failed', {
      description: 'Invalid credentials',
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows fallback toast when signIn throws', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    signInEmailMock.mockRejectedValue(new Error('Network issue'));
    const user = userEvent.setup();

    renderWithRouter();

    await user.type(screen.getByLabelText(/email/i), 'error@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalled();
    });

    expect(toastMock).toHaveBeenCalledWith('Error', {
      description: 'An unexpected error occurred. Please try again.',
    });
    expect(navigateMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Sign in error:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
