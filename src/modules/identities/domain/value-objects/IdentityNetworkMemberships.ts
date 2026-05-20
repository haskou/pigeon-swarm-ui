import { IdentityNetworkId } from './IdentityNetworkId';

export class IdentityNetworkMemberships {
  // prettier-ignore
  private constructor(private readonly networkIds: IdentityNetworkId[]) {
  }

  public static fromPrimitives(
    networkIds: string[],
  ): IdentityNetworkMemberships {
    return new IdentityNetworkMemberships(
      networkIds.reduce<IdentityNetworkId[]>((uniqueNetworkIds, networkId) => {
        const candidate = IdentityNetworkId.fromString(networkId);

        if (
          uniqueNetworkIds.some((existingNetworkId) =>
            existingNetworkId.isEqual(candidate),
          )
        ) {
          return uniqueNetworkIds;
        }

        return [...uniqueNetworkIds, candidate];
      }, []),
    );
  }

  public add(networkId: IdentityNetworkId): IdentityNetworkMemberships {
    if (this.has(networkId)) return this;

    return new IdentityNetworkMemberships([...this.networkIds, networkId]);
  }

  public has(networkId: IdentityNetworkId): boolean {
    return this.networkIds.some((candidate) => candidate.isEqual(networkId));
  }

  public toPrimitives(): string[] {
    return this.networkIds.map((networkId) => networkId.toString());
  }
}
