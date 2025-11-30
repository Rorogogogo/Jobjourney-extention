// Platform detection utilities
import type { Platform } from './types';

export class PlatformDetector {
  static getCurrentPlatform(): Platform | null {
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
    if (hostname === 'ebuu.fa.ap1.oraclecloud.com') return 'westpac';
    if (hostname === 'lifeatcanva.com' || hostname === 'www.lifeatcanva.com') return 'canva';

    return null;
  }
}
