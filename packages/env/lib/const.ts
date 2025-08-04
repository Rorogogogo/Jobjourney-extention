export const IS_DEV = process.env['CLI_CEB_DEV'] === 'true';
export const IS_PROD = !IS_DEV;
export const IS_FIREFOX = process.env['CLI_CEB_FIREFOX'] === 'true';
export const IS_CI = process.env['CEB_CI'] === 'true';

// JobJourney Configuration
export const JOBJOURNEY_FRONTEND_URL = IS_DEV
  ? process.env['CEB_JOBJOURNEY_FRONTEND_DEV'] || 'http://localhost:5001'
  : process.env['CEB_JOBJOURNEY_FRONTEND_PROD'] || 'https://jobjourney.me';

export const JOBJOURNEY_API_URL = IS_DEV
  ? process.env['CEB_JOBJOURNEY_API_DEV'] || 'http://localhost:5014'
  : process.env['CEB_JOBJOURNEY_API_PROD'] || 'https://server.jobjourney.me';
