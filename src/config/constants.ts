export const CONFIG = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
  },
  scraper: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3'),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
    headless: process.env.HEADLESS !== 'false',
    retryAttempts: 3,
    retryDelay: 1000,
  },
} as const;

export const EMAIL_PATTERNS = {
  standard: () => /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  mailto: () => /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
} as const;

export const CONTACT_PAGE_PATTERNS = [
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/get-in-touch',
  '/reach-us',
] as const;

export const EXCLUDED_EMAIL_DOMAINS = [
  'example.com',
  'test.com',
  'sentry.io',
  'wixpress.com',
  'w3.org',
  'schema.org',
  'googleapis.com',
  'google.com',
  'facebook.com',
  'twitter.com',
] as const;

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
] as const;
