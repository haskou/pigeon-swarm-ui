import type { Network } from '../../../domain/aggregates/Network';
import type { NetworkResource } from '../resources/NetworkResource';

import { Network as NetworkAggregate } from '../../../domain/aggregates/Network';

export class NetworkMapper {
  public toAggregate(resource: NetworkResource): Network {
    return NetworkAggregate.fromPrimitives({
      id: resource.id,
      key: resource.key ?? undefined,
      name: resource.name,
      status: 'attached',
    });
  }

  public toResource(network: Network): NetworkResource {
    const primitives = network.toPrimitives();

    return {
      id: primitives.id,
      key: primitives.key,
      name: primitives.name,
    };
  }
}
