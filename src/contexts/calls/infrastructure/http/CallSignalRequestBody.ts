import type { CallSignalPayload } from '../media/CallSignalPayload';

const maximumCallSignalBytes = 64 * 1024;

export class CallSignalRequestBody {
  private readonly serialized: string;

  public constructor(signal: CallSignalPayload) {
    this.serialized = JSON.stringify({
      payload: signal.payload,
      recipientIdentityId: signal.recipientIdentityId,
      signalType: signal.signalType,
    });

    if (
      new TextEncoder().encode(this.serialized).byteLength >=
      maximumCallSignalBytes
    ) {
      throw new Error(
        'Call signal payload exceeds the 64 KiB transport limit.',
      );
    }
  }

  public body(): {
    payload: Record<string, unknown>;
    recipientIdentityId: string;
    signalType: CallSignalPayload['signalType'];
  } {
    return JSON.parse(this.serialized) as {
      payload: Record<string, unknown>;
      recipientIdentityId: string;
      signalType: CallSignalPayload['signalType'];
    };
  }

  public toString(): string {
    return this.serialized;
  }
}
