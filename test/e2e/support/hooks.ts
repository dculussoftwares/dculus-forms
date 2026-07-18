import { Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { CustomWorld } from './world';
import { hasStoredAuthState, STORAGE_STATE_PATH } from './authStorage';
import { attachDiagnostics } from './diagnostics';

setDefaultTimeout(120 * 1000);

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({ headless: this.headless });
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
  await this.browser?.close();
});
