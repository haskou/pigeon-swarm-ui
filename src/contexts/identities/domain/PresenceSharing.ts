import { assert } from '@haskou/value-objects';

import { ConversationId } from '../../conversations/domain/value-objects/ConversationId';
import { PresenceSharingRequiresDirectConversationError } from './errors/PresenceSharingRequiresDirectConversationError';
import { IdentityId } from './value-objects/IdentityId';

/**
 * This device's choice to exchange presence with one contact, the peer of a
 * direct conversation. Off unless chosen; it lives on this device only and is
 * not replicated, so it records no event.
 */
export class PresenceSharing {
  public static create(
    conversationId: ConversationId,
    contactId: IdentityId,
  ): PresenceSharing {
    return new PresenceSharing(conversationId, contactId);
  }

  public static fromPrimitives(primitives: {
    contactIdentityId: string;
    conversationId: string;
  }): PresenceSharing {
    return new PresenceSharing(
      ConversationId.fromString(primitives.conversationId),
      IdentityId.fromString(primitives.contactIdentityId),
    );
  }

  private constructor(
    private readonly conversationId: ConversationId,
    private readonly contactId: IdentityId,
  ) {
    assert(
      !conversationId.isGroup(),
      new PresenceSharingRequiresDirectConversationError(),
    );
  }

  public getContactId(): IdentityId {
    return this.contactId;
  }

  public isFor(conversationId: ConversationId): boolean {
    return this.conversationId.isEqual(conversationId);
  }

  public isSameAs(other: PresenceSharing): boolean {
    return this.conversationId.isEqual(other.conversationId);
  }

  public isWith(contactId: IdentityId): boolean {
    return this.contactId.isEqual(contactId);
  }

  public toPrimitives() {
    return {
      contactIdentityId: this.contactId.toString(),
      conversationId: this.conversationId.toString(),
    };
  }
}
