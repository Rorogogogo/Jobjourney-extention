/**
 * Global environment detection utility for JobJourney Extension.
 * Provides consistent environment detection across all components.
 */

let cachedEnvironment: 'development' | 'production' | null = null;
let cachedBaseUrl: string | null = null;
let detectionPromise: Promise<void> | null = null;

/**
 * Detect if we're in development or production environment.
 * Uses CLI_CEB_DEV environment variable for reliable detection.
 */
export const detectEnvironment = async (): Promise<'development' | 'production'> => {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  if (detectionPromise) {
    await detectionPromise;
    return cachedEnvironment!;
  }

  detectionPromise = (async () => {
    try {
      const isDevMode = process.env['CLI_CEB_DEV'] === 'true';

      if (isDevMode) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);

          await fetch('http://localhost:5001/', {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors',
          });
          clearTimeout(timeoutId);

          cachedEnvironment = 'development';
          cachedBaseUrl = 'http://localhost:5001';
        } catch {
          cachedEnvironment = 'production';
          cachedBaseUrl = 'https://jobjourney.me';
        }
      } else {
        cachedEnvironment = 'production';
        cachedBaseUrl = 'https://jobjourney.me';
      }
    } catch {
      cachedEnvironment = 'production';
      cachedBaseUrl = 'https://jobjourney.me';
    }
  })();

  await detectionPromise;
  return cachedEnvironment!;
};

export const getJobJourneyBaseUrl = async (): Promise<string> => {
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }

  await detectEnvironment();
  return cachedBaseUrl!;
};

export const getJobMarketUrl = async (): Promise<string> => {
  const baseUrl = await getJobJourneyBaseUrl();
  return `${baseUrl}/job-market`;
};

export const getAuthUrl = async (): Promise<string> => {
  const baseUrl = await getJobJourneyBaseUrl();
  return `${baseUrl}/extension-auth?source=extension&redirect=close`;
};

export const getDashboardUrl = async (): Promise<string> => {
  const baseUrl = await getJobJourneyBaseUrl();
  return `${baseUrl}/dashboard`;
};

export const isDevelopment = (): boolean => cachedEnvironment === 'development';

export const isProduction = (): boolean => cachedEnvironment === 'production';

export const clearEnvironmentCache = (): void => {
  cachedEnvironment = null;
  cachedBaseUrl = null;
  detectionPromise = null;
};

export const getEnvironmentInfo = () => ({
  environment: cachedEnvironment,
  baseUrl: cachedBaseUrl,
  isCached: cachedEnvironment !== null,
});
