import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CommunityId } from './CommunityId';
import { CommunityIdentityId } from './CommunityIdentityId';
import { CommunityNetworkId } from './CommunityNetworkId';

export class CommunityMetadata {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityMetadata>,
  ): CommunityMetadata {
    return new CommunityMetadata(
      CommunityId.fromString(primitives.id),
      CommunityIdentityId.fromString(primitives.ownerIdentityId),
      CommunityNetworkId.fromString(primitives.networkId),
      new Timestamp(primitives.createdAt),
    );
  }

  private constructor(
    private readonly id: CommunityId,
    private readonly ownerIdentityId: CommunityIdentityId,
    private readonly networkId: CommunityNetworkId,
    private readonly createdAt: Timestamp,
  ) {}

  public getId(): CommunityId {
    return this.id;
  }

  public isOwnedBy(identityId: CommunityIdentityId): boolean {
    return this.ownerIdentityId.isEqual(identityId);
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt.valueOf(),
      id: this.id.toString(),
      networkId: this.networkId.toString(),
      ownerIdentityId: this.ownerIdentityId.toString(),
    };
  }
}
