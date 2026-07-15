import type { Page } from 'playwright';
import { CustomWorld } from './world';

/**
 * Wires console/network capture onto a page, appending into the shared
 * world arrays so failure diagnostics cover secondary pages (e.g. the
 * form-viewer's own browser context), not just the primary builder page.
 */
export function attachDiagnostics(world: CustomWorld, page: Page, label: string): void {
  page.on('console', (msg) => {
    world.consoleLogs.push(`[${label}] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    world.consoleLogs.push(`[${label}] [pageerror] ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    world.networkFailures.push(`[${label}] [requestfailed] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      world.networkFailures.push(`[${label}] [${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });
}
