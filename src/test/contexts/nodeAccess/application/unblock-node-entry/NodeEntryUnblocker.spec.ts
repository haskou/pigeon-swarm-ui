import { mock } from 'jest-mock-extended';

import type { NodeBlockListRepository } from '../../../../../contexts/nodeAccess/domain/repositories/NodeBlockListRepository';

import { UnblockNodeEntryMessage } from '../../../../../contexts/nodeAccess/application/unblock-node-entry/messages/UnblockNodeEntryMessage';
import { NodeEntryUnblocker } from '../../../../../contexts/nodeAccess/application/unblock-node-entry/NodeEntryUnblocker';
import { NodeBlockList } from '../../../../../contexts/nodeAccess/domain/NodeBlockList';

const owner = 'T3duZXJLZXk=';
const alice = 'QWxpY2VLZXk=';

describe(NodeEntryUnblocker.name, () => {
  it('removes an identity in the next version of the stored list', async () => {
    const repository = mock<NodeBlockListRepository>();
    repository.find.mockResolvedValue(
      NodeBlockList.fromPrimitives({
        blockedIdentityIds: [alice],
        blockedNodePeerIds: [],
        issuedAt: 1,
        ownerIdentityId: owner,
        version: 7,
      }),
    );
    repository.save.mockImplementation((list) => Promise.resolve(list));

    const saved = await new NodeEntryUnblocker(repository).unblock(
      new UnblockNodeEntryMessage({
        actorIdentityId: owner,
        identityId: alice,
      }),
    );

    expect(saved.toPrimitives()).toMatchObject({
      blockedIdentityIds: [],
      version: 8,
    });
  });
});
