import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityModerationLogBody } from './CommunityModerationLogBody';
import type { CommunityModerationLogInput } from './CommunityModerationLogInput';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { deriveModerationLogId } from './deriveCommunityRecordId';

/** Signs the `moderationLogs` put that accompanies a moderation action. */
export class CommunityModerationLogSigner {
  private readonly mutations = new PublicMutationSigner();

  public sign(
    session: Session,
    input: CommunityModerationLogInput,
  ): CommunityModerationLogBody {
    const actorIdentityId = this.mutations.authorOf(session);
    const id = deriveModerationLogId(
      input.communityId,
      actorIdentityId,
      input.action,
      input.target.type,
      input.target.id,
      input.createdAt,
    );
    const details = Object.fromEntries(
      Object.entries(input.details).filter(([, value]) => value !== undefined),
    );
    const mutation = this.mutations.sign(
      session,
      {
        kind: 'put',
        payload: {
          action: input.action,
          actorIdentityId,
          communityId: input.communityId,
          createdAt: input.createdAt,
          details,
          id,
          scopeType: 'community_moderation_log',
          target: { id: input.target.id, type: input.target.type },
        },
        recordId: id,
        store: 'moderationLogs',
      },
      PublicMutationSigner.FIRST_POSITION,
    );

    return { createdAt: input.createdAt, mutation };
  }
}
