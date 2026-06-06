import type { ChatMessage } from '../../../shared/domain/pigeonResources.types';

export class MessageEditPolicy {
  public static canEdit(message: ChatMessage, identityId: string): boolean {
    return (
      message.authorIdentityId === identityId &&
      !message.deliveryStatus &&
      !message.encrypted &&
      message.kind !== 'call-event' &&
      !message.poll &&
      !message.sticker &&
      message.content.trim().length > 0
    );
  }
}
