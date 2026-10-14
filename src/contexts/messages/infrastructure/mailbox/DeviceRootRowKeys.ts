import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { DeviceRootRowCipher } from './DeviceRootRowCipher';

/**
 * The keys of one identity's rows in one local store, derived by HKDF-SHA256
 * from the device-sealed root: the row cipher, and an HMAC-SHA256 key whose
 * tags stand in for ids at rest.
 */
export class DeviceRootRowKeys {
  /** `label` names the store, e.g. `pigeon-group-history`. */
  public static async derive(
    root: Uint8Array,
    label: string,
    identityId: string,
  ): Promise<DeviceRootRowKeys> {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(root),
      'HKDF',
      false,
      ['deriveKey'],
    );
    const tagKey = await crypto.subtle.deriveKey(
      {
        hash: 'SHA-256',
        info: encoder.encode(`${label}:tag:v1:${identityId}`),
        name: 'HKDF',
        salt: encoder.encode(`${label}:salt`),
      },
      material,
      { hash: 'SHA-256', length: 256, name: 'HMAC' },
      false,
      ['sign'],
    );

    return new DeviceRootRowKeys(
      await DeviceRootRowCipher.derive(root, label, identityId),
      tagKey,
    );
  }

  private constructor(
    public readonly cipher: DeviceRootRowCipher,
    private readonly tagKey: CryptoKey,
  ) {}

  /** A stable, keyed stand-in for `parts`. */
  public async tag(parts: readonly string[]): Promise<string> {
    return encodeBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          this.tagKey,
          new TextEncoder().encode(JSON.stringify(parts)),
        ),
      ),
    );
  }
}
