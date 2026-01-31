import { GenerateLeadsRequestSchema } from '../types/lead.types.js';
import type { GenerateLeadsRequest } from '../types/lead.types.js';

export function validateGenerateRequest(data: unknown): {
  success: boolean;
  data?: GenerateLeadsRequest;
  error?: string;
} {
  const result = GenerateLeadsRequestSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages = result.error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ');

  return { success: false, error: errorMessages };
}

export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[<>\"'&;|`$(){}[\]\\]/g, '')
    .trim()
    .slice(0, 200);
}
