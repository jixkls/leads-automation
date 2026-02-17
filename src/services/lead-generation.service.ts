import { GoogleMapsScraper } from '../scrapers/google-maps-scraper.js';
import { WebsiteScraper } from '../scrapers/website-scraper.js';
import { DataProcessingService } from './data-processing.service.js';
import type { Job, Lead, GenerateLeadsRequest } from '../types/lead.types.js';

type JobUpdateCallback = (job: Job) => void;

export class LeadGenerationService {
  private jobs = new Map<string, Job>();
  private googleMapsScraper: GoogleMapsScraper;
  private websiteScraper: WebsiteScraper;
  private dataProcessingService: DataProcessingService;
  private jobListeners = new Map<string, Set<JobUpdateCallback>>();

  constructor() {
    this.googleMapsScraper = new GoogleMapsScraper();
    this.websiteScraper = new WebsiteScraper();
    this.dataProcessingService = new DataProcessingService();
  }

  async startJob(request: GenerateLeadsRequest): Promise<Job> {
    const jobId = this.generateJobId();
    const job: Job = {
      id: jobId,
      status: 'pending',
      request,
      leads: [],
      progress: 0,
      totalExpected: request.quantity,
      currentStep: 'Inicializando...',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.runJob(job).catch((error) => {
      console.error(`[LeadGeneration] Unhandled error in job ${jobId}:`, error);
    });

    return job;
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  subscribeToJob(jobId: string, callback: JobUpdateCallback): () => void {
    if (!this.jobListeners.has(jobId)) {
      this.jobListeners.set(jobId, new Set());
    }
    this.jobListeners.get(jobId)!.add(callback);

    return () => {
      this.jobListeners.get(jobId)?.delete(callback);
    };
  }

  private notifyListeners(job: Job): void {
    const listeners = this.jobListeners.get(job.id);
    if (listeners) {
      for (const callback of listeners) {
        callback(job);
      }
    }
  }

  private async runJob(job: Job): Promise<void> {
    try {
      job.status = 'running';
      job.currentStep = 'Pesquisando no Google Maps...';
      this.updateJob(job);

      await this.googleMapsScraper.initialize();

      const location = this.buildLocationString(job.request.location);
      const searchQuery = job.request.keywords
        ? `${job.request.niche} ${job.request.keywords}`
        : job.request.niche;

      const businesses = await this.googleMapsScraper.searchBusinesses(
        searchQuery,
        location,
        job.request.quantity,
        (current, total, businessName) => {
          job.progress = Math.round((current / total) * 50);
          job.currentStep = `Negócio encontrado: ${businessName || 'Desconhecido'}`;
          this.updateJob(job);
        }
      );

      job.currentStep = 'Extraindo informações de contato...';
      this.updateJob(job);

      const leads: Lead[] = [];
      for (let i = 0; i < businesses.length; i++) {
        const business = businesses[i];

        let email: string | undefined;
        let websiteFacebook: string | undefined;
        let websiteInstagram: string | undefined;
        let websiteLinkedin: string | undefined;
        let websiteTwitter: string | undefined;

        if (business.website) {
          job.currentStep = `Extraindo contatos de ${business.name}...`;
          this.updateJob(job);

          try {
            const contactInfo = await this.websiteScraper.extractContactInfo(
              business.website,
              this.getCountryCode(job.request.location.country)
            );
            email = contactInfo.emails[0];

            for (const link of contactInfo.socialLinks) {
              const lower = link.toLowerCase();
              if (!websiteFacebook && lower.includes('facebook.com')) websiteFacebook = link;
              else if (!websiteInstagram && lower.includes('instagram.com')) websiteInstagram = link;
              else if (!websiteLinkedin && lower.includes('linkedin.com')) websiteLinkedin = link;
              else if (!websiteTwitter && (lower.includes('twitter.com') || lower.includes('x.com'))) websiteTwitter = link;
            }
          } catch {
            // Continue without email/social
          }
        }

        const lead: Lead = {
          id: this.generateLeadId(),
          name: business.name,
          email,
          phone: business.phone,
          company: business.name,
          website: business.website,
          address: business.address,
          city: job.request.location.city,
          state: job.request.location.state,
          country: job.request.location.country,
          rating: business.rating,
          reviewCount: business.reviewCount,
          facebook: business.facebook || websiteFacebook,
          instagram: business.instagram || websiteInstagram,
          linkedin: business.linkedin || websiteLinkedin,
          twitter: business.twitter || websiteTwitter,
          niche: job.request.niche,
          source: 'google_maps',
          scrapedAt: new Date(),
        };

        leads.push(lead);
        job.progress = 50 + Math.round(((i + 1) / businesses.length) * 50);
        this.updateJob(job);
      }

      job.leads = this.dataProcessingService.processLeads(leads);
      job.status = 'completed';
      job.currentStep = 'Concluído!';
      job.progress = 100;
      this.updateJob(job);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Erro desconhecido';
      job.currentStep = 'Falhou';
      this.updateJob(job);
    } finally {
      await this.googleMapsScraper.close();
      await this.websiteScraper.close();
      this.jobListeners.delete(job.id);
    }
  }

  private buildLocationString(location: GenerateLeadsRequest['location']): string {
    const parts = [location.city, location.state, location.country].filter(Boolean);
    return parts.join(', ');
  }

  private getCountryCode(country: string): string {
    const countryMap: Record<string, string> = {
      'United States': 'US',
      USA: 'US',
      US: 'US',
      'United Kingdom': 'GB',
      UK: 'GB',
      Canada: 'CA',
      Australia: 'AU',
      Germany: 'DE',
      France: 'FR',
      Brasil: 'BR',
      Brazil: 'BR',
      BR: 'BR',
      Portugal: 'PT',
      PT: 'PT',
    };
    return countryMap[country] || 'BR';
  }

  private updateJob(job: Job): void {
    job.updatedAt = new Date();
    this.jobs.set(job.id, job);
    this.notifyListeners(job);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateLeadId(): string {
    return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
