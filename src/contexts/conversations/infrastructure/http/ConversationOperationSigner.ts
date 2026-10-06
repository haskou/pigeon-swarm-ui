import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { ConversationOperationBody } from './ConversationOperationBody';
import type { ConversationOperationInput } from './ConversationOperationInput';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';

/**
 * Signs the `conversationOperations` put every conversation mutation must
 * carry. The record id commits to the payload without its id, so the node can
 * rebuild it from the operation alone.
 */
export class ConversationOperationSigner {
  private readonly mutations = new PublicMutationSigner();

  public sign(
    session: Session,
    input: ConversationOperationInput,
  ): ConversationOperationBody {
    const parents = [...input.parents].sort();
    const body = {
      action: input.action,
      args: input.args,
      authorIdentityId: this.mutations.authorOf(session),
      conversationId: input.conversationId,
      createdAt: input.createdAt,
      networkId: input.networkId,
      parents,
      scopeType: 'conversation_operation',
    };
    const recordId = `conversation:${input.conversationId}:op:${this.mutations.digestOfValue(body)}`;
    const mutation = this.mutations.sign(
      session,
      {
        kind: 'put',
        payload: { ...body, id: recordId },
        recordId,
        store: 'conversationOperations',
      },
      PublicMutationSigner.FIRST_POSITION,
    );

    return { createdAt: input.createdAt, mutation, parents };
  }
}
