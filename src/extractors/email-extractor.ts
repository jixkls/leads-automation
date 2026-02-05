import { EMAIL_PATTERNS, EXCLUDED_EMAIL_DOMAINS } from '../config/constants.js';

export function extractEmails(html: string): string[] {
  const emails = new Set<string>();

  const standardMatches = html.match(EMAIL_PATTERNS.standard()) || [];
  for (const email of standardMatches) {
    emails.add(email.toLowerCase());
  }

  const mailtoMatches = html.matchAll(EMAIL_PATTERNS.mailto());
  for (const match of mailtoMatches) {
    if (match[1]) {
      emails.add(match[1].toLowerCase());
    }
  }

  return filterValidEmails([...emails]);
}

function filterValidEmails(emails: string[]): string[] {
  return emails.filter((email) => {
    const domain = email.split('@')[1];
    if (!domain) return false;

    if (EXCLUDED_EMAIL_DOMAINS.some((excluded) => domain.includes(excluded))) {
      return false;
    }

    if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
      return false;
    }

    const localPart = email.split('@')[0];
    if (!localPart || localPart.length > 64) return false;

    if (/noreply|no-reply|donotreply|unsubscribe|mailer-daemon/i.test(email)) {
      return false;
    }

    return true;
  });
}

export function extractEmailFromText(text: string): string | null {
  const match = text.match(EMAIL_PATTERNS.standard());
  return match ? match[0].toLowerCase() : null;
}
