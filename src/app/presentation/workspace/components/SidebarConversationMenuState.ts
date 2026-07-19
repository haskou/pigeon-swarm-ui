import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';

export type SidebarConversationMenuState = {
  conversation: ConversationResource;
  left: number;
  title: string;
  top: number;
};
