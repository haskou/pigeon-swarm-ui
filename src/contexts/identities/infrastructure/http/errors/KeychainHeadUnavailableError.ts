/**
 * The session holds a keychain pointer, so a keychain exists, but its head did
 * not replicate within the lag window. Publishing without the head would post
 * a version 1 root with no previous link beside the existing keychain, so the
 * publish is refused and nothing is sent. Retrying once replication catches up
 * publishes normally.
 */
export class KeychainHeadUnavailableError extends Error {
  public constructor() {
    super(
      'The keychain head has not replicated yet, so nothing was published.',
    );
    this.name = 'KeychainHeadUnavailableError';
  }
}
