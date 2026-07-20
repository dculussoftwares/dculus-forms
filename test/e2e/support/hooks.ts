import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, type Browser } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { CustomWorld } from './world';
import { hasStoredAuthState, STORAGE_STATE_PATH } from './authStorage';
import { attachDiagnostics } from './diagnostics';

setDefaultTimeout(120 * 1000);

// One browser per parallel worker process, reused across all scenarios that worker runs.
// Per-scenario isolation still comes from a fresh BrowserContext (and thus storage/cookies) below.
let sharedBrowser: Browser;

BeforeAll(async function () {
  sharedBrowser = await chromium.launch({ headless: process.env.E2E_HEADLESS !== 'false' });
});

AfterAll(async function () {
  await sharedBrowser?.close();
});

Before(async function (this: CustomWorld) {
  this.browser = sharedBrowser;
  this.context = await this.browser.newContext({
    baseURL: this.baseUrl,
    storageState: hasStoredAuthState() ? STORAGE_STATE_PATH : undefined,
    viewport: { width: 1280, height: 720 },
  });
  this.page = await this.context.newPage();

  this.consoleLogs = [];
  this.networkFailures = [];
  attachDiagnostics(this, this.page, 'main');
});

After(async function (this: CustomWorld, scenario) {
  if (scenario.result?.status === 'FAILED') {
    const slug = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    mkdirSync('test-results/e2e/screenshots', { recursive: true });

    const screenshotPath = `test-results/e2e/screenshots/${slug}.png`;
    await this.page?.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    console.log(`Failed at URL: ${this.page?.url()}`);

    let viewerUrl: string | undefined;
    if (this.viewerPage && !this.viewerPage.isClosed()) {
      const viewerScreenshotPath = `test-results/e2e/screenshots/${slug}.viewer.png`;
      await this.viewerPage.screenshot({ path: viewerScreenshotPath, fullPage: true }).catch(() => {});
      console.log(`Viewer screenshot saved to: ${viewerScreenshotPath}`);
      viewerUrl = this.viewerPage.url();
      console.log(`Viewer page at URL: ${viewerUrl}`);
    }

    if (this.pageB && !this.pageB.isClosed()) {
      const pageBScreenshotPath = `test-results/e2e/screenshots/${slug}.pageB.png`;
      await this.pageB.screenshot({ path: pageBScreenshotPath, fullPage: true }).catch(() => {});
      console.log(`PageB screenshot saved to: ${pageBScreenshotPath}`);
      console.log(`PageB at URL: ${this.pageB.url()}`);
    }

    const diagPath = `test-results/e2e/screenshots/${slug}.diagnostics.log`;
    const diagContent = [
      `Main page URL: ${this.page?.url()}`,
      `Viewer page URL: ${viewerUrl ?? '(no viewer page opened)'}`,
      `PageB URL: ${this.pageB && !this.pageB.isClosed() ? this.pageB.url() : '(no pageB opened)'}`,
      '--- console ---',
      ...this.consoleLogs,
      '--- network failures / 4xx+5xx ---',
      ...this.networkFailures,
    ].join('\n');
    writeFileSync(diagPath, diagContent);
    console.log(`Diagnostics saved to: ${diagPath}`);
  }

  await this.page?.close();
  await this.pageB?.close();
  await this.viewerPage?.close();
  await this.context?.close();
  await this.contextB?.close();
  // Note: browser is shared across scenarios in this worker (see BeforeAll) — do not close it here.
});
