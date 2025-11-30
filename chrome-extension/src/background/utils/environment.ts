/**
 * Global environment detection utility for JobJourney Extension Background Services
 * Provides consistent environment detection across all background services
 */

let cachedEnvironment: 'development' | 'production' | null = null;
let cachedBaseUrl: string | null = null;
let detectionPromise: Promise<void> | null = null;

/**
 * Detect if we're in development or production environment
 * Uses CLI_CEB_DEV environment variable for reliable detection
 * Results are cached to avoid multiple checks
 */
export const detectEnvironment = async (): Promise<'development' | 'production'> => {
  // Return cached result if available
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  // If detection is already in progress, wait for it
  if (detectionPromise) {
    await detectionPromise;
    return cachedEnvironment!;
  }

  // Start new detection
  detectionPromise = (async () => {
    try {
      // Use CLI_CEB_DEV environment variable for reliable detection
      const isDevMode = process.env['CLI_CEB_DEV'] === 'true';

      if (isDevMode) {
        // In development mode, only check port 5001 (JobJourney frontend)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);

          await fetch('http://localhost:5001/', {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors',
          });
          clearTimeout(timeoutId);

          cachedEnvironment = 'development';
          cachedBaseUrl = 'http://localhost:5001';
        } catch {
          // If 5001 not accessible, use production even in dev mode
          cachedEnvironment = 'production';
          cachedBaseUrl = 'https://jobjourney.me';
        }
      } else {
        // Production mode
        cachedEnvironment = 'production';
        cachedBaseUrl = 'https://jobjourney.me';
      }
    } catch {
      // Fallback to production on any unexpected errors
      cachedEnvironment = 'production';
      cachedBaseUrl = 'https://jobjourney.me';
    }
  })();

  await detectionPromise;
  return cachedEnvironment!;
};

/**
 * Get the base URL for JobJourney frontend
 * Automatically detects environment if not already cached
 */
export const getJobJourneyBaseUrl = async (): Promise<string> => {
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }

  await detectEnvironment();
  return cachedBaseUrl!;
};

/**
 * Get the JobJourney job market URL
 * This is where users should be redirected to view scraped jobs
 */
export const getJobMarketUrl = async (): Promise<string> => {
  const baseUrl = await getJobJourneyBaseUrl();
  return `${baseUrl}/job-market`;
};

/**
 * Get the JobJourney auth URL for extension login
 */
export const getAuthUrl = async (): Promise<string> => {
  const baseUrl = await getJobJourneyBaseUrl();
  return `${baseUrl}/extension-auth?source=extension&redirect=close`;
};

/**
 * Check if we're in development environment (cached result)
 */
export const isDevelopment = (): boolean => cachedEnvironment === 'development';

/**
 * Check if we're in production environment (cached result)
 */
export const isProduction = (): boolean => cachedEnvironment === 'production';

/**
 * Clear environment cache (useful for testing or config changes)
 */
export const clearEnvironmentCache = (): void => {
  cachedEnvironment = null;
  cachedBaseUrl = null;
  detectionPromise = null;
};

/**
 * Get current environment info (for debugging)
 */
export const getEnvironmentInfo = () => ({
  environment: cachedEnvironment,
  baseUrl: cachedBaseUrl,
  isCached: cachedEnvironment !== null,
});
