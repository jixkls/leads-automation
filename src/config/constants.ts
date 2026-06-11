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
    // Number of Google Maps detail pages processed in parallel
    detailConcurrency: parseInt(process.env.DETAIL_CONCURRENCY || '3'),
    // Number of business websites scraped for contacts in parallel
    websiteConcurrency: parseInt(process.env.WEBSITE_CONCURRENCY || '4'),
    // Block images/fonts/media to speed up page loads
    blockResources: process.env.BLOCK_RESOURCES !== 'false',
    // Extra URLs collected beyond the requested quantity to compensate extraction failures
    urlOverfetchRatio: parseFloat(process.env.URL_OVERFETCH_RATIO || '1.4'),
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
  '/contato',
  '/contacto',
  '/fale-conosco',
  '/atendimento',
  '/quem-somos',
  '/sobre',
  '/sobre-nos',
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
  // Placeholder domains left in website templates
  'meusite.com',
  'mysite.com',
  'yoursite.com',
  'seusite.com',
  'yourdomain.com',
  'domain.com',
  'email.com',
  'wix.com',
] as const;

// Social profile URLs that belong to website builders/platforms, not to the
// business itself (left behind by site templates)
export const EXCLUDED_SOCIAL_PATTERNS = [
  'facebook.com/wixstudio',
  'facebook.com/wix',
  'facebook.com/wordpress',
  'instagram.com/wixstudio',
  'instagram.com/wix',
  'instagram.com/wordpress',
  'twitter.com/wix',
  'x.com/wix',
  'linkedin.com/company/wix-com',
  'linkedin.com/company/wordpress',
] as const;

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
] as const;
