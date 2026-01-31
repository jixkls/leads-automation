import { BaseScraper } from './base-scraper.js';
import { extractEmails } from '../extractors/email-extractor.js';
import { extractPhones } from '../extractors/phone-extractor.js';
import { CONTACT_PAGE_PATTERNS } from '../config/constants.js';
import type { ExtractedContact } from '../types/lead.types.js';

export class WebsiteScraper extends BaseScraper {
  async extractContactInfo(
    websiteUrl: string,
    defaultCountry: string = 'US'
  ): Promise<ExtractedContact> {
    const page = await this.createPage();
    const result: ExtractedContact = {
      emails: [],
      phones: [],
      socialLinks: [],
    };

    try {
      const normalizedUrl = this.normalizeUrl(websiteUrl);
      await page.goto(normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      await this.delay(1000);

      const homePageHtml = await page.content();
      this.extractFromHtml(homePageHtml, result, defaultCountry);

      const contactPageUrl = await this.findContactPage(page);
      if (contactPageUrl) {
        try {
          await page.goto(contactPageUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 10000,
          });
          await this.delay(500);
          const contactHtml = await page.content();
          this.extractFromHtml(contactHtml, result, defaultCountry);
        } catch {
          // Contact page navigation failed
        }
      }

      result.emails = [...new Set(result.emails)];
      result.phones = [...new Set(result.phones)];
      result.socialLinks = [...new Set(result.socialLinks)];
    } catch {
      // Website access failed
    } finally {
      await page.context().close();
    }

    return result;
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  private extractFromHtml(
    html: string,
    result: ExtractedContact,
    defaultCountry: string
  ): void {
    const emails = extractEmails(html);
    result.emails.push(...emails);

    const phones = extractPhones(html, defaultCountry);
    result.phones.push(...phones);

    const socialPatterns = [
      /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9._-]+/gi,
      /https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9._-]+/gi,
      /https?:\/\/(www\.)?twitter\.com\/[a-zA-Z0-9._-]+/gi,
      /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._-]+/gi,
    ];

    for (const pattern of socialPatterns) {
      const matches = html.match(pattern) || [];
      result.socialLinks.push(...matches);
    }
  }

  private async findContactPage(page: any): Promise<string | null> {
    const baseUrl = new URL(page.url()).origin;

    for (const pattern of CONTACT_PAGE_PATTERNS) {
      const link = await page.$(`a[href*="${pattern}"]`);

      if (link) {
        const href = await link.getAttribute('href');
        if (href) {
          if (href.startsWith('http')) return href;
          if (href.startsWith('/')) return `${baseUrl}${href}`;
          return `${baseUrl}/${href}`;
        }
      }
    }

    const contactLink = await page.$(
      'a:has-text("Contact"), a:has-text("contact"), a:has-text("Contact Us"), a:has-text("Get in Touch")'
    );
    if (contactLink) {
      const href = await contactLink.getAttribute('href');
      if (href) {
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return `${baseUrl}${href}`;
        return `${baseUrl}/${href}`;
      }
    }

    return null;
  }
}
