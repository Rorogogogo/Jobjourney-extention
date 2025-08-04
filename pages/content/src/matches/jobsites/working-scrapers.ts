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
