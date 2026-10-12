import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';

export type SidebarConversationMenuState = {
  conversation: ConversationResource;
  left: number;
  title: string;
  top: number;
};
