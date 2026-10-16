import { type MockProxy, mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { NodeAccessSessions } from '../../../../../contexts/nodeAccess/infrastructure/http/repositories/NodeAccessSessions';
import type { NodeBlockSourceResource } from '../../../../../contexts/nodeAccess/infrastructure/http/resources/NodeAccessResources';

import { ApprovePendingNodeBlockEntriesMessage } from '../../../../../contexts/nodeAccess/application/approve-pending-node-block-entries/messages/ApprovePendingNodeBlockEntriesMessage';
import { PendingNodeBlockEntriesApprover } from '../../../../../contexts/nodeAccess/application/approve-pending-node-block-entries/PendingNodeBlockEntriesApprover';
import { PigeonNodeAccessApi } from '../../../../../contexts/nodeAccess/infrastructure/http/PigeonNodeAccessApi';
import { PigeonNodeBlockSourceRepository } from '../../../../../contexts/nodeAccess/infrastructure/http/repositories/PigeonNodeBlockSourceRepository';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const owner = 'T3duZXJLZXk=';
const sourceOwner = 'U291cmNlT3duZXI=';
const alice = 'QWxpY2VLZXk=';
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

function approverWith(): {
  api: MockProxy<PigeonNodeAccessApi>;
  approver: PendingNodeBlockEntriesApprover;
} {
  const api = mock<PigeonNodeAccessApi>();
  const sessions = mock<NodeAccessSessions>();
  sessions.find.mockReturnValue({} as Session);
  api.postApproval.mockResolvedValue(source());

  return {
    api,
    approver: new PendingNodeBlockEntriesApprover(
      new PigeonNodeBlockSourceRepository(api, sessions),
    ),
  };
}

describe(PendingNodeBlockEntriesApprover.name, () => {
  it('approves every pending entry of the version the owner reviewed', async () => {
    const { api, approver } = approverWith();

    await approver.approve(
      new ApprovePendingNodeBlockEntriesMessage({
        actorIdentityId: owner,
        sourceOwnerIdentityId: sourceOwner,
        version: 4,
      }),
    );

    expect(api.postApproval).toHaveBeenCalledWith(
      sourceOwner,
      { all: true, version: 4 },
      expect.anything(),
    );
  });

  it('approves one pending entry of the version the owner reviewed', async () => {
    const { api, approver } = approverWith();

    await approver.approve(
      new ApprovePendingNodeBlockEntriesMessage({
        actorIdentityId: owner,
        entry: { nodePeerId: peer },
        sourceOwnerIdentityId: sourceOwner,
        version: 4,
      }),
    );

    expect(api.postApproval).toHaveBeenCalledWith(
      sourceOwner,
      {
        all: false,
        blockedIdentityIds: [],
        blockedNodePeerIds: [peer],
        version: 4,
      },
      expect.anything(),
    );
  });

  it('never swaps the reviewed version for a newer pending one', async () => {
    const { api, approver } = approverWith();

    await approver.approve(
      new ApprovePendingNodeBlockEntriesMessage({
        actorIdentityId: owner,
        entry: { identityId: alice },
        sourceOwnerIdentityId: sourceOwner,
        version: 4,
      }),
    );

    expect(api.getPendingEntries).not.toHaveBeenCalled();
  });

  it('lets a stale version refusal reach the caller', async () => {
    const { api, approver } = approverWith();
    const stale = new HttpJsonError(
      409,
      'Conflict',
      JSON.stringify({ code: 'NodeBlockSourceVersionHasChangedError' }),
    );
    api.postApproval.mockRejectedValue(stale);

    await expect(
      approver.approve(
        new ApprovePendingNodeBlockEntriesMessage({
          actorIdentityId: owner,
          sourceOwnerIdentityId: sourceOwner,
          version: 4,
        }),
      ),
    ).rejects.toBe(stale);
  });
});
