import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';

import { API_VERSION, type HealthResponse } from '@scuttlebutt/shared-types';

import { ScuttlebuttDatabase } from './database.js';

export interface PlatformAppOptions {
  databaseUrl?: string;
  googleClientId?: string;
  staticDirectory?: string;
  webOrigin?: string;
}

interface GoogleCredentialBody {
  credential: string;
}

interface ProfileBody extends GoogleCredentialBody {
  profile: {
    avatarUrl: string | null;
    backgroundColor: string;
    bio: string;
    interests: string[];
    joinedServerIds: string[];
    name: string;
    tags: string[];
  };
}

export function buildApp(options: PlatformAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });
  const google = options.googleClientId ? new OAuth2Client(options.googleClientId) : undefined;
  const database = options.databaseUrl ? new ScuttlebuttDatabase(options.databaseUrl) : undefined;

  void app.register(cors, {
    credentials: true,
    origin: options.webOrigin ?? 'http://localhost:5173',
  });

  app.get<{ Reply: HealthResponse }>('/health', async () => ({
    status: 'ok',
    service: 'platform-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/config', async () => ({
    googleClientId: options.googleClientId ?? null,
    persistence: database ? 'postgres' : 'local-demo',
  }));

  app.post<{ Body: GoogleCredentialBody }>('/api/auth/google', async (request, reply) => {
    if (!google || !options.googleClientId) {
      return reply.code(503).send({ error: 'Google sign-in is not configured.' });
    }
    const ticket = await google.verifyIdToken({
      idToken: request.body.credential,
      audience: options.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return reply.code(401).send({ error: 'Google identity could not be verified.' });
    }
    const identity = {
      avatarUrl: payload.picture,
      email: payload.email,
      googleSubject: payload.sub,
      name: payload.name ?? payload.email.split('@')[0] ?? 'Scuttlebutt user',
    };
    const user = database
      ? await database.upsertGoogleUser(identity)
      : {
          id: payload.sub,
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.avatarUrl ?? null,
          backgroundColor: '#6d5f82',
          bio: '',
          tags: [],
          interests: [],
          joinedServerIds: [],
          onboardingCompleted: false,
        };
    return { user };
  });

  app.put<{ Body: ProfileBody }>('/api/profile', async (request, reply) => {
    if (!google || !options.googleClientId) {
      return reply.code(503).send({ error: 'Google sign-in is not configured.' });
    }
    const ticket = await google.verifyIdToken({
      idToken: request.body.credential,
      audience: options.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return reply.code(401).send({ error: 'Google identity could not be verified.' });
    }
    const profile = request.body.profile;
    if (
      !profile?.name?.trim() ||
      profile.name.trim().length > 40 ||
      profile.bio.trim().split(/\s+/).filter(Boolean).length > 10 ||
      profile.tags.length > 5 ||
      profile.interests.length > 8 ||
      (profile.avatarUrl?.length ?? 0) > 3_000_000
    ) {
      return reply.code(400).send({ error: 'Profile details are invalid.' });
    }
    const sanitized = {
      avatarUrl: profile.avatarUrl,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(profile.backgroundColor)
        ? profile.backgroundColor
        : '#6d5f82',
      bio: profile.bio.trim(),
      interests: profile.interests.slice(0, 8),
      joinedServerIds: profile.joinedServerIds.slice(0, 12),
      name: profile.name.trim(),
      tags: profile.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
    };
    const user = database
      ? await database.updateUserProfile(payload.sub, sanitized)
      : {
          ...sanitized,
          id: payload.sub,
          email: payload.email,
          onboardingCompleted: true,
        };
    return { user };
  });

  if (database) {
    app.addHook('onReady', async () => database.migrate());
    app.addHook('onClose', async () => database.close());
  }

  const staticRoot = options.staticDirectory ? resolve(options.staticDirectory) : undefined;
  if (staticRoot && existsSync(staticRoot)) {
    void app.register(fastifyStatic, { root: staticRoot, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/'))
        return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'Not found' });
    });
  }

  return app;
}
