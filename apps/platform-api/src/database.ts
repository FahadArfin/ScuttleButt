import { randomBytes, randomUUID } from 'node:crypto';

import { Pool } from 'pg';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';
export type FriendPresenceStatus = PresenceStatus | 'offline';

export interface AppUser {
  avatarUrl: string | null;
  backgroundColor: string;
  bio: string;
  email: string;
  id: string;
  interests: string[];
  joinedServerIds: string[];
  name: string;
  onboardingCompleted: boolean;
  presence: PresenceStatus;
  tags: string[];
}

export interface UserProfileUpdate {
  avatarUrl: string | null;
  backgroundColor: string;
  bio: string;
  interests: string[];
  joinedServerIds: string[];
  name: string;
  tags: string[];
}

export interface SyncedWorkspace {
  dms: unknown[];
  groups: unknown[];
}

export interface FriendProfile {
  avatarUrl: string | null;
  bio: string;
  id: string;
  name: string;
  presence: FriendPresenceStatus;
  tags: string[];
}

export interface FriendState {
  friendCode: string;
  friends: FriendProfile[];
  incoming: FriendProfile[];
  outgoing: FriendProfile[];
}

const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class ScuttlebuttDatabase {
  readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    });
  }

  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        google_subject text UNIQUE NOT NULL,
        email text UNIQUE NOT NULL,
        display_name text NOT NULL,
        avatar_url text,
        avatar_object_key text,
        profile_banner_color text NOT NULL DEFAULT '#6d5f82',
        profile_bio text NOT NULL DEFAULT '',
        profile_tags text[] NOT NULL DEFAULT '{}',
        profile_interests text[] NOT NULL DEFAULT '{}',
        joined_server_ids text[] NOT NULL DEFAULT '{}',
        onboarding_completed boolean NOT NULL DEFAULT false,
        presence text NOT NULL DEFAULT 'online',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_object_key text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_banner_color text NOT NULL DEFAULT '#6d5f82';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bio text NOT NULL DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_tags text[] NOT NULL DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_interests text[] NOT NULL DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_server_ids text[] NOT NULL DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS presence text NOT NULL DEFAULT 'online';
      CREATE TABLE IF NOT EXISTS friend_codes (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code_digest text UNIQUE NOT NULL,
        issued_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS friendships (
        requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('pending','accepted','declined','blocked')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (requester_id, recipient_id)
      );
      CREATE TABLE IF NOT EXISTS groups (
        id uuid PRIMARY KEY,
        owner_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS group_members (
        group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member',
        PRIMARY KEY (group_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS channels (
        id uuid PRIMARY KEY,
        group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('text','voice','dm')),
        name text NOT NULL,
        livekit_room text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS channel_members (
        channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (channel_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id uuid PRIMARY KEY,
        channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL REFERENCES users(id),
        body text NOT NULL DEFAULT '',
        reply_to uuid REFERENCES messages(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        edited_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id uuid PRIMARY KEY,
        message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        object_key text NOT NULL,
        mime_type text NOT NULL,
        byte_size bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS messages_channel_created_idx ON messages(channel_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS friendships_recipient_status_idx ON friendships(recipient_id, status);
      CREATE TABLE IF NOT EXISTS user_workspace_state (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        groups jsonb NOT NULL DEFAULT '[]',
        dms jsonb NOT NULL DEFAULT '[]',
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS synced_groups (
        id text PRIMARY KEY,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS synced_group_members (
        group_id text NOT NULL REFERENCES synced_groups(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member',
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (group_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS synced_conversations (
        id text PRIMARY KEY,
        conversation jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS synced_conversation_members (
        conversation_id text NOT NULL REFERENCES synced_conversations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation jsonb,
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (conversation_id, user_id)
      );
      ALTER TABLE synced_conversation_members ADD COLUMN IF NOT EXISTS conversation jsonb;
      CREATE TABLE IF NOT EXISTS synced_messages (
        id text PRIMARY KEY,
        conversation_id text NOT NULL REFERENCES synced_conversations(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS synced_messages_conversation_created_idx
        ON synced_messages(conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS synced_message_reactions (
        message_id text NOT NULL REFERENCES synced_messages(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (message_id, user_id, emoji)
      );
      CREATE INDEX IF NOT EXISTS synced_message_reactions_message_idx
        ON synced_message_reactions(message_id, emoji);
    `);
  }

  async upsertGoogleUser(input: {
    avatarUrl?: string;
    email: string;
    googleSubject: string;
    name: string;
  }): Promise<AppUser> {
    const result = await this.pool.query<AppUser>(
      `
      INSERT INTO users (id, google_subject, email, display_name, avatar_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (google_subject) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = CASE
          WHEN users.onboarding_completed THEN users.display_name
          ELSE EXCLUDED.display_name
        END,
        avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
        updated_at = now()
      RETURNING id, email, display_name AS name, avatar_url AS "avatarUrl",
        profile_banner_color AS "backgroundColor", profile_bio AS bio,
        profile_tags AS tags, profile_interests AS interests,
        joined_server_ids AS "joinedServerIds", onboarding_completed AS "onboardingCompleted",
        presence
    `,
      [randomUUID(), input.googleSubject, input.email, input.name, input.avatarUrl ?? null],
    );
    const user = result.rows[0];
    if (!user) throw new Error('Google user could not be stored.');
    return user;
  }

  async updateUserProfile(googleSubject: string, profile: UserProfileUpdate): Promise<AppUser> {
    const result = await this.pool.query<AppUser>(
      `
      UPDATE users SET
        display_name = $2,
        avatar_url = $3,
        profile_banner_color = $4,
        profile_bio = $5,
        profile_tags = $6,
        profile_interests = $7,
        joined_server_ids = $8,
        onboarding_completed = true,
        updated_at = now()
      WHERE google_subject = $1
      RETURNING id, email, display_name AS name, avatar_url AS "avatarUrl",
        profile_banner_color AS "backgroundColor", profile_bio AS bio,
        profile_tags AS tags, profile_interests AS interests,
        joined_server_ids AS "joinedServerIds", onboarding_completed AS "onboardingCompleted",
        presence
    `,
      [
        googleSubject,
        profile.name,
        profile.avatarUrl,
        profile.backgroundColor,
        profile.bio,
        profile.tags,
        profile.interests,
        profile.joinedServerIds,
      ],
    );
    const user = result.rows[0];
    if (!user) throw new Error('User profile could not be updated.');
    return user;
  }

  async updatePresence(userId: string, presence: PresenceStatus): Promise<void> {
    await this.pool.query('UPDATE users SET presence = $2, updated_at = now() WHERE id = $1', [
      userId,
      presence,
    ]);
  }

  async getUserId(googleSubject: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      'SELECT id FROM users WHERE google_subject = $1',
      [googleSubject],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Authenticated user was not found.');
    return id;
  }

  async getOrCreateFriendCode(userId: string): Promise<string> {
    const existing = await this.pool.query<{ code_digest: string }>(
      'SELECT code_digest FROM friend_codes WHERE user_id = $1',
      [userId],
    );
    if (existing.rows[0]) return existing.rows[0].code_digest;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bytes = randomBytes(6);
      const code = Array.from(
        bytes,
        (value) => FRIEND_CODE_ALPHABET[value % FRIEND_CODE_ALPHABET.length],
      ).join('');
      const inserted = await this.pool.query<{ code_digest: string }>(
        `INSERT INTO friend_codes (user_id, code_digest) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING code_digest`,
        [userId, code],
      );
      if (inserted.rows[0]) return inserted.rows[0].code_digest;
    }
    throw new Error('A unique friend code could not be generated.');
  }

  async listFriends(userId: string): Promise<FriendState> {
    const profileColumns = `u.id, u.display_name AS name, u.avatar_url AS "avatarUrl",
      u.profile_bio AS bio, u.profile_tags AS tags,
      CASE WHEN u.presence = 'invisible' THEN 'offline' ELSE u.presence END AS presence`;
    const [friends, incoming, outgoing, friendCode] = await Promise.all([
      this.pool.query<FriendProfile>(
        `SELECT ${profileColumns} FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.recipient_id ELSE f.requester_id END
         WHERE (f.requester_id = $1 OR f.recipient_id = $1) AND f.status = 'accepted'
         ORDER BY u.display_name`,
        [userId],
      ),
      this.pool.query<FriendProfile>(
        `SELECT ${profileColumns} FROM friendships f JOIN users u ON u.id = f.requester_id
         WHERE f.recipient_id = $1 AND f.status = 'pending' ORDER BY f.created_at DESC`,
        [userId],
      ),
      this.pool.query<FriendProfile>(
        `SELECT ${profileColumns} FROM friendships f JOIN users u ON u.id = f.recipient_id
         WHERE f.requester_id = $1 AND f.status = 'pending' ORDER BY f.created_at DESC`,
        [userId],
      ),
      this.getOrCreateFriendCode(userId),
    ]);
    return {
      friendCode,
      friends: friends.rows,
      incoming: incoming.rows,
      outgoing: outgoing.rows,
    };
  }

  async requestFriend(userId: string, code: string): Promise<FriendProfile> {
    const recipient = await this.pool.query<FriendProfile>(
      `SELECT u.id, u.display_name AS name, u.avatar_url AS "avatarUrl",
        u.profile_bio AS bio, u.profile_tags AS tags,
        CASE WHEN u.presence = 'invisible' THEN 'offline' ELSE u.presence END AS presence
       FROM friend_codes fc JOIN users u ON u.id = fc.user_id WHERE fc.code_digest = $1`,
      [code],
    );
    const profile = recipient.rows[0];
    if (!profile)
      throw Object.assign(new Error('No user has that friend code.'), { statusCode: 404 });
    if (profile.id === userId) {
      throw Object.assign(new Error('You cannot add your own friend code.'), { statusCode: 400 });
    }
    const accepted = await this.pool.query(
      `SELECT 1 FROM friendships WHERE status = 'accepted' AND
       ((requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1))`,
      [userId, profile.id],
    );
    if (accepted.rowCount) {
      throw Object.assign(new Error('You are already friends.'), { statusCode: 409 });
    }
    await this.pool.query(
      `INSERT INTO friendships (requester_id, recipient_id, status) VALUES ($1, $2, 'pending')
       ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = 'pending', updated_at = now()`,
      [userId, profile.id],
    );
    return profile;
  }

  async respondToFriendRequest(
    userId: string,
    requesterId: string,
    action: 'accept' | 'decline',
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE friendships SET status = $3, updated_at = now()
         WHERE requester_id = $1 AND recipient_id = $2 AND status = 'pending' RETURNING requester_id`,
        [requesterId, userId, action === 'accept' ? 'accepted' : 'declined'],
      );
      if (!updated.rowCount) {
        throw Object.assign(new Error('Friend request was not found.'), { statusCode: 404 });
      }
      if (action === 'accept') {
        await client.query(
          `DELETE FROM friendships
           WHERE requester_id = $1 AND recipient_id = $2 AND status = 'pending'`,
          [userId, requesterId],
        );
        const profiles = await client.query<FriendProfile>(
          `SELECT id, display_name AS name, avatar_url AS "avatarUrl",
            profile_bio AS bio, profile_tags AS tags,
            CASE WHEN presence = 'invisible' THEN 'offline' ELSE presence END AS presence
            FROM users WHERE id = ANY($1::uuid[])`,
          [[userId, requesterId]],
        );
        const recipient = profiles.rows.find(({ id }) => id === userId)!;
        const requester = profiles.rows.find(({ id }) => id === requesterId)!;
        const conversationId = `dm-${[userId, requesterId].sort().join('-')}`;
        const conversationFor = (friend: FriendProfile) => ({
          id: conversationId,
          title: friend.name,
          kind: 'direct',
          avatarLabel: friend.name.slice(0, 2).toUpperCase(),
          avatarUrl: friend.avatarUrl,
          presence: 'Friend',
          preview: 'Start a private conversation.',
          updatedAt: 'Now',
          unreadCount: 0,
          encrypted: true,
          members: 2,
        });
        await client.query(
          `INSERT INTO synced_conversations (id, conversation) VALUES ($1, $2::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [conversationId, JSON.stringify(conversationFor(requester))],
        );
        for (const [memberId, conversation] of [
          [userId, conversationFor(requester)],
          [requesterId, conversationFor(recipient)],
        ] as const) {
          await client.query(
            `INSERT INTO synced_conversation_members (conversation_id, user_id, conversation)
             VALUES ($1, $2, $3::jsonb)
             ON CONFLICT (conversation_id, user_id) DO UPDATE SET conversation = EXCLUDED.conversation`,
            [conversationId, memberId, JSON.stringify(conversation)],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getWorkspace(userId: string): Promise<SyncedWorkspace | null> {
    const [result, shared] = await Promise.all([
      this.pool.query<{ dms: unknown[]; groups: Record<string, unknown>[] }>(
        'SELECT groups, dms FROM user_workspace_state WHERE user_id = $1',
        [userId],
      ),
      this.pool.query<{ group_data: Record<string, unknown> }>(
        `SELECT sg.group_data FROM synced_groups sg
         JOIN synced_group_members sgm ON sgm.group_id = sg.id
         WHERE sgm.user_id = $1 ORDER BY sg.updated_at`,
        [userId],
      ),
    ]);
    const local = result.rows[0];
    if (!local && shared.rows.length === 0) return null;
    const groups = new Map<string, Record<string, unknown>>();
    for (const group of local?.groups ?? []) groups.set(String(group.id), group);
    for (const { group_data: group } of shared.rows) groups.set(String(group.id), group);
    return { dms: local?.dms ?? [], groups: [...groups.values()] };
  }

  async saveWorkspace(userId: string, workspace: SyncedWorkspace): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_workspace_state (user_id, groups, dms)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         groups = EXCLUDED.groups, dms = EXCLUDED.dms, updated_at = now()`,
      [userId, JSON.stringify(workspace.groups), JSON.stringify(workspace.dms)],
    );
    for (const value of workspace.groups) {
      const group = value as { id?: unknown };
      if (typeof group.id !== 'string' || !group.id) continue;
      await this.pool.query(
        `INSERT INTO synced_groups (id, owner_id, group_data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET group_data = EXCLUDED.group_data, updated_at = now()`,
        [group.id, userId, JSON.stringify(value)],
      );
      await this.pool.query(
        `INSERT INTO synced_group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')
         ON CONFLICT DO NOTHING`,
        [group.id, userId],
      );
    }
  }

  async inviteFriendToGroup(
    userId: string,
    friendId: string,
    group: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (typeof group.id !== 'string' || !group.id || typeof group.name !== 'string') {
      throw Object.assign(new Error('Group details are invalid.'), { statusCode: 400 });
    }
    const friendship = await this.pool.query(
      `SELECT 1 FROM friendships WHERE status = 'accepted' AND
       ((requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1))`,
      [userId, friendId],
    );
    if (!friendship.rowCount) {
      throw Object.assign(new Error('Only accepted friends can be invited.'), { statusCode: 403 });
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO synced_groups (id, owner_id, group_data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET group_data = EXCLUDED.group_data, updated_at = now()`,
        [group.id, userId, JSON.stringify(group)],
      );
      await client.query(
        `INSERT INTO synced_group_members (group_id, user_id, role)
         VALUES ($1, $2, 'owner'), ($1, $3, 'member') ON CONFLICT DO NOTHING`,
        [group.id, userId, friendId],
      );
      const profiles = await client.query<FriendProfile>(
        `SELECT u.id, u.display_name AS name, u.avatar_url AS "avatarUrl",
          u.profile_bio AS bio, u.profile_tags AS tags,
          CASE WHEN u.presence = 'invisible' THEN 'offline' ELSE u.presence END AS presence
         FROM synced_group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1 ORDER BY u.display_name`,
        [group.id],
      );
      const nextGroup = {
        ...group,
        members: profiles.rows.map((profile) => ({
          avatar: profile.avatarUrl ?? '',
          id: profile.id,
          name: profile.name,
          note: 'Member',
          status: profile.presence,
        })),
      };
      await client.query(
        'UPDATE synced_groups SET group_data = $2::jsonb, updated_at = now() WHERE id = $1',
        [group.id, JSON.stringify(nextGroup)],
      );
      const channels = Array.isArray(group.channels) ? group.channels : [];
      for (const value of channels) {
        const channel = value as {
          conversationId?: unknown;
          kind?: unknown;
          name?: unknown;
          participantIds?: unknown[];
        };
        if (typeof channel.conversationId !== 'string' || typeof channel.name !== 'string')
          continue;
        const isVoice = channel.kind === 'voice';
        const conversation = {
          id: channel.conversationId,
          title: channel.name,
          kind: 'channel',
          avatarLabel: isVoice ? 'VC' : '#',
          presence: isVoice ? 'Voice room' : `${group.name} text channel`,
          preview: isVoice ? 'Meeting chat and voice room.' : 'Start the conversation.',
          updatedAt: 'Now',
          unreadCount: 0,
          encrypted: true,
          members: profiles.rows.length,
          categoryId: group.id,
          categoryName: group.name,
          channelKind: isVoice ? 'voice' : 'text',
          voiceRoomId: isVoice ? channel.conversationId : undefined,
        };
        await client.query(
          `INSERT INTO synced_conversations (id, conversation) VALUES ($1, $2::jsonb)
           ON CONFLICT (id) DO UPDATE SET conversation = EXCLUDED.conversation, updated_at = now()`,
          [channel.conversationId, JSON.stringify(conversation)],
        );
        for (const member of profiles.rows) {
          await client.query(
            `INSERT INTO synced_conversation_members (conversation_id, user_id, conversation)
             VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING`,
            [channel.conversationId, member.id, JSON.stringify(conversation)],
          );
        }
      }
      await client.query('COMMIT');
      return nextGroup;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertConversation(userId: string, conversation: { id: string }): Promise<unknown> {
    await this.pool.query(
      `INSERT INTO synced_conversations (id, conversation) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET conversation = EXCLUDED.conversation, updated_at = now()`,
      [conversation.id, JSON.stringify(conversation)],
    );
    await this.pool.query(
      `INSERT INTO synced_conversation_members (conversation_id, user_id, conversation)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET conversation = EXCLUDED.conversation`,
      [conversation.id, userId, JSON.stringify(conversation)],
    );
    return conversation;
  }

  async listConversations(userId: string): Promise<unknown[]> {
    const result = await this.pool.query<{ conversation: unknown }>(
      `SELECT COALESCE(m.conversation, c.conversation) AS conversation FROM synced_conversations c
       JOIN synced_conversation_members m ON m.conversation_id = c.id
       WHERE m.user_id = $1 ORDER BY c.updated_at DESC`,
      [userId],
    );
    return result.rows.map(({ conversation }) => conversation);
  }

  async listMessages(userId: string, conversationId: string): Promise<unknown[]> {
    const result = await this.pool.query<{
      avatar_url: string | null;
      message: Record<string, unknown>;
    }>(
      `SELECT sm.message, sender.avatar_url FROM synced_messages sm
       JOIN synced_conversation_members m ON m.conversation_id = sm.conversation_id
       JOIN users sender ON sender.id = sm.sender_id
       WHERE sm.conversation_id = $1 AND m.user_id = $2
       ORDER BY sm.created_at`,
      [conversationId, userId],
    );
    return result.rows.map(({ avatar_url, message }) => ({
      ...message,
      senderAvatar: avatar_url ?? undefined,
    }));
  }

  async saveMessage(
    userId: string,
    conversationId: string,
    message: { id: string },
  ): Promise<unknown> {
    const membership = await this.pool.query(
      `SELECT 1 FROM synced_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId],
    );
    if (membership.rowCount === 0) throw new Error('Conversation access denied.');
    await this.pool.query(
      `INSERT INTO synced_messages (id, conversation_id, sender_id, message)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, updated_at = now()`,
      [message.id, conversationId, userId, JSON.stringify(message)],
    );
    return message;
  }

  async updateMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    operation: 'delete' | 'edit' | 'react',
    value?: string,
  ): Promise<void> {
    const result = await this.pool.query<{ message: Record<string, unknown>; sender_id: string }>(
      `SELECT sm.message, sm.sender_id FROM synced_messages sm
       JOIN synced_conversation_members scm ON scm.conversation_id = sm.conversation_id
       WHERE sm.id = $1 AND sm.conversation_id = $2 AND scm.user_id = $3`,
      [messageId, conversationId, userId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Message not found.');
    if ((operation === 'edit' || operation === 'delete') && row.sender_id !== userId) {
      throw new Error('Only your messages can be changed.');
    }
    if (operation === 'delete') {
      await this.pool.query('DELETE FROM synced_messages WHERE id = $1', [messageId]);
      return;
    }
    if (operation === 'react') {
      if (!value) throw new Error('Reaction is required.');

      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const lockedResult = await client.query<{
          message: Record<string, unknown>;
        }>(
          `SELECT sm.message FROM synced_messages sm
           WHERE sm.id = $1 AND sm.conversation_id = $2
           FOR UPDATE`,
          [messageId, conversationId],
        );
        const lockedRow = lockedResult.rows[0];
        if (!lockedRow) throw new Error('Message not found.');

        const current = lockedRow.message;
        const currentReactions = {
          ...((current.reactions as Record<string, number> | undefined) ?? {}),
        };
        const currentReactionUsers = {
          ...((current.reactionUsers as Record<string, Array<{ id: string; name: string }>> | undefined) ??
            {}),
        };

        const existing = await client.query(
          `SELECT 1 FROM synced_message_reactions
           WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
          [messageId, userId, value],
        );
        if ((existing.rowCount ?? 0) > 0) {
          await client.query(
            `DELETE FROM synced_message_reactions
             WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
            [messageId, userId, value],
          );
        } else {
          await client.query(
            `INSERT INTO synced_message_reactions (message_id, user_id, emoji)
             VALUES ($1, $2, $3)`,
            [messageId, userId, value],
          );
        }

        const reactionRows = await client.query<{
          display_name: string;
          emoji: string;
          user_id: string;
        }>(
          `SELECT r.emoji, r.user_id, u.display_name
           FROM synced_message_reactions r
           JOIN users u ON u.id = r.user_id
           WHERE r.message_id = $1
           ORDER BY r.created_at, u.display_name`,
          [messageId],
        );
        const nextReactionUsers: Record<string, Array<{ id: string; name: string }>> = {};
        for (const reaction of reactionRows.rows) {
          const users = nextReactionUsers[reaction.emoji] ?? [];
          users.push({
            id: reaction.user_id,
            name: reaction.display_name,
          });
          nextReactionUsers[reaction.emoji] = users;
        }

        const nextReactions = { ...currentReactions };
        const emojiKeys = new Set([
          ...Object.keys(currentReactions),
          ...Object.keys(nextReactionUsers),
        ]);
        for (const emoji of emojiKeys) {
          const knownUsers = currentReactionUsers[emoji]?.length ?? 0;
          const preservedCount = Math.max(0, (currentReactions[emoji] ?? 0) - knownUsers);
          const count = preservedCount + (nextReactionUsers[emoji]?.length ?? 0);
          if (count > 0) nextReactions[emoji] = count;
          else delete nextReactions[emoji];
        }

        const next: Record<string, unknown> = { ...current, reactions: nextReactions };
        if (Object.keys(nextReactionUsers).length > 0) {
          next.reactionUsers = nextReactionUsers;
        } else {
          delete next.reactionUsers;
        }
        await client.query(
          'UPDATE synced_messages SET message = $2::jsonb, updated_at = now() WHERE id = $1',
          [messageId, JSON.stringify(next)],
        );
        await client.query('COMMIT');
        return;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    const next = { ...row.message };
    if (operation === 'edit') {
      next.body = value ?? '';
      next.edited = true;
    }
    await this.pool.query(
      'UPDATE synced_messages SET message = $2::jsonb, updated_at = now() WHERE id = $1',
      [messageId, JSON.stringify(next)],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
