export type LoginIdentityProgressStep =
  | 'decrypting-keys'
  | 'loading-keychain'
  | 'loading-workspace'
  | 'node-starting'
  | 'resolving-identity';
