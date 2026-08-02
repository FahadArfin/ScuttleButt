import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

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
      CREATE TABLE IF NOT EXISTS synced_conversations (
        id text PRIMARY KEY,
        conversation jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS synced_conversation_members (
        conversation_id text NOT NULL REFERENCES synced_conversations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (conversation_id, user_id)
      );
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
        joined_server_ids AS "joinedServerIds", onboarding_completed AS "onboardingCompleted"
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
        joined_server_ids AS "joinedServerIds", onboarding_completed AS "onboardingCompleted"
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

  async getUserId(googleSubject: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      'SELECT id FROM users WHERE google_subject = $1',
      [googleSubject],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Authenticated user was not found.');
    return id;
  }

  async getWorkspace(userId: string): Promise<SyncedWorkspace | null> {
    const result = await this.pool.query<{ dms: unknown[]; groups: unknown[] }>(
      'SELECT groups, dms FROM user_workspace_state WHERE user_id = $1',
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async saveWorkspace(userId: string, workspace: SyncedWorkspace): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_workspace_state (user_id, groups, dms)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         groups = EXCLUDED.groups, dms = EXCLUDED.dms, updated_at = now()`,
      [userId, JSON.stringify(workspace.groups), JSON.stringify(workspace.dms)],
    );
  }

  async upsertConversation(userId: string, conversation: { id: string }): Promise<unknown> {
    await this.pool.query(
      `INSERT INTO synced_conversations (id, conversation) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET conversation = EXCLUDED.conversation, updated_at = now()`,
      [conversation.id, JSON.stringify(conversation)],
    );
    await this.pool.query(
      `INSERT INTO synced_conversation_members (conversation_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [conversation.id, userId],
    );
    return conversation;
  }

  async listConversations(userId: string): Promise<unknown[]> {
    const result = await this.pool.query<{ conversation: unknown }>(
      `SELECT c.conversation FROM synced_conversations c
       JOIN synced_conversation_members m ON m.conversation_id = c.id
       WHERE m.user_id = $1 ORDER BY c.updated_at DESC`,
      [userId],
    );
    return result.rows.map(({ conversation }) => conversation);
  }

  async listMessages(userId: string, conversationId: string): Promise<unknown[]> {
    const result = await this.pool.query<{ avatar_url: string | null; message: Record<string, unknown> }>(
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
    const next = { ...row.message };
    if (operation === 'edit') {
      next.body = value ?? '';
      next.edited = true;
    } else {
      const reactions = { ...((next.reactions as Record<string, number> | undefined) ?? {}) };
      if (value) reactions[value] = (reactions[value] ?? 0) + 1;
      next.reactions = reactions;
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
