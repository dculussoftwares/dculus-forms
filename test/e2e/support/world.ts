import type { Browser, BrowserContext, Page } from 'playwright';
import { setWorldConstructor } from '@cucumber/cucumber';

export class CustomWorld {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  readonly baseUrl: string;
  readonly headless: boolean;
  readonly formViewerUrl: string;
  newFormTitle?: string;
  formShortUrl?: string;
  viewerPage?: Page;

  constructor() {
    this.baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
    this.headless = process.env.E2E_HEADLESS !== 'false';
    this.formViewerUrl = process.env.FORM_VIEWER_URL ?? 'http://localhost:5173';
  }
}

setWorldConstructor(CustomWorld);
