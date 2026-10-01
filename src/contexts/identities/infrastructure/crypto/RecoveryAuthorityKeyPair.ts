import type { StringValueObject } from '@haskou/value-objects';

import { KeyPair, PrivateKey } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { RecoveryKey } from '../../domain/value-objects/RecoveryKey';

const PRIVATE_KEY_DER_PREFIX = Buffer.from(
  '302e020100300506032b657004220420',
  'hex',
);
const DERIVED_KEY_BITS = 256;
const DERIVATION_INFO = new TextEncoder().encode(
  'pigeon-swarm:recovery-authority:v1',
);

export class RecoveryAuthorityKeyPair {
  private static privateKeyPem(seed: ArrayBuffer): string {
    const encoded = Buffer.concat([
      PRIVATE_KEY_DER_PREFIX,
      Buffer.from(seed),
    ]).toString('base64');

    return `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----\n`;
  }

  public static async derive(
    recoveryKey: RecoveryKey,
    identityId: StringValueObject,
  ): Promise<KeyPair> {
    const recoveryBytes = new Uint8Array(recoveryKey.getBytes());
    const key = await crypto.subtle.importKey(
      'raw',
      recoveryBytes.buffer,
      'HKDF',
      false,
      ['deriveBits'],
    );
    const salt = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(identityId.valueOf()),
    );
    const seed = await crypto.subtle.deriveBits(
      {
        hash: 'SHA-256',
        info: DERIVATION_INFO,
        name: 'HKDF',
        salt,
      },
      key,
      DERIVED_KEY_BITS,
    );
    const privateKey = PrivateKey.fromPEM(this.privateKeyPem(seed));

    return new KeyPair(privateKey.getPublicKey(), privateKey);
  }
}
