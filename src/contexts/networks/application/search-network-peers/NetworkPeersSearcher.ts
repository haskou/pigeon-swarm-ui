import type { NetworkPeer } from '../../domain/entities/NetworkPeer';
import type { NetworkPeerRepository } from '../../domain/repositories/NetworkPeerRepository';

export class NetworkPeersSearcher {
  public constructor(
    private readonly networkPeerRepository: NetworkPeerRepository,
  ) {}

  public async search(): Promise<NetworkPeer[]> {
    return await this.networkPeerRepository.search();
  }
}
