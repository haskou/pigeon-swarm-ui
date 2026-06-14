import { StringValueObject } from '@haskou/value-objects';

const RECOVERY_KEY_PREFIX = 'psrk1.';
const RECOVERY_KEY_BYTES = 32;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export class RecoveryKey extends StringValueObject {
  public static generate(): RecoveryKey {
    const bytes = new Uint8Array(RECOVERY_KEY_BYTES);

    crypto.getRandomValues(bytes);

    return new RecoveryKey(`${RECOVERY_KEY_PREFIX}${bytesToBase64Url(bytes)}`);
  }

  public static fromString(value: string): RecoveryKey {
    return new RecoveryKey(value);
  }

  public static isValid(value: string): boolean {
    try {
      RecoveryKey.fromString(value);

      return true;
    } catch {
      return false;
    }
  }

  private constructor(value: string) {
    const normalized = value.trim();

    if (!normalized.startsWith(RECOVERY_KEY_PREFIX)) {
      throw new Error('Invalid recovery key prefix.');
    }

    const bytes = base64UrlToBytes(
      normalized.slice(RECOVERY_KEY_PREFIX.length),
    );

    if (bytes.byteLength !== RECOVERY_KEY_BYTES) {
      throw new Error('Invalid recovery key length.');
    }

    super(normalized);
  }

  public getBytes(): Uint8Array {
    return base64UrlToBytes(this.valueOf().slice(RECOVERY_KEY_PREFIX.length));
  }
}
