import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

/** First 24 hex chars of sha256 over the request identity tuple. */
export function deriveMembershipRequestId(
  communityId: string,
  type: 'invitation' | 'request',
  creatorIdentityId: string,
  identityId: string,
  createdAt: number,
): string {
  return SHA256Hash.from(
    JSON.stringify([
      communityId,
      type,
      creatorIdentityId,
      identityId,
      createdAt,
    ]),
  )
    .toString()
    .slice(0, 24);
}

/** base64url(sha256(JSON([communityId, creatorIdentityId, nonce]))). */
export function deriveInviteToken(
  communityId: string,
  creatorIdentityId: string,
  nonce: string,
): string {
  return Buffer.from(
    SHA256Hash.from(
      JSON.stringify([communityId, creatorIdentityId, nonce]),
    ).toString(),
    'hex',
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** First 24 hex chars of sha256 over a moderation log entry identity tuple. */
export function deriveModerationLogId(
  communityId: string,
  actorIdentityId: string,
  action: string,
  targetType: string,
  targetId: string,
  createdAt: number,
): string {
  return SHA256Hash.from(
    JSON.stringify([
      communityId,
      actorIdentityId,
      action,
      targetType,
      targetId,
      createdAt,
    ]),
  )
    .toString()
    .slice(0, 24);
}

/** First 24 hex chars of sha256 over a channel or role creation tuple. */
export function deriveCommunityEntityId(
  kind: 'channel' | 'role',
  communityId: string,
  creatorIdentityId: string,
  createdAt: number,
): string {
  return SHA256Hash.from(
    JSON.stringify([kind, communityId, creatorIdentityId, createdAt]),
  )
    .toString()
    .slice(0, 24);
}
