import type { WorkspaceGroup } from './workspace.js';

async function groupRequest<T>(
  path: string,
  credential: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, ...body }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? 'The group could not be updated.');
  }
  return response.json() as Promise<T>;
}

export async function inviteFriendToGroup(
  credential: string,
  friendId: string,
  group: WorkspaceGroup,
): Promise<WorkspaceGroup> {
  const result = await groupRequest<{ group: WorkspaceGroup }>('/api/groups/invite', credential, {
    friendId,
    group,
  });
  return result.group;
}
