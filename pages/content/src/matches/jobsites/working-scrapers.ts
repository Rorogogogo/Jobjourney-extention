// Working scrapers implementation based on the actual working extension
export {};

// Global Job class to match the working version
declare global {
  interface Window {
    Job: any;
    linkedInScraper: any;
    seekScraper: any;
    indeedScraper: any;
  }
}

// Enhanced Job class from working version
class Job {
  public title: string;
  public company: string;
  public location: string;
  public jobUrl: string;
  public description: string;
  public salary: string;
  public postedDate: string;
  public companyLogoUrl: string | null;
  public platform: string;
  public jobType: string;
  public workplaceType: string;
  public applicantCount: string;
  public isRPRequired: boolean;

  constructor({
    title,
    company,
    location,
    jobUrl,
    description = '',
    salary = '',
    postedDate = '',
    companyLogoUrl = null,
    platform,
    jobType = '',
    workplaceType = '',
    applicantCount = '',
    isRPRequired = false,
  }: {
    title: string;
    company: string;
    location: string;
    jobUrl: string;
    description?: string;
    salary?: string;
    postedDate?: string;
    companyLogoUrl?: string | null;
    platform: string;
    jobType?: string;
    workplaceType?: string;
    applicantCount?: string;
    isRPRequired?: boolean;
  }) {
    this.title = title?.trim() || '';
    this.company = company?.trim() || '';
    this.location = location?.trim() || '';
    this.jobUrl = jobUrl || '';
    this.description = description?.trim() || '';
    this.salary = salary?.trim() || '';
    this.postedDate = postedDate?.trim() || '';
    this.companyLogoUrl = companyLogoUrl || null;
    this.platform = platform || '';
    this.jobType = jobType?.trim() || '';
    this.workplaceType = workplaceType?.trim() || '';
    this.applicantCount = applicantCount?.trim() || '';
    this.isRPRequired = isRPRequired || false;
  }

  // Custom JSON serialization to ensure proper field names
  toJSON() {
    return {
      title: this.title,
      company: this.company,
      location: this.location,
      jobUrl: this.jobUrl, // Ensure this is jobUrl not url
      description: this.description,
      salary: this.salary,
      postedDate: this.postedDate,
      companyLogoUrl: this.companyLogoUrl, // Ensure this is included
      platform: this.platform,
      jobType: this.jobType,
      workplaceType: this.workplaceType,
      applicantCount: this.applicantCount,
      isRPRequired: this.isRPRequired,
      extracted_at: this.postedDate || null,
      id: `${this.platform.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
  }

  static createFromLinkedIn(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'LinkedIn',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
    });
  }

  static createFromSEEK(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'SEEK',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
    });
  }

  static createFromIndeed(data: any) {
    return new Job({
      title: data.title,
      company: data.company,
      location: data.location,
      jobUrl: data.jobUrl,
      description: data.description,
      salary: data.salary,
      postedDate: data.postedDate,
      companyLogoUrl: data.companyLogoUrl,
      platform: 'Indeed',
      jobType: data.jobType || '',
      workplaceType: data.workplaceType || '',
      applicantCount: data.applicantCount || '',
    });
  }
}

// Make Job available globally like in the working version
window.Job = Job;

console.log('Working scrapers implementation loaded');
