/**
 * One contact as this device last saw it: the display name of an identity
 * the owner talks to, and when the node last returned that profile. Never
 * holds keys or credentials, so nothing cryptographic reads from it.
 */
export type ContactDirectoryEntry = {
  readonly identityId: string;
  readonly name: string;
  readonly seenAt: number;
};
