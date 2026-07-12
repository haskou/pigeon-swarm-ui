export type LoginIdentityProgressStep =
  | 'confirming-passkey'
  | 'decrypting-keys'
  | 'loading-keychain'
  | 'loading-workspace'
  | 'resolving-identity';
