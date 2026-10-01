import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

export function identityResource(name = 'Ada'): IdentityResource {
  return {
    authorizationRevision: 0,
    deviceCredential: 'device-credential',
    deviceCredentialCommitment: 'device-credential-commitment',
    id: 'identity-a',
    networks: ['network-a'],
    profile: { name },
    recoveryAuthority: 'recovery-authority',
    signature: 'signature',
    timestamp: 100,
    version: 1,
  };
}
