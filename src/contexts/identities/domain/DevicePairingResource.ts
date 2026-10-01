import { assert } from '@haskou/value-objects';

export class DevicePairingResource {
  public static fromUnknown(
    value: unknown,
    invalidMessage: string,
  ): DevicePairingResource {
    assert(
      typeof value === 'object' && value !== null,
      new Error(invalidMessage),
    );

    return new DevicePairingResource(
      Object.fromEntries(Object.entries(value)),
      invalidMessage,
    );
  }

  private constructor(
    private readonly values: Record<string, unknown>,
    private readonly invalidMessage: string,
  ) {}

  public assertProtocol(kind: string, version: number): void {
    assert(
      this.getString('kind') === kind && this.getNumber('version') === version,
      new Error(this.invalidMessage),
    );
  }

  public getKeyPair(name: string): {
    privateKey: string;
    publicKey: string;
  } {
    const keyPair = this.getResource(name);

    return {
      privateKey: keyPair.getString('privateKey'),
      publicKey: keyPair.getString('publicKey'),
    };
  }

  public getNumber(name: string): number {
    const value = this.values[name];
    assert(typeof value === 'number', new Error(this.invalidMessage));

    return value;
  }

  public getResource(name: string): DevicePairingResource {
    return DevicePairingResource.fromUnknown(
      this.values[name],
      this.invalidMessage,
    );
  }

  public getString(name: string): string {
    const value = this.values[name];
    assert(typeof value === 'string', new Error(this.invalidMessage));

    return value;
  }
}
