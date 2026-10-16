import type { NodeBlockSource } from '../NodeBlockSource';
import type { PendingNodeBlockEntries } from '../PendingNodeBlockEntries';
import type { NodeAccessActorId } from '../value-objects/NodeAccessActorId';
import type { NodeAccessIdentityId } from '../value-objects/NodeAccessIdentityId';
import type { NodeBlockApproval } from '../value-objects/NodeBlockApproval';

export interface NodeBlockSourceRepository {
  approve(
    sourceOwnerIdentityId: NodeAccessIdentityId,
    approval: NodeBlockApproval,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockSource>;
  findPending(
    sourceOwnerIdentityId: NodeAccessIdentityId,
    actorId: NodeAccessActorId,
  ): Promise<PendingNodeBlockEntries>;
  remove(
    sourceOwnerIdentityId: NodeAccessIdentityId,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockSource[]>;
  save(
    source: NodeBlockSource,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockSource>;
  search(actorId: NodeAccessActorId): Promise<NodeBlockSource[]>;
}
