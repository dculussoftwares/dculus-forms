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
  expectedFieldSettings?: Record<string, any>;

  constructor() {
    this.baseUrl = process.env.E2E_FORM_APP_URL ?? 'http://localhost:5173';
    this.headless = process.env.E2E_HEADLESS !== 'false';
    this.formViewerUrl = process.env.E2E_FORM_VIEWER_URL ?? 'http://localhost:5173';

    // Ensure backend URL always ends with /graphql
    const backendBase = process.env.E2E_BACKEND_URL ?? 'http://localhost:4000';
    this.backendUrl = backendBase.endsWith('/graphql') ? backendBase : `${backendBase}/graphql`;
  }
}

setWorldConstructor(CustomWorld);
