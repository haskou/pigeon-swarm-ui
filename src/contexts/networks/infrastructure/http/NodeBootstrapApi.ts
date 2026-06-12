import type { NodeNetwork } from '../../application/list-node-networks/NodeNetwork';
import type { Peer } from '../../application/list-peers/ListPeers';
import type { NodeInfo } from './NodeInfo';

import { API_SERVER_URL } from '../../../../app/API_SERVER_URL';
import { ApiUrlBuilder } from '../../../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';

export class NodeBootstrapApi {
  private readonly requestCache = new Map<string, Promise<unknown>>();

  public constructor(
    private readonly http = new HttpJsonClient(
      new ApiUrlBuilder(API_SERVER_URL),
    ),
  ) {}

  private async cachedRequest<T>(
    key: string,
    requestFactory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.requestCache.get(key) as Promise<T> | undefined;

    if (cached) return await cached;

    const request = requestFactory().catch((caught: unknown) => {
      this.requestCache.delete(key);

      throw caught;
    });

    this.requestCache.set(key, request);

    return await request;
  }

  public async getInfo(): Promise<NodeInfo & { owner: string | null }> {
    const info = await this.http.request<NodeInfo>('/node/');

    return { ...info, owner: info.owner ?? null };
  }

  public async getNetworks(): Promise<NodeNetwork[]> {
    const result = await this.cachedRequest(
      'GET /node/networks/ anonymous',
      () =>
        this.http.request<{ networks: NodeNetwork[] }>('/node/networks/', {
          method: 'GET',
        }),
    );

    return result.networks;
  }

  public async getPeers(): Promise<Peer[]> {
    const result = await this.http.request<{ peers: Peer[] }>('/peers/');

    return result.peers;
  }
}
