export const APP_NAME = 'Scuttlebutt' as const;
export const API_VERSION = '0.1.0' as const;

export interface HealthResponse {
  status: 'ok';
  service: 'platform-api';
  version: typeof API_VERSION;
  timestamp: string;
}
