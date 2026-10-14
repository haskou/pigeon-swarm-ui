import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../domain/ChatMessage';
import type { MessageResource } from '../http/MessageResource';

export interface MessageProjectionPort {
  decrypt(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage>;

  decryptMany(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]>;

  /**
   * Only the messages whose payload could be read, in source order. A message
   * with a missing conversation key or a failed decrypt is left out.
   */
  decryptReadable(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]>;
}
