import { APP_NAME } from '@scuttlebutt/shared-types';
import { E2E_SELECTORS } from '@scuttlebutt/testing';
import { StatusCard } from '@scuttlebutt/ui';

export function App() {
  return (
    <main className="app-shell" data-testid={E2E_SELECTORS.appShell}>
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">Phase 1 foundation</p>
        <h1 id="app-title">{APP_NAME}</h1>
        <p className="hero-copy">
          A self-hosted communication platform built around open protocols and operator-controlled
          infrastructure.
        </p>
      </section>

      <StatusCard
        title="Workspace ready"
        status="Foundation online"
        detail="The web shell is running. Messaging, federation, and realtime media arrive in later phases."
      />
    </main>
  );
}
