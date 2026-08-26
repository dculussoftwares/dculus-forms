import {
  renderEmailLayout,
  renderParagraph,
  renderButton,
  renderInfoBox,
  renderAltLink,
  EMAIL_THEME,
} from './emailLayout.js';

export interface AutomationFailureEmailData {
  ownerName: string;
  automationName: string;
  runUrl: string;
  /**
   * `first-failure` is a heads-up on a run that just failed; `auto-paused` means the automation
   * has stopped itself after repeated failures and needs a fix before it will run again.
   */
  reason: 'first-failure' | 'auto-paused';
  consecutiveFailures: number;
}

/**
 * Escapes a value before it goes into the HTML body. `automationName` is set by any EDITOR on the
 * form, so it reaches this template as arbitrary user input — unescaped, a name containing markup
 * would inject it into the recipient's inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateAutomationFailureEmailHtml(data: AutomationFailureEmailData): string {
  const { runUrl, reason, consecutiveFailures } = data;
  const isPaused = reason === 'auto-paused';
  const automationName = escapeHtml(data.automationName);

  const subtitle = isPaused
    ? `<strong style="color:${EMAIL_THEME.body};">${automationName}</strong> has been paused after failing ${consecutiveFailures} times in a row.`
    : `A run of <strong style="color:${EMAIL_THEME.body};">${automationName}</strong> failed.`;

  const bodyHtml = `
    ${renderParagraph(
      isPaused
        ? 'It kept failing after every retry, so it has been switched off to stop it burning through retries and filling its history with the same error. Nothing will run until you switch it back on.'
        : 'It was retried and still did not go through. If this was a one-off — a service that was briefly unreachable — the next run will pick up as normal and you can ignore this.'
    )}
    ${renderButton(runUrl, 'See what failed')}
    ${
      isPaused
        ? renderInfoBox(
            'warning',
            '⚠️&nbsp;Fix the failing step, then activate the automation again from its builder.'
          )
        : renderInfoBox(
            'security',
            `🔁&nbsp;You will not get another email about this until it either recovers or pauses itself after ${consecutiveFailures > 1 ? consecutiveFailures : 5} consecutive failures.`
          )
    }
    ${renderAltLink(runUrl)}
  `;

  return renderEmailLayout({
    title: isPaused ? 'Automation paused' : 'Automation run failed',
    preheader: isPaused
      ? `${automationName} paused after ${consecutiveFailures} consecutive failures.`
      : `A run of ${automationName} failed.`,
    heading: isPaused ? 'Automation paused' : 'Automation run failed',
    subtitle,
    bodyHtml,
  });
}

export function generateAutomationFailureEmailText(data: AutomationFailureEmailData): string {
  const { automationName, runUrl, reason, consecutiveFailures } = data;

  if (reason === 'auto-paused') {
    return `
Automation paused: ${automationName}

"${automationName}" has been paused after failing ${consecutiveFailures} times in a row.

It kept failing after every retry, so it has been switched off to stop it burning through retries
and filling its history with the same error. Nothing will run until you switch it back on.

See what failed: ${runUrl}

Fix the failing step, then activate the automation again from its builder.
`.trim();
  }

  return `
Automation run failed: ${automationName}

A run of "${automationName}" failed. It was retried and still did not go through.

If this was a one-off — a service that was briefly unreachable — the next run will pick up as
normal and you can ignore this.

See what failed: ${runUrl}
`.trim();
}
