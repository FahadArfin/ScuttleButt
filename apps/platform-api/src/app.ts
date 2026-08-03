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

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';

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

interface PresenceBody extends GoogleCredentialBody {
  presence: PresenceStatus;
}

interface WorkspaceBody extends GoogleCredentialBody {
  workspace: { dms: unknown[]; groups: unknown[] };
}

interface ConversationBody extends GoogleCredentialBody {
  conversation: { id: string };
}

interface ConversationRequestBody extends GoogleCredentialBody {
  conversationId: string;
}

interface MessageBody extends ConversationRequestBody {
  message: { id: string; senderId?: string };
}

interface MessageMutationBody extends ConversationRequestBody {
  messageId: string;
  value?: string;
}

interface FriendRequestBody extends GoogleCredentialBody {
  code: string;
}

interface FriendResponseBody extends GoogleCredentialBody {
  action: 'accept' | 'decline';
  requesterId: string;
}

interface GroupInviteBody extends GoogleCredentialBody {
  friendId: string;
  group: Record<string, unknown>;
}

export function buildApp(options: PlatformAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });
  const google = options.googleClientId ? new OAuth2Client(options.googleClientId) : undefined;
  const database = options.databaseUrl ? new ScuttlebuttDatabase(options.databaseUrl) : undefined;
  const authenticate = async (credential: string): Promise<string> => {
    if (!google || !options.googleClientId || !database) {
      throw Object.assign(new Error('Cloud synchronization is not configured.'), {
        statusCode: 503,
      });
    }
    const ticket = await google.verifyIdToken({
      idToken: credential,
      audience: options.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw Object.assign(new Error('Google identity could not be verified.'), { statusCode: 401 });
    }
    return database.getUserId(payload.sub);
  };

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
          presence: 'online',
        };
    const friendCode = database ? await database.getOrCreateFriendCode(user.id) : null;
    return { user: { ...user, friendCode } };
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
      tags: profile.tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5),
    };
    const user = database
      ? await database.updateUserProfile(payload.sub, sanitized)
      : {
          ...sanitized,
          id: payload.sub,
          email: payload.email,
          onboardingCompleted: true,
        };
    const friendCode = database ? await database.getOrCreateFriendCode(user.id) : null;
    return { user: { ...user, friendCode } };
  });

  app.post<{ Body: PresenceBody }>('/api/presence', async (request, reply) => {
    const userId = await authenticate(request.body.credential);
    if (!['online', 'idle', 'dnd', 'invisible'].includes(request.body.presence)) {
      return reply.code(400).send({ error: 'Presence status is invalid.' });
    }
    await database!.updatePresence(userId, request.body.presence);
    return { presence: request.body.presence, saved: true };
  });

  app.post<{ Body: GoogleCredentialBody }>('/api/friends/list', async (request) => {
    const userId = await authenticate(request.body.credential);
    return database!.listFriends(userId);
  });

  app.post<{ Body: FriendRequestBody }>('/api/friends/request', async (request) => {
    const userId = await authenticate(request.body.credential);
    const code = request.body.code.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      throw Object.assign(new Error('Enter a valid friend code.'), { statusCode: 400 });
    }
    return { recipient: await database!.requestFriend(userId, code) };
  });

  app.post<{ Body: FriendResponseBody }>('/api/friends/respond', async (request) => {
    const userId = await authenticate(request.body.credential);
    if (!['accept', 'decline'].includes(request.body.action)) {
      throw Object.assign(new Error('Friend response is invalid.'), { statusCode: 400 });
    }
    await database!.respondToFriendRequest(userId, request.body.requesterId, request.body.action);
    return { saved: true };
  });

  app.post<{ Body: GroupInviteBody }>('/api/groups/invite', async (request) => {
    const userId = await authenticate(request.body.credential);
    return {
      group: await database!.inviteFriendToGroup(userId, request.body.friendId, request.body.group),
    };
  });

  app.post<{ Body: GoogleCredentialBody }>('/api/sync/workspace/load', async (request) => {
    const userId = await authenticate(request.body.credential);
    return { workspace: await database!.getWorkspace(userId) };
  });

  app.put<{ Body: WorkspaceBody }>('/api/sync/workspace', async (request) => {
    const userId = await authenticate(request.body.credential);
    await database!.saveWorkspace(userId, request.body.workspace);
    return { saved: true };
  });

  app.post<{ Body: ConversationBody }>('/api/sync/conversations', async (request) => {
    const userId = await authenticate(request.body.credential);
    return { conversation: await database!.upsertConversation(userId, request.body.conversation) };
  });

  app.post<{ Body: GoogleCredentialBody }>('/api/sync/conversations/list', async (request) => {
    const userId = await authenticate(request.body.credential);
    return { conversations: await database!.listConversations(userId) };
  });

  app.post<{ Body: ConversationRequestBody }>('/api/sync/messages/list', async (request) => {
    const userId = await authenticate(request.body.credential);
    return {
      messages: await database!.listMessages(userId, request.body.conversationId),
    };
  });

  app.post<{ Body: MessageBody }>('/api/sync/messages', async (request) => {
    const userId = await authenticate(request.body.credential);
    const message = { ...request.body.message, senderId: userId };
    return {
      message: await database!.saveMessage(userId, request.body.conversationId, message),
    };
  });

  app.patch<{ Body: MessageMutationBody }>('/api/sync/messages/edit', async (request) => {
    const userId = await authenticate(request.body.credential);
    await database!.updateMessage(
      userId,
      request.body.conversationId,
      request.body.messageId,
      'edit',
      request.body.value,
    );
    return { saved: true };
  });

  app.post<{ Body: MessageMutationBody }>('/api/sync/messages/react', async (request) => {
    const userId = await authenticate(request.body.credential);
    await database!.updateMessage(
      userId,
      request.body.conversationId,
      request.body.messageId,
      'react',
      request.body.value,
    );
    return { saved: true };
  });

  app.delete<{ Body: MessageMutationBody }>('/api/sync/messages', async (request) => {
    const userId = await authenticate(request.body.credential);
    await database!.updateMessage(
      userId,
      request.body.conversationId,
      request.body.messageId,
      'delete',
    );
    return { deleted: true };
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
