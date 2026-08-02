import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Camera, Check, ChatCenteredDots, UploadSimple } from '@phosphor-icons/react';

import type { SignedInUser } from './auth.js';
import { INTERESTS, RECOMMENDED_SERVERS } from './onboarding-data.js';
import { GROUP_STORAGE_KEY } from './workspace.js';

const PROFILE_STORAGE_KEY = 'scuttlebutt:profile:v2';
const MAX_AVATAR_BYTES = 2_000_000;

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function OnboardingPage({
  user,
  onComplete,
}: {
  user: SignedInUser;
  onComplete: (user: SignedInUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [backgroundColor, setBackgroundColor] = useState(user.backgroundColor || '#5865f2');
  const [bio, setBio] = useState(user.bio);
  const [tagDraft, setTagDraft] = useState('');
  const [tags, setTags] = useState<string[]>(user.tags);
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [joinedServerIds, setJoinedServerIds] = useState<string[]>(user.joinedServerIds);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const recommendations = useMemo(
    () =>
      RECOMMENDED_SERVERS.filter(
        ({ interests: serverInterests }) =>
          interests.length === 0 || serverInterests.some((interest) => interests.includes(interest)),
      ),
    [interests],
  );

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) =>
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  const addTag = () => {
    const value = tagDraft.trim().replace(/^#/, '').slice(0, 18);
    if (!value || tags.includes(value) || tags.length >= 5) return;
    setTags([...tags, value]);
    setTagDraft('');
  };

  const uploadAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_AVATAR_BYTES) {
      setError('Choose a JPG, PNG, GIF, or WebP image under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => setAvatarUrl(String(reader.result)));
    reader.readAsDataURL(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Choose a display name.');
    if (words(bio) > 10) return setError('Keep your bio to 10 words or fewer.');
    setSaving(true);
    setError('');
    const profile = {
      avatarUrl,
      backgroundColor,
      bio: bio.trim(),
      interests,
      joinedServerIds,
      name: name.trim(),
      tags,
    };
    try {
      const credential = sessionStorage.getItem('scuttlebutt:google-credential');
      let nextUser: SignedInUser = { ...user, ...profile, onboardingCompleted: true };
      if (credential) {
        const response = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ credential, profile }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          throw new Error(
            response.status === 413
              ? 'That profile picture is too large. Choose an image under 2 MB.'
              : payload.error ?? payload.message ?? 'Your profile could not be saved. Please try again.',
          );
        }
        nextUser = ((await response.json()) as { user: SignedInUser }).user;
      }
      const joinedGroups = RECOMMENDED_SERVERS.filter(({ group }) =>
        nextUser.joinedServerIds.includes(group.id),
      ).map(({ group }) => group);
      localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(joinedGroups));
      localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({
          avatar: nextUser.avatarUrl ?? '',
          bannerColor: nextUser.backgroundColor,
          bio: nextUser.bio,
          displayName: nextUser.name,
          status: 'Online',
        }),
      );
      sessionStorage.setItem('scuttlebutt:user', JSON.stringify(nextUser));
      onComplete(nextUser);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="onboarding-shell">
      <form className="onboarding-card" onSubmit={(event) => void submit(event)}>
        <header className="onboarding-header">
          <span className="auth-mark"><ChatCenteredDots size={28} weight="duotone" /></span>
          <div><p className="section-kicker">Welcome to Scuttlebutt</p><h1>Make this space yours.</h1></div>
          <span className="onboarding-step">Profile setup</span>
        </header>

        <div className="onboarding-grid">
          <section className="onboarding-section profile-setup-section">
            <h2>Your profile</h2>
            <p>This is how friends and communities will recognize you.</p>
            <div className="profile-setup-preview" style={{ backgroundColor }}>
              <button type="button" className="avatar-upload" onClick={() => fileRef.current?.click()}>
                {avatarUrl ? <img src={avatarUrl} alt="Profile preview" /> : <span>{initials(name)}</span>}
                <i><Camera size={16} /></i>
              </button>
              <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={uploadAvatar} />
              <div><strong>{name || 'Your name'}</strong><small>{tags.map((tag) => `#${tag}`).join(' ') || 'Add a few tags'}</small></div>
            </div>
            <button type="button" className="secondary-action upload-action" onClick={() => fileRef.current?.click()}><UploadSimple size={17} /> Upload profile picture</button>
            <label>Display name<input maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Bio <span>{words(bio)}/10 words</span><textarea rows={2} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Builder, gamer, and professional snack finder." /></label>
            <label>Profile background<input className="color-input" type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /></label>
            <label>Tags <span>{tags.length}/5</span><div className="tag-input-row"><input value={tagDraft} maxLength={18} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="developer" /><button type="button" onClick={addTag}>Add</button></div></label>
            <div className="selected-tags">{tags.map((tag) => <button type="button" key={tag} onClick={() => setTags(tags.filter((item) => item !== tag))}>#{tag} ×</button>)}</div>
          </section>

          <section className="onboarding-section discovery-setup-section">
            <h2>What are you into?</h2>
            <p>Pick any interests. We’ll recommend communities you may enjoy.</p>
            <div className="interest-grid">{INTERESTS.map((interest) => <button type="button" key={interest} className={interests.includes(interest) ? 'selected' : ''} onClick={() => toggle(interest, interests, setInterests)}>{interests.includes(interest) ? <Check size={15} weight="bold" /> : null}{interest}</button>)}</div>
            <div className="recommendation-heading"><div><h2>Recommended servers</h2><p>Select the communities you want to join.</p></div><span>{joinedServerIds.length} selected</span></div>
            <div className="server-recommendations">{recommendations.map(({ group, interests: serverInterests }) => { const selected = joinedServerIds.includes(group.id); return <button type="button" key={group.id} className={selected ? 'selected' : ''} onClick={() => toggle(group.id, joinedServerIds, setJoinedServerIds)}><span className="recommendation-icon">{group.name.slice(0, 2).toUpperCase()}</span><span><strong>{group.name}</strong><small>{group.description}</small><em>{serverInterests.join(' · ')}</em></span>{selected ? <Check size={20} weight="bold" /> : <span className="join-label">Join</span>}</button>; })}</div>
          </section>
        </div>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <footer className="onboarding-footer"><span>You can change all of this later in Settings.</span><button type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Enter Scuttlebutt'}</button></footer>
      </form>
    </main>
  );
}
