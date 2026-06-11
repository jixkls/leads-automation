import type { Page } from 'playwright';
import { BaseScraper, ScraperError } from './base-scraper.js';
import { CONFIG } from '../config/constants.js';
import type { ScrapedBusiness, ScrapeFilters } from '../types/lead.types.js';

const END_OF_LIST_MARKERS = [
  'você chegou ao final da lista',
  "you've reached the end of the list",
  'no final da lista',
];

export class GoogleMapsScraper extends BaseScraper {
  private normalizeBrazilPhone(phone: string): string | undefined {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If already has country code 55, format it
    if (digits.startsWith('55') && digits.length >= 12) {
      return `+${digits}`;
    }

    // If starts with 0, remove it (local format)
    const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;

    // Brazilian numbers: 10-11 digits (DDD + number)
    if (cleanDigits.length >= 10 && cleanDigits.length <= 11) {
      return `+55${cleanDigits}`;
    }

    // Too few digits to be a valid Brazilian number
    if (cleanDigits.length < 10) {
      return undefined;
    }

    return `+55${cleanDigits}`;
  }

  async searchBusinesses(
    queries: string[],
    location: string,
    maxResults: number,
    onProgress?: (current: number, total: number, business?: string) => void,
    filters?: ScrapeFilters
  ): Promise<ScrapedBusiness[]> {
    console.log(`[GoogleMaps] Iniciando ${queries.length} busca(s) em "${location}"`);
    const context = await this.createContext();
    const page = await this.createPageInContext(context);
    const businesses: ScrapedBusiness[] = [];
    // Place URLs already collected across all queries (same place can show up
    // in several searches and under different URL variants)
    const seenPlaceKeys = new Set<string>();
    // Extracted businesses, keyed by name+address and by phone
    const seenBusinessKeys = new Set<string>();
    let anyPanelFound = false;

    try {
      for (let q = 0; q < queries.length && businesses.length < maxResults; q++) {
        const query = queries[q];
        const searchQuery = `${query} in ${location}`;
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

        console.log(`[GoogleMaps] Busca ${q + 1}/${queries.length}: "${query}"`);
        try {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[GoogleMaps] Falha na navegação:', message);
          if (queries.length === 1) {
            throw new ScraperError(`Falha ao acessar Google Maps: ${message}`, 'network');
          }
          continue;
        }

        if (q === 0) {
          await this.handleConsentDialog(page);
        }

        await page.waitForSelector('div[role="feed"], div[role="main"]', { timeout: 15000 }).catch(() => {
          console.log('[GoogleMaps] Timeout aguardando feed, continuando...');
        });
        await this.delay(1500);

        const resultsPanel = await this.findResultsPanel(page);
        if (!resultsPanel) {
          console.log(`[GoogleMaps] Painel de resultados não encontrado para "${query}"`);
          continue;
        }
        anyPanelFound = true;

        // Phase 1: Collect new place URLs for this query (overfetch to
        // compensate failed extractions and filtered-out results)
        const remaining = maxResults - businesses.length;
        const urlTarget = Math.ceil(remaining * CONFIG.scraper.urlOverfetchRatio) + 3;
        const urls = await this.collectBusinessUrls(page, resultsPanel, urlTarget, seenPlaceKeys);
        console.log(`[GoogleMaps] ${urls.length} URLs novas coletadas para "${query}"`);
        if (urls.length === 0) continue;

        // Phase 2: Process queue with parallel worker pages
        const concurrency = Math.max(1, CONFIG.scraper.detailConcurrency);
        let nextUrlIndex = 0;

        const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async (_, workerId) => {
          const workerPage = workerId === 0 ? page : await this.createPageInContext(context);
          try {
            while (businesses.length < maxResults && nextUrlIndex < urls.length) {
              const index = nextUrlIndex++;
              const url = urls[index];
              console.log(`[GoogleMaps] Processando ${index + 1}/${urls.length}: ${url.slice(0, 60)}...`);

              const business = await this.extractFromUrl(workerPage, url);
              if (!business) continue;

              if (!this.passesFilters(business, filters)) {
                console.log(`[GoogleMaps] Negócio descartado pelos filtros: ${business.name}`);
                continue;
              }

              if (this.isDuplicateBusiness(business, seenBusinessKeys)) {
                console.log(`[GoogleMaps] Negócio duplicado ignorado: ${business.name}`);
                continue;
              }

              if (businesses.length >= maxResults) break;
              businesses.push(business);
              console.log(`[GoogleMaps] Negócio extraído: ${business.name}`);
              onProgress?.(businesses.length, maxResults, business.name);
            }
          } finally {
            if (workerId !== 0) {
              await workerPage.close().catch(() => {});
            }
          }
        });

        await Promise.all(workers);
      }

      if (!anyPanelFound && businesses.length === 0) {
        throw new ScraperError('Nenhum resultado encontrado no Google Maps', 'selector');
      }

      console.log(`[GoogleMaps] Busca concluída. Total: ${businesses.length} negócios`);
    } catch (error) {
      if (error instanceof ScraperError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GoogleMaps] Erro durante scraping:', message);
      throw new ScraperError(`Erro ao buscar negócios: ${message}`, 'unknown');
    } finally {
      await context.close();
    }

    return businesses;
  }

  /**
   * Stable identity for a place URL, so the same place reached through
   * different URL variants (or different searches) is only collected once.
   */
  private placeKeyFromUrl(url: string): string {
    // Google encodes a unique place id as !1s0x...:0x...
    const idMatch = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
    if (idMatch) return idMatch[1].toLowerCase();

    const nameMatch = url.match(/\/maps\/place\/([^/]+)/);
    const coords = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    return `${nameMatch?.[1].toLowerCase() ?? url}|${coords ? `${coords[1]},${coords[2]}` : ''}`;
  }

  /**
   * Checks an extracted business against everything already collected, by
   * name+address and by phone. Registers its keys when it is new.
   */
  private isDuplicateBusiness(business: ScrapedBusiness, seen: Set<string>): boolean {
    const name = business.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const address = (business.address || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const nameKey = `n:${name}|${address}`;
    const phoneDigits = business.phone?.replace(/\D/g, '') || '';
    const phoneKey = phoneDigits.length >= 10 ? `p:${phoneDigits.slice(-10)}` : null;

    if (seen.has(nameKey) || (phoneKey && seen.has(phoneKey))) {
      return true;
    }
    seen.add(nameKey);
    if (phoneKey) seen.add(phoneKey);
    return false;
  }

  private passesFilters(business: ScrapedBusiness, filters?: ScrapeFilters): boolean {
    if (!filters) return true;
    if (filters.minRating !== undefined && (business.rating === undefined || business.rating < filters.minRating)) {
      return false;
    }
    if (filters.requirePhone && !business.phone) return false;
    if (filters.requireWebsite && !business.website) return false;
    return true;
  }

  private async collectBusinessUrls(
    page: Page,
    resultsPanel: import('playwright').ElementHandle,
    maxResults: number,
    seenPlaceKeys: Set<string>
  ): Promise<string[]> {
    const urls: string[] = [];
    let scrollAttempts = 0;
    // Scale scroll budget with the requested quantity (~7 results per scroll page)
    const maxScrollAttempts = Math.max(25, Math.ceil(maxResults / 4) + 15);
    let previousUrlCount = 0;
    let noNewUrlsCount = 0;

    while (urls.length < maxResults && scrollAttempts < maxScrollAttempts) {
      // Extract all place links in a single page evaluation (much faster than
      // round-tripping per element)
      const hrefs = await page.$$eval('a[href*="/maps/place/"]', (links) =>
        links.map((l) => l.getAttribute('href')).filter((h): h is string => !!h)
      );
      for (const href of hrefs) {
        if (urls.length >= maxResults) break;
        const placeKey = this.placeKeyFromUrl(href);
        if (seenPlaceKeys.has(placeKey)) continue;
        seenPlaceKeys.add(placeKey);
        urls.push(href);
      }

      console.log(`[GoogleMaps] URLs encontradas: ${urls.length}`);

      // Stop early when Google Maps says there is nothing more to load
      const reachedEnd = await resultsPanel.evaluate((el: Element, markers: string[]) => {
        const text = (el.textContent || '').toLowerCase();
        return markers.some((m) => text.includes(m));
      }, END_OF_LIST_MARKERS).catch(() => false);

      if (reachedEnd) {
        console.log('[GoogleMaps] Fim da lista de resultados detectado');
        break;
      }

      // Check if we found new URLs in this scroll
      if (urls.length === previousUrlCount) {
        noNewUrlsCount++;
        if (noNewUrlsCount >= 3) {
          console.log('[GoogleMaps] Sem novas URLs após 3 tentativas, parando coleta');
          break;
        }
      } else {
        noNewUrlsCount = 0;
      }
      previousUrlCount = urls.length;

      // Scroll a full panel height to load more results
      if (urls.length < maxResults) {
        await resultsPanel.evaluate((el: Element) => {
          el.scrollBy(0, el.clientHeight || 800);
        });
        await this.delay(800);
        scrollAttempts++;
      }
    }

    return urls;
  }

  private async extractFromUrl(
    page: Page,
    url: string
  ): Promise<ScrapedBusiness | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await this.delay(800);

      const business = await this.extractBusinessDetails(page);
      if (business) {
        const coords = this.extractCoordinates(url);
        if (coords) {
          business.latitude = coords.latitude;
          business.longitude = coords.longitude;
        }
      }
      return business;
    } catch (err) {
      console.log(`[GoogleMaps] Falha ao extrair de URL:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  private extractCoordinates(url: string): { latitude: number; longitude: number } | null {
    // Place URLs embed coordinates as !3d<lat>!4d<lng>
    const match = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (match) {
      return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
    }
    // Fallback: viewport coordinates @lat,lng
    const viewport = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (viewport) {
      return { latitude: parseFloat(viewport[1]), longitude: parseFloat(viewport[2]) };
    }
    return null;
  }

  private async findResultsPanel(page: Page): Promise<import('playwright').ElementHandle | null> {
    const selectors = [
      'div[role="feed"]',
      'div[role="main"] div[role="feed"]',
      '[aria-label*="Results"] div[role="feed"]',
    ];

    for (const selector of selectors) {
      const panel = await page.$(selector);
      if (panel) {
        console.log(`[GoogleMaps] Painel encontrado com seletor: ${selector}`);
        return panel;
      }
    }
    return null;
  }

  private async handleConsentDialog(page: Page): Promise<void> {
    const consentSelectors = [
      'button[aria-label*="Accept"]',
      'button[aria-label*="Aceitar"]',
      'button[aria-label*="Accept all"]',
      'button[aria-label*="Aceitar tudo"]',
      'form[action*="consent"] button',
      'button:has-text("Accept all")',
      'button:has-text("Aceitar tudo")',
      'button:has-text("Concordo")',
      'button:has-text("I agree")',
    ];

    try {
      for (const selector of consentSelectors) {
        const acceptButton = await page.$(selector);
        if (acceptButton) {
          console.log(`[GoogleMaps] Diálogo de consentimento encontrado, aceitando...`);
          await acceptButton.click();
          await this.delay(1000);
          return;
        }
      }
      console.log('[GoogleMaps] Nenhum diálogo de consentimento detectado');
    } catch {
      console.log('[GoogleMaps] Erro ao processar diálogo de consentimento (ignorando)');
    }
  }

  private async extractBusinessDetails(page: Page): Promise<ScrapedBusiness | null> {
    try {
      await page.waitForSelector('h1', { timeout: 5000 });

      const name = await page.$eval('h1', (el) => el.textContent?.trim() || '');
      if (!name) return null;

      let phone: string | undefined;
      let whatsapp: string | undefined;
      let website: string | undefined;
      let address: string | undefined;
      let rating: number | undefined;
      let reviewCount: number | undefined;
      let category: string | undefined;

      // Business category (e.g. "Restaurante", "Dentista")
      const categorySelectors = [
        'button[jsaction*="category"]',
        'button[jsaction*="pane.rating.category"]',
      ];
      for (const selector of categorySelectors) {
        const text = await page.$eval(selector, (el) => el.textContent?.trim()).catch(() => null);
        if (text) {
          category = text;
          break;
        }
      }

      const buttonSelectors = [
        'button[data-item-id]',
        'a[data-item-id]',
        '[data-item-id]',
      ];

      for (const selector of buttonSelectors) {
        const buttons = await page.$$(selector);
        for (const button of buttons) {
          const itemId = await button.getAttribute('data-item-id');
          const ariaLabel = await button.getAttribute('aria-label');

          if (itemId?.startsWith('phone:') || ariaLabel?.toLowerCase().includes('phone') || ariaLabel?.toLowerCase().includes('telefone')) {
            const phoneText = await button.$eval('[class*="fontBodyMedium"]', (el) => el.textContent?.trim()).catch(() => null)
              || await button.textContent();
            if (phoneText && /[\d\s\-+()]+/.test(phoneText)) {
              phone = this.normalizeBrazilPhone(phoneText.trim());
            }
          }

          if (itemId?.startsWith('address') || ariaLabel?.toLowerCase().includes('address') || ariaLabel?.toLowerCase().includes('endereço')) {
            const addressText = await button.$eval('[class*="fontBodyMedium"]', (el) => el.textContent?.trim()).catch(() => null)
              || await button.textContent();
            if (addressText) {
              address = addressText.trim();
            }
          }
        }
        if (phone || address) break;
      }

      const websiteSelectors = [
        'a[data-item-id="authority"]',
        'a[data-item-id*="website"]',
        'a[aria-label*="Website"]',
        'a[aria-label*="Site"]',
      ];

      for (const selector of websiteSelectors) {
        const websiteLink = await page.$(selector);
        if (websiteLink) {
          website = await websiteLink.getAttribute('href') || undefined;
          if (website) break;
        }
      }

      // Look for WhatsApp links
      const whatsappSelectors = [
        'a[href*="wa.me"]',
        'a[href*="whatsapp.com"]',
        'a[href*="api.whatsapp"]',
        'a[aria-label*="WhatsApp"]',
        'a[aria-label*="whatsapp"]',
      ];

      for (const selector of whatsappSelectors) {
        const waLink = await page.$(selector);
        if (waLink) {
          const href = await waLink.getAttribute('href');
          if (href) {
            // Extract number from wa.me/5511999999999 or similar
            const match = href.match(/wa\.me\/(\d+)|whatsapp.*?(\d{10,})/i);
            if (match) {
              const waNumber = match[1] || match[2];
              whatsapp = waNumber.startsWith('55') ? `+${waNumber}` : `+55${waNumber}`;
            } else {
              whatsapp = href;
            }
            break;
          }
        }
      }

      // If no WhatsApp found but we have a phone, create WhatsApp link from phone
      if (!whatsapp && phone) {
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length >= 12) {
          whatsapp = `+${phoneDigits}`;
        }
      }

      // Extract social media links
      let facebook: string | undefined;
      let instagram: string | undefined;
      let linkedin: string | undefined;
      let twitter: string | undefined;

      // Check a[data-item-id] elements for social platform links
      const socialElements = await page.$$('a[data-item-id]');
      for (const el of socialElements) {
        const href = await el.getAttribute('href');
        const itemId = await el.getAttribute('data-item-id');
        if (!href) continue;
        const lowerHref = href.toLowerCase();
        const lowerId = (itemId || '').toLowerCase();

        if (lowerHref.includes('facebook.com') || lowerId.includes('facebook')) {
          facebook = facebook || href;
        } else if (lowerHref.includes('instagram.com') || lowerId.includes('instagram')) {
          instagram = instagram || href;
        } else if (lowerHref.includes('linkedin.com') || lowerId.includes('linkedin')) {
          linkedin = linkedin || href;
        } else if (lowerHref.includes('twitter.com') || lowerHref.includes('x.com') || lowerId.includes('twitter')) {
          twitter = twitter || href;
        }
      }

      // Fallback: scan all <a href> on the page for social URLs (single
      // page evaluation instead of one round-trip per link)
      if (!facebook || !instagram || !linkedin || !twitter) {
        const allHrefs = await page.$$eval('a[href]', (links) =>
          links.map((l) => l.getAttribute('href')).filter((h): h is string => !!h)
        ).catch(() => [] as string[]);
        for (const href of allHrefs) {
          const lowerHref = href.toLowerCase();

          if (!facebook && lowerHref.includes('facebook.com/') && !lowerHref.includes('facebook.com/sharer') && !lowerHref.includes('/events/') && !lowerHref.includes('/groups/') && !lowerHref.includes('/watch') && !lowerHref.includes('/plugins')) {
            facebook = href;
          } else if (!instagram && lowerHref.includes('instagram.com/') && !lowerHref.includes('instagram.com/accounts')) {
            instagram = href;
          } else if (!linkedin && lowerHref.includes('linkedin.com/')) {
            linkedin = href;
          } else if (!twitter && (lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) && !lowerHref.includes('/intent/') && !lowerHref.includes('/share')) {
            twitter = href;
          }
        }
      }

      const ratingSelectors = [
        'span[role="img"][aria-label*="stars"]',
        'span[role="img"][aria-label*="estrelas"]',
        'span[aria-label*="rating"]',
        'span[aria-label*="avaliação"]',
      ];

      for (const selector of ratingSelectors) {
        const ratingElement = await page.$(selector);
        if (ratingElement) {
          const ariaLabel = await ratingElement.getAttribute('aria-label');
          const match = ariaLabel?.match(/(\d+[.,]?\d*)/);
          if (match) {
            rating = parseFloat(match[1].replace(',', '.'));
            break;
          }
        }
      }

      const reviewSelectors = [
        'span[aria-label*="reviews"]',
        'span[aria-label*="avaliações"]',
        'span[aria-label*="comentários"]',
      ];

      for (const selector of reviewSelectors) {
        const reviewElement = await page.$(selector);
        if (reviewElement) {
          const reviewText = await reviewElement.textContent();
          const match = reviewText?.replace(/\./g, '').match(/(\d+)/);
          if (match) {
            reviewCount = parseInt(match[1]);
            break;
          }
        }
      }

      if (!phone && !address) {
        const infoButtons = await page.$$('[data-tooltip]');
        for (const btn of infoButtons) {
          const tooltip = await btn.getAttribute('data-tooltip');
          const text = await btn.textContent();

          if (tooltip?.includes('phone') || tooltip?.includes('telefone') || /^\+?\d[\d\s\-()]+$/.test(text || '')) {
            if (!phone && text) phone = this.normalizeBrazilPhone(text.trim());
          }
          if ((tooltip?.includes('address') || tooltip?.includes('endereço')) && !address && text) {
            address = text.trim();
          }
        }
      }

      return {
        name,
        phone,
        whatsapp,
        website,
        address,
        category,
        rating,
        reviewCount,
        facebook,
        instagram,
        linkedin,
        twitter,
      };
    } catch (err) {
      console.log('[GoogleMaps] Erro ao extrair detalhes:', err instanceof Error ? err.message : err);
      return null;
    }
  }
}
