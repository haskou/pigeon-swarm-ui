import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { LeaveCommunityResult } from '../create-community/LeaveCommunityResult';
import type { CommunityKeychainPort } from '../publish-community-keychain/CommunityKeychainPort';
import type { LeaveCommunityPort } from './LeaveCommunityPort';
import type { LeaveCommunityMessage } from './messages/LeaveCommunityMessage';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { ConversationKeychain as ConversationKeychainService } from '../../../conversations/domain/ConversationKeychain';

export class LeaveCommunity {
  public constructor(
    private readonly membership: LeaveCommunityPort,
    private readonly keychain: CommunityKeychainPort,
  ) {}

  private isAlreadyApplied(caught: unknown): boolean {
    return (
      caught instanceof HttpJsonError &&
      (caught.code === 'CommunityMemberNotFoundError' ||
        caught.code === 'CommunityNotFoundError')
    );
  }

  public async leave(
    message: LeaveCommunityMessage,
  ): Promise<LeaveCommunityResult> {
    const session = message.getSession();
    const communityId = message.getCommunityId();
    let community: Community | null = null;

    try {
      community = await this.membership.leaveCommunity(session, communityId);
    } catch (caught) {
      if (!this.isAlreadyApplied(caught)) throw caught;
    }

    const published = await this.keychain.publishKeychain(
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
