import type { Browser, BrowserContext, Page } from 'playwright';
import { setWorldConstructor } from '@cucumber/cucumber';

export class CustomWorld {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  readonly baseUrl: string;
  readonly headless: boolean;
  readonly formViewerUrl: string;
  readonly backendUrl: string;
  newFormTitle?: string;
  formShortUrl?: string;
  viewerPage?: Page;

  constructor() {
    this.baseUrl = process.env.E2E_FORM_APP_URL ?? 'http://localhost:5173';
    this.headless = process.env.E2E_HEADLESS !== 'false';
    this.formViewerUrl = process.env.E2E_FORM_VIEWER_URL ?? 'http://localhost:5173';
    this.backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:4000/graphql';
  }
}

setWorldConstructor(CustomWorld);
