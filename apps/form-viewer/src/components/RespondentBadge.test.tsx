import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RespondentBadge from './RespondentBadge';

describe('RespondentBadge', () => {
  it('shows the email it was given (server-derived, never trusted from local state)', () => {
    render(<RespondentBadge email="dana@acme.com" onSwitchAccount={vi.fn().mockResolvedValue(undefined)} />);
    const badge = screen.getByTestId('respondent-badge');
    expect(badge).toHaveTextContent('dana@acme.com');
    expect(badge).toHaveTextContent(/recorded with your response/i);
    expect(screen.getByTestId('respondent-badge-switch')).toHaveTextContent('Switch account');
  });

  it('falls back to the initial when no avatar URL is given', () => {
    render(<RespondentBadge email="dana@acme.com" onSwitchAccount={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.queryByTestId('respondent-badge-avatar')).not.toBeInTheDocument();
    expect(screen.getByTestId('respondent-badge')).toHaveTextContent('D');
  });

  it('renders the avatar image when a URL is given', () => {
    render(
      <RespondentBadge
        email="dana@acme.com"
        imageUrl="https://example.com/a.png"
        onSwitchAccount={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByTestId('respondent-badge-avatar')).toHaveAttribute('src', 'https://example.com/a.png');
  });

  it('calls onSwitchAccount when "Switch account" is clicked', async () => {
    const onSwitchAccount = vi.fn().mockResolvedValue(undefined);
    render(<RespondentBadge email="dana@acme.com" onSwitchAccount={onSwitchAccount} />);

    await userEvent.click(screen.getByTestId('respondent-badge-switch'));

    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
  });

  it('disables the control while the sign-out is in flight (no double sign-out)', async () => {
    let resolve!: () => void;
    const onSwitchAccount = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    render(<RespondentBadge email="dana@acme.com" onSwitchAccount={onSwitchAccount} />);

    const button = screen.getByTestId('respondent-badge-switch');
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Switching…');

    await userEvent.click(button);
    expect(onSwitchAccount).toHaveBeenCalledTimes(1);

    resolve();
  });

  it('surfaces a failed sign-out instead of implying the respondent is signed out', async () => {
    const onSwitchAccount = vi.fn().mockRejectedValue(new Error('network'));
    render(<RespondentBadge email="dana@acme.com" onSwitchAccount={onSwitchAccount} />);

    await userEvent.click(screen.getByTestId('respondent-badge-switch'));

    await waitFor(() => {
      expect(screen.getByTestId('respondent-badge')).toHaveTextContent("Couldn't switch account");
    });
    // Still names the account — the identity is still live.
    expect(screen.getByTestId('respondent-badge')).toHaveTextContent('dana@acme.com');

    const retry = screen.getByTestId('respondent-badge-switch');
    expect(retry).toHaveTextContent('Try again');
    await userEvent.click(retry);
    expect(onSwitchAccount).toHaveBeenCalledTimes(2);
  });
});
