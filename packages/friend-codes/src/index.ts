import { createHmac, randomBytes, randomUUID } from 'node:crypto';

export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const;
export const FRIEND_CODE_LENGTH = 16 as const;
export const FRIEND_CODE_GROUP_LENGTH = 4 as const;
export const DEFAULT_LOOKUP_LIMIT = 5 as const;
export const DEFAULT_LOOKUP_WINDOW_MS = 60_000 as const;

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendCodeOwner {
  principalId: string;
  matrixUserId: string;
}

export interface FriendCodeIssue {
  displayCode: string;
  issuedAt: number;
}

export interface FriendInvite {
  displayCode: string;
  url: string;
}

export interface ContactRequestSubmission {
  acceptedForProcessing: true;
  rateLimited: boolean;
  requestId: string;
  retryAfterMs?: number;
}

export interface ContactRequestSummary {
  createdAt: number;
  requestId: string;
  status: ContactRequestStatus;
}

export interface ContactSummary {
  contactId: string;
  createdAt: number;
  peerMatrixUserId: string;
  peerPrincipalId: string;
}

export interface FriendCodeServiceOptions {
  lookupLimit?: number;
  lookupWindowMs?: number;
  now?: () => number;
  secret: string | Uint8Array;
}

interface StoredFriendCode {
  digest: string;
  issuedAt: number;
  matrixUserId: string;
  ownerPrincipalId: string;
  revokedAt: number | null;
}

interface StoredContactRequest {
  createdAt: number;
  recipientPrincipalId: string;
  requestId: string;
  requesterPrincipalId: string;
  status: ContactRequestStatus;
}

interface StoredContact {
  createdAt: number;
  leftMatrixUserId: string;
  leftPrincipalId: string;
  rightMatrixUserId: string;
  rightPrincipalId: string;
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function randomFriendCode(): string {
  let code = '';
  const alphabetLength = FRIEND_CODE_ALPHABET.length;
  const largestUnbiasedByte = 256 - (256 % alphabetLength);

  while (code.length < FRIEND_CODE_LENGTH) {
    for (const byte of randomBytes(FRIEND_CODE_LENGTH)) {
      if (byte >= largestUnbiasedByte) {
        continue;
      }

      code += FRIEND_CODE_ALPHABET[byte % alphabetLength];

      if (code.length === FRIEND_CODE_LENGTH) {
        break;
      }
    }
  }

  return code;
}

export function normalizeFriendCode(value: string): string {
  const normalized = value.normalize('NFKC').replace(/[\s-]/g, '').toUpperCase();
  const alphabet = new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`);

  if (!alphabet.test(normalized)) {
    throw new Error('Friend code must contain exactly 16 valid characters.');
  }

  return normalized;
}

export function formatFriendCode(normalizedCode: string): string {
  const normalized = normalizeFriendCode(normalizedCode);
  const groups: string[] = [];

  for (let index = 0; index < normalized.length; index += FRIEND_CODE_GROUP_LENGTH) {
    groups.push(normalized.slice(index, index + FRIEND_CODE_GROUP_LENGTH));
  }

  return groups.join('-');
}

export function createFriendInviteUrl(applicationOrigin: string, displayCode: string): string {
  const url = new URL('/invite/friend', applicationOrigin);
  url.searchParams.set('code', formatFriendCode(displayCode));
  return url.toString();
}

export function createFriendInvite(applicationOrigin: string, displayCode: string): FriendInvite {
  return {
    displayCode: formatFriendCode(displayCode),
    url: createFriendInviteUrl(applicationOrigin, displayCode),
  };
}

export function parseFriendInviteUrl(inviteUrl: string): string {
  try {
    const url = new URL(inviteUrl);
    const code = url.searchParams.get('code');

    if (url.pathname !== '/invite/friend' || !code) {
      throw new Error('Invalid friend invite link.');
    }

    return formatFriendCode(code);
  } catch {
    throw new Error('Invalid friend invite link.');
  }
}

export function digestFriendCode(secret: string | Uint8Array, normalizedCode: string): string {
  const normalized = normalizeFriendCode(normalizedCode);
  const key = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : secret;

  if (key.byteLength < 32) {
    throw new Error('Friend-code secret must contain at least 32 bytes.');
  }

  return createHmac('sha256', key).update(normalized, 'utf8').digest('base64url');
}

function contactPairKey(leftPrincipalId: string, rightPrincipalId: string): string {
  return [leftPrincipalId, rightPrincipalId].sort().join('\u0000');
}

export class InMemoryFriendCodeStore {
  private readonly codes = new Map<string, StoredFriendCode>();
  private readonly contacts = new Map<string, StoredContact>();
  private readonly identities = new Map<string, FriendCodeOwner>();
  private readonly requests = new Map<string, StoredContactRequest>();
  private readonly blockedPairs = new Set<string>();

  saveIdentity(owner: FriendCodeOwner): void {
    this.identities.set(owner.principalId, { ...owner });
  }

  getIdentity(principalId: string): FriendCodeOwner | undefined {
    const identity = this.identities.get(principalId);
    return identity ? { ...identity } : undefined;
  }

  revokeCodesForOwner(principalId: string, revokedAt: number): void {
    for (const code of this.codes.values()) {
      if (code.ownerPrincipalId === principalId && code.revokedAt === null) {
        code.revokedAt = revokedAt;
      }
    }
  }

  saveCode(code: StoredFriendCode): void {
    this.codes.set(code.digest, { ...code });
  }

  getActiveCode(digest: string): StoredFriendCode | undefined {
    const code = this.codes.get(digest);
    return code && code.revokedAt === null ? { ...code } : undefined;
  }

  getCodeForOwner(principalId: string): StoredFriendCode | undefined {
    return [...this.codes.values()].find(
      (code) => code.ownerPrincipalId === principalId && code.revokedAt === null,
    );
  }

  saveRequest(request: StoredContactRequest): void {
    this.requests.set(request.requestId, { ...request });
  }

  getRequest(requestId: string): StoredContactRequest | undefined {
    const request = this.requests.get(requestId);
    return request ? { ...request } : undefined;
  }

  findPendingRequest(
    requesterPrincipalId: string,
    recipientPrincipalId: string,
  ): StoredContactRequest | undefined {
    return [...this.requests.values()].find(
      (request) =>
        request.requesterPrincipalId === requesterPrincipalId &&
        request.recipientPrincipalId === recipientPrincipalId &&
        request.status === 'pending',
    );
  }

  hasContact(leftPrincipalId: string, rightPrincipalId: string): boolean {
    return this.contacts.has(contactPairKey(leftPrincipalId, rightPrincipalId));
  }

  listRequestsForRecipient(recipientPrincipalId: string): StoredContactRequest[] {
    return [...this.requests.values()]
      .filter(
        (request) =>
          request.recipientPrincipalId === recipientPrincipalId && request.status === 'pending',
      )
      .map((request) => ({ ...request }));
  }

  updateRequest(request: StoredContactRequest): void {
    this.requests.set(request.requestId, { ...request });
  }

  declinePendingRequestsBetween(leftPrincipalId: string, rightPrincipalId: string): void {
    for (const request of this.requests.values()) {
      if (
        request.status === 'pending' &&
        ((request.requesterPrincipalId === leftPrincipalId &&
          request.recipientPrincipalId === rightPrincipalId) ||
          (request.requesterPrincipalId === rightPrincipalId &&
            request.recipientPrincipalId === leftPrincipalId))
      ) {
        request.status = 'declined';
      }
    }
  }

  setBlocked(leftPrincipalId: string, rightPrincipalId: string, blocked: boolean): void {
    const key = contactPairKey(leftPrincipalId, rightPrincipalId);

    if (blocked) {
      this.blockedPairs.add(key);
    } else {
      this.blockedPairs.delete(key);
    }
  }

  isBlocked(leftPrincipalId: string, rightPrincipalId: string): boolean {
    return this.blockedPairs.has(contactPairKey(leftPrincipalId, rightPrincipalId));
  }

  saveContact(contact: StoredContact): void {
    this.contacts.set(contactPairKey(contact.leftPrincipalId, contact.rightPrincipalId), {
      ...contact,
    });
  }

  listContacts(principalId: string): StoredContact[] {
    return [...this.contacts.values()]
      .filter(
        (contact) =>
          contact.leftPrincipalId === principalId || contact.rightPrincipalId === principalId,
      )
      .map((contact) => ({ ...contact }));
  }
}

export class FriendCodeService {
  private readonly lookupAttempts = new Map<string, number[]>();
  private readonly lookupLimit: number;
  private readonly lookupWindowMs: number;
  private readonly now: () => number;

  constructor(
    private readonly store: InMemoryFriendCodeStore,
    private readonly options: FriendCodeServiceOptions,
  ) {
    this.lookupLimit = options.lookupLimit ?? DEFAULT_LOOKUP_LIMIT;
    this.lookupWindowMs = options.lookupWindowMs ?? DEFAULT_LOOKUP_WINDOW_MS;
    this.now = options.now ?? Date.now;

    if (!Number.isInteger(this.lookupLimit) || this.lookupLimit < 1) {
      throw new Error('lookupLimit must be a positive integer.');
    }

    if (!Number.isInteger(this.lookupWindowMs) || this.lookupWindowMs < 1) {
      throw new Error('lookupWindowMs must be a positive integer.');
    }
  }

  issueCode(owner: FriendCodeOwner): FriendCodeIssue {
    assertNonEmpty(owner.principalId, 'principalId');
    assertNonEmpty(owner.matrixUserId, 'matrixUserId');

    const issuedAt = this.now();
    this.store.saveIdentity(owner);
    this.store.revokeCodesForOwner(owner.principalId, issuedAt);

    const normalizedCode = randomFriendCode();
    this.store.saveCode({
      digest: digestFriendCode(this.options.secret, normalizedCode),
      issuedAt,
      matrixUserId: owner.matrixUserId,
      ownerPrincipalId: owner.principalId,
      revokedAt: null,
    });

    return {
      displayCode: formatFriendCode(normalizedCode),
      issuedAt,
    };
  }

  revokeCode(principalId: string): boolean {
    const activeCode = this.store.getCodeForOwner(principalId);

    if (!activeCode) {
      return false;
    }

    this.store.revokeCodesForOwner(principalId, this.now());
    return true;
  }

  requestContactByCode(
    requesterPrincipalId: string,
    displayCode: string,
    rateLimitKey = requesterPrincipalId,
  ): ContactRequestSubmission {
    assertNonEmpty(requesterPrincipalId, 'requesterPrincipalId');
    const requestId = randomUUID();
    const rateLimit = this.consumeLookup(rateLimitKey);

    if (!rateLimit.allowed) {
      return {
        acceptedForProcessing: true,
        rateLimited: true,
        requestId,
        retryAfterMs: rateLimit.retryAfterMs,
      };
    }

    let activeCode: StoredFriendCode | undefined;

    try {
      activeCode = this.store.getActiveCode(
        digestFriendCode(this.options.secret, normalizeFriendCode(displayCode)),
      );
    } catch {
      activeCode = undefined;
    }

    if (
      !activeCode ||
      activeCode.ownerPrincipalId === requesterPrincipalId ||
      this.store.isBlocked(requesterPrincipalId, activeCode.ownerPrincipalId) ||
      this.store.findPendingRequest(requesterPrincipalId, activeCode.ownerPrincipalId) ||
      this.store.hasContact(requesterPrincipalId, activeCode.ownerPrincipalId)
    ) {
      return { acceptedForProcessing: true, rateLimited: false, requestId };
    }

    this.store.saveRequest({
      createdAt: this.now(),
      recipientPrincipalId: activeCode.ownerPrincipalId,
      requestId,
      requesterPrincipalId,
      status: 'pending',
    });

    return { acceptedForProcessing: true, rateLimited: false, requestId };
  }

  listPendingRequests(recipientPrincipalId: string): ContactRequestSummary[] {
    return this.store.listRequestsForRecipient(recipientPrincipalId).map((request) => ({
      createdAt: request.createdAt,
      requestId: request.requestId,
      status: request.status,
    }));
  }

  acceptContact(recipientPrincipalId: string, requestId: string): ContactSummary {
    const request = this.requirePendingRequest(recipientPrincipalId, requestId);
    const requester = this.store.getIdentity(request.requesterPrincipalId);
    const recipient = this.store.getIdentity(request.recipientPrincipalId);

    if (
      !requester ||
      !recipient ||
      this.store.isBlocked(requester.principalId, recipient.principalId)
    ) {
      throw new Error('Contact request is no longer available.');
    }

    request.status = 'accepted';
    this.store.updateRequest(request);
    this.store.saveContact({
      createdAt: this.now(),
      leftMatrixUserId: requester.matrixUserId,
      leftPrincipalId: requester.principalId,
      rightMatrixUserId: recipient.matrixUserId,
      rightPrincipalId: recipient.principalId,
    });

    return this.toContactSummary(recipient.principalId, requester);
  }

  declineContact(recipientPrincipalId: string, requestId: string): void {
    const request = this.requirePendingRequest(recipientPrincipalId, requestId);
    request.status = 'declined';
    this.store.updateRequest(request);
  }

  listContacts(principalId: string): ContactSummary[] {
    if (!this.store.getIdentity(principalId)) {
      return [];
    }

    return this.store
      .listContacts(principalId)
      .filter((contact) => !this.store.isBlocked(contact.leftPrincipalId, contact.rightPrincipalId))
      .map((contact) => {
        const peer =
          contact.leftPrincipalId === principalId
            ? {
                matrixUserId: contact.rightMatrixUserId,
                principalId: contact.rightPrincipalId,
              }
            : {
                matrixUserId: contact.leftMatrixUserId,
                principalId: contact.leftPrincipalId,
              };

        return {
          contactId: contactPairKey(contact.leftPrincipalId, contact.rightPrincipalId),
          createdAt: contact.createdAt,
          peerMatrixUserId: peer.matrixUserId,
          peerPrincipalId: peer.principalId,
        };
      });
  }

  blockPrincipal(principalId: string, blockedPrincipalId: string): void {
    assertNonEmpty(principalId, 'principalId');
    assertNonEmpty(blockedPrincipalId, 'blockedPrincipalId');
    this.store.setBlocked(principalId, blockedPrincipalId, true);
    this.store.declinePendingRequestsBetween(principalId, blockedPrincipalId);
  }

  unblockPrincipal(principalId: string, blockedPrincipalId: string): void {
    this.store.setBlocked(principalId, blockedPrincipalId, false);
  }

  private consumeLookup(
    principalId: string,
  ): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = this.now();
    const attempts = (this.lookupAttempts.get(principalId) ?? []).filter(
      (timestamp) => now - timestamp < this.lookupWindowMs,
    );

    if (attempts.length >= this.lookupLimit) {
      const oldestAttempt = attempts[0] ?? now;
      this.lookupAttempts.set(principalId, attempts);
      return {
        allowed: false,
        retryAfterMs: Math.max(1, this.lookupWindowMs - (now - oldestAttempt)),
      };
    }

    attempts.push(now);
    this.lookupAttempts.set(principalId, attempts);
    return { allowed: true };
  }

  private requirePendingRequest(
    recipientPrincipalId: string,
    requestId: string,
  ): StoredContactRequest {
    const request = this.store.getRequest(requestId);

    if (
      !request ||
      request.recipientPrincipalId !== recipientPrincipalId ||
      request.status !== 'pending'
    ) {
      throw new Error('Contact request is not available.');
    }

    return request;
  }

  private toContactSummary(principalId: string, peer: FriendCodeOwner): ContactSummary {
    const contact = this.store
      .listContacts(principalId)
      .find(
        (candidate) =>
          candidate.leftPrincipalId === peer.principalId ||
          candidate.rightPrincipalId === peer.principalId,
      );

    if (!contact) {
      throw new Error('Accepted contact was not stored.');
    }

    return {
      contactId: contactPairKey(contact.leftPrincipalId, contact.rightPrincipalId),
      createdAt: contact.createdAt,
      peerMatrixUserId: peer.matrixUserId,
      peerPrincipalId: peer.principalId,
    };
  }
}
