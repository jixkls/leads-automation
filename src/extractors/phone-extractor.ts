import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const PHONE_PATTERNS = [
  /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  /\+?[0-9]{1,4}[-.\s]?[0-9]{2,4}[-.\s]?[0-9]{2,4}[-.\s]?[0-9]{2,4}/g,
  /tel:([+0-9\-.\s()]+)/gi,
  /href="tel:([^"]+)"/gi,
];

export function extractPhones(
  html: string,
  defaultCountry: string = 'US'
): string[] {
  const phones = new Set<string>();

  for (const pattern of PHONE_PATTERNS) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const phoneStr = match[1] || match[0];
      const cleaned = cleanPhoneNumber(phoneStr);
      if (cleaned) {
        const formatted = formatPhoneNumber(cleaned, defaultCountry);
        if (formatted) {
          phones.add(formatted);
        }
      }
    }
  }

  return [...phones];
}

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function formatPhoneNumber(
  phone: string,
  defaultCountry: string
): string | null {
  try {
    if (phone.length < 7 || phone.length > 15) {
      return null;
    }

    const phoneWithCountry = phone.startsWith('+') ? phone : `+1${phone}`;

    if (
      isValidPhoneNumber(phoneWithCountry) ||
      isValidPhoneNumber(phone, defaultCountry as 'US')
    ) {
      const parsed = parsePhoneNumber(
        phone.startsWith('+') ? phone : phone,
        defaultCountry as 'US'
      );
      return parsed?.formatInternational() || null;
    }

    return null;
  } catch {
    return null;
  }
}

export function normalizePhone(
  phone: string,
  defaultCountry: string = 'US'
): string | null {
  try {
    const parsed = parsePhoneNumber(phone, defaultCountry as 'US');
    return parsed?.formatInternational() || null;
  } catch {
    return null;
  }
}
