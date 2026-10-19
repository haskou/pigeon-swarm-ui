import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';

import { useWorkspaceConversationNavigation } from '../../../../app/presentation/workspace/components/useWorkspaceConversationNavigation';
import { copy } from '../../../../shared/presentation/i18n/copy';

const mockCreate = jest.fn<Promise<unknown>, unknown[]>();

jest.mock('react', () => ({
  useCallback: <T>(callback: T): T => callback,
}));

jest.mock('../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    conversations: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

const peerId = 'identity-peer';
const privateNetwork: NodeNetwork = {
  id: 'network-private',
  name: 'Team',
  privateNetwork: true,
};
const publicNetwork: NodeNetwork = {
  id: 'network-public',
  name: 'Open',
  privateNetwork: false,
};
const unflaggedNetwork: NodeNetwork = { id: 'network-absent', name: 'Legacy' };
const nodeNetworks: NodeNetwork[] = [
  privateNetwork,
  publicNetwork,
  unflaggedNetwork,
];

function navigationFor(
  ownNetworkIds: string[],
  nodeNetworkList: NodeNetwork[],
  nodeNetworksLoadError = false,
) {
  const session = {
    identity: { id: 'identity-own', networks: ownNetworkIds },
    keychain: {},
  } as unknown as Session;

  return useWorkspaceConversationNavigation({
    closeCommunityMembers: jest.fn(),
    closeConversationCreation: jest.fn(),
    closeSidebar: jest.fn(),
    conversations: [],
    nodeNetworks: nodeNetworkList,
    nodeNetworksLoadError,
    nodeNetworksLoading: false,
    rememberIdentity: jest.fn(),
    session,
    sessionRef: { current: session },
    setActiveConversationId: jest.fn(),
    setConversations: jest.fn(),
    setSession: jest.fn(),
    showMessagesWorkspace: jest.fn(),
  });
}

function peerSharing(networks: string[]): IdentityResource {
  return { id: peerId, networks } as unknown as IdentityResource;
}

describe(useWorkspaceConversationNavigation.name, () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      conversation: { id: 'conversation-created' },
    });
  });

  it('creates the direct conversation on a shared network the node flags private', async () => {
    const navigation = navigationFor(
      ['network-public', 'network-private'],
      nodeNetworks,
    );

    await navigation.openOrCreateConversation(
      peerId,
      peerSharing(['network-public', 'network-private']),
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.anything(),
      peerId,
      'network-private',
    );
  });

  it('refuses to create a direct conversation on a shared network the node flags public', async () => {
    const navigation = navigationFor(['network-public'], nodeNetworks);

    await expect(
      navigation.openOrCreateConversation(
        peerId,
        peerSharing(['network-public']),
      ),
    ).rejects.toThrow(copy.dialog.noSharedPrivateNetwork);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('refuses to create a direct conversation on a shared network with no privateNetwork flag', async () => {
    const navigation = navigationFor(['network-absent'], nodeNetworks);

    await expect(
      navigation.openOrCreateConversation(
        peerId,
        peerSharing(['network-absent']),
      ),
    ).rejects.toThrow(copy.dialog.noSharedPrivateNetwork);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('chooses the shared private network over a preferred public one', async () => {
    const navigation = navigationFor(
      ['network-public', 'network-private'],
      nodeNetworks,
    );

    await navigation.openOrCreateConversation(
      peerId,
      peerSharing(['network-public', 'network-private']),
      'network-public',
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.anything(),
      peerId,
      'network-private',
    );
  });

  it('reports a failed node network list instead of a missing private network', async () => {
    const navigation = navigationFor(['network-private'], [], true);

    await expect(
      navigation.openOrCreateConversation(
        peerId,
        peerSharing(['network-private']),
      ),
    ).rejects.toThrow(copy.dialog.networksLoadFailed);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
