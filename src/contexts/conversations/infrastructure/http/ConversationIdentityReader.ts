import type { IdentityResource } from '../../../identities/infrastructure/http/resources/IdentityResource';

export type ConversationIdentityReader = {
  get(identityId: string): Promise<IdentityResource>;
};
