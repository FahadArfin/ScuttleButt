import { describe, expect, it } from 'vitest';

import {
  extractMentions,
  filterMentionCandidates,
  mentionDraftAt,
  mentionPattern,
  type MentionCandidate,
} from './mentions.js';

const candidates: MentionCandidate[] = [
  { id: 'fahad', name: 'Fahad Arfin' },
  { id: 'earebear', name: 'EareBear' },
  { id: 'maya', name: 'Maya Patel' },
];

describe('chat mentions', () => {
  it('finds the @ query at the caret', () => {
    expect(mentionDraftAt('hello @Fa', 9)).toEqual({ end: 9, query: 'Fa', start: 6 });
    expect(mentionDraftAt('hello @Fa there')).toBeUndefined();
  });

  it('filters members without changing their display names', () => {
    expect(filterMentionCandidates(candidates, 'bear').map(({ id }) => id)).toEqual(['earebear']);
  });

  it('extracts selected member references for reliable notifications', () => {
    expect(extractMentions('Hey @Fahad Arfin, can you check this?', candidates)).toEqual([
      { id: 'fahad', name: 'Fahad Arfin' },
    ]);
  });

  it('builds a case-insensitive renderer pattern for stored mentions', () => {
    const pattern = mentionPattern([{ id: 'fahad', name: 'Fahad Arfin' }]);
    const match = pattern?.exec('@fahad arfin');
    expect(match?.[2]).toBe('@fahad arfin');
  });
});
