import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

export type GroupParticipant = {
  identity?: IdentityResource;
  identityId: string;
  name?: string;
  picture?: null | string;
};
