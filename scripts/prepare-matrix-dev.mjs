import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = resolve(projectRoot, 'infrastructure', 'matrix', 'docker-compose.yml');
const dataDirectory = resolve(projectRoot, 'infrastructure', 'matrix', 'data');
const configFile = resolve(dataDirectory, 'homeserver.yaml');

mkdirSync(dataDirectory, { recursive: true });

if (!existsSync(configFile)) {
  execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'run', '--rm', '--no-deps', 'synapse', 'generate'],
    { cwd: projectRoot, stdio: 'inherit' },
  );
}

const config = YAML.parse(readFileSync(configFile, 'utf8'));
config.database = {
  name: 'psycopg2',
  args: {
    database: 'synapse',
    host: 'postgres',
    password: 'synapse-dev-only',
    port: 5432,
    user: 'synapse',
  },
  allow_unsafe_locale: true,
};
config.enable_registration = true;
config.enable_registration_without_verification = true;
config.registration_requires_token = false;

if (Array.isArray(config.listeners)) {
  config.listeners = config.listeners.map((listener) => {
    if (listener.port !== 8008) {
      return listener;
    }

    return {
      ...listener,
      bind_addresses: ['0.0.0.0'],
    };
  });
}

writeFileSync(configFile, YAML.stringify(config), 'utf8');
console.log(`Prepared local Synapse config at ${configFile}`);
