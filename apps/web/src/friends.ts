export interface FriendProfile {
  avatarUrl: string | null;
  bio: string;
  id: string;
  name: string;
  tags: string[];
}

export interface FriendState {
  friendCode: string;
  friends: FriendProfile[];
  incoming: FriendProfile[];
  outgoing: FriendProfile[];
}

async function friendRequest<T>(
  path: string,
  credential: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, ...body }),
  });
  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Friend request could not be completed.');
  return payload;
}

export function loadFriendState(credential: string): Promise<FriendState> {
  return friendRequest('/api/friends/list', credential);
}

export function sendFriendRequest(
  credential: string,
  code: string,
): Promise<{ recipient: FriendProfile }> {
  return friendRequest('/api/friends/request', credential, { code });
}

export function respondToFriendRequest(
  credential: string,
  requesterId: string,
  action: 'accept' | 'decline',
): Promise<{ saved: boolean }> {
  return friendRequest('/api/friends/respond', credential, { action, requesterId });
}
