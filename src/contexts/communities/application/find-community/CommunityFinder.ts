import type { Community } from '../../domain/Community';
import type { CommunityRepository } from '../../domain/repositories/CommunityRepository';

import { FindCommunityMessage } from './messages/FindCommunityMessage';

export class CommunityFinder {
  public constructor(
    private readonly communityRepository: CommunityRepository,
  ) {}

  public async find(message: FindCommunityMessage): Promise<Community> {
    return await this.communityRepository.find(
      message.getCommunityId(),
      message.getActorIdentityId(),
    );
  }
}
