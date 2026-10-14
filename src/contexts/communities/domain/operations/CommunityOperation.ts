import type { CommunityOperationPrimitives } from './CommunityOperationPrimitives';

/**
 * One signed change of a community, after the client checked its content
 * address and its author's identity signature. Whether the author was allowed
 * to make it is decided by the fold, never by the operation itself.
 */
export class CommunityOperation {
  public static readonly GENESIS = 'community_created';

  public static fromPrimitives(
    primitives: CommunityOperationPrimitives,
  ): CommunityOperation {
    return new CommunityOperation({
      ...primitives,
      parents: [...primitives.parents],
    });
  }

  private constructor(
    private readonly primitives: CommunityOperationPrimitives,
  ) {}

  public getAction(): string {
    return this.primitives.action;
  }

  public getArguments(): Readonly<Record<string, unknown>> {
    return this.primitives.args;
  }

  public getAuthorIdentityId(): string {
    return this.primitives.authorIdentityId;
  }

  public getCommunityId(): string {
    return this.primitives.communityId;
  }

  public getCreatedAt(): number {
    return this.primitives.createdAt;
  }

  public getHash(): string {
    return this.primitives.hash;
  }

  public getNetworkId(): string {
    return this.primitives.networkId;
  }

  public getParents(): readonly string[] {
    return this.primitives.parents;
  }

  public isGenesis(): boolean {
    return this.primitives.action === CommunityOperation.GENESIS;
  }
}
