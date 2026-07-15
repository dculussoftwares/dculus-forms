import { Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { CustomWorld } from './world';
import { hasStoredAuthState, STORAGE_STATE_PATH } from './authStorage';

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
  this.page.on('console', (msg) => {
    this.consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  this.page.on('pageerror', (err) => {
    this.consoleLogs.push(`[pageerror] ${err.message}`);
  });
  this.page.on('requestfailed', (req) => {
    this.networkFailures.push(`[requestfailed] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  this.page.on('response', (res) => {
    if (res.status() >= 400) {
      this.networkFailures.push(`[${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });
});

After(async function (this: CustomWorld, scenario) {
  if (scenario.result?.status === 'FAILED') {
    const slug = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    mkdirSync('test-results/e2e/screenshots', { recursive: true });

    const screenshotPath = `test-results/e2e/screenshots/${slug}.png`;
    await this.page?.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    const url = this.page?.url();
    console.log(`Failed at URL: ${url}`);

    const diagPath = `test-results/e2e/screenshots/${slug}.diagnostics.log`;
    const diagContent = [
      `URL: ${url}`,
      '--- console ---',
      ...this.consoleLogs,
      '--- network failures / 4xx+5xx ---',
      ...this.networkFailures,
    ].join('\n');
    writeFileSync(diagPath, diagContent);
    console.log(`Diagnostics saved to: ${diagPath}`);
  }

  await this.page?.close();
  await this.context?.close();
  await this.browser?.close();
});
