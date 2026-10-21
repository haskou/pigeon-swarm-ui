/**
 * The session holds no keychain pointer and the identity was not created on
 * this device, so there is no head to publish under. A root posted here could
 * sit beside a keychain that replication has not delivered yet, so the publish
 * is refused and nothing is sent.
 */
export class KeychainNotFoundError extends Error {
  public constructor() {
    super(
      'No keychain is visible for this identity, so nothing was published.',
    );
    this.name = 'KeychainNotFoundError';
  }
}
