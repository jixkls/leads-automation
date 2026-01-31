import { stringify } from 'csv-stringify/sync';
import type { Lead } from '../types/lead.types.js';

export class ExportService {
  exportToCSV(leads: Lead[]): string {
    const records = leads.map((lead) => ({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      website: lead.website || '',
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      country: lead.country || '',
      rating: lead.rating?.toString() || '',
      review_count: lead.reviewCount?.toString() || '',
      niche: lead.niche,
      source: lead.source,
      scraped_at: lead.scrapedAt.toISOString(),
    }));

    return stringify(records, {
      header: true,
      columns: [
        { key: 'name', header: 'Nome' },
        { key: 'email', header: 'E-mail' },
        { key: 'phone', header: 'Telefone' },
        { key: 'company', header: 'Empresa' },
        { key: 'website', header: 'Site' },
        { key: 'address', header: 'Endereço' },
        { key: 'city', header: 'Cidade' },
        { key: 'state', header: 'Estado' },
        { key: 'country', header: 'País' },
        { key: 'rating', header: 'Avaliação' },
        { key: 'review_count', header: 'Número de Avaliações' },
        { key: 'niche', header: 'Nicho' },
        { key: 'source', header: 'Fonte' },
        { key: 'scraped_at', header: 'Data de Coleta' },
      ],
    });
  }
}
