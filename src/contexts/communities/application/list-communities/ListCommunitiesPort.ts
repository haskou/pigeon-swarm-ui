import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { ListCommunitiesMessage } from './messages/ListCommunitiesMessage';

export interface ListCommunitiesPort {
  list(message: ListCommunitiesMessage): Promise<Community[]>;
}
