import { describe, expect, it } from '@jest/globals';

import type {
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
} from '../../../../../shared/domain/pigeonResources.types';

import { ChatConversationPresentation } from '../../../../../app/presentation/workspace/components/ChatConversationPresentation';

describe(ChatConversationPresentation.name, () => {
  it('projects a group conversation and its call participants', () => {
    const conversation = {
      id: 'group:friends',
      name: 'Friends',
      networkId: 'network-a',
      participantIds: ['identity-a', 'identity-b'],
      type: 'group',
    } as ConversationResource;
    const identity = {
      id: 'identity-b',
      profile: { handle: 'ada', name: 'Ada' },
    } as IdentityResource;
    const presentation = new ChatConversationPresentation({
      conversation,
      currentIdentityId: 'identity-a',
      hasConversationKey: true,
      identityNames: { 'identity-b': 'Ada' },
      identityPictures: { 'identity-b': 'avatar-url' },
      identityProfiles: { 'identity-b': identity },
      loadedMessageCount: 3,
      nodeNetworks: [{ id: 'network-a', name: 'Alpha' }],
    });

    expect(presentation).toMatchObject({
      canCreatePoll: true,
      canOpenPeerProfile: false,
      canShareConversationKey: false,
      isGroup: true,
      name: 'Friends',
      networkName: 'Alpha',
      participantIds: ['identity-a', 'identity-b'],
      title: 'Friends',
    });
    expect(presentation.callParticipants).toHaveLength(2);
    expect(presentation.groupParticipants[1]).toMatchObject({
      identity,
      identityId: 'identity-b',
      name: 'Ada',
      picture: 'avatar-url',
    });
  });

  it('projects direct conversation encryption details', () => {
    const conversation = {
      id: 'one-to-one:a',
      networkId: 'network-a',
      participantIds: ['identity-a', 'identity-b'],
      title: 'Ada (@ada)',
      type: 'one-to-one',
    } as ConversationResource;
    const conversationKey = {
      algorithm: 'aes-256-gcm',
      conversationId: conversation.id,
      createdAt: 1,
      key: 'secret',
      kind: 'conversation',
      peerIdentityId: 'identity-b',
      version: 2,
    } satisfies ConversationKeyEntry;
    const presentation = new ChatConversationPresentation({
      conversation,
      conversationKey,
      currentIdentityId: 'identity-a',
      hasConversationKey: true,
      identityNames: { 'identity-b': 'Ada (@ada)' },
      identityPictures: {},
      identityProfiles: {},
      loadedMessageCount: 8,
      nodeNetworks: [{ id: 'network-a', name: 'Alpha' }],
      peerIdentityId: 'identity-b',
    });

    expect(presentation.title).toBe('Ada');
    expect(presentation.canOpenPeerProfile).toBe(true);
    expect(presentation.conversationData.frontendDerived).toMatchObject({
      e2eReady: true,
      loadedMessages: 8,
    });
    expect(presentation.encryptionDetails).toMatchObject({
      status: 'ready',
      title: expect.any(String),
    });
    expect(presentation.encryptionDetails?.secrets[0]).toMatchObject({
      sensitive: true,
      value: 'secret',
    });
  });
});
