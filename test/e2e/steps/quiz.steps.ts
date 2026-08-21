/**
 * Native Quiz E2E steps (GitHub epic #289, issue #302).
 *
 * Reuses shared drag/settings/GraphQL-creation helpers from ./helpers wherever
 * possible. Custom steps here only cover quiz-specific UI (the wizard's
 * "Create a Quiz" card, the per-field answer-key editor, the respondent result
 * screen, and the responses table's Score/Status columns) — none of which has
 * existing step coverage elsewhere.
 *
 * Radio/checkbox fields always start with three default options ("Option 1",
 * "Option 2", "Option 3") whether they're dropped in the builder (see
 * apps/form-app/src/store/helpers/fieldHelpers.ts) or defined directly in a
 * hand-built GraphQL formSchema below — every scenario here keys "Option 1"
 * as the correct answer so the same viewer-answering step works regardless of
 * how the quiz form was created.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { createFormViaGraphQL } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Wizard — "Create a Quiz" entry point
// ─────────────────────────────────────────────────────────────────────────────

When('I create a quiz via the wizard titled {string}', async function (this: CustomWorld, title: string) {
  if (!this.page) throw new Error('Page is not initialized');

  await this.page.goto('/dashboard');

  const createButton = this.page.getByRole('button', { name: /create form/i });
  await createButton.click();

  const quizChoice = this.page.getByRole('button', { name: 'Create a Quiz' });
  await quizChoice.waitFor({ timeout: 10_000 });
  await quizChoice.click();

  const titleInput = this.page.getByPlaceholder(/World Capitals Trivia/i);
  await titleInput.waitFor({ timeout: 10_000 });
  const quizTitle = `${title} ${Date.now()}`;
  this.newFormTitle = quizTitle;
  await titleInput.fill(quizTitle);

  const continueButton = this.page.getByRole('button', { name: /^continue$/i });
  await continueButton.click();

  const createFormButton = this.page.getByRole('button', { name: /^create form$/i });
  await createFormButton.waitFor({ timeout: 15_000 });
  await createFormButton.click();

  // The wizard navigates to `/builder/page-builder`, but the builder shell
  // itself immediately resolves that to a tab-specific URL (observed:
  // `/builder/content?screen=page:{id}`) — match any builder sub-route rather
  // than the wizard's literal target.
  await expect(this.page).toHaveURL(/\/dashboard\/form\/[^/]+\/builder\//, { timeout: 45_000 });
});

Then('I should be in the collaborative builder', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const builderRoot = this.page.getByTestId('collaborative-form-builder');
  await expect(builderRoot).toBeVisible({ timeout: 45_000 });
});

When('I navigate to the form dashboard from the builder', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const url = this.page.url();
  const match = url.match(/\/dashboard\/form\/([^/]+)/);
  if (!match) throw new Error(`Could not extract form ID from builder URL: ${url}`);
  this.currentFormId = match[1];
  // The last field save's Y.js update is sent over the collaboration
  // WebSocket, not plain HTTP — "networkidle" after clicking Save (in the
  // "I save the ... field settings" steps) doesn't wait for it to actually
  // reach the server. Navigating away immediately can abort that in-flight
  // WebSocket message before Hocuspocus persists it, so the answer key
  // saved moments ago silently never reaches the DB. A short settle window
  // avoids that race.
  await this.page.waitForTimeout(1_500);
  await this.page.goto(`${this.baseUrl}/dashboard/form/${match[1]}`);
  await expect(this.page.getByTestId('app-sidebar')).toBeVisible({ timeout: 30_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression scenario — a plain non-quiz, single-page form. Built via the
// shared `createFormViaGraphQL` helper (no `settings` sent at all — the
// exact payload shape every pre-quiz test already uses) rather than the
// "first template" + "add a new page" flow, since the seeded templates are
// multi-field/multi-page and would require navigating through unrelated
// required fields in the viewer just to reach the one field this scenario
// cares about.
// ─────────────────────────────────────────────────────────────────────────────

function nonQuizFormSchema() {
  return {
    layout: {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      code: 'L9',
      content: '<h1>Regression Test</h1>',
      backgroundImageKey: '',
      pageMode: 'multipage',
    },
    pages: [{ id: 'page-1', title: 'Page 1', order: 1, fields: [] }],
    isShuffleEnabled: false,
  };
}

When('I create a non-quiz form via GraphQL for the regression check', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, nonQuizFormSchema(), 'E2E Quiz Regression Test');
});

// ─────────────────────────────────────────────────────────────────────────────
// Answer-key authoring (GradingSettings, field-settings-v2/GradingSettings.tsx)
// ─────────────────────────────────────────────────────────────────────────────

When('I mark the first option as the correct answer', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const section = this.page.getByTestId('grading-settings-section');
  await expect(section).toBeVisible({ timeout: 15_000 });
  await section.locator('#grading-option-0').click();
});

Then('quiz mode should be visible in the builder', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const strip = this.page.getByTestId('quiz-summary-strip');
  await expect(strip).toBeVisible({ timeout: 15_000 });
});

Then('the quiz summary strip should not be visible in the builder', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('quiz-summary-strip')).toHaveCount(0);
});

Then('the grading settings section should not be visible', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await expect(this.page.getByTestId('grading-settings-section')).toHaveCount(0);
});

// The builder assigns each dragged field a random id (unlike the hand-built
// schemas in helpers/form-schemas.ts, whose fields use friendly ids like
// "field-required"), and the viewer names each input after the field's real
// id (see packages/ui/src/renderers/FormFieldRenderer.tsx's `name={field.id}`)
// — so a field added via drag-and-drop can only be targeted generically.
When('I fill the only text field with valid data in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const textbox = this.viewerPage.locator('input[type="text"]').first();
  await expect(textbox).toBeVisible({ timeout: 10_000 });
  await textbox.fill('Regression test answer');
});

// ─────────────────────────────────────────────────────────────────────────────
// Respondent viewer — answering + result screen
// (packages/ui/src/renderers/QuizResultScreen.tsx, mounted inside thank-you-display)
// ─────────────────────────────────────────────────────────────────────────────

// The wizard's blank-quiz flow defaults to layout L1 (packages/ui/src/layouts/
// L1ClassicLayout.tsx), which shows a cover screen with a "Get Started" (or
// custom CTA) button before any field renders — not quiz-specific, every L1
// form has it. Call this once right after the form becomes visible in the
// viewer; it's a no-op for layouts without a cover screen.
When('I dismiss the viewer cover screen if present', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const getStarted = this.viewerPage.getByRole('button', { name: /get started/i });
  // `isVisible()` checks the current DOM snapshot only — it doesn't wait —
  // so calling it right after navigation can race the cover screen's render
  // and report "absent" even when one is coming. `waitFor` actually waits.
  // Only the wait is caught (a real click failure must still propagate,
  // rather than being swallowed as "no cover screen present").
  let coverScreenPresent = true;
  try {
    await getStarted.waitFor({ state: 'visible', timeout: 3_000 });
  } catch (error) {
    // Only a genuine timeout means "no cover screen for this layout" — any
    // other error (e.g. the page/context was closed) is a real failure and
    // must propagate rather than being silently treated as "absent".
    if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
    coverScreenPresent = false;
  }
  if (coverScreenPresent) {
    await getStarted.click();
  }
});

When('I answer the radio and checkbox questions correctly in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');

  const radioOption = this.viewerPage.getByRole('radio', { name: 'Option 1' });
  await expect(radioOption).toBeVisible({ timeout: 10_000 });
  await radioOption.click({ force: true });

  const checkboxOption = this.viewerPage.getByRole('checkbox', { name: 'Option 1' });
  await expect(checkboxOption).toBeVisible({ timeout: 10_000 });
  await checkboxOption.click({ force: true });
});

Then('I should see a passing quiz score on the result screen', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');

  await expect(this.viewerPage.getByTestId('thank-you-display')).toBeVisible({ timeout: 15_000 });

  const resultScreen = this.viewerPage.getByTestId('quiz-result-screen');
  await expect(resultScreen).toBeVisible({ timeout: 15_000 });

  const badge = this.viewerPage.getByTestId('quiz-result-badge');
  await expect(badge).toBeVisible({ timeout: 10_000 });
  await expect(badge).toContainText(/passed/i);

  await expect(this.viewerPage.getByTestId('quiz-result-score')).toBeVisible({ timeout: 10_000 });
});

Then('I should see the quiz pending message in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await expect(this.viewerPage.getByTestId('quiz-result-pending')).toBeVisible({ timeout: 15_000 });
  await expect(this.viewerPage.getByTestId('quiz-result-pending-message')).toBeVisible({ timeout: 10_000 });
});

Then('I should not see a quiz score or badge in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await expect(this.viewerPage.getByTestId('quiz-result-score')).toHaveCount(0);
  await expect(this.viewerPage.getByTestId('quiz-result-badge')).toHaveCount(0);
  await expect(this.viewerPage.getByTestId('quiz-result-screen')).toHaveCount(0);
});

Then('no quiz result UI should be shown in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await expect(this.viewerPage.getByTestId('quiz-result-screen')).toHaveCount(0);
  await expect(this.viewerPage.getByTestId('quiz-result-pending')).toHaveCount(0);
  await expect(this.viewerPage.getByTestId('quiz-result-badge')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Quiz form creation via GraphQL (scenarios that need deterministic, repeatable
// scores rather than driving the wizard + builder UI end to end again)
// ─────────────────────────────────────────────────────────────────────────────

function quizFormSchema() {
  return {
    layout: {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      // L9 has no cover/intro screen (packages/ui/src/layouts/L9PagesLayout.tsx)
      // — fields render immediately, unlike L1 (the wizard's default), which
      // shows a "Get Started" cover the respondent must click through first.
      code: 'L9',
      content: '<h1>Quiz Time</h1>',
      thankYouContent: '<h1>Thanks!</h1>',
      customBackGroundColor: '#ffffff',
      backgroundImageKey: '',
      pageMode: 'multipage',
    },
    pages: [
      {
        id: 'quiz-page-1',
        title: 'Quiz',
        order: 1,
        fields: [
          {
            id: 'quiz-radio-field',
            type: 'radio_field',
            label: 'Radio Question',
            defaultValue: '',
            prefix: '',
            hint: '',
            validation: { required: true, type: 'fillable_form_field_validation' },
            options: ['Option 1', 'Option 2', 'Option 3'],
            grading: { mode: 'exact', pointValue: 1, acceptedAnswers: ['Option 1'] },
          },
          {
            id: 'quiz-checkbox-field',
            type: 'checkbox_field',
            label: 'Checkbox Question',
            defaultValue: '',
            prefix: '',
            hint: '',
            placeholder: '',
            validation: { required: true, type: 'checkbox_field_validation' },
            options: ['Option 1', 'Option 2', 'Option 3'],
            grading: {
              mode: 'set',
              pointValue: 1,
              acceptedAnswers: ['Option 1'],
              set: { scoring: 'all' },
            },
          },
        ],
      },
    ],
    isShuffleEnabled: false,
  };
}

async function createQuizFormViaGraphQL(
  world: CustomWorld,
  gradeRelease: 'immediate' | 'afterReview'
): Promise<string> {
  if (!world.page) throw new Error('Page is not initialized');

  await world.page.goto(`${world.baseUrl}/dashboard`);
  await world.page.waitForTimeout(2000);

  const organizationId = await world.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;
    const apolloClient = (
      window as Window & { __APOLLO_CLIENT__?: { cache?: { extract: () => Record<string, unknown> } } }
    ).__APOLLO_CLIENT__;
    if (apolloClient?.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKey = Object.keys(cacheData).find((k: string) => k.startsWith('Organization:'));
        if (orgKey) return orgKey.split(':')[1];
      } catch { /* ignore */ }
    }
    return new URL(window.location.href).searchParams.get('org');
  });

  if (!organizationId) throw new Error('Organization ID not found');

  const formTitle = `E2E Quiz Test ${Date.now()}`;
  const settings = {
    quiz: {
      enabled: true,
      passThresholdPercent: 60,
      gradeRelease,
      respondentVisibility: {
        totalScore: true,
        perQuestionCorrectness: true,
        correctAnswers: false,
        pointValues: false,
        feedback: false,
        passFailBadge: true,
      },
    },
  };

  const response = await world.page.evaluate(
    async ({ orgId, title, formSchema, settings, backendUrl }) => {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `mutation CreateForm($input: CreateFormInput!) {
            createForm(input: $input) { id title shortUrl }
          }`,
          variables: { input: { title, formSchema, organizationId: orgId, settings } },
        }),
      });
      return res.json();
    },
    { orgId: organizationId, title: formTitle, formSchema: quizFormSchema(), settings, backendUrl: world.backendUrl }
  );

  if (response.errors) {
    throw new Error(`GraphQL error creating quiz form: ${JSON.stringify(response.errors)}`);
  }
  if (!response.data?.createForm?.id) {
    throw new Error(`createForm returned no form id: ${JSON.stringify(response)}`);
  }

  const formId = response.data.createForm.id;
  world.newFormTitle = formTitle;
  world.currentFormId = formId;
  await world.page.goto(`${world.baseUrl}/dashboard/form/${formId}`);
  await expect(world.page.getByTestId('app-sidebar')).toBeVisible({ timeout: 30_000 });
  // `app-sidebar` is generic layout chrome that renders before this specific
  // form's own data (isPublished, etc.) has finished loading — clicking
  // Publish immediately after can race that fetch and silently no-op.
  await world.page.waitForLoadState('networkidle');
  return formId;
}

When('I create a quiz form via GraphQL with gradeRelease {string}', async function (this: CustomWorld, gradeRelease: string) {
  if (gradeRelease !== 'immediate' && gradeRelease !== 'afterReview') {
    throw new Error(`Unsupported gradeRelease in this step: ${gradeRelease}`);
  }
  await createQuizFormViaGraphQL(this, gradeRelease);
});

// Epic #289 D9 (Story 17, #321): 'afterReview'/'scheduled' is only reachable
// through respondent identity, so createForm must reject it outright on a
// form with neither accessControl.enabled nor collectRespondentEmail. Mirrors
// createQuizFormViaGraphQL above but asserts the mutation is REJECTED instead
// of asserting it succeeds — there is deliberately no follow-up viewer flow,
// since this combination can never be saved in the first place.
Then('creating a quiz form via GraphQL with gradeRelease {string} and no respondent identity should be rejected', async function (this: CustomWorld, gradeRelease: string) {
  if (!this.page) throw new Error('Page is not initialized');

  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;
    const apolloClient = (
      window as Window & { __APOLLO_CLIENT__?: { cache?: { extract: () => Record<string, unknown> } } }
    ).__APOLLO_CLIENT__;
    if (apolloClient?.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKey = Object.keys(cacheData).find((k: string) => k.startsWith('Organization:'));
        if (orgKey) return orgKey.split(':')[1];
      } catch { /* ignore */ }
    }
    return new URL(window.location.href).searchParams.get('org');
  });

  if (!organizationId) throw new Error('Organization ID not found');

  const settings = {
    quiz: {
      enabled: true,
      passThresholdPercent: 60,
      gradeRelease,
      respondentVisibility: {
        totalScore: true,
        perQuestionCorrectness: true,
        correctAnswers: false,
        pointValues: false,
        feedback: false,
        passFailBadge: true,
      },
    },
  };

  const response = await this.page.evaluate(
    async ({ orgId, title, formSchema, settings, backendUrl }) => {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `mutation CreateForm($input: CreateFormInput!) {
            createForm(input: $input) { id title shortUrl }
          }`,
          variables: { input: { title, formSchema, organizationId: orgId, settings } },
        }),
      });
      return res.json();
    },
    {
      orgId: organizationId,
      title: `E2E Quiz Rejection Test ${Date.now()}`,
      formSchema: quizFormSchema(),
      settings,
      backendUrl: this.backendUrl,
    }
  );

  if (!response.errors?.length) {
    throw new Error(
      `Expected createForm to reject gradeRelease "${gradeRelease}" with no respondent identity, but it succeeded: ${JSON.stringify(response)}`
    );
  }
  expect(response.errors[0].message).toMatch(/deferred grade release/i);
});

// A form created moments ago via the createForm mutation can have its publish
// click race the dashboard's own GET_FORM_BY_ID fetch still settling — the
// click lands but the status badge never flips to "Live" within the shared
// "I publish the form" step's window. Retrying with a reload in between (this
// step is only used by this file's GraphQL-created scenarios) works around
// that without touching the shared step other suites rely on.
When('I publish the quiz form', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const publishButton = this.page.getByTestId('publish-form-button');
  const statusBadge = this.page.getByTestId('form-status-badge');

  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(publishButton).toBeVisible({ timeout: 10_000 });
    await publishButton.click();
    try {
      await expect(statusBadge).toContainText(/live/i, { timeout: 10_000 });
      return;
    } catch {
      if (attempt === 2) throw new Error('Publish never took effect after 3 attempts');
      await this.page.reload();
      await expect(this.page.getByTestId('app-sidebar')).toBeVisible({ timeout: 30_000 });
      await this.page.waitForLoadState('networkidle');
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Submitting responses as a respondent (separate viewer browser contexts, one
// per submission, so each response is independent of any other's form state)
// ─────────────────────────────────────────────────────────────────────────────

async function submitQuizResponse(world: CustomWorld, correct: boolean): Promise<void> {
  if (!world.browser) throw new Error('Browser is not initialized');
  if (!world.formShortUrl) throw new Error('Form short URL is not set');

  const context = await world.browser.newContext({
    baseURL: world.formViewerUrl,
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  await page.goto(`/f/${world.formShortUrl}`);
  await page.waitForSelector(
    '[data-testid="form-viewer-loading"], [data-testid="form-viewer-error"], [data-testid="form-viewer-renderer"]',
    { timeout: 30_000 }
  );
  await expect(page.getByTestId('form-viewer-renderer')).toBeVisible({ timeout: 30_000 });

  const radioLabel = correct ? 'Option 1' : 'Option 2';
  await page.getByRole('radio', { name: radioLabel }).click({ force: true });

  const checkboxLabel = correct ? 'Option 1' : 'Option 2';
  await page.getByRole('checkbox', { name: checkboxLabel }).click({ force: true });

  const submitButton = page.getByTestId('viewer-submit-button');
  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await expect(submitButton).toBeEnabled({ timeout: 5_000 });
  await submitButton.click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('thank-you-display')).toBeVisible({ timeout: 15_000 });

  world.viewerPage = page;
}

When('I submit a fully correct quiz response as a respondent', async function (this: CustomWorld) {
  await submitQuizResponse(this, true);
});

When('I submit a fully incorrect quiz response as a respondent', async function (this: CustomWorld) {
  await submitQuizResponse(this, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Responses table — Score/Status columns (createGradeColumns in
// apps/form-app/src/utils/createResponsesColumns.tsx)
// ─────────────────────────────────────────────────────────────────────────────

// Deliberately distinct step text from response-filters.steps.ts's
// "I navigate to the responses page" — that step reads a module-scoped
// `currentFormId` local to that file, not `this.currentFormId`, so reusing its
// exact wording here would silently navigate using unrelated (or null) state.
When('I view the responses table for the quiz form', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');

  let formId = this.currentFormId;
  if (!formId) {
    const match = this.page.url().match(/\/dashboard\/form\/([^/]+)/);
    if (!match) throw new Error(`Could not determine form ID from current page URL: ${this.page.url()}`);
    formId = match[1];
  }

  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}/responses`);
  const responsesTable = this.page.getByTestId('responses-table');
  await expect(responsesTable).toBeVisible({ timeout: 30_000 });
});

Then('I should see a Score column in the responses table', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const header = this.page.getByRole('button', { name: 'Score' });
  await expect(header).toBeVisible({ timeout: 15_000 });
});

Then('there should be no quiz score column in the responses table', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByRole('button', { name: 'Score' })).toHaveCount(0);
});

// Reads each row's Score cell specifically (not the whole row's concatenated
// text) — adjacent table cells share no separator when Playwright reads
// textContent across a row, so e.g. a "Option 2" cell followed immediately by
// a "0/2 · 0%" cell reads as "Option 20/2 · 0%", and a row-wide regex match
// silently absorbs that trailing "2" into the score ("20/2" instead of
// "0/2"). Matching each cell's own, anchored text avoids that entirely.
async function readScorePairs(world: CustomWorld): Promise<Array<[number, number]>> {
  // The table shows an "Updating..." overlay while the sorted refetch is in
  // flight — networkidle can resolve just before that request actually
  // starts (it's fired from a React state update, not synchronously with the
  // click), so wait for the overlay to clear rather than trusting networkidle
  // alone.
  await world.page!.getByText('Updating...').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});

  const rows = world.page!.locator('[data-testid="responses-table"] tbody tr');
  const rowCount = await rows.count();
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < rowCount; i++) {
    const cells = rows.nth(i).locator('td');
    const cellTexts = await cells.allTextContents();
    const scoreText = cellTexts.find((text) => /^\s*\d+\s*\/\s*\d+\s*·/.test(text));
    if (!scoreText) {
      throw new Error(`Could not find a Score cell in row ${i}: ${JSON.stringify(cellTexts)}`);
    }
    const match = scoreText.match(/^\s*(\d+)\s*\/\s*(\d+)\s*·/);
    pairs.push([Number(match![1]), Number(match![2])]);
  }
  return pairs;
}

Then('clicking the score column header should sort the responses by score', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const header = this.page.getByRole('button', { name: 'Score' });

  await header.click();
  await this.page.waitForLoadState('networkidle');
  await this.page.waitForTimeout(500);
  const afterFirstClick = await readScorePairs(this);
  // The two seeded responses (fully correct / fully incorrect) must have
  // different scores, otherwise "sorting changed the order" can't be observed.
  expect(new Set(afterFirstClick.map(([score, max]) => `${score}/${max}`)).size).toBeGreaterThan(1);

  await header.click();
  await this.page.waitForLoadState('networkidle');
  await this.page.waitForTimeout(500);
  const afterSecondClick = await readScorePairs(this);

  expect(afterSecondClick[0]).toEqual(afterFirstClick[afterFirstClick.length - 1]);
  expect(afterSecondClick[afterSecondClick.length - 1]).toEqual(afterFirstClick[0]);
});
