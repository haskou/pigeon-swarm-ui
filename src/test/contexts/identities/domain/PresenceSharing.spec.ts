import { ConversationId } from '../../../../contexts/conversations/domain/value-objects/ConversationId';
import { PresenceSharingRequiresDirectConversationError } from '../../../../contexts/identities/domain/errors/PresenceSharingRequiresDirectConversationError';
import { PresenceSharing } from '../../../../contexts/identities/domain/PresenceSharing';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';

describe(PresenceSharing.name, () => {
  it('binds one direct conversation to its contact', () => {
    const sharing = PresenceSharing.create(
      ConversationId.fromString('conversation-b'),
      IdentityId.fromString('identity-b'),
    );

    expect(sharing.isFor(ConversationId.fromString('conversation-b'))).toBe(
      true,
    );
    expect(sharing.isWith(IdentityId.fromString('identity-b'))).toBe(true);
    expect(sharing.isWith(IdentityId.fromString('identity-c'))).toBe(false);
    expect(sharing.toPrimitives()).toEqual({
      contactIdentityId: 'identity-b',
      conversationId: 'conversation-b',
    });
  });

  it('refuses a group conversation', () => {
    expect(() =>
      PresenceSharing.fromPrimitives({
        contactIdentityId: 'identity-b',
        conversationId: 'group:team',
      }),
    ).toThrow(PresenceSharingRequiresDirectConversationError);
  });
});
