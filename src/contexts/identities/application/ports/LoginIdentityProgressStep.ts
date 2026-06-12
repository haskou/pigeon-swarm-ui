export type LoginIdentityProgressStep =
  | 'decrypting-keys'
  | 'loading-keychain'
  | 'loading-workspace'
  | 'resolving-identity';
