import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import * as webPush from 'web-push';

import { API_VERSION, type HealthResponse } from '@scuttlebutt/shared-types';

import { ScuttlebuttDatabase } from './database.js';

export interface PlatformAppOptions {
  databaseUrl?: string;
  googleClientId?: string;
  staticDirectory?: string;
  webPushPrivateKey?: string;
  webPushPublicKey?: string;
  webPushSubject?: string;
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

interface PersistedMessageBody {
  body?: string;
  id: string;
  mentions?: unknown;
  replyTo?: unknown;
  senderId?: string;
  senderName?: string;
  [key: string]: unknown;
}

interface MessageBody extends ConversationRequestBody {
  message: PersistedMessageBody;
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

interface PushSubscriptionBody extends GoogleCredentialBody {
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      auth: string;
      p256dh: string;
    };
  };
}

interface PushUnsubscribeBody extends GoogleCredentialBody {
  endpoint: string;
}

function isValidPushSubscription(value: unknown): value is PushSubscriptionBody['subscription'] {
  if (!value || typeof value !== 'object') return false;
  const subscription = value as Partial<PushSubscriptionBody['subscription']>;
  return Boolean(
    typeof subscription.endpoint === 'string' &&
    subscription.endpoint.startsWith('https://') &&
    subscription.endpoint.length <= 4096 &&
    subscription.keys &&
    typeof subscription.keys.auth === 'string' &&
    subscription.keys.auth.length <= 512 &&
    typeof subscription.keys.p256dh === 'string' &&
    subscription.keys.p256dh.length <= 512,
  );
}

function errorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

export function buildApp(options: PlatformAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });
  const google = options.googleClientId ? new OAuth2Client(options.googleClientId) : undefined;
  const database = options.databaseUrl ? new ScuttlebuttDatabase(options.databaseUrl) : undefined;
  const webPushOptions =
    options.webPushPublicKey && options.webPushPrivateKey && options.webPushSubject
      ? {
          privateKey: options.webPushPrivateKey,
          publicKey: options.webPushPublicKey,
          subject: options.webPushSubject,
        }
      : undefined;
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
    webPushPublicKey: webPushOptions?.publicKey ?? null,
  }));

  app.get('/api/push/config', async () => ({
    publicKey: webPushOptions?.publicKey ?? null,
  }));

  app.post<{ Body: PushSubscriptionBody }>('/api/push/subscribe', async (request, reply) => {
    if (!webPushOptions) {
      return reply.code(503).send({ error: 'Push notifications are not configured.' });
    }
    const userId = await authenticate(request.body.credential);
    if (!isValidPushSubscription(request.body.subscription)) {
      return reply.code(400).send({ error: 'Push subscription is invalid.' });
    }
    await database!.upsertPushSubscription(
      userId,
      request.body.subscription,
      request.headers['user-agent'],
    );
    return { saved: true };
  });

  app.post<{ Body: PushUnsubscribeBody }>('/api/push/unsubscribe', async (request, reply) => {
    const userId = await authenticate(request.body.credential);
    if (
      typeof request.body.endpoint !== 'string' ||
      !request.body.endpoint.startsWith('https://') ||
      request.body.endpoint.length > 4096
    ) {
      return reply.code(400).send({ error: 'Push endpoint is invalid.' });
    }
    await database!.removePushSubscription(userId, request.body.endpoint);
    return { saved: true };
  });

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

  app.post<{ Body: ConversationRequestBody }>('/api/sync/messages/read', async (request) => {
    const userId = await authenticate(request.body.credential);
    await database!.markConversationRead(userId, request.body.conversationId);
    return { saved: true };
  });

  app.post<{ Body: MessageBody }>('/api/sync/messages', async (request) => {
    const userId = await authenticate(request.body.credential);
    const message = { ...request.body.message, senderId: userId };
    const savedMessage = await database!.saveMessage(userId, request.body.conversationId, message);
    if (webPushOptions) {
      try {
        const targets = await database!.getMessagePushTargets(
          userId,
          request.body.conversationId,
          request.body.message,
        );
        await Promise.all(
          targets.map(async (target) => {
            try {
              await webPush.sendNotification(
                {
                  endpoint: target.endpoint,
                  keys: { auth: target.auth, p256dh: target.p256dh },
                },
                JSON.stringify({
                  body: target.body,
                  data: {
                    conversationId: request.body.conversationId,
                    reason: target.reason,
                    url: target.url,
                  },
                  icon: '/scuttlebutt-mark.webp',
                  tag: target.tag,
                  title: target.title,
                }),
                {
                  TTL: 60,
                  urgency: 'high',
                  vapidDetails: webPushOptions,
                },
              );
            } catch (error) {
              if (errorStatusCode(error) === 404 || errorStatusCode(error) === 410) {
                await database!.removePushSubscriptionByEndpoint(target.endpoint);
              } else {
                request.log.warn(
                  { statusCode: errorStatusCode(error) },
                  'Web Push delivery failed; message was saved.',
                );
              }
            }
          }),
        );
      } catch (error) {
        request.log.warn({ error }, 'Web Push notification preparation failed; message was saved.');
      }
    }
    return {
      message: savedMessage,
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
