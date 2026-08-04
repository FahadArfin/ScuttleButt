import type { PresenceIndicatorStatus } from './presence.js';

export interface MentionReference {
  id: string;
  name: string;
}

export interface MentionCandidate extends MentionReference {
  avatar?: string | null;
  note?: string;
  status?: PresenceIndicatorStatus;
}

export interface MentionDraft {
  end: number;
  query: string;
  start: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function mentionDraftAt(value: string, cursor = value.length): MentionDraft | undefined {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/);
  if (!match) return undefined;
  const prefixLength = match[1]?.length ?? 0;
  const start = beforeCursor.length - match[0].length + prefixLength;
  return { end: cursor, query: match[2] ?? '', start };
}

export function filterMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
  limit = 8,
): MentionCandidate[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return candidates
    .filter(({ name }) => !normalizedQuery || name.toLocaleLowerCase().includes(normalizedQuery))
    .slice(0, limit);
}

export function extractMentions(body: string, candidates: MentionCandidate[]): MentionReference[] {
  return candidates
    .filter(({ name }) => {
      const pattern = new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|\\s|[.,!?;:])`, 'iu');
      return pattern.test(body);
    })
    .map(({ id, name }) => ({ id, name }));
}

export function mentionPattern(mentions: MentionReference[]): RegExp | undefined {
  const names = [...new Set(mentions.map(({ name }) => name.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (names.length === 0) return undefined;
  return new RegExp(
    `(^|\\s)(@(?:${names.map((name) => escapeRegExp(name)).join('|')}))(?=$|\\s|[.,!?;:])`,
    'giu',
  );
}
