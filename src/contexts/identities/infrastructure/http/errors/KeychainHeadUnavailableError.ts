const messages = {
  ambiguous:
    'An earlier first publish may already have stored the keychain, so nothing was published until its head replicates.',
  unreplicated:
    'The keychain head has not replicated yet, so nothing was published.',
} as const;

/**
 * The first publish cannot proceed because the keychain head is unreadable, so
 * nothing is published. `ambiguous` means an earlier first POST may already
 * have stored the keychain, so the message says so and the retry waits for a
 * head. `unreplicated` means a pointer exists but its head has not replicated
 * within the lag window. Publishing without the head would post a version 1
 * root with no previous link beside the existing keychain, so the publish is
 * refused and nothing is sent. Retrying once replication catches up publishes
 * normally.
 */
export class KeychainHeadUnavailableError extends Error {
  public constructor(reason: keyof typeof messages) {
    super(messages[reason]);
    this.name = 'KeychainHeadUnavailableError';
  }
}
