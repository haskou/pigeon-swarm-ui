import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';

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

/**
 * base64url(sha256(JSON([communityId, creatorIdentityId, nonce, maxUses,
 * expiresAt ?? null]))): the bearer secret of an invite link. It commits to
 * the limits, so the node refuses a link whose stored limits were changed.
 */
export function deriveInviteToken(
  communityId: string,
  creatorIdentityId: string,
  nonce: string,
  maxUses: number,
  expiresAt: number | undefined,
): string {
  return Buffer.from(
    SHA256Hash.from(
      JSON.stringify([
        communityId,
        creatorIdentityId,
        nonce,
        maxUses,
        expiresAt ?? null,
      ]),
    ).toString(),
    'hex',
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * base64url(sha256("pigeon:community-invite-reference:v1\n" + token)): what
 * a signed invite-link join names instead of the token, which every member
 * reads and which would otherwise let any of them use the link.
 */
export function deriveInviteReference(inviteToken: string): string {
  return Buffer.from(
    SHA256Hash.from(
      `pigeon:community-invite-reference:v1\n${inviteToken}`,
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

/** base64url sha256 of the canonical owner tuple a community id commits to. */
export function deriveCommunityId(
  networkId: string,
  ownerIdentityId: string,
  nonce: string,
): string {
  return Buffer.from(
    SHA256Hash.from(
      canonicalJson({ networkId, nonce, ownerIdentityId }),
    ).toString(),
    'hex',
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
