import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { ListCommunitiesMessage } from '../list-communities/messages/listCommunitiesMessage';

export interface ListCommunitiesPort {
  list(message: ListCommunitiesMessage): Promise<Community[]>;
}
