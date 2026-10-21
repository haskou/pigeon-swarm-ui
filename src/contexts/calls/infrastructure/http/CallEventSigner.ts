import type { PublicMutation } from '@haskou/pigeon-swarm-crypto';

import { CommitmentId } from '@haskou/pigeon-swarm-crypto';

import type { PublicMutationIntent } from '../../../../shared/infrastructure/crypto/PublicMutationIntent';
import type { PublicMutationPosition } from '../../../../shared/infrastructure/crypto/PublicMutationPosition';
import type { Session } from '../../../identities/infrastructure/session/Session';

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
  mutation: PublicMutation;
}

/**
 * Signs the three records a call is derived from on every node: the start by
 * its creator, a participant state by that participant and the end by its
 * ender. Byte-exact contract: node docs/api.md, "Signed call events".
 */
export class CallEventSigner {
  public constructor(private readonly mutations: PublicMutationSigner) {}

  private intent(
    recordId: string,
    payload: Record<string, unknown>,
  ): PublicMutationIntent {
    return { kind: 'put', payload, recordId, store: 'calls' };
  }

  private participantIntent(
    session: Session,
    callId: string,
    state: CallParticipantState,
    at: number,
  ): PublicMutationIntent {
    const identityId = this.mutations.authorOf(session);
    const id = `call-participant:${callId}:${identityId}`;

    return this.intent(id, {
      at,
      callId,
      id,
      identityId,
      scopeType: 'call_participant',
      state,
    });
  }

  private endIntent(
    session: Session,
    callId: string,
    at: number,
  ): PublicMutationIntent {
    const id = `call-end:${callId}`;

    return this.intent(id, {
      at,
      callId,
      endedByIdentityId: this.mutations.authorOf(session),
      id,
      scopeType: 'call_end',
    });
  }

  /** Random client nonce, matching ^[A-Za-z0-9_-]{16,128}$. */
  public nonce(): string {
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }

  public async start(
    session: Session,
    input: CallStartInput,
  ): Promise<SignedCallStart> {
    const creatorIdentityId = this.mutations.authorOf(session);
    const callId = CommitmentId.call(creatorIdentityId, input.nonce);
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
      mutation: await this.mutations.sign(
        session,
        this.intent(id, payload),
        PublicMutationSigner.FIRST_POSITION,
      ),
    };
  }

  public async participant(
    session: Session,
    callId: string,
    state: CallParticipantState,
    at: number,
    position: PublicMutationPosition,
  ): Promise<PublicMutation> {
    return await this.mutations.sign(
      session,
      this.participantIntent(session, callId, state, at),
      position,
    );
  }

  /** Signs without any request: see `signAtObservedRevision`. */
  public participantOnPageDeparture(
    session: Session,
    callId: string,
    state: CallParticipantState,
    at: number,
    position: PublicMutationPosition,
  ): PublicMutation {
    return this.mutations.signAtObservedRevision(
      session,
      this.participantIntent(session, callId, state, at),
      position,
    );
  }

  public async end(
    session: Session,
    callId: string,
    at: number,
  ): Promise<PublicMutation> {
    return await this.mutations.sign(
      session,
      this.endIntent(session, callId, at),
      PublicMutationSigner.FIRST_POSITION,
    );
  }

  /** Signs without any request: see `signAtObservedRevision`. */
  public endOnPageDeparture(
    session: Session,
    callId: string,
    at: number,
  ): PublicMutation {
    return this.mutations.signAtObservedRevision(
      session,
      this.endIntent(session, callId, at),
      PublicMutationSigner.FIRST_POSITION,
    );
  }
}
