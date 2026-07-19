import type { NetworkPeerResource } from '../resources/NetworkPeerResource';

import { NetworkPeer } from '../../../domain/entities/NetworkPeer';

export class NetworkPeerMapper {
  public toAggregate(resource: NetworkPeerResource): NetworkPeer {
    return NetworkPeer.fromPrimitives({
      ...resource,
      owner: resource.owner,
    });
  }

  public toResource(peer: NetworkPeer): NetworkPeerResource {
    return peer.toPrimitives();
  }
}
