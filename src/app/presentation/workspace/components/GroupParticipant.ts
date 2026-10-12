import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

export type GroupParticipant = {
  identity?: IdentityResource;
  identityId: string;
  name?: string;
  picture?: null | string;
};
