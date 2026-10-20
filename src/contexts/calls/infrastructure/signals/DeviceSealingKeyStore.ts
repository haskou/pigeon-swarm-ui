import { X25519KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedEntryStore } from '../../../messages/infrastructure/mailbox/DeviceSealedEntryStore';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';

const KIND = 'sealing-key';
const KEY_BYTES = 32;

/**
 * The device's X25519 sealing key. The private bytes exist only sealed under
 * the device root key in a database of their own, so a reload keeps the key
 * that published records advertise.
 */
export class DeviceSealingKeyStore {
  public constructor(private readonly entries: DeviceSealedEntryStore) {}

  private static id(session: Session): string {
    return session.deviceCredentialKeyPair.toPrimitives().publicKey;
  }

  private async privateKey(session: Session): Promise<Uint8Array> {
    const id = DeviceSealingKeyStore.id(session);
    const stored = await this.entries.get(session, KIND, id);

    if (stored) return stored;

    const fresh = crypto.getRandomValues(new Uint8Array(KEY_BYTES));

    if (await this.entries.add(session, KIND, id, fresh)) return fresh;

    const winner = await this.entries.get(session, KIND, id);

    if (!winner) throw new Error('The device sealing key could not be stored.');

    return winner;
  }

  public async keyPair(session: Session): Promise<X25519KeyPair> {
    return X25519KeyPair.fromPrivateKey(await this.privateKey(session));
  }

  /** The base64url of the raw public key a sealing record publishes. */
  public async publicKey(session: Session): Promise<string> {
    return encodeBase64Url(
      (await this.keyPair(session)).getPublicKey().toRaw(),
    );
  }
}
