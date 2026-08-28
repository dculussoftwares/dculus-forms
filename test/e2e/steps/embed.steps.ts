/**
 * Form Embed v1 E2E steps.
 *
 * The value of these steps is the cross-origin boundary, so the fixture host
 * page is served by a real HTTP server on 127.0.0.1 — a different origin from
 * the form-viewer's localhost, which means the browser enforces the same
 * postMessage and cookie rules a customer's site would. Building the host page
 * with `page.setContent` would run it on `about:blank`, where origin checks are
 * meaningless and every one of these assertions would pass vacuously.
 *
 * The snippet under test is read out of the panel's own snippet box rather
 * than reconstructed here, so a change to the generator that breaks the output
 * fails these scenarios instead of being mirrored by them.
 *
 * @see docs/form-embed-v1-spec.md §13
 */

import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import { When, Then, After } from '@cucumber/cucumber';
import { expect, type BrowserContext } from '@playwright/test';
import { CustomWorld } from '../support/world';

/** Host pages started by a scenario, torn down in the After hook. */
const hostServers = new Map<CustomWorld, Server>();

/** Browser contexts opened for those host pages, torn down alongside them. */
const hostContexts = new Map<CustomWorld, BrowserContext>();

interface EmbedWorld extends CustomWorld {
  embedSnippet?: string;
  hostPageUrl?: string;
}

function hostPageHtml(snippet: string): string {
  // The instrumentation is the assertion surface: it records every dculus:*
  // message verbatim so a later step can check both that a message arrived and
  // that it carried nothing it shouldn't.
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Embed host fixture</title></head>
<body>
  <h1>Host page</h1>
  <button id="before">before</button>
  ${snippet}
  <button id="after">after</button>
  <div style="height:800px"></div>
  <script>
    window.__dculusMessages = [];
    window.addEventListener('message', function (e) {
      if (e.data && typeof e.data.type === 'string' && e.data.type.indexOf('dculus:') === 0) {
        window.__dculusMessages.push(e.data);
      }
    });
    window.__embedState = function () {
      var frame = document.querySelector('iframe');
      var overlay = document.querySelector('[role="dialog"]');
      var active = document.activeElement;
      return {
        hasFrame: !!frame,
        frameHeight: frame ? parseInt(frame.style.height, 10) : null,
        overlayOpen: !!overlay,
        bodyOverflow: document.body.style.overflow,
        activeTag: active ? active.tagName : null,
        activeText: active ? (active.textContent || '').trim().slice(0, 40) : null,
      };
    };
  </script>
</body></html>`;
}

async function startHostPage(world: EmbedWorld, snippet: string): Promise<string> {
  const html = hostPageHtml(snippet);
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise<void>((resolve) => {
    // 127.0.0.1 rather than localhost: the form-viewer is served from
    // localhost, and using the same hostname would make this same-origin and
    // quietly defeat the point of the test.
    server.listen(0, '127.0.0.1', () => resolve());
  });

  hostServers.set(world, server);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/`;
}

async function openHostPage(world: EmbedWorld, snippet: string): Promise<void> {
  if (!world.browser) throw new Error('Browser is not initialized');

  const url = await startHostPage(world, snippet);
  world.hostPageUrl = url;

  const context = await world.browser.newContext({ viewport: { width: 1280, height: 900 } });
  hostContexts.set(world, context);
  world.viewerPage = await context.newPage();
  await world.viewerPage.goto(url);
  await world.viewerPage.waitForLoadState('networkidle');
}

/** The snippet exactly as an owner would paste it, for a given short URL. */
function inlineSnippet(viewerOrigin: string, shortUrl: string): string {
  return [
    `<div data-dculus-form="${shortUrl}" data-dculus-mode="inline"></div>`,
    `<script src="${viewerOrigin}/embed.js" async></script>`,
  ].join('\n');
}

function lightboxSnippet(viewerOrigin: string, shortUrl: string): string {
  return [
    `<div data-dculus-form="${shortUrl}" data-dculus-mode="lightbox"`,
    `     data-dculus-label="Give feedback"`,
    `     data-dculus-title="Embed test form"></div>`,
    `<script src="${viewerOrigin}/embed.js" async></script>`,
  ].join('\n');
}

async function graphql(world: CustomWorld, query: string, variables: unknown) {
  if (!world.page) throw new Error('Page is not initialized');
  const result = await world.page.evaluate(
    async ({ q, v, backendUrl }) => {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: q, variables: v }),
      });
      return res.json();
    },
    { q: query, v: variables, backendUrl: world.backendUrl }
  );
  if (result.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

/* ------------------------------------------------------------------ panel */

When('I open the collect responses panel on the embed tab', async function (this: EmbedWorld) {
  if (!this.page) throw new Error('Page is not initialized');

  // The ⋯ → Embed shortcut, which must land on the Embed tab directly rather
  // than on Link.
  await this.page.getByRole('button', { name: /more/i }).click();
  await this.page.getByTestId('embed-form-menu-item').click();

  await expect(this.page.getByTestId('collect-responses-panel')).toBeVisible({ timeout: 10_000 });
  await expect(this.page.getByTestId('embed-tab')).toBeVisible({ timeout: 10_000 });
});

Then('the embed type {string} should be selected', async function (this: EmbedWorld, type: string) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId(`embed-type-${type}`)).toHaveAttribute('aria-checked', 'true');
});

Then(
  'the embed snippet should contain {string}',
  async function (this: EmbedWorld, expected: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const snippet = await this.page.getByTestId('embed-snippet').innerText();
    expect(snippet).toContain(expected);
  }
);

Then('the embed snippet should contain the embed loader script', async function (this: EmbedWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const snippet = await this.page.getByTestId('embed-snippet').innerText();
  expect(snippet).toContain('/embed.js');
  // The no-JS fallback is what a visitor gets when an ad blocker eats the
  // loader, so its absence is a real regression rather than cosmetic.
  expect(snippet).toContain('<noscript>');
  this.embedSnippet = snippet;
});

When('I copy the embed snippet', async function (this: EmbedWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  this.embedSnippet = await this.page.getByTestId('embed-snippet').innerText();
  await this.page.getByTestId('embed-copy-snippet').click();
});

Then(
  "the form's saved embed type should be {string}",
  async function (this: EmbedWorld, expected: string) {
    if (!this.currentFormId) throw new Error('No current form id');
    // Copy is also what persists settings.embed, so poll for the mutation
    // rather than betting a fixed wait against CI's slowest run.
    await expect
      .poll(
        async () => {
          const data = await graphql(
            this,
            `query GetEmbed($id: ID!) { form(id: $id) { id settings { embed { enabled type } } } }`,
            { id: this.currentFormId }
          );
          return data.form.settings?.embed?.type ?? null;
        },
        { timeout: 15_000 }
      )
      .toBe(expected);
  }
);

When('I require respondents to sign in', async function (this: EmbedWorld) {
  if (!this.currentFormId) throw new Error('No current form id');
  await graphql(
    this,
    `mutation Gate($id: ID!, $input: UpdateFormInput!) { updateForm(id: $id, input: $input) { id } }`,
    {
      id: this.currentFormId,
      input: {
        settings: {
          accessControl: { enabled: true, requireSignIn: true, allowedDomains: [] },
        },
      },
    }
  );
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
});

Then('the framed embed types should be disabled', async function (this: EmbedWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  for (const type of ['inline', 'lightbox', 'iframe']) {
    await expect(this.page.getByTestId(`embed-type-${type}`)).toBeDisabled();
  }
});

Then('the gated embed warning should be shown', async function (this: EmbedWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('embed-gated-warning')).toBeVisible();
});

/* -------------------------------------------------------------- host page */

When('I open a host page with the copied inline embed snippet', async function (this: EmbedWorld) {
  if (!this.embedSnippet) throw new Error('No embed snippet captured');
  // The panel renders relative-free absolute URLs, so the snippet works
  // verbatim from another origin — which is exactly what is being asserted.
  await openHostPage(this, this.embedSnippet.replace(/<noscript>[\s\S]*<\/noscript>/, ''));
});

When('I open a host page with a lightbox embed snippet', async function (this: EmbedWorld) {
  if (!this.formShortUrl) throw new Error('Form short URL is not set');
  await openHostPage(this, lightboxSnippet(this.formViewerUrl, this.formShortUrl));
});

When('I open a host page with an inline embed snippet', async function (this: EmbedWorld) {
  if (!this.formShortUrl) throw new Error('Form short URL is not set');
  await openHostPage(this, inlineSnippet(this.formViewerUrl, this.formShortUrl));
});

Then('the embedded form should render inside the host page', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  const frame = this.viewerPage.frameLocator('iframe');
  await expect(frame.getByTestId('embed-form-viewer')).toBeVisible({ timeout: 30_000 });
});

Then(
  'the host page should have received a {string} message',
  async function (this: EmbedWorld, type: string) {
    if (!this.viewerPage) throw new Error('Host page is not open');
    await expect
      .poll(
        async () =>
          this.viewerPage!.evaluate(
            (t) => (window as any).__dculusMessages.some((m: any) => m.type === t),
            type
          ),
        { timeout: 30_000 }
      )
      .toBe(true);
  }
);

Then('the embedded frame should be sized to its content', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');

  // The placeholder is 400px; anything still at exactly that means no resize
  // message ever landed and the frame is guessing.
  await expect
    .poll(async () => this.viewerPage!.evaluate(() => (window as any).__embedState().frameHeight), {
      timeout: 30_000,
    })
    .not.toBe(400);

  const { frameHeight } = await this.viewerPage.evaluate(() => (window as any).__embedState());
  expect(frameHeight).toBeGreaterThan(100);

  // The frame must be at least as tall as its own document, or the respondent
  // gets a scrollbar inside the embed — the failure this whole protocol exists
  // to prevent.
  const documentHeight = await this.viewerPage
    .frameLocator('iframe')
    .locator('[data-testid="embed-form-viewer"]')
    .evaluate((el) => Math.ceil(el.getBoundingClientRect().height));
  expect(frameHeight).toBeGreaterThanOrEqual(documentHeight - 4);
});

When('I submit the embedded form', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  const frame = this.viewerPage.frameLocator('iframe');

  // Layouts with an intro screen gate the pages behind a CTA.
  const cta = frame.getByTestId('viewer-cta-button');
  if (await cta.count()) {
    await cta.click();
  }

  // Walk to the last page, then submit.
  for (let i = 0; i < 10; i++) {
    const submit = frame.getByRole('button', { name: /^submit$/i });
    if (await submit.count()) {
      await submit.click();
      break;
    }
    const next = frame.getByRole('button', { name: /^(ok|next)$/i }).first();
    if (!(await next.count())) break;
    await next.click();
    await this.viewerPage.waitForTimeout(300);
  }

  await expect(frame.getByText(/thank you/i).first()).toBeVisible({ timeout: 30_000 });
});

Then('no answer data should have crossed the frame boundary', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  const messages = await this.viewerPage.evaluate(() => (window as any).__dculusMessages);

  // Whitelist rather than blacklist: a new field added to the protocol without
  // thinking about this boundary should fail here, not slip through because it
  // wasn't on a list of forbidden names.
  const allowedKeys = new Set(['type', 'v', 'formId', 'instanceId', 'height']);
  for (const message of messages) {
    for (const key of Object.keys(message)) {
      expect(
        allowedKeys.has(key),
        `unexpected key "${key}" in ${message.type} — no response data may cross the frame`
      ).toBe(true);
    }
  }
});

Then(
  'the response should be recorded with embed context {string}',
  async function (this: EmbedWorld, context: string) {
    if (!this.currentFormId) throw new Error('No current form id');
    // Read it back through the API the analytics view uses, so this asserts
    // the whole capture path rather than a column write.
    await expect
      .poll(
        async () => {
          const data = await graphql(
            this,
            `query Sources($formId: ID!) {
               formAnalytics(formId: $formId) { trafficSources { context count } }
             }`,
            { formId: this.currentFormId }
          );
          const sources = data.formAnalytics?.trafficSources ?? [];
          return sources.some((s: any) => s.context === context && s.count > 0);
        },
        { timeout: 30_000 }
      )
      .toBe(true);
  }
);

/* --------------------------------------------------------------- lightbox */

Then('the lightbox trigger button should be visible', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  await expect(this.viewerPage.getByRole('button', { name: 'Give feedback' })).toBeVisible({
    timeout: 30_000,
  });
});

Then('no embedded frame should have loaded yet', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  // An embed nobody opens must cost the visitor nothing.
  const { hasFrame } = await this.viewerPage.evaluate(() => (window as any).__embedState());
  expect(hasFrame).toBe(false);
});

When('I click the lightbox trigger', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  await this.viewerPage.getByRole('button', { name: 'Give feedback' }).click();
});

Then('the lightbox overlay should be open', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  await expect(this.viewerPage.locator('[role="dialog"][aria-modal="true"]')).toBeVisible({
    timeout: 10_000,
  });
  await expect(this.viewerPage.frameLocator('iframe').getByTestId('embed-form-viewer')).toBeVisible({
    timeout: 30_000,
  });
});

Then('the host page body scroll should be locked', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  const { bodyOverflow } = await this.viewerPage.evaluate(() => (window as any).__embedState());
  expect(bodyOverflow).toBe('hidden');
});

When('I press Escape inside the embedded form', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');

  // Dispatched INSIDE the cross-origin frame, on a frame-scoped locator. The
  // host never sees a keydown raised in there, so the overlay can only close
  // because the iframe forwards it as dculus:closeself — the regression this
  // step exists to catch.
  //
  // Pressing on the frame locator rather than clicking into the frame and
  // using page-level `keyboard.press` is deliberate: the latter depends on the
  // host routing the key across the frame boundary, which does not happen
  // reliably, and made this step fail roughly one run in three.
  await this.viewerPage
    .frameLocator('iframe')
    .locator('body')
    .press('Escape');
});

Then('the lightbox overlay should be closed', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  await expect
    .poll(async () => this.viewerPage!.evaluate(() => (window as any).__embedState().overlayOpen), {
      timeout: 15_000,
    })
    .toBe(false);
});

Then('the host page body scroll should be restored', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  const { bodyOverflow } = await this.viewerPage.evaluate(() => (window as any).__embedState());
  expect(bodyOverflow).not.toBe('hidden');
});

Then('focus should return to the lightbox trigger', async function (this: EmbedWorld) {
  if (!this.viewerPage) throw new Error('Host page is not open');
  const { activeTag, activeText } = await this.viewerPage.evaluate(() =>
    (window as any).__embedState()
  );
  expect(activeTag).toBe('BUTTON');
  expect(activeText).toBe('Give feedback');
});

After(async function (this: EmbedWorld) {
  // The context has to go first: its open page holds a keep-alive connection
  // to the fixture server, which would otherwise keep the handle open.
  const context = hostContexts.get(this);
  if (context) {
    await context.close();
    hostContexts.delete(this);
  }

  const server = hostServers.get(this);
  if (server) {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    hostServers.delete(this);
  }
});
