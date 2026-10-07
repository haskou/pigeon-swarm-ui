import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityOperationBody } from './CommunityOperationBody';
import type { CommunityOperationInput } from './CommunityOperationInput';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';

/**
 * Signs the `communityOperations` put every community mutation must carry.
 * The record id commits to the payload without its id, so the node can
 * rebuild it from the operation alone.
 */
export class CommunityOperationSigner {
  public constructor(private readonly mutations: PublicMutationSigner) {}

  public async sign(
    session: Session,
    input: CommunityOperationInput,
  ): Promise<CommunityOperationBody> {
    const parents = [...input.parents].sort();
    const body = {
      action: input.action,
      args: input.args,
      authorIdentityId: this.mutations.authorOf(session),
      communityId: input.communityId,
      createdAt: input.createdAt,
      networkId: input.networkId,
      parents,
      scopeType: 'community_operation',
    };
    const recordId = `community:${input.communityId}:op:${this.mutations.digestOfValue(body)}`;
    const mutation = await this.mutations.sign(
      session,
      {
        kind: 'put',
        payload: { ...body, id: recordId },
        recordId,
        store: 'communityOperations',
      },
      PublicMutationSigner.FIRST_POSITION,
    );

    return { createdAt: input.createdAt, mutation, parents };
  }
}
