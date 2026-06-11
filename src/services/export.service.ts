import { stringify } from 'csv-stringify/sync';
import type { Lead } from '../types/lead.types.js';

export class ExportService {
  exportToCSV(leads: Lead[]): string {
    const records = leads.map((lead) => ({
      name: lead.name,
      email: lead.email || '',
      all_emails: lead.allEmails?.join('; ') || '',
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      company: lead.company || '',
      website: lead.website || '',
      address: lead.address || '',
      category: lead.category || '',
      facebook: lead.facebook || '',
      instagram: lead.instagram || '',
      linkedin: lead.linkedin || '',
      twitter: lead.twitter || '',
      city: lead.city || '',
      state: lead.state || '',
      country: lead.country || '',
      latitude: lead.latitude?.toString() || '',
      longitude: lead.longitude?.toString() || '',
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
        { key: 'all_emails', header: 'Todos os E-mails' },
        { key: 'phone', header: 'Telefone' },
        { key: 'whatsapp', header: 'WhatsApp' },
        { key: 'company', header: 'Empresa' },
        { key: 'website', header: 'Site' },
        { key: 'address', header: 'Endereço' },
        { key: 'category', header: 'Categoria' },
        { key: 'facebook', header: 'Facebook' },
        { key: 'instagram', header: 'Instagram' },
        { key: 'linkedin', header: 'LinkedIn' },
        { key: 'twitter', header: 'Twitter/X' },
        { key: 'city', header: 'Cidade' },
        { key: 'state', header: 'Estado' },
        { key: 'country', header: 'País' },
        { key: 'latitude', header: 'Latitude' },
        { key: 'longitude', header: 'Longitude' },
        { key: 'rating', header: 'Avaliação' },
        { key: 'review_count', header: 'Número de Avaliações' },
        { key: 'niche', header: 'Nicho' },
        { key: 'source', header: 'Fonte' },
        { key: 'scraped_at', header: 'Data de Coleta' },
      ],
    });
  }
}
