import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

import { assert } from '@haskou/value-objects';

import type { DevicePairingRequest } from './DevicePairingRequest';

import { DevicePairingError } from './DevicePairingError';

export class DevicePairingRequestDraft {
  private state: 'available' | 'consumed' | 'reserved' = 'available';

  public constructor(
    private readonly request: DevicePairingRequest,
    private readonly target: KeyPair,
    private readonly transport: KeyPair,
  ) {}

  public reserve(): void {
    assert(
      this.state === 'available',
      new DevicePairingError(
        'used',
        'Device pairing request was already used.',
      ),
    );
    this.state = 'reserved';
  }

  public release(): void {
    if (this.state === 'reserved') {
      this.state = 'available';
    }
  }

  public consume(): void {
    this.state = 'consumed';
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
