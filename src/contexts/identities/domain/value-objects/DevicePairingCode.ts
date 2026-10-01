import {
  InvalidFormatError,
  StringValueObject,
  assert,
} from '@haskou/value-objects';

const PREFIX = 'psdp1.';
const MAX_LENGTH = 32_768;

export class DevicePairingCode extends StringValueObject {
  public static encode(resource: object): DevicePairingCode {
    const bytes = new TextEncoder().encode(JSON.stringify(resource));
    let binary = '';

    for (const byte of bytes) binary += String.fromCharCode(byte);

    return new DevicePairingCode(
      `${PREFIX}${btoa(binary)}`
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, ''),
    );
  }

  public static fromString(value: string): DevicePairingCode {
    return new DevicePairingCode(value.trim());
  }

  private constructor(value: string) {
    assert(
      value.startsWith(PREFIX),
      new InvalidFormatError('[redacted pairing code]'),
    );
    super(value, MAX_LENGTH);
  }

  public decode(): unknown {
    const encoded = this.valueOf().slice(PREFIX.length);
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');

    try {
      const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      );

      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      throw new InvalidFormatError('[redacted pairing code]');
    }
  }
}
