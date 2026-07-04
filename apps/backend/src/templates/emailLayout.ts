/**
 * Shared email layout + design tokens for all transactional emails.
 *
 * Emails cannot import the React `@dculus/ui` components, so this module mirrors
 * the app's design system (the Typeform-inspired aubergine/green palette defined
 * in `apps/form-app/src/index.css`) in email-safe HTML: table-based layout with
 * inline styles for base rendering, plus a `<style>` block for responsive tweaks.
 *
 * All templates should build their body content and wrap it with
 * `renderEmailLayout()` so headers, footers, buttons, and spacing stay consistent.
 */

/** Brand design tokens — kept in sync with the `--tf-*` tokens in index.css. */
export const EMAIL_THEME = {
  // Surfaces
  pageBg: '#f7f7f8',        // --tf-faint: app / page background
  cardBg: '#ffffff',        // white content card
  headerBg: '#3c323e',      // --tf-dark: aubergine header band + wordmark bg
  footerBg: '#f7f7f8',

  // Text
  heading: '#2a222b',       // --tf-darkest: headings
  body: '#4c414e',          // --tf-text: body copy
  muted: '#655d67',         // --tf-muted: secondary / footer text
  onDark: '#ffffff',        // text on the aubergine header
  onDarkMuted: 'rgba(255,255,255,0.72)',

  // Accent
  green: '#177767',         // --tf-green: primary CTA
  greenDark: '#125f52',     // pressed / border shade for CTA

  // Borders
  border: '#e7e5e8',        // hairline border on white
  borderStrong: '#dcd9de',

  // Info-box variants
  infoBg: '#eef6f4',
  infoBorder: '#cfe4dd',
  infoText: '#12604f',

  warningBg: '#fdf6e6',
  warningBorder: '#f0d089',
  warningText: '#8a6216',

  securityBg: '#f4f4f5',
  securityBorder: '#e7e5e8',
  securityText: '#4c414e',
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export interface EmailLayoutOptions {
  /** Value for the <title> tag (also used for accessibility). */
  title: string;
  /** Short preheader shown in inbox previews (hidden in the body). */
  preheader?: string;
  /** Optional heading rendered inside the white card above the body content. */
  heading?: string;
  /** Optional muted subtitle rendered under the heading. */
  subtitle?: string;
  /** Pre-rendered, email-safe HTML for the main content. */
  bodyHtml: string;
}

/**
 * Wraps body content in the shared, brand-consistent email shell:
 * aubergine header band with the Dculus Forms wordmark, white content card,
 * and a neutral footer with support links.
 */
export function renderEmailLayout(options: EmailLayoutOptions): string {
  const { title, preheader, heading, subtitle, bodyHtml } = options;

  const headingHtml = heading
    ? `<h1 style="margin:0 0 8px 0; font-family:${FONT_STACK}; font-size:26px; line-height:1.25; font-weight:700; color:${EMAIL_THEME.heading};">${heading}</h1>`
    : '';

  const subtitleHtml = subtitle
    ? `<p style="margin:0 0 24px 0; font-family:${FONT_STACK}; font-size:16px; line-height:1.5; color:${EMAIL_THEME.muted};">${subtitle}</p>`
    : '';

  const preheaderHtml = preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: ${EMAIL_THEME.pageBg}; }
    table { border-collapse: collapse; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
    a { text-decoration: none; }
    .cta-button:hover { background-color: ${EMAIL_THEME.greenDark} !important; }
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; border-radius: 0 !important; }
      .email-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .email-heading { font-size: 23px !important; }
    }
    @media only screen and (max-width: 480px) {
      .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .cta-button { display: block !important; }
    }
  </style>
</head>
<body>
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_THEME.pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" style="width:600px; max-width:600px; background-color:${EMAIL_THEME.cardBg}; border:1px solid ${EMAIL_THEME.border}; border-radius:14px; overflow:hidden;">
          <!-- Header band -->
          <tr>
            <td align="center" style="background-color:${EMAIL_THEME.headerBg}; padding:28px 24px;">
              <span style="font-family:${FONT_STACK}; font-size:20px; font-weight:700; letter-spacing:-0.2px; color:${EMAIL_THEME.onDark};">Dculus&nbsp;Forms</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="email-pad" style="padding:40px;">
              ${headingHtml}
              ${subtitleHtml}
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="email-pad" style="padding:24px 40px 32px 40px; background-color:${EMAIL_THEME.footerBg}; border-top:1px solid ${EMAIL_THEME.border};">
              <p style="margin:0 0 6px 0; font-family:${FONT_STACK}; font-size:13px; line-height:1.6; color:${EMAIL_THEME.muted}; text-align:center;">
                This email was sent from <strong style="color:${EMAIL_THEME.body};">Dculus Forms</strong>.
              </p>
              <p style="margin:0; font-family:${FONT_STACK}; font-size:13px; line-height:1.6; color:${EMAIL_THEME.muted}; text-align:center;">
                <a href="https://dculus.com" style="color:${EMAIL_THEME.green}; text-decoration:none;">Visit Dculus.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:support@dculus.com" style="color:${EMAIL_THEME.green}; text-decoration:none;">support@dculus.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** A paragraph of body copy with consistent spacing/typography. */
export function renderParagraph(html: string): string {
  return `<p style="margin:0 0 18px 0; font-family:${FONT_STACK}; font-size:16px; line-height:1.6; color:${EMAIL_THEME.body};">${html}</p>`;
}

/**
 * Bulletproof, table-based primary CTA button (green).
 * Keeps `class="cta-button"` for hover styling and test compatibility.
 */
export function renderButton(href: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 8px auto;">
    <tr>
      <td align="center" bgcolor="${EMAIL_THEME.green}" style="border-radius:10px;">
        <a href="${href}" target="_blank" class="cta-button" style="display:inline-block; padding:14px 34px; font-family:${FONT_STACK}; font-size:16px; font-weight:600; line-height:1; color:#ffffff; background-color:${EMAIL_THEME.green}; border-radius:10px; text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

type InfoBoxVariant = 'info' | 'warning' | 'security';

const INFO_BOX_STYLES: Record<InfoBoxVariant, { bg: string; border: string; text: string }> = {
  info: { bg: EMAIL_THEME.infoBg, border: EMAIL_THEME.infoBorder, text: EMAIL_THEME.infoText },
  warning: { bg: EMAIL_THEME.warningBg, border: EMAIL_THEME.warningBorder, text: EMAIL_THEME.warningText },
  security: { bg: EMAIL_THEME.securityBg, border: EMAIL_THEME.securityBorder, text: EMAIL_THEME.securityText },
};

/** A rounded, tinted callout box (expiry notices, security notes, etc.). */
export function renderInfoBox(variant: InfoBoxVariant, html: string): string {
  const s = INFO_BOX_STYLES[variant];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td style="background-color:${s.bg}; border:1px solid ${s.border}; border-radius:10px; padding:14px 16px; font-family:${FONT_STACK}; font-size:14px; line-height:1.55; color:${s.text};">${html}</td>
    </tr>
  </table>`;
}

/** Renders a large, monospace one-time-code display. */
export function renderOtpCode(otp: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
    <tr>
      <td align="center" style="background-color:${EMAIL_THEME.pageBg}; border:1px solid ${EMAIL_THEME.border}; border-radius:12px; padding:28px 20px;">
        <div style="font-family:${FONT_STACK}; font-size:12px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:${EMAIL_THEME.muted}; margin-bottom:14px;">Your verification code</div>
        <div style="font-family:'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size:36px; font-weight:700; letter-spacing:8px; color:${EMAIL_THEME.heading};">${otp}</div>
      </td>
    </tr>
  </table>`;
}

/** "Trouble with the button? Copy this link" fallback block. */
export function renderAltLink(url: string): string {
  return `
  <p style="margin:24px 0 6px 0; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:${EMAIL_THEME.muted};">If the button above doesn't work, copy and paste this link into your browser:</p>
  <p style="margin:0; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; word-break:break-all;"><a href="${url}" style="color:${EMAIL_THEME.green}; text-decoration:none;">${url}</a></p>`;
}
