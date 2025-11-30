// Factory for creating platform-specific scrapers
import { AtlassianScraper } from './save-single-job-scrapers/atlassian-single-job-scraper';
import { CanvaScraper } from './save-single-job-scrapers/canva-single-job-scraper';
import { IndeedScraper } from './save-single-job-scrapers/indeed-single-job-scraper';
import { JoraScraper } from './save-single-job-scrapers/jora-single-job-scraper';
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
      case 'jora':
        return new JoraScraper();
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

    // Use exact hostname or subdomain matching to prevent injection attacks
    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) return 'linkedin';
    if (
      hostname === 'seek.com.au' ||
      hostname.endsWith('.seek.com.au') ||
      hostname === 'seek.co.nz' ||
      hostname.endsWith('.seek.co.nz')
    )
      return 'seek';
    if (hostname === 'indeed.com' || hostname.endsWith('.indeed.com')) return 'indeed';
    if (hostname === 'jora.com' || hostname.endsWith('.jora.com')) return 'jora';
    if (hostname === 'reed.co.uk' || hostname.endsWith('.reed.co.uk')) return 'reed';
    if (hostname === 'recruitment.macquarie.com') return 'macquarie';
    if (hostname === 'atlassian.com' || hostname.endsWith('.atlassian.com')) return 'atlassian';
    if (hostname === 'lifeatcanva.com' || hostname === 'www.lifeatcanva.com') return 'canva';

    return null;
  }
}
