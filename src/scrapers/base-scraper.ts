import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { CONFIG, USER_AGENTS } from '../config/constants.js';

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'media']);

// Playwright cannot launch browsers under Bun on Windows (the stdio pipes of
// its launch transport never connect). The server must run under Node — see
// the tsx-based scripts in package.json. Fail fast with a clear message.
if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined' && process.platform === 'win32') {
  console.warn(
    '[Scraper] AVISO: Playwright não funciona sob Bun no Windows. ' +
      'Use "bun run dev" / "npm run dev" (que executam via tsx/Node).'
  );
}

export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly type: 'browser' | 'selector' | 'network' | 'timeout' | 'unknown'
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // Share a single launch across concurrent callers so parallel
    // createPage() calls never spawn duplicate browsers
    if (this.browser) return;
    if (!this.initPromise) {
      this.initPromise = this.launchBrowser().finally(() => {
        this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private async launchBrowser(): Promise<void> {
    try {
      console.log('[Scraper] Inicializando navegador...');
      this.browser = await chromium.launch({ headless: CONFIG.scraper.headless });
      console.log('[Scraper] Navegador iniciado com sucesso');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Scraper] Falha ao iniciar navegador:', message);
      if (message.includes('Executable doesn\'t exist') || message.includes('browserType.launch')) {
        throw new ScraperError(
          'Navegador Playwright não instalado. Execute: bunx playwright install chromium',
          'browser'
        );
      }
      throw new ScraperError(`Falha ao iniciar navegador: ${message}`, 'browser');
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  protected async createContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initialize();
    }

    const context = await this.browser!.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
    });

    if (CONFIG.scraper.blockResources) {
      await context.route('**/*', (route) => {
        if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) {
          return route.abort();
        }
        return route.continue();
      });
    }

    return context;
  }

  protected async createPageInContext(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    page.setDefaultTimeout(CONFIG.scraper.requestTimeout);
    return page;
  }

  protected async createPage(): Promise<Page> {
    console.log('[Scraper] Criando nova página...');
    const context = await this.createContext();
    return this.createPageInContext(context);
  }

  protected getRandomUserAgent(): string {
    const index = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[index];
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = CONFIG.scraper.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries - 1) {
          await this.delay(CONFIG.scraper.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError;
  }
}
