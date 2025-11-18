// Constants for JobJourney Extension
export const EXTENSION_NAME = 'JobJourney Assistant';
export const VERSION = '3.0.0';

// Country configurations with icons and platform mappings
export interface CountryConfig {
  name: string;
  code: string;
  icon: string;
  platforms: string[];
  locations: string[];
  urls: PlatformUrls;
}

export interface PlatformUrls {
  linkedin?: string;
  seek?: string;
  indeed?: string;
  jora?: string;
  reed?: string;
}

// Platform configurations
export interface Platform {
  id: string;
  name: string;
  icon: string;
  domains: string[];
  color: string;
  enabled: boolean;
}

export const PLATFORMS: Record<string, Platform> = {
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    domains: ['linkedin.com'],
    color: '#0077b5',
    enabled: true,
  },
  seek: {
    id: 'seek',
    name: 'SEEK',
    icon: '🔍',
    domains: ['seek.com.au', 'seek.co.nz'],
    color: '#e60278',
    enabled: true,
  },
  indeed: {
    id: 'indeed',
    name: 'Indeed',
    icon: '📋',
    domains: ['indeed.com', 'au.indeed.com', 'uk.indeed.com', 'ca.indeed.com'],
    color: '#003a6b',
    enabled: false, // Temporarily disabled
  },
  jora: {
    id: 'jora',
    name: 'Jora',
    icon: '🧭',
    domains: ['jora.com', 'au.jora.com', 'nz.jora.com'],
    color: '#0e8136',
    enabled: true,
  },
  reed: {
    id: 'reed',
    name: 'Reed',
    icon: '🇬🇧',
    domains: ['reed.co.uk'],
    color: '#e31837',
    enabled: true,
  },
};

// Country configurations with platform mappings and URLs
export const COUNTRIES: Record<string, CountryConfig> = {
  US: {
    name: 'United States',
    code: 'US',
    icon: '🇺🇸',
    platforms: ['linkedin'],
    locations: [
      'New York, NY',
      'Los Angeles, CA',
      'Chicago, IL',
      'Houston, TX',
      'Phoenix, AZ',
      'Philadelphia, PA',
      'San Antonio, TX',
      'San Diego, CA',
      'Dallas, TX',
      'San Jose, CA',
      'Austin, TX',
      'Jacksonville, FL',
      'Fort Worth, TX',
      'Columbus, OH',
      'Charlotte, NC',
      'San Francisco, CA',
      'Indianapolis, IN',
      'Seattle, WA',
      'Denver, CO',
      'Washington, DC',
      'Boston, MA',
      'El Paso, TX',
      'Nashville, TN',
      'Detroit, MI',
      'Oklahoma City, OK',
      'Portland, OR',
      'Las Vegas, NV',
      'Memphis, TN',
      'Louisville, KY',
      'Baltimore, MD',
      'Milwaukee, WI',
      'Albuquerque, NM',
      'Tucson, AZ',
      'Fresno, CA',
      'Mesa, AZ',
      'Sacramento, CA',
      'Atlanta, GA',
      'Kansas City, MO',
      'Colorado Springs, CO',
      'Miami, FL',
      'Raleigh, NC',
      'Omaha, NE',
      'Long Beach, CA',
      'Virginia Beach, VA',
      'Oakland, CA',
      'Minneapolis, MN',
      'Tampa, FL',
      'Tulsa, OK',
      'Arlington, TX',
      'New Orleans, LA',
    ],
    urls: {
      linkedin: 'https://www.linkedin.com/jobs/search/',
      indeed: 'https://www.indeed.com/jobs',
    },
  },
  AU: {
    name: 'Australia',
    code: 'AU',
    icon: '🇦🇺',
    platforms: ['linkedin', 'seek', 'jora'],
    locations: [
      'Sydney, NSW',
      'Melbourne, VIC',
      'Brisbane, QLD',
      'Perth, WA',
      'Adelaide, SA',
      'Gold Coast, QLD',
      'Newcastle, NSW',
      'Canberra, ACT',
      'Hobart, TAS',
      'Darwin, NT',
      'Townsville, QLD',
      'Cairns, QLD',
      'Toowoomba, QLD',
      'Ballarat, VIC',
      'Bendigo, VIC',
      'Albury, NSW',
      'Launceston, TAS',
      'Mackay, QLD',
      'Rockhampton, QLD',
      'Bunbury, WA',
      'Bundaberg, QLD',
      'Coffs Harbour, NSW',
      'Wagga Wagga, NSW',
      'Hervey Bay, QLD',
      'Mildura, VIC',
      'Shepparton, VIC',
      'Port Macquarie, NSW',
      'Gladstone, QLD',
      'Tamworth, NSW',
      'Traralgon, VIC',
      'Orange, NSW',
      'Dubbo, NSW',
      'Geraldton, WA',
      'Nowra, NSW',
      'Warrnambool, VIC',
      'Kalgoorlie, WA',
      'Albany, WA',
      'Blue Mountains, NSW',
      'Lismore, NSW',
      'Goulburn, NSW',
    ],
    urls: {
      linkedin: 'https://www.linkedin.com/jobs/search/',
      seek: 'https://www.seek.com.au',
      indeed: 'https://au.indeed.com/jobs',
      jora: 'https://au.jora.com/',
    },
  },
  UK: {
    name: 'United Kingdom',
    code: 'UK',
    icon: '🇬🇧',
    platforms: ['linkedin', 'reed'],
    locations: [
      'London',
      'Manchester',
      'Birmingham',
      'Leeds',
      'Glasgow',
      'Liverpool',
      'Edinburgh',
      'Bristol',
      'Sheffield',
      'Newcastle',
      'Nottingham',
      'Cardiff',
      'Belfast',
      'Leicester',
      'Coventry',
      'Bradford',
      'Stoke-on-Trent',
      'Wolverhampton',
      'Plymouth',
      'Derby',
      'Southampton',
      'Swansea',
      'Reading',
      'Northampton',
      'Luton',
      'Milton Keynes',
      'Warrington',
      'York',
      'Poole',
      'Bournemouth',
      'Peterborough',
      'Cambridge',
      'Oxford',
      'Blackpool',
      'Ipswich',
      'Norwich',
      'Exeter',
      'Chelmsford',
      'Gloucester',
      'Aberdeen',
      'Dundee',
      'Stirling',
      'Inverness',
    ],
    urls: {
      linkedin: 'https://www.linkedin.com/jobs/search/',
      reed: 'https://www.reed.co.uk/jobs',
      indeed: 'https://uk.indeed.com/jobs',
    },
  },
  CA: {
    name: 'Canada',
    code: 'CA',
    icon: '🇨🇦',
    platforms: ['linkedin'],
    locations: [
      'Toronto, ON',
      'Vancouver, BC',
      'Montreal, QC',
      'Calgary, AB',
      'Ottawa, ON',
      'Edmonton, AB',
      'Winnipeg, MB',
      'Quebec City, QC',
      'Hamilton, ON',
      'Kitchener, ON',
      'London, ON',
      'Halifax, NS',
      'Victoria, BC',
      'Windsor, ON',
      'Oshawa, ON',
      'Saskatoon, SK',
      'Regina, SK',
      'Sherbrooke, QC',
      "St. John's, NL",
      'Barrie, ON',
      'Kelowna, BC',
      'Abbotsford, BC',
      'Kingston, ON',
      'Sudbury, ON',
      'Chicoutimi, QC',
      'Thunder Bay, ON',
      'Saint John, NB',
      'Moncton, NB',
      'Kamloops, BC',
      'Brantford, ON',
      'Cape Breton, NS',
      'Chatham-Kent, ON',
      'Red Deer, AB',
      'Lethbridge, AB',
      'Nanaimo, BC',
      'Fredericton, NB',
      'Medicine Hat, AB',
      'Sarnia, ON',
      'Grande Prairie, AB',
      'Charlottetown, PE',
    ],
    urls: {
      linkedin: 'https://www.linkedin.com/jobs/search/',
      indeed: 'https://ca.indeed.com/jobs',
    },
  },
  NZ: {
    name: 'New Zealand',
    code: 'NZ',
    icon: '🇳🇿',
    platforms: ['linkedin', 'seek'],
    locations: [
      'Auckland',
      'Wellington',
      'Christchurch',
      'Hamilton',
      'Tauranga',
      'Dunedin',
      'Palmerston North',
      'Napier-Hastings',
      'Nelson',
      'Rotorua',
      'New Plymouth',
      'Whangarei',
      'Invercargill',
      'Whanganui',
      'Gisborne',
      'Blenheim',
      'Masterton',
      'Timaru',
      'Oamaru',
      'Greymouth',
      'Westport',
      'Hokitika',
      'Te Awamutu',
      'Pukekohe',
      'Tokoroa',
      'Levin',
      'Ashburton',
      'Gore',
      'Whakatane',
      'Rangiora',
    ],
    urls: {
      linkedin: 'https://www.linkedin.com/jobs/search/',
      seek: 'https://www.seek.co.nz',
    },
  },
};

// Job suggestions
export const JOB_SUGGESTIONS = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Scientist',
  'Data Analyst',
  'Product Manager',
  'UX Designer',
  'UI Designer',
  'DevOps Engineer',
  'QA Engineer',
  'Business Analyst',
  'Project Manager',
  'Marketing Manager',
  'Sales Representative',
  'Accountant',
  'Graphic Designer',
  'Content Writer',
  'Customer Support',
  'HR Manager',
];

// Build search URLs with proper encoding and parameters
export const buildSearchUrl = (
  platform: string,
  config: { keywords: string; location?: string; country?: string },
): string => {
  const { keywords, location, country } = config;
  const encodedKeywords = encodeURIComponent(keywords);
  const encodedLocation = location ? encodeURIComponent(location) : '';

  const countryConfig = country ? COUNTRIES[country] : null;
  const baseUrl = countryConfig?.urls[platform as keyof PlatformUrls];

  if (!baseUrl) {
    throw new Error(`No URL configured for platform ${platform} in country ${country}`);
  }

  switch (platform) {
    case 'linkedin': {
      let linkedinUrl = `${baseUrl}?keywords=${encodedKeywords}`;
      if (location) linkedinUrl += `&location=${encodedLocation}`;
      return linkedinUrl;
    }

    case 'seek': {
      // SEEK uses format: https://www.seek.com.au/job-title-jobs/in-All-Location
      // Convert keywords to URL-friendly format and add location
      const seekKeywords = keywords.toLowerCase().replace(/\s+/g, '-');
      let seekUrl = `${baseUrl}/${seekKeywords}-jobs`;
      if (location) {
        // Format location for SEEK: "in-All-Hobart-TAS" format
        const seekLocation = location.replace(/,?\s+/g, '-');
        seekUrl += `/in-All-${seekLocation}`;
      }
      return seekUrl;
    }

    case 'indeed': {
      let indeedUrl = `${baseUrl}?q=${encodedKeywords}`;
      if (location) indeedUrl += `&l=${encodedLocation}`;
      return indeedUrl;
    }

    case 'jora': {
      let joraUrl = `${baseUrl}j?sp=search&trigger_source=serp&qa=y&q=${encodedKeywords}`;
      if (location) joraUrl += `&l=${encodedLocation}`;
      return joraUrl;
    }

    case 'reed': {
      let reedUrl = `${baseUrl}/${encodedKeywords.replace(/\s+/g, '-')}-jobs`;
      if (location) reedUrl += `?location=${encodedLocation}`;
      return reedUrl;
    }

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
};

// Message types for Chrome messaging
export const MESSAGE_TYPES = {
  START_SCRAPING: 'START_SCRAPING',
  SCRAPING_PROGRESS: 'SCRAPING_PROGRESS',
  SCRAPING_COMPLETE: 'SCRAPING_COMPLETE',
  SCRAPING_ERROR: 'SCRAPING_ERROR',
  AUTH_STATUS: 'AUTH_STATUS',
  TOKEN_UPDATE: 'TOKEN_UPDATE',
  SCRAPE_JOBS: 'SCRAPE_JOBS',
  SHOW_OVERLAY: 'SHOW_OVERLAY',
  HIDE_OVERLAY: 'HIDE_OVERLAY',
  API_REQUEST: 'API_REQUEST',
  API_RESPONSE: 'API_RESPONSE',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'jobjourney_auth_token',
  USER_DATA: 'jobjourney_user_data',
  SEARCH_PREFERENCES: 'search_preferences',
  LAST_SCRAPE: 'last_scrape_data',
} as const;

// Centralized timeout configuration for all scraping operations
export const TIMEOUT_CONFIG = {
  // Overall platform scraping timeout (all pages combined)
  PLATFORM_SCRAPING_TOTAL: 900000, // 15 minutes - entire platform scraping

  // Individual page operations
  PAGE_LOAD: 60000, // 60 seconds - single page navigation/loading

  // Job detail panel operations
  JOB_PANEL_MAX_WAIT: 3000, // 3 seconds - max wait between job panel attempts
  JOB_PANEL_MAX_ATTEMPTS: 15, // Max attempts to load job panels (Indeed)

  // Platform-specific configurations
  LINKEDIN: {
    JOB_PANEL_MAX_ATTEMPTS: 30, // LinkedIn needs more attempts
    JOB_PANEL_MAX_WAIT: 3000,
  },

  SEEK: {
    JOB_PANEL_MAX_ATTEMPTS: 25, // SEEK moderate attempts
    JOB_PANEL_MAX_WAIT: 3000,
  },
} as const;

// Scraping configuration
export const SCRAPING_CONFIG = {
  MAX_JOBS_PER_PLATFORM: 50,
  RATE_LIMIT_DELAY: 1000,
  MAX_RETRIES: 3,
  TIMEOUT: TIMEOUT_CONFIG.PLATFORM_SCRAPING_TOTAL, // Use centralized timeout
  USER_AGENT: 'JobJourney-Assistant/3.0.0',
} as const;

// UI states
export const UI_STATES = {
  IDLE: 'idle',
  AUTHENTICATING: 'authenticating',
  SCRAPING: 'scraping',
  ERROR: 'error',
  SUCCESS: 'success',
} as const;
