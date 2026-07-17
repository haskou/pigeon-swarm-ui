import type { PrimitiveOf } from '@haskou/value-objects';

import { CallCandidateType } from '../value-objects/CallCandidateType';
import { CallConnectionMetadata } from '../value-objects/CallConnectionMetadata';
import { CallConnectionState } from '../value-objects/CallConnectionState';
import { CallIdentityId } from '../value-objects/CallIdentityId';
import { CallRelayUsage } from '../value-objects/CallRelayUsage';

export class CallMediaConnection {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallMediaConnection>,
  ): CallMediaConnection {
    const metadata = (value?: string): CallConnectionMetadata | undefined =>
      value ? CallConnectionMetadata.fromString(value) : undefined;

    return new CallMediaConnection(
      CallIdentityId.fromString(primitives.remoteIdentityId),
      CallConnectionState.fromPrimitives(primitives.state),
      primitives.usesRelay ? CallRelayUsage.RELAY : CallRelayUsage.DIRECT,
      primitives.localCandidateType
        ? CallCandidateType.fromPrimitives(primitives.localCandidateType)
        : undefined,
      metadata(primitives.protocol),
      metadata(primitives.relayProtocol),
      metadata(primitives.relayUrl),
      primitives.remoteCandidateType
        ? CallCandidateType.fromPrimitives(primitives.remoteCandidateType)
        : undefined,
    );
  }

  private constructor(
    private readonly remoteIdentityId: CallIdentityId,
    private readonly state: CallConnectionState,
    private readonly relayUsage: CallRelayUsage,
    private readonly localCandidateType?: CallCandidateType,
    private readonly protocol?: CallConnectionMetadata,
    private readonly relayProtocol?: CallConnectionMetadata,
    private readonly relayUrl?: CallConnectionMetadata,
    private readonly remoteCandidateType?: CallCandidateType,
  ) {}

  public toPrimitives() {
    const primitives: {
      localCandidateType?: ReturnType<CallCandidateType['valueOf']>;
      protocol?: string;
      relayProtocol?: string;
      relayUrl?: string;
      remoteCandidateType?: ReturnType<CallCandidateType['valueOf']>;
      remoteIdentityId: string;
      state: ReturnType<CallConnectionState['valueOf']>;
      usesRelay: boolean;
    } = {
      remoteIdentityId: this.remoteIdentityId.toString(),
      state: this.state.valueOf(),
      usesRelay: this.relayUsage.usesRelay(),
    };

    if (this.localCandidateType) {
      primitives.localCandidateType = this.localCandidateType.valueOf();
    }

    if (this.protocol) primitives.protocol = this.protocol.toString();

    if (this.relayProtocol) {
      primitives.relayProtocol = this.relayProtocol.toString();
    }

    if (this.relayUrl) primitives.relayUrl = this.relayUrl.toString();

    if (this.remoteCandidateType) {
      primitives.remoteCandidateType = this.remoteCandidateType.valueOf();
    }

    return primitives;
  }
}
