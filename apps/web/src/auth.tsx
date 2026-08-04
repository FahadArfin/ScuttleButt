import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ChatCenteredDots, LockSimple } from '@phosphor-icons/react';

import { OnboardingPage } from './onboarding.js';
import { normalizePresenceStatus, type PresenceStatus } from './presence.js';

export interface SignedInUser {
  avatarUrl: string | null;
  backgroundColor: string;
  bio: string;
  email: string;
  friendCode: string | null;
  id: string;
  interests: string[];
  joinedServerIds: string[];
  name: string;
  onboardingCompleted: boolean;
  presence: PresenceStatus;
  tags: string[];
}
interface GoogleCredentialResponse {
  credential: string;
}

const AUTH_SESSION_STORAGE_KEY = 'scuttlebutt:auth-session';
const LEGACY_USER_STORAGE_KEY = 'scuttlebutt:user';
const LEGACY_CREDENTIAL_STORAGE_KEY = 'scuttlebutt:google-credential';
const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GOOGLE_CREDENTIAL_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

export interface AuthSession {
  credential: string | null;
  credentialRefreshedAt: number;
  expiresAt: number;
  user: SignedInUser;
}

function normalizeUser(
  user: Partial<SignedInUser> & Pick<SignedInUser, 'email' | 'id' | 'name'>,
): SignedInUser {
  return {
    avatarUrl: user.avatarUrl ?? null,
    backgroundColor: user.backgroundColor ?? '#5865f2',
    bio: user.bio ?? '',
    email: user.email,
    friendCode: user.friendCode ?? null,
    id: user.id,
    interests: user.interests ?? [],
    joinedServerIds: user.joinedServerIds ?? [],
    name: user.name,
    onboardingCompleted: user.onboardingCompleted ?? false,
    presence: normalizePresenceStatus(user.presence),
    tags: user.tags ?? [],
  };
}

function parseStoredUser(value: unknown): SignedInUser | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SignedInUser>;
  if (
    typeof candidate.email !== 'string' ||
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string'
  ) {
    return null;
  }
  return normalizeUser(
    candidate as Partial<SignedInUser> & Pick<SignedInUser, 'email' | 'id' | 'name'>,
  );
}

function readAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<AuthSession>;
    const user = parseStoredUser(stored.user);
    if (!user || typeof stored.expiresAt !== 'number' || stored.expiresAt <= Date.now()) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return {
      credential: typeof stored.credential === 'string' ? stored.credential : null,
      credentialRefreshedAt:
        typeof stored.credentialRefreshedAt === 'number'
          ? stored.credentialRefreshedAt
          : Date.now(),
      expiresAt: stored.expiresAt,
      user,
    };
  } catch {
    return null;
  }
}

export function persistAuthSession(user: SignedInUser, credential: string | null): void {
  const session: AuthSession = {
    credential,
    credentialRefreshedAt: Date.now(),
    expiresAt: Date.now() + AUTH_SESSION_TTL_MS,
    user,
  };
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function loadAuthSession(): AuthSession | null {
  const stored = readAuthSession();
  if (stored) return stored;

  try {
    const legacyUser = window.sessionStorage.getItem(LEGACY_USER_STORAGE_KEY);
    if (!legacyUser) return null;
    const user = parseStoredUser(JSON.parse(legacyUser));
    if (!user) return null;
    const credential = window.sessionStorage.getItem(LEGACY_CREDENTIAL_STORAGE_KEY);
    persistAuthSession(user, credential);
    window.sessionStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_CREDENTIAL_STORAGE_KEY);
    return readAuthSession();
  } catch {
    return null;
  }
}

export function getStoredGoogleCredential(): string | null {
  const session = loadAuthSession();
  return session?.credential || null;
}

export function updateStoredAuthUser(user: SignedInUser): void {
  const session = loadAuthSession();
  if (!session) return;
  window.localStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({ ...session, user }),
  );
}

export function clearAuthSession(): void {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_USER_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_CREDENTIAL_STORAGE_KEY);
}

function shouldRefreshGoogleCredential(): boolean {
  const session = loadAuthSession();
  return Boolean(
    session?.credential &&
      Date.now() - session.credentialRefreshedAt >= GOOGLE_CREDENTIAL_REFRESH_INTERVAL_MS,
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            auto_select?: boolean;
            callback: (response: GoogleCredentialResponse) => void;
            client_id: string;
          }) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

export function AuthGate({ children }: { children: (user: SignedInUser) => ReactNode }) {
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [user, setUser] = useState<SignedInUser | null>(() => loadAuthSession()?.user ?? null);
  const [error, setError] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);
  const currentUserRef = useRef(user);
  const googleMountedRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  currentUserRef.current = user;

  useEffect(() => {
    void fetch('/api/config')
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{ googleClientId: string | null }>)
          : { googleClientId: null },
      )
      .then((config) => setClientId(config.googleClientId))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || googleMountedRef.current === clientId) return;
    const mountGoogle = () => {
      if (!window.google || googleMountedRef.current === clientId) return;
      googleMountedRef.current = clientId;
      window.google.accounts.id.initialize({
        auto_select: Boolean(currentUserRef.current && shouldRefreshGoogleCredential()),
        client_id: clientId,
        callback: (response) => {
          setError('');
          void fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
          })
            .then(async (result) => {
              if (!result.ok) throw new Error('Google sign-in could not be completed.');
              const payload = (await result.json()) as { user: SignedInUser };
              const nextUser = normalizeUser(payload.user);
              persistAuthSession(nextUser, response.credential);
              setUser(nextUser);
            })
            .catch((reason: unknown) =>
              setError(reason instanceof Error ? reason.message : 'Sign-in failed.'),
          );
        },
      });
      if (currentUserRef.current) {
        if (shouldRefreshGoogleCredential()) window.google.accounts.id.prompt();
        refreshTimerRef.current = window.setInterval(() => {
          if (currentUserRef.current && shouldRefreshGoogleCredential()) {
            window.google?.accounts.id.prompt();
          }
        }, GOOGLE_CREDENTIAL_REFRESH_INTERVAL_MS);
      } else if (buttonRef.current) {
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          shape: 'pill',
          size: 'large',
          text: 'continue_with',
          theme: 'filled_black',
        });
      }
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-scuttlebutt-google]');
    if (existing) {
      if (window.google) mountGoogle();
      else existing.addEventListener('load', mountGoogle, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.scuttlebuttGoogle = 'true';
    script.addEventListener('load', mountGoogle, { once: true });
    document.head.append(script);
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [clientId]);

  if (user) {
    return user.onboardingCompleted ? (
      children(user)
    ) : (
      <OnboardingPage user={user} onComplete={setUser} />
    );
  }
  if (clientId === null) {
    return children({
      avatarUrl: null,
      backgroundColor: '#5865f2',
      bio: '',
      email: 'local@scuttlebutt.test',
      friendCode: null,
      id: 'local-user',
      interests: [],
      joinedServerIds: [],
      name: 'Local user',
      onboardingCompleted: true,
      presence: 'online',
      tags: [],
    });
  }
  if (clientId === undefined) return <div className="auth-loading">Loading Scuttlebutt…</div>;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="auth-mark">
          <ChatCenteredDots size={32} weight="duotone" />
        </span>
        <p className="section-kicker">Scuttlebutt</p>
        <h1>Talk with your people.</h1>
        <p>Sign in to reach your friends, groups, messages, and voice rooms from any device.</p>
        <div ref={buttonRef} className="google-sign-in-slot" />
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <small>
          <LockSimple size={14} /> Google verifies your identity. Scuttlebutt never receives your
          password.
        </small>
      </section>
    </main>
  );
}
