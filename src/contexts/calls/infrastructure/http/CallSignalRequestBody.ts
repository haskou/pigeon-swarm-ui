import type { SealedCallSignal } from '../signals/SealedCallSignal';

const maximumCallSignalBytes = 64 * 1024;

export class CallSignalRequestBody {
  private readonly serialized: string;

  public constructor(private readonly signal: SealedCallSignal) {
    this.serialized = JSON.stringify(signal);

    if (
      new TextEncoder().encode(this.serialized).byteLength >=
      maximumCallSignalBytes
    ) {
      throw new Error(
        'Call signal payload exceeds the 64 KiB transport limit.',
      );
    }
  }

  public body(): SealedCallSignal {
    return JSON.parse(this.serialized) as SealedCallSignal;
  }

  public toString(): string {
    return this.serialized;
  }
}
