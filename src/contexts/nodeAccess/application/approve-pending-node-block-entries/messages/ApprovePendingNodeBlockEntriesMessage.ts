import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeAccessIdentityId } from '../../../domain/value-objects/NodeAccessIdentityId';
import { NodeBlockListVersion } from '../../../domain/value-objects/NodeBlockListVersion';
import { NodeBlockTarget } from '../../../domain/value-objects/NodeBlockTarget';

export class ApprovePendingNodeBlockEntriesMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      /** One entry to approve; without it every pending entry is approved. */
      entry?: { identityId?: string; nodePeerId?: string };
      sourceOwnerIdentityId: string;
      /** The pending version the node owner reviewed. */
      version: number;
    },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public getSourceOwnerIdentityId(): NodeAccessIdentityId {
    return NodeAccessIdentityId.fromString(this.input.sourceOwnerIdentityId);
  }

  /** The single entry to approve, or null to approve them all. */
  public getEntry(): NodeBlockTarget | null {
    return this.input.entry
      ? NodeBlockTarget.fromPrimitives(this.input.entry)
      : null;
  }

  public getVersion(): NodeBlockListVersion {
    return NodeBlockListVersion.fromNumber(this.input.version);
  }
}
