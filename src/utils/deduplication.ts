import type { Lead } from '../types/lead.types.js';

/**
 * Deduplicates leads using three independent indexes: email, phone, and
 * name+address. A lead matching an existing one through ANY of the indexes is
 * merged into it (missing fields filled in), instead of being kept as a
 * duplicate. This catches the case where the same business is scraped twice
 * but one copy has an email and the other only a phone.
 */
export function deduplicateLeads(leads: Lead[]): Lead[] {
  const result: Lead[] = [];
  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  const byName = new Map<string, number>();

  for (const lead of leads) {
    const emailKey = lead.email?.toLowerCase();
    const phoneDigits = lead.phone?.replace(/\D/g, '') || '';
    const phoneKey = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : undefined;
    const nameKey = buildNameKey(lead);

    let index =
      (emailKey !== undefined ? byEmail.get(emailKey) : undefined) ??
      (phoneKey !== undefined ? byPhone.get(phoneKey) : undefined) ??
      byName.get(nameKey);

    if (index !== undefined) {
      result[index] = mergeLeads(result[index], lead);
    } else {
      index = result.length;
      result.push(lead);
    }

    // Register all keys of the surviving lead so future duplicates match
    // through any of them
    const merged = result[index];
    if (merged.email) byEmail.set(merged.email.toLowerCase(), index);
    const mergedPhone = merged.phone?.replace(/\D/g, '') || '';
    if (mergedPhone.length >= 10) byPhone.set(mergedPhone.slice(-10), index);
    byName.set(buildNameKey(merged), index);
    if (emailKey) byEmail.set(emailKey, index);
    if (phoneKey) byPhone.set(phoneKey, index);
    byName.set(nameKey, index);
  }

  return result;
}

function buildNameKey(lead: Lead): string {
  const name = lead.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const address = (lead.address || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return `${name}|${address}`;
}

/**
 * Keeps the more complete lead and fills its missing fields from the other.
 */
function mergeLeads(a: Lead, b: Lead): Lead {
  const [primary, secondary] =
    calculateCompletenessScore(a) >= calculateCompletenessScore(b) ? [a, b] : [b, a];

  const merged: Lead = { ...primary };
  for (const key of Object.keys(secondary) as (keyof Lead)[]) {
    if (merged[key] === undefined && secondary[key] !== undefined) {
      (merged as Record<keyof Lead, unknown>)[key] = secondary[key];
    }
  }

  if (primary.allEmails || secondary.allEmails) {
    merged.allEmails = [...new Set([...(primary.allEmails || []), ...(secondary.allEmails || [])])];
  }

  return merged;
}

function calculateCompletenessScore(lead: Lead): number {
  let score = 0;
  if (lead.email) score += 3;
  if (lead.phone) score += 2;
  if (lead.whatsapp) score += 1;
  if (lead.website) score += 1;
  if (lead.address) score += 1;
  if (lead.company) score += 1;
  if (lead.category) score += 0.5;
  if (lead.rating) score += 0.5;
  if (lead.facebook) score += 0.5;
  if (lead.instagram) score += 0.5;
  if (lead.linkedin) score += 0.5;
  if (lead.twitter) score += 0.5;
  return score;
}
