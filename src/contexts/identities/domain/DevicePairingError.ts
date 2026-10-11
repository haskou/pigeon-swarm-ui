import type { DevicePairingFailure } from './DevicePairingFailure';

export class DevicePairingError extends Error {
  public constructor(
    public readonly failure: DevicePairingFailure,
    message: string,
  ) {
    super(message);
    this.name = 'DevicePairingError';
  }
}
