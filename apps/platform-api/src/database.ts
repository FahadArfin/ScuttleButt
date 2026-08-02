import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

export interface AppUser {
  avatarUrl: string | null;
  email: string;
  id: string;
  name: string;
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
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
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
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now()
      RETURNING id, email, display_name AS name, avatar_url AS "avatarUrl"
    `,
      [randomUUID(), input.googleSubject, input.email, input.name, input.avatarUrl ?? null],
    );
    const user = result.rows[0];
    if (!user) throw new Error('Google user could not be stored.');
    return user;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
