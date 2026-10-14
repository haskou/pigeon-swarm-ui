import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CommunityOperationBody } from './CommunityOperationBody';
import type { CommunityOperationInput } from './CommunityOperationInput';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { CommunityOperationProof } from './CommunityOperationProof';

/**
 * Signs the `communityOperations` put every community mutation must carry.
 * The author's identity key signs the operation, so members can replay it
 * back to the community's creator; the device credential signs the put that
 * stores it.
 */
export class CommunityOperationSigner {
  public constructor(private readonly mutations: PublicMutationSigner) {}

  public async sign(
    session: Session,
    input: CommunityOperationInput,
  ): Promise<CommunityOperationBody> {
    const document = CommunityOperationProof.seal(
      {
        action: input.action,
        args: input.args,
        authorIdentityId: this.mutations.authorOf(session),
        communityId: input.communityId,
        createdAt: input.createdAt,
        networkId: input.networkId,
        parents: [...input.parents].sort(),
        scopeType: 'community_operation',
      },
      session.keyPair,
    );
    const mutation = await this.mutations.sign(
      session,
      {
        kind: 'put',
        payload: { ...document },
        recordId: document.id,
        store: 'communityOperations',
      },
      PublicMutationSigner.FIRST_POSITION,
    );

    return {
      createdAt: input.createdAt,
      identitySignature: document.identitySignature,
      mutation,
      parents: document.parents,
    };
  }
}
