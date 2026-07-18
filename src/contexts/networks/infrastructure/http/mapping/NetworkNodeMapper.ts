import type { NodeInfo } from '../NodeInfo';

import { NetworkNode } from '../../../domain/NetworkNode';

export class NetworkNodeMapper {
  public toAggregate(resource: NodeInfo): NetworkNode {
    return NetworkNode.fromPrimitives({
      id: resource.id,
      ownerId: resource.owner ?? undefined,
      publicNetworkAttached: (resource.networkSummary?.publicCount ?? 0) > 0,
    });
  }
}
