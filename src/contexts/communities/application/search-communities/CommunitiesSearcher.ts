import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { SearchCommunitiesMessage } from './messages/SearchCommunitiesMessage';

export class CommunitiesSearcher {
  public constructor(private readonly communities: CommunityRepository) {}

  public async search(message: SearchCommunitiesMessage): Promise<Community[]> {
    return await this.communities.search(message.getActorIdentityId());
  }
}
