/** What a group conversation id commits to, as plain strings. */
export type GroupMailboxGenesisFields = Readonly<
  Record<'creatorIdentityId' | 'networkId' | 'nonce', string>
>;
