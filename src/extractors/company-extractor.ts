import * as cheerio from 'cheerio';

export function extractCompanyName(html: string, url?: string): string | null {
  const $ = cheerio.load(html);

  const schemaOrg = $('script[type="application/ld+json"]').text();
  if (schemaOrg) {
    try {
      const data = JSON.parse(schemaOrg);
      const name = findCompanyInSchema(data);
      if (name) return cleanCompanyName(name);
    } catch {
      // Invalid JSON, continue with other methods
    }
  }

  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName) return cleanCompanyName(ogSiteName);

  const title = $('title').text();
  if (title) {
    const companyFromTitle = extractFromTitle(title);
    if (companyFromTitle) return cleanCompanyName(companyFromTitle);
  }

  if (url) {
    const fromUrl = extractFromUrl(url);
    if (fromUrl) return cleanCompanyName(fromUrl);
  }

  return null;
}

function findCompanyInSchema(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  if (obj['@type'] === 'Organization' || obj['@type'] === 'LocalBusiness') {
    if (typeof obj.name === 'string') return obj.name;
  }

  if (typeof obj.name === 'string' && obj['@type']) {
    return obj.name;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findCompanyInSchema(item);
      if (found) return found;
    }
  }

  return null;
}

function extractFromTitle(title: string): string | null {
  const separators = [' | ', ' - ', ' – ', ' — ', ' :: ', ' : '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      return parts[0].trim() || parts[1]?.trim() || null;
    }
  }
  return title.trim() || null;
}

function extractFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    if (parts.length > 0) {
      return capitalize(parts[0]);
    }
  } catch {
    // Invalid URL
  }
  return null;
}

function cleanCompanyName(name: string): string {
  return name
    .replace(/\s*(LLC|Inc|Corp|Ltd|Limited|Co\.?|Company)\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function extractAddress(html: string): string | null {
  const $ = cheerio.load(html);

  const schemaOrg = $('script[type="application/ld+json"]').text();
  if (schemaOrg) {
    try {
      const data = JSON.parse(schemaOrg);
      const address = findAddressInSchema(data);
      if (address) return address;
    } catch {
      // Continue with other methods
    }
  }

  const addressElement = $('[itemprop="address"]').text().trim();
  if (addressElement) return addressElement;

  const addressClass = $('.address, .contact-address, [class*="address"]')
    .first()
    .text()
    .trim();
  if (addressClass) return addressClass;

  return null;
}

function findAddressInSchema(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  if (obj.address && typeof obj.address === 'object') {
    const addr = obj.address as Record<string, unknown>;
    const parts = [
      addr.streetAddress,
      addr.addressLocality,
      addr.addressRegion,
      addr.postalCode,
      addr.addressCountry,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findAddressInSchema(item);
      if (found) return found;
    }
  }

  return null;
}
