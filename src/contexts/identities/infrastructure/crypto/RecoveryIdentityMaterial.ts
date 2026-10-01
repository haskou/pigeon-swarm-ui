import { KeyPair, PrivateKey, UserRootKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type { RecoveryKey } from '../../domain/value-objects/RecoveryKey';

import { IdentityId } from '../../domain/value-objects/IdentityId';
import { RecoveryAuthorityKeyPair } from './RecoveryAuthorityKeyPair';

const PRIVATE_KEY_DER_PREFIX = Buffer.from(
  '302e020100300506032b657004220420',
  'hex',
);
const DERIVED_KEY_BITS = 256;
const DERIVATION_SALT = new TextEncoder().encode(
  'pigeon-swarm:recovery-kit:v1',
);

export class RecoveryIdentityMaterial {
  private static async deriveBytes(
    recoveryKey: RecoveryKey,
    domain: string,
  ): Promise<Uint8Array> {
    const recoveryBytes = new Uint8Array(recoveryKey.getBytes());
    const key = await crypto.subtle.importKey(
      'raw',
      recoveryBytes.buffer,
      'HKDF',
      false,
      ['deriveBits'],
    );
    const bytes = await crypto.subtle.deriveBits(
      {
        hash: 'SHA-256',
        info: new TextEncoder().encode(domain),
        name: 'HKDF',
        salt: DERIVATION_SALT,
      },
      key,
      DERIVED_KEY_BITS,
    );

    return new Uint8Array(bytes);
  }

  private static keyPair(seed: Uint8Array): KeyPair {
    const encoded = Buffer.concat([
      PRIVATE_KEY_DER_PREFIX,
      Buffer.from(seed),
    ]).toString('base64');
    const privateKey = PrivateKey.fromPEM(
      `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----\n`,
    );

    return new KeyPair(privateKey.getPublicKey(), privateKey);
  }

  public static async derive(recoveryKey: RecoveryKey): Promise<{
    identityKeyPair: KeyPair;
    recoveryAuthorityKeyPair: KeyPair;
    rootKey: UserRootKey;
  }> {
    const identityKeyPair = this.keyPair(
      await this.deriveBytes(
        recoveryKey,
        'pigeon-swarm:recovery-identity-signing:v1',
      ),
    );
    const rootKey = UserRootKey.fromBase64(
      Buffer.from(
        await this.deriveBytes(
          recoveryKey,
          'pigeon-swarm:recovery-user-root:v1',
        ),
      ).toString('base64'),
    );
    const identityId = IdentityId.fromString(
      identityKeyPair.toPrimitives().publicKey,
    );
    const recoveryAuthorityKeyPair = await RecoveryAuthorityKeyPair.derive(
      recoveryKey,
      new StringValueObject(identityId.valueOf()),
    );

    return { identityKeyPair, recoveryAuthorityKeyPair, rootKey };
  }
}
