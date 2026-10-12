import { describe, expect, it } from '@jest/globals';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';

import { WorkspaceConversationTarget } from '../../../../../app/presentation/workspace/components/WorkspaceConversationTarget';

describe(WorkspaceConversationTarget.name, () => {
  it('finds an existing direct conversation with the target identity', () => {
    const conversation = {
      id: 'one-to-one:conversation',
      participantIds: ['current', 'peer'],
      type: 'one-to-one',
    } as ConversationResource;

    expect(
      WorkspaceConversationTarget.existingConversation(
        [conversation],
        'current',
        { conversations: {} } as LocalKeychain,
        'peer',
      ),
    ).toBe(conversation);
  });

  it('selects the preferred shared network when it is available', () => {
    const network = WorkspaceConversationTarget.sharedNetwork(
      ['network-a', 'network-b'],
      { networks: ['network-b'] } as IdentityResource,
      'network-b',
    );

    expect(network.toString()).toBe('network-b');
  });
});
