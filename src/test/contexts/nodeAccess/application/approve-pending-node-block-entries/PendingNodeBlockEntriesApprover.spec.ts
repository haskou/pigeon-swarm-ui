import { type MockProxy, mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { NodeAccessSessions } from '../../../../../contexts/nodeAccess/infrastructure/http/repositories/NodeAccessSessions';
import type { NodeBlockSourceResource } from '../../../../../contexts/nodeAccess/infrastructure/http/resources/NodeAccessResources';

import { ApprovePendingNodeBlockEntriesMessage } from '../../../../../contexts/nodeAccess/application/approve-pending-node-block-entries/messages/ApprovePendingNodeBlockEntriesMessage';
import { PendingNodeBlockEntriesApprover } from '../../../../../contexts/nodeAccess/application/approve-pending-node-block-entries/PendingNodeBlockEntriesApprover';
import { NodeBlockSourceHasNothingPendingError } from '../../../../../contexts/nodeAccess/domain/errors/NodeBlockSourceHasNothingPendingError';
import { PigeonNodeAccessApi } from '../../../../../contexts/nodeAccess/infrastructure/http/PigeonNodeAccessApi';
import { PigeonNodeBlockSourceRepository } from '../../../../../contexts/nodeAccess/infrastructure/http/repositories/PigeonNodeBlockSourceRepository';

const owner = 'T3duZXJLZXk=';
const sourceOwner = 'U291cmNlT3duZXI=';
const alice = 'QWxpY2VLZXk=';
const bob = 'Qm9iS2V5';
const peer = '12D3KooWAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function source(): NodeBlockSourceResource {
  return {
    appliedCount: 1,
    autoApply: false,
    lastFetchedAt: 10,
    lastFetchOutcome: 'accepted',
    origin: 'https://source.example',
    ownerIdentityId: sourceOwner,
    pendingCount: 0,
    version: 5,
  };
}

function approverWith(pending: {
  blockedIdentityIds: string[];
  blockedNodePeerIds: string[];
  version: number | null;
}): {
  api: MockProxy<PigeonNodeAccessApi>;
  approver: PendingNodeBlockEntriesApprover;
} {
  const api = mock<PigeonNodeAccessApi>();
  const sessions = mock<NodeAccessSessions>();
  sessions.find.mockReturnValue(mock<Session>());
  api.getPendingEntries.mockResolvedValue({
    ...pending,
    ownerIdentityId: sourceOwner,
  });
  api.postApproval.mockResolvedValue(source());

  return {
    api,
    approver: new PendingNodeBlockEntriesApprover(
      new PigeonNodeBlockSourceRepository(api, sessions),
    ),
  };
}

describe(PendingNodeBlockEntriesApprover.name, () => {
  it('approves every pending entry of the version under review', async () => {
    const { api, approver } = approverWith({
      blockedIdentityIds: [alice, bob],
      blockedNodePeerIds: [peer],
      version: 5,
    });

    await approver.approve(
      new ApprovePendingNodeBlockEntriesMessage({
        actorIdentityId: owner,
        sourceOwnerIdentityId: sourceOwner,
      }),
    );

    expect(api.postApproval).toHaveBeenCalledWith(
      sourceOwner,
      { all: true, version: 5 },
      expect.anything(),
    );
  });

  it('approves one pending entry of the version under review', async () => {
    const { api, approver } = approverWith({
      blockedIdentityIds: [alice, bob],
      blockedNodePeerIds: [peer],
      version: 5,
    });

    await approver.approve(
      new ApprovePendingNodeBlockEntriesMessage({
        actorIdentityId: owner,
        entry: { nodePeerId: peer },
        sourceOwnerIdentityId: sourceOwner,
      }),
    );

    expect(api.postApproval).toHaveBeenCalledWith(
      sourceOwner,
      {
        all: false,
        blockedIdentityIds: [],
        blockedNodePeerIds: [peer],
        version: 5,
      },
      expect.anything(),
    );
  });

  it('refuses to approve an entry the source does not list as pending', async () => {
    const { api, approver } = approverWith({
      blockedIdentityIds: [alice],
      blockedNodePeerIds: [],
      version: 5,
    });

    await expect(
      approver.approve(
        new ApprovePendingNodeBlockEntriesMessage({
          actorIdentityId: owner,
          entry: { identityId: bob },
          sourceOwnerIdentityId: sourceOwner,
        }),
      ),
    ).rejects.toThrow(NodeBlockSourceHasNothingPendingError);
    expect(api.postApproval).not.toHaveBeenCalled();
  });
});
