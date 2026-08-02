import { loadConfig } from '@scuttlebutt/config';

import { buildApp } from './app.js';

const config = loadConfig();
const app = buildApp({
  databaseUrl: config.databaseUrl,
  googleClientId: config.googleClientId,
  staticDirectory: config.staticDirectory,
  webOrigin: config.webOrigin,
});

app.listen({ host: config.apiHost, port: config.apiPort }).catch((error: unknown) => {
  app.log.error(error);
  process.exitCode = 1;
});
