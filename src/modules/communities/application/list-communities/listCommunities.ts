import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { ListCommunitiesPort } from '../ports/listCommunitiesPort';

import { ListCommunitiesMessage } from './messages/listCommunitiesMessage';

export class ListCommunities {
  public constructor(private readonly communities: ListCommunitiesPort) {}

  public async list(message: ListCommunitiesMessage): Promise<Community[]> {
    return await this.communities.list(message);
  }
}
