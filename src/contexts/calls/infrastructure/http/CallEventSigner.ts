import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { PublicMutationPosition } from '../../../../shared/infrastructure/crypto/PublicMutationPosition';
import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';

export type CallParticipantState = 'declined' | 'joined' | 'left';

export type CallStartScope =
  | { conversationId: string; type: 'conversation' }
  | { channelId: string; communityId: string; type: 'community_channel' };

export interface CallStartInput {
  networkId: string;
  nonce: string;
  participantIds: string[];
  scope: CallStartScope;
  sessionEpoch?: number;
  startedAt: number;
}

export interface SignedCallStart {
  callId: string;
  mutation: SignedPublicMutation;
}

/**
 * Signs the three records a call is derived from on every node: the start by
 * its creator, a participant state by that participant and the end by its
 * ender. Byte-exact contract: node docs/api.md, "Signed call events".
 */
export class CallEventSigner {
  private readonly mutations = new PublicMutationSigner();

  private sign(
    session: Session,
    recordId: string,
    payload: Record<string, unknown>,
    position: PublicMutationPosition,
  ): SignedPublicMutation {
    return this.mutations.sign(
      session,
      { kind: 'put', payload, recordId, store: 'calls' },
      position,
    );
  }

  /** Random client nonce, matching ^[A-Za-z0-9_-]{16,128}$. */
  public nonce(): string {
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }

  /** The id commits to the creator: UUID bytes from sha256(creator:nonce). */
  public callId(creatorIdentityId: string, nonce: string): string {
    const digest = SHA256Hash.from(`${creatorIdentityId}:${nonce}`).toString();
    const bytes = Array.from({ length: 16 }, (_, index) =>
      Number.parseInt(digest.slice(index * 2, index * 2 + 2), 16),
    );

    bytes[6] = (bytes[6] % 16) + 128;
    bytes[8] = (bytes[8] % 64) + 128;
    const hex = bytes
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  public start(session: Session, input: CallStartInput): SignedCallStart {
    const creatorIdentityId = this.mutations.authorOf(session);
    const callId = this.callId(creatorIdentityId, input.nonce);
    const conversation = input.scope.type === 'conversation';
    const id = `call:${callId}`;
    const payload = {
      callId,
      creatorIdentityId,
      id,
      networkId: input.networkId,
      nonce: input.nonce,
      participantIds: conversation ? [...input.participantIds].sort() : [],
      scope: input.scope,
      scopeType: 'call_start',
      ...(input.sessionEpoch === undefined
        ? {}
        : { sessionEpoch: input.sessionEpoch }),
      startedAt: input.startedAt,
    };

    return {
      callId,
      mutation: this.sign(
        session,
        id,
        payload,
        PublicMutationSigner.FIRST_POSITION,
      ),
    };
  }

  public participant(
    session: Session,
    callId: string,
    state: CallParticipantState,
    at: number,
    position: PublicMutationPosition,
  ): SignedPublicMutation {
    const identityId = this.mutations.authorOf(session);
    const id = `call-participant:${callId}:${identityId}`;

    return this.sign(
      session,
      id,
      {
        at,
        callId,
        id,
        identityId,
        scopeType: 'call_participant',
        state,
      },
      position,
    );
  }

  public end(
    session: Session,
    callId: string,
    at: number,
  ): SignedPublicMutation {
    const id = `call-end:${callId}`;

    return this.sign(
      session,
      id,
      {
        at,
        callId,
        endedByIdentityId: this.mutations.authorOf(session),
        id,
        scopeType: 'call_end',
      },
      PublicMutationSigner.FIRST_POSITION,
    );
  }
}
