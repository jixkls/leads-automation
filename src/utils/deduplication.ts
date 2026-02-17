import type { Lead } from '../types/lead.types.js';

export function deduplicateLeads(leads: Lead[]): Lead[] {
  const seen = new Map<string, Lead>();

  for (const lead of leads) {
    const key = generateDeduplicationKey(lead);
    const existing = seen.get(key);

    if (!existing || isMoreComplete(lead, existing)) {
      seen.set(key, lead);
    }
  }

  return [...seen.values()];
}

function generateDeduplicationKey(lead: Lead): string {
  const normalizedName = lead.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedPhone = lead.phone?.replace(/\D/g, '') || '';
  const normalizedEmail = lead.email?.toLowerCase() || '';

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  if (normalizedPhone && normalizedPhone.length >= 10) {
    return `phone:${normalizedPhone.slice(-10)}`;
  }

  return `name:${normalizedName}`;
}

function isMoreComplete(newLead: Lead, existingLead: Lead): boolean {
  const newScore = calculateCompletenessScore(newLead);
  const existingScore = calculateCompletenessScore(existingLead);
  return newScore > existingScore;
}

function calculateCompletenessScore(lead: Lead): number {
  let score = 0;
  if (lead.email) score += 3;
  if (lead.phone) score += 2;
  if (lead.website) score += 1;
  if (lead.address) score += 1;
  if (lead.company) score += 1;
  if (lead.rating) score += 0.5;
  if (lead.facebook) score += 0.5;
  if (lead.instagram) score += 0.5;
  if (lead.linkedin) score += 0.5;
  if (lead.twitter) score += 0.5;
  return score;
}
