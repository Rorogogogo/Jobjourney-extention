// Platform detection utilities
import type { Platform } from './types';

export class PlatformDetector {
  static getCurrentPlatform(): Platform | null {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('seek.com')) return 'seek';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('reed.co.uk')) return 'reed';
    if (hostname === 'recruitment.macquarie.com') return 'macquarie';
    if (hostname.includes('atlassian.com')) return 'atlassian';
    if (hostname.includes('ebuu.fa.ap1.oraclecloud.com')) return 'westpac';
    if (hostname.includes('lifeatcanva.com')) return 'canva';

    return null;
  }
}