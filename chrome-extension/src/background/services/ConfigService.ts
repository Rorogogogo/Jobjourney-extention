// Configuration management for JobJourney Extension
import { detectEnvironment as globalDetectEnvironment, getJobJourneyBaseUrl } from '../utils/environment';
import { Logger } from '../utils/Logger';
import type { ConfigData } from '../types';

export class ConfigService {
  private config: ConfigData = {
    environment: 'production',
    baseUrl: 'https://jobjourney.me',
    apiUrl: 'https://server.jobjourney.me/api',
    initialized: false,
  };

  /**
   * Initialize configuration by detecting environment
   */
  async initialize(): Promise<void> {
    if (this.config.initialized) return;

    try {
      // Use global environment detection utility
      const environment = await globalDetectEnvironment();
      this.config.environment = environment;

      await this.setupUrls();
      this.config.initialized = true;

      Logger.info(`🟢 JobJourney Extension initialized for ${this.config.environment}`, {
        baseUrl: this.config.baseUrl,
        apiUrl: this.config.apiUrl,
      });
    } catch (error) {
      Logger.error('❌ Failed to initialize config:', error);
      this.fallbackToProduction();
    }
  }

  /**
   * Detect if we're in development or production environment
   * Uses CLI_CEB_DEV environment variable for reliable detection
   */
  private async detectEnvironment(): Promise<void> {
    try {
      // Use CLI_CEB_DEV environment variable for reliable detection
      const isDevMode = process.env['CLI_CEB_DEV'] === 'true';

      if (isDevMode) {
        this.config.environment = 'development';
        Logger.info('🔧 Development environment detected (CLI_CEB_DEV=true)');
      } else {
        this.config.environment = 'production';
        Logger.info('🌐 Production environment detected (CLI_CEB_DEV=false)');
      }
    } catch (error) {
      // Fallback to production on any unexpected errors
      this.config.environment = 'production';
      Logger.warning('⚠️ Environment detection failed, defaulting to production:', error);
    }
  }

  /**
   * Setup URLs based on detected environment
   */
  private async setupUrls(): Promise<void> {
    // Use global environment detection utility for base URL
    this.config.baseUrl = await getJobJourneyBaseUrl();

    if (this.config.environment === 'development') {
      this.config.apiUrl = 'http://localhost:5014/api';
    } else {
      this.config.apiUrl = 'https://server.jobjourney.me/api';
    }
  }

  /**
   * Fallback to production configuration
   */
  private fallbackToProduction(): void {
    this.config.environment = 'production';
    this.config.baseUrl = 'https://jobjourney.me';
    this.config.apiUrl = 'https://server.jobjourney.me/api';
    this.config.initialized = true;

    Logger.warning('⚠️ Falling back to production configuration');
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfigData {
    return { ...this.config };
  }

  /**
   * Get environment
   */
  getEnvironment(): 'development' | 'production' {
    return this.config.environment;
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.config.apiUrl;
  }

  /**
   * Check if development environment
   */
  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  /**
   * Check if production environment
   */
  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Force set environment (for testing)
   */
  setEnvironment(env: 'development' | 'production'): void {
    this.config.environment = env;
    this.setupUrls();
    Logger.info(`Environment set to: ${env}`);
  }
}
