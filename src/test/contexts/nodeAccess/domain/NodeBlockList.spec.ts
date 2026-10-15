import { Timestamp } from '@haskou/value-objects';

import { NodeBlockEntryAlreadyBlockedError } from '../../../../contexts/nodeAccess/domain/errors/NodeBlockEntryAlreadyBlockedError';
import { NodeBlockEntryNotBlockedError } from '../../../../contexts/nodeAccess/domain/errors/NodeBlockEntryNotBlockedError';
import { NodeOwnerIdentityCannotBeBlockedError } from '../../../../contexts/nodeAccess/domain/errors/NodeOwnerIdentityCannotBeBlockedError';
import { NodeBlockList } from '../../../../contexts/nodeAccess/domain/NodeBlockList';
import { NodeAccessIdentityId } from '../../../../contexts/nodeAccess/domain/value-objects/NodeAccessIdentityId';
import { NodeBlockTarget } from '../../../../contexts/nodeAccess/domain/value-objects/NodeBlockTarget';

const owner = 'T3duZXJLZXk=';
const previousOwner = 'UHJldmlvdXNPd25lcg==';
const alice = 'QWxpY2VLZXk=';
const bob = 'Qm9iS2V5';
const peerA = '12D3KooWAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const peerB = '12D3KooWBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const issuedAt = new Timestamp(1773848829055);

function stored(input: {
  blockedIdentityIds?: string[];
  ownerIdentityId?: string;
  version?: number;
}): NodeBlockList {
  return NodeBlockList.fromPrimitives({
    blockedIdentityIds: input.blockedIdentityIds ?? [],
    blockedNodePeerIds: [],
    issuedAt: 1,
    ownerIdentityId: input.ownerIdentityId ?? owner,
    version: input.version ?? 3,
  });
}

describe(NodeBlockList.name, () => {
  it('issues the first version when the node owner blocks on a node without a list', () => {
    const list = NodeBlockList.continuing(
      null,
      NodeAccessIdentityId.fromString(owner),
    );

    list.block(NodeBlockTarget.identity(alice), issuedAt);

    expect(list.toPrimitives()).toEqual({
      blockedIdentityIds: [alice],
      blockedNodePeerIds: [],
      issuedAt: issuedAt.valueOf(),
      ownerIdentityId: owner,
      version: 1,
    });
    expect(list.pullDomainEvents()).toHaveLength(1);
  });

  it('issues a higher version with entries sorted by code unit and unique', () => {
    const list = NodeBlockList.continuing(
      stored({ blockedIdentityIds: [bob] }),
      NodeAccessIdentityId.fromString(owner),
    );

    list.block(NodeBlockTarget.identity(alice), issuedAt);
    list.block(NodeBlockTarget.node(peerB), issuedAt);
    list.block(NodeBlockTarget.node(peerA), issuedAt);

    expect(list.toPrimitives()).toMatchObject({
      blockedIdentityIds: [alice, bob],
      blockedNodePeerIds: [peerA, peerB],
      version: 6,
    });
  });

  it('never blocks the node owner identity', () => {
    const list = NodeBlockList.continuing(
      null,
      NodeAccessIdentityId.fromString(owner),
    );

    expect(() =>
      list.block(
        NodeBlockTarget.identity(
          `-----BEGIN PUBLIC KEY-----\n${owner}\n-----END PUBLIC KEY-----`,
        ),
        issuedAt,
      ),
    ).toThrow(NodeOwnerIdentityCannotBeBlockedError);
    expect(list.toPrimitives().version).toBeNull();
  });

  it('refuses to issue a version that changes nothing', () => {
    const list = NodeBlockList.continuing(
      stored({ blockedIdentityIds: [alice] }),
      NodeAccessIdentityId.fromString(owner),
    );

    expect(() =>
      list.block(NodeBlockTarget.identity(alice), issuedAt),
    ).toThrow(NodeBlockEntryAlreadyBlockedError);
    expect(() => list.unblock(NodeBlockTarget.identity(bob), issuedAt)).toThrow(
      NodeBlockEntryNotBlockedError,
    );
  });

  it('removes an entry in a new version', () => {
    const list = NodeBlockList.continuing(
      stored({ blockedIdentityIds: [alice, bob] }),
      NodeAccessIdentityId.fromString(owner),
    );

    list.unblock(NodeBlockTarget.identity(alice), issuedAt);

    expect(list.toPrimitives()).toMatchObject({
      blockedIdentityIds: [bob],
      version: 4,
    });
  });

  it('adopts a previous owner list from the first version without the new owner', () => {
    const list = NodeBlockList.continuing(
      stored({
        blockedIdentityIds: [alice, owner],
        ownerIdentityId: previousOwner,
        version: 40,
      }),
      NodeAccessIdentityId.fromString(owner),
    );

    list.block(NodeBlockTarget.identity(bob), issuedAt);

    expect(list.toPrimitives()).toMatchObject({
      blockedIdentityIds: [alice, bob],
      ownerIdentityId: owner,
      version: 1,
    });
  });
});
