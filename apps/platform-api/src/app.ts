import Fastify, { type FastifyInstance } from 'fastify';

import { API_VERSION, type HealthResponse } from '@scuttlebutt/shared-types';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get<{ Reply: HealthResponse }>('/health', async () => ({
    status: 'ok',
    service: 'platform-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
  }));

  return app;
}
