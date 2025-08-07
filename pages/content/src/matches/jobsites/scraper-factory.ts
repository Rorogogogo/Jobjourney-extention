// Factory for creating platform-specific scrapers
import { AtlassianScraper } from './save-single-job-scrapers/atlassian-single-job-scraper';
import { CanvaScraper } from './save-single-job-scrapers/canva-single-job-scraper';
import { IndeedScraper } from './save-single-job-scrapers/indeed-single-job-scraper';
import { LinkedInScraper } from './save-single-job-scrapers/linkedin-single-job-scraper';
import { MacquarieScraper } from './save-single-job-scrapers/macquarie-single-job-scraper';
import { ReedScraper } from './save-single-job-scrapers/reed-single-job-scraper';
import { SeekScraper } from './save-single-job-scrapers/seek-single-job-scraper';
import { WestpacScraper } from './save-single-job-scrapers/westpac-single-job-scraper';
import type { JobScraper } from './types';

export class ScraperFactory {
  static createScraper(platform: string): JobScraper | null {
    switch (platform) {
      case 'linkedin':
        return new LinkedInScraper();
      case 'indeed':
        return new IndeedScraper();
      case 'seek':
        return new SeekScraper();
      case 'reed':
        return new ReedScraper();
      case 'macquarie':
        return new MacquarieScraper();
      case 'atlassian':
        return new AtlassianScraper();
      case 'westpac':
        return new WestpacScraper();
      case 'canva':
        return new CanvaScraper();
      default:
        return null;
    }
  }

  static detectPlatform(): string | null {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('seek.com')) return 'seek';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('reed.co.uk')) return 'reed';
    if (hostname === 'recruitment.macquarie.com') return 'macquarie';
    if (hostname.includes('atlassian.com')) return 'atlassian';
    if (hostname.includes('lifeatcanva.com')) return 'canva';

    return null;
  }
}
