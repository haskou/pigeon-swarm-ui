import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

export type ConversationIdentityReader = {
  get(identityId: string): Promise<IdentityResource>;
};
