import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

import { assert } from '@haskou/value-objects';

import type { DevicePairingRequest } from './DevicePairingRequest';

import { DevicePairingError } from './DevicePairingError';

export class DevicePairingRequestDraft {
  private consumed = false;

  public constructor(
    private readonly request: DevicePairingRequest,
    private readonly target: KeyPair,
    private readonly transport: KeyPair,
  ) {}

  public assertAvailable(): void {
    assert(
      this.consumed === false,
      new DevicePairingError(
        'used',
        'Device pairing request was already used.',
      ),
    );
  }

  public consume(): void {
    this.assertAvailable();
    this.consumed = true;
  }

  public getRequest(): DevicePairingRequest {
    return this.request;
  }

  public getTargetKeyPair(): KeyPair {
    return this.target;
  }

  public getTransportKeyPair(): KeyPair {
    return this.transport;
  }
}
