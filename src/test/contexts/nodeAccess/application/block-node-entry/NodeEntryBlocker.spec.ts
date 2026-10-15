import { mock } from 'jest-mock-extended';

import type { NodeBlockListRepository } from '../../../../../contexts/nodeAccess/domain/repositories/NodeBlockListRepository';

import { BlockNodeEntryMessage } from '../../../../../contexts/nodeAccess/application/block-node-entry/messages/BlockNodeEntryMessage';
import { NodeEntryBlocker } from '../../../../../contexts/nodeAccess/application/block-node-entry/NodeEntryBlocker';
import { NodeOwnerIdentityCannotBeBlockedError } from '../../../../../contexts/nodeAccess/domain/errors/NodeOwnerIdentityCannotBeBlockedError';
import { NodeBlockList } from '../../../../../contexts/nodeAccess/domain/NodeBlockList';

const owner = 'T3duZXJLZXk=';
const alice = 'QWxpY2VLZXk=';
const peer = '12D3KooWAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe(NodeEntryBlocker.name, () => {
  it('blocks a node by peer id in the next version of the stored list', async () => {
    const repository = mock<NodeBlockListRepository>();
    repository.find.mockResolvedValue(
      NodeBlockList.fromPrimitives({
        blockedIdentityIds: [alice],
        blockedNodePeerIds: [],
        issuedAt: 1,
        ownerIdentityId: owner,
        version: 2,
      }),
    );
    repository.save.mockImplementation((list) => Promise.resolve(list));

    const saved = await new NodeEntryBlocker(repository).block(
      new BlockNodeEntryMessage({ actorIdentityId: owner, nodePeerId: peer }),
    );

    expect(saved.toPrimitives()).toMatchObject({
      blockedIdentityIds: [alice],
      blockedNodePeerIds: [peer],
      ownerIdentityId: owner,
      version: 3,
    });
    expect(repository.find.mock.calls[0]?.[0].toString()).toBe(owner);
    expect(repository.save.mock.calls[0]?.[1].toString()).toBe(owner);
  });

  it('never saves a list that blocks the node owner', async () => {
    const repository = mock<NodeBlockListRepository>();
    repository.find.mockResolvedValue(null);

    await expect(
      new NodeEntryBlocker(repository).block(
        new BlockNodeEntryMessage({ actorIdentityId: owner, identityId: owner }),
      ),
    ).rejects.toThrow(NodeOwnerIdentityCannotBeBlockedError);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
