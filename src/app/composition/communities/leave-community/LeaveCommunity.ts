import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { LeaveCommunityResult } from '../create-community/LeaveCommunityResult';

import { PigeonCommunitiesGateway } from '../../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { ConversationKeychain as ConversationKeychainService } from '../../../../contexts/conversations/domain/ConversationKeychain';
import { PigeonIdentitiesGateway } from '../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

export class LeaveCommunity {
  public constructor(
    private readonly communities: PigeonCommunitiesGateway,
    private readonly identities: PigeonIdentitiesGateway,
  ) {}

  private isAlreadyApplied(caught: unknown): boolean {
    return (
      caught instanceof HttpJsonError &&
      (caught.code === 'CommunityMemberNotFoundError' ||
        caught.code === 'CommunityNotFoundError')
    );
  }

  public async leave(
    session: Session,
    communityId: string,
  ): Promise<LeaveCommunityResult> {
    let community: Community | null = null;

    try {
      community = await this.communities.leaveCommunity(session, communityId);
    } catch (caught) {
      if (!this.isAlreadyApplied(caught)) throw caught;
    }

    const published = await this.identities.publishKeychain(
      session,
      ConversationKeychainService.withoutCommunityEntry(
        session.keychain,
        communityId,
      ),
    );

    return {
      community,
      communityId,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }
}
