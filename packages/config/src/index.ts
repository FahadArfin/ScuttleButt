export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface RuntimeConfig {
  apiHost: string;
  apiPort: number;
  environment: RuntimeEnvironment;
  webOrigin: string;
}

function parsePort(value: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseEnvironment(value: string): RuntimeEnvironment {
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }

  throw new Error('NODE_ENV must be development, test, or production.');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    apiHost: env.API_HOST ?? '127.0.0.1',
    apiPort: parsePort(env.API_PORT ?? env.PORT ?? '3001'),
    environment: parseEnvironment(env.NODE_ENV ?? 'development'),
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:5173',
  };
}
