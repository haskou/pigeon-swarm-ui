import { describe, expect, it } from '@jest/globals';

import type {
  ConversationResource,
  IdentityResource,
} from '../../../../../shared/domain/pigeonResources.types';

import { SidebarConversation } from '../../../../../app/presentation/workspace/components/SidebarConversation';
import { sessionFixture } from '../../../../contexts/conversations/ConversationFixture';

const directConversation: ConversationResource = {
  id: 'one-to-one:a',
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
  type: 'one-to-one',
};

describe(SidebarConversation.name, () => {
  it('projects direct conversation identity details', () => {
    const session = sessionFixture();
    const identity = {
      id: 'identity-b',
      profile: { handle: 'ada', name: 'Ada' },
    } as IdentityResource;
    const item = new SidebarConversation(
      directConversation,
      session.identity.id,
      session.keychain,
      { 'identity-b': 'Ada' },
      { 'identity-b': 'avatar-url' },
      { 'identity-b': identity },
    );

    expect(item).toMatchObject({
      handle: '@ada',
      loading: { avatar: false, subtitle: false, title: false },
      peerIdentityId: 'identity-b',
      pictureUrl: 'avatar-url',
      title: 'Ada',
    });
    expect(item.matches('ADA')).toBe(true);
  });

  it('projects group conversations without identity loading placeholders', () => {
    const session = sessionFixture();
    const item = new SidebarConversation(
      {
        ...directConversation,
        id: 'group:a',
        name: 'Friends',
        type: 'group',
      },
      session.identity.id,
      session.keychain,
      {},
      {},
      {},
    );

    expect(item.title).toBe('Friends');
    expect(item.loading).toEqual({
      avatar: false,
      subtitle: false,
      title: false,
    });
    expect(item.matches('missing')).toBe(false);
  });
});
