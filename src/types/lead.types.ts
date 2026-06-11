import { z } from 'zod';

export const LeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  allEmails: z.array(z.string()).optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  company: z.string().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  category: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  facebook: z.string().url().optional(),
  instagram: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  twitter: z.string().url().optional(),
  niche: z.string(),
  source: z.enum(['google_maps']),
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
  quantity: z.number().min(1).max(200).default(10),
  options: z
    .object({
      extractWebsiteContacts: z.boolean().default(true),
      minRating: z.number().min(0).max(5).optional(),
      requirePhone: z.boolean().default(false),
      requireWebsite: z.boolean().default(false),
      requireEmail: z.boolean().default(false),
    })
    .default({
      extractWebsiteContacts: true,
      requirePhone: false,
      requireWebsite: false,
      requireEmail: false,
    }),
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
  category?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  placeId?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
}

export interface ScrapeFilters {
  minRating?: number;
  requirePhone?: boolean;
  requireWebsite?: boolean;
}

export interface ExtractedContact {
  emails: string[];
  phones: string[];
  socialLinks: string[];
  whatsapp?: string;
}
