import type { Page } from 'playwright';
import { BaseScraper, ScraperError } from './base-scraper.js';
import type { ScrapedBusiness } from '../types/lead.types.js';

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
    query: string,
    location: string,
    maxResults: number,
    onProgress?: (current: number, total: number, business?: string) => void
  ): Promise<ScrapedBusiness[]> {
    console.log(`[GoogleMaps] Iniciando busca: "${query}" em "${location}"`);
    const page = await this.createPage();
    const businesses: ScrapedBusiness[] = [];

    try {
      const searchQuery = `${query} in ${location}`;
      const encodedQuery = encodeURIComponent(searchQuery);
      const searchUrl = `https://www.google.com/maps/search/${encodedQuery}`;

      console.log(`[GoogleMaps] Navegando para: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((err) => {
        console.error('[GoogleMaps] Falha na navegação:', err.message);
        throw new ScraperError(`Falha ao acessar Google Maps: ${err.message}`, 'network');
      });

      console.log('[GoogleMaps] Verificando diálogo de consentimento...');
      await this.handleConsentDialog(page);

      // Wait for Google Maps to load the results feed
      console.log('[GoogleMaps] Aguardando carregamento do mapa...');
      await page.waitForSelector('div[role="feed"], div[role="main"]', { timeout: 15000 }).catch(() => {
        console.log('[GoogleMaps] Timeout aguardando feed, continuando...');
      });
      await this.delay(2000);

      console.log('[GoogleMaps] Procurando painel de resultados...');
      const resultsPanel = await this.findResultsPanel(page);
      if (!resultsPanel) {
        console.log('[GoogleMaps] Painel de resultados não encontrado');
        throw new ScraperError('Nenhum resultado encontrado no Google Maps', 'selector');
      }
      console.log('[GoogleMaps] Painel de resultados encontrado');

      // Phase 1: Collect business URLs
      console.log('[GoogleMaps] Coletando URLs...');
      const urls = await this.collectBusinessUrls(page, resultsPanel, maxResults);
      console.log(`[GoogleMaps] ${urls.length} URLs coletadas`);

      if (urls.length === 0) {
        console.log('[GoogleMaps] Nenhuma URL encontrada');
        return businesses;
      }

      // Phase 2: Process queue one-by-one
      for (let i = 0; i < urls.length && businesses.length < maxResults; i++) {
        const url = urls[i];
        console.log(`[GoogleMaps] Processando ${i + 1}/${urls.length}: ${url.slice(0, 60)}...`);

        const business = await this.extractFromUrl(page, url);
        if (business) {
          businesses.push(business);
          console.log(`[GoogleMaps] Negócio extraído: ${business.name}`);
          onProgress?.(businesses.length, urls.length, business.name);
        }
      }

      console.log(`[GoogleMaps] Busca concluída. Total: ${businesses.length} negócios`);
    } catch (error) {
      if (error instanceof ScraperError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GoogleMaps] Erro durante scraping:', message);
      throw new ScraperError(`Erro ao buscar negócios: ${message}`, 'unknown');
    } finally {
      await page.context().close();
    }

    return businesses;
  }

  private async collectBusinessUrls(
    page: Page,
    resultsPanel: import('playwright').ElementHandle,
    maxResults: number
  ): Promise<string[]> {
    const urls = new Set<string>();
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;
    let previousUrlCount = 0;
    let noNewUrlsCount = 0;

    while (urls.size < maxResults && scrollAttempts < maxScrollAttempts) {
      // Find all links to place pages
      const links = await page.$$('a[href*="/maps/place/"]');

      for (const link of links) {
        if (urls.size >= maxResults) break;

        const href = await link.getAttribute('href');
        if (href && href.includes('/maps/place/')) {
          urls.add(href);
        }
      }

      console.log(`[GoogleMaps] URLs encontradas: ${urls.size}`);

      // Check if we found new URLs in this scroll
      if (urls.size === previousUrlCount) {
        noNewUrlsCount++;
        if (noNewUrlsCount >= 3) {
          console.log('[GoogleMaps] Sem novas URLs após 3 tentativas, parando coleta');
          break;
        }
      } else {
        noNewUrlsCount = 0;
      }
      previousUrlCount = urls.size;

      // Scroll to load more results
      if (urls.size < maxResults) {
        await resultsPanel.evaluate((el: Element) => {
          el.scrollBy(0, 500);
        });
        await this.delay(1000);
        scrollAttempts++;
      }
    }

    return Array.from(urls);
  }

  private async extractFromUrl(
    page: Page,
    url: string
  ): Promise<ScrapedBusiness | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await this.delay(1000);

      return await this.extractBusinessDetails(page);
    } catch (err) {
      console.log(`[GoogleMaps] Falha ao extrair de URL:`, err instanceof Error ? err.message : err);
      return null;
    }
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

      // Fallback: scan all <a href> on the page for social URLs
      if (!facebook || !instagram || !linkedin || !twitter) {
        const allLinks = await page.$$('a[href]');
        for (const link of allLinks) {
          const href = await link.getAttribute('href');
          if (!href) continue;
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
