import type { NodeBlockSourceRepository } from '../../../domain/repositories/NodeBlockSourceRepository';
import type { NodeAccessIdentityId } from '../../../domain/value-objects/NodeAccessIdentityId';
import type { NodeBlockApproval } from '../../../domain/value-objects/NodeBlockApproval';
import type { NodeBlockApprovalResource } from '../resources/NodeAccessResources';
import type { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import type { PigeonNodeAccessApi } from '../PigeonNodeAccessApi';
import type { NodeAccessSessions } from './NodeAccessSessions';

import { NodeBlockSource } from '../../../domain/NodeBlockSource';
import { PendingNodeBlockEntries } from '../../../domain/PendingNodeBlockEntries';

// eslint-disable-next-line max-len
export class PigeonNodeBlockSourceRepository implements NodeBlockSourceRepository {
  public constructor(
    private readonly api: PigeonNodeAccessApi,
    private readonly sessions: NodeAccessSessions,
  ) {}

  private static approvalResource(
    approval: NodeBlockApproval,
  ): NodeBlockApprovalResource {
    const { all, identityIds, nodePeerIds, version } = approval.toPrimitives();

    return all
      ? { all, version }
      : {
          all,
          blockedIdentityIds: identityIds,
          blockedNodePeerIds: nodePeerIds,
          version,
        };
  }

  public async approve(
    sourceOwnerIdentityId: NodeAccessIdentityId,
    approval: NodeBlockApproval,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockSource> {
    return NodeBlockSource.fromPrimitives(
      await this.api.postApproval(
        sourceOwnerIdentityId.valueOf(),
        PigeonNodeBlockSourceRepository.approvalResource(approval),
        this.sessions.find(actorId),
      ),
    );
  }

  public async findPending(
    sourceOwnerIdentityId: NodeAccessIdentityId,
    actorId: NodeAccessActorId,
  ): Promise<PendingNodeBlockEntries> {
    return PendingNodeBlockEntries.fromPrimitives(
      await this.api.getPendingEntries(
        sourceOwnerIdentityId.valueOf(),
        this.sessions.find(actorId),
      ),
    );
  }

  public async remove(
    sourceOwnerIdentityId: NodeAccessIdentityId,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockSource[]> {
    const sources = await this.api.deleteSource(
      sourceOwnerIdentityId.valueOf(),
      this.sessions.find(actorId),
    );

    return sources.map((source) => NodeBlockSource.fromPrimitives(source));
  }

  public async save(
    source: NodeBlockSource,
    actorId: NodeAccessActorId,
  ): Promise<NodeBlockSource> {
    const { autoApply, origin, ownerIdentityId } = source.toPrimitives();
    const stored = await this.api.putSource(
      ownerIdentityId,
      { autoApply, origin },
      this.sessions.find(actorId),
    );
    source.pullDomainEvents();

    return NodeBlockSource.fromPrimitives(stored);
  }

  public async search(actorId: NodeAccessActorId): Promise<NodeBlockSource[]> {
    const sources = await this.api.getSources(this.sessions.find(actorId));

    return sources.map((source) => NodeBlockSource.fromPrimitives(source));
  }
}
