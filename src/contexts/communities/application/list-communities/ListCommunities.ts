import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { ListCommunitiesPort } from './ListCommunitiesPort';

import { ListCommunitiesMessage } from './messages/ListCommunitiesMessage';

export class ListCommunities {
  public constructor(private readonly communities: ListCommunitiesPort) {}

  public async list(message: ListCommunitiesMessage): Promise<Community[]> {
    return await this.communities.list(message);
  }
}
