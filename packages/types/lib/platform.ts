// Platform identification and configuration types

export type PlatformId =
  | 'linkedin'
  | 'indeed'
  | 'seek'
  | 'jora'
  | 'reed'
  | 'macquarie'
  | 'atlassian'
  | 'westpac'
  | 'canva';

export interface Platform {
  id: PlatformId;
  name: string;
  icon: string;
  domains: string[];
  color: string;
  enabled: boolean;
}

export interface PlatformUrls {
  linkedin?: string;
  seek?: string;
  indeed?: string;
  jora?: string;
  reed?: string;
}

export interface CountryConfig {
  name: string;
  code: string;
  icon: string;
  platforms: PlatformId[];
  locations: string[];
  urls: PlatformUrls;
}
