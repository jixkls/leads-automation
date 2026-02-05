import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js';

const createPhonePatterns = () => [
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

  for (const pattern of createPhonePatterns()) {
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

    const country = defaultCountry as CountryCode;

    if (
      isValidPhoneNumber(phone, country) ||
      (phone.startsWith('+') && isValidPhoneNumber(phone))
    ) {
      const parsed = phone.startsWith('+')
        ? parsePhoneNumber(phone)
        : parsePhoneNumber(phone, country);
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
    const parsed = parsePhoneNumber(phone, defaultCountry as CountryCode);
    return parsed?.formatInternational() || null;
  } catch {
    return null;
  }
}
