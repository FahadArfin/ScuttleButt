import { loadConfig } from '@scuttlebutt/config';

import { buildApp } from './app';

const config = loadConfig();
const app = buildApp();

app.listen({ host: config.apiHost, port: config.apiPort }).catch((error: unknown) => {
  app.log.error(error);
  process.exitCode = 1;
});
