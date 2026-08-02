import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ChatCenteredDots, LockSimple } from '@phosphor-icons/react';

import { OnboardingPage } from './onboarding.js';

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
  tags: string[];
}
interface GoogleCredentialResponse {
  credential: string;
}

function normalizeUser(user: Partial<SignedInUser> & Pick<SignedInUser, 'email' | 'id' | 'name'>): SignedInUser {
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
    tags: user.tags ?? [],
  };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            callback: (response: GoogleCredentialResponse) => void;
            client_id: string;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

export function AuthGate({ children }: { children: (user: SignedInUser) => ReactNode }) {
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [user, setUser] = useState<SignedInUser | null>(() => {
    const stored = sessionStorage.getItem('scuttlebutt:user');
    return stored ? normalizeUser(JSON.parse(stored) as SignedInUser) : null;
  });
  const [error, setError] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);

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
    if (!clientId || user) return;
    const mountGoogle = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
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
              sessionStorage.setItem('scuttlebutt:user', JSON.stringify(nextUser));
              sessionStorage.setItem('scuttlebutt:google-credential', response.credential);
              setUser(nextUser);
            })
            .catch((reason: unknown) =>
              setError(reason instanceof Error ? reason.message : 'Sign-in failed.'),
            );
        },
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        shape: 'pill',
        size: 'large',
        text: 'continue_with',
        theme: 'filled_black',
      });
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
  }, [clientId, user]);

  if (user) {
    return user.onboardingCompleted ? children(user) : <OnboardingPage user={user} onComplete={setUser} />;
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
