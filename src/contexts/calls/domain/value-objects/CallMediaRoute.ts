import type { PrimitiveOf } from '@haskou/value-objects';

import { CallCandidateType } from './CallCandidateType';
import { CallConnectionMetadata } from './CallConnectionMetadata';

export class CallMediaRoute {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallMediaRoute>,
  ): CallMediaRoute {
    const metadata = (value?: string): CallConnectionMetadata | undefined =>
      value ? CallConnectionMetadata.fromString(value) : undefined;

    return new CallMediaRoute(
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
    } = {};

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
