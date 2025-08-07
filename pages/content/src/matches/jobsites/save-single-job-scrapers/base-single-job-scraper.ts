// Base scraper class with common functionality
import type { JobData, JobScraper } from '../types';

export abstract class BaseScraper implements JobScraper {
  protected abstract platform: string;

  abstract extractJobData(): JobData | null;
  abstract findInsertionPoint(): HTMLElement | null;

  protected cleanUrl(url: string): string {
    return url.split('?')[0];
  }

  protected extractText(element: Element | null): string {
    return element?.textContent?.trim() || '';
  }

  protected querySelector(selectors: string[]): Element | null {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && this.extractText(element)) {
        return element;
      }
    }
    return null;
  }

  protected queryImageSrc(selectors: string[]): string | null {
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLImageElement;
      if (element?.src) {
        return element.src;
      }
    }
    return null;
  }
}
