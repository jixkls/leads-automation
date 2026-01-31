import { z } from 'zod';

export const LeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  niche: z.string(),
  source: z.enum(['google_maps', 'website', 'google_search', 'duckduckgo']),
  scrapedAt: z.date(),
});

export type Lead = z.infer<typeof LeadSchema>;

export const GenerateLeadsRequestSchema = z.object({
  niche: z.string().min(1, 'Niche is required'),
  keywords: z.string().optional(),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().min(1, 'Country is required'),
  }),
  quantity: z.number().min(10).max(50).default(10),
});

export type GenerateLeadsRequest = z.infer<typeof GenerateLeadsRequestSchema>;

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  request: GenerateLeadsRequest;
  leads: Lead[];
  progress: number;
  totalExpected: number;
  currentStep: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapedBusiness {
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  placeId?: string;
}

export interface ExtractedContact {
  emails: string[];
  phones: string[];
  socialLinks: string[];
}
