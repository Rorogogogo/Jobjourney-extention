// Configuration types

export interface ConfigData {
  environment: 'development' | 'production';
  baseUrl: string;
  apiUrl: string;
  initialized: boolean;
}
