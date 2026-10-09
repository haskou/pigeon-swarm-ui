import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { MlsRecordInput } from './MlsRecordInput';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';

/**
 * base64url(sha256(canonicalize({epoch, groupId, kind, payload,
 * recipientIdentityId}))). The node re-derives it, so a record cannot claim
 * an id for content it did not carry.
 */
export function deriveMlsRecordId(input: MlsRecordInput): string {
  return Buffer.from(
    SHA256Hash.from(
      canonicalJson({
        ...(input.epoch !== undefined && { epoch: input.epoch }),
        groupId: input.groupId,
        kind: input.kind,
        payload: input.payload,
        ...(input.recipientIdentityId && {
          recipientIdentityId: input.recipientIdentityId,
        }),
      }),
    ).toString(),
    'hex',
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
