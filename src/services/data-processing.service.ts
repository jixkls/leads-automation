import type { Lead } from '../types/lead.types.js';
import { deduplicateLeads } from '../utils/deduplication.js';
import { normalizePhone } from '../extractors/phone-extractor.js';

export class DataProcessingService {
  processLeads(leads: Lead[]): Lead[] {
    const normalized = leads.map((lead) => this.normalizeLead(lead));
    const filtered = normalized.filter((lead) => this.isValidLead(lead));
    return deduplicateLeads(filtered);
  }

  private normalizeLead(lead: Lead): Lead {
    return {
      ...lead,
      name: this.normalizeName(lead.name),
      email: lead.email?.toLowerCase().trim(),
      phone: lead.phone ? normalizePhone(lead.phone) || lead.phone : undefined,
      company: lead.company ? this.normalizeName(lead.company) : undefined,
      website: lead.website ? this.normalizeUrl(lead.website) : undefined,
      address: lead.address?.trim(),
      facebook: lead.facebook ? this.normalizeUrl(lead.facebook) : undefined,
      instagram: lead.instagram ? this.normalizeUrl(lead.instagram) : undefined,
      linkedin: lead.linkedin ? this.normalizeUrl(lead.linkedin) : undefined,
      twitter: lead.twitter ? this.normalizeUrl(lead.twitter) : undefined,
    };
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s&'-]/gu, '');
  }

  private normalizeUrl(url: string): string {
    let normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    try {
      const parsed = new URL(normalized);
      return parsed.href;
    } catch {
      return normalized;
    }
  }

  private isValidLead(lead: Lead): boolean {
    if (!lead.name || lead.name.length < 2) {
      return false;
    }

    if (!lead.phone && !lead.email && !lead.website) {
      return false;
    }

    return true;
  }
}
