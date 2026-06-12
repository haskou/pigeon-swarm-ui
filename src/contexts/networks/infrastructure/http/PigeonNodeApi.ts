import { PrivateKey, UUID } from '@haskou/value-objects';

import type {
  IpfsReplicationStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { NodeNetwork } from '../../application/list-node-networks/NodeNetwork';
import type { Peer } from '../../application/list-peers/ListPeers';
import type { NodeInfo } from './NodeInfo';

export class PigeonNodeApi {
  private readonly requestCache = new Map<string, Promise<unknown>>();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
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

  private invalidateNetworksCache(): void {
    for (const key of this.requestCache.keys()) {
      if (key.startsWith('GET /node/networks/')) this.requestCache.delete(key);
    }
  }

  public async getInfo(): Promise<NodeInfo & { owner: string | null }> {
    const info = await this.http.request<NodeInfo>('/node/');

    return { ...info, owner: info.owner ?? null };
  }

  public async claim(session: Session): Promise<void> {
    const path = '/node/owner';
    const body = { identityId: session.identity.id };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }

  public async getNetworks(session?: Session): Promise<NodeNetwork[]> {
    const path = '/node/networks/';
    const result = await this.cachedRequest(
      `GET ${path} ${session?.identity.id ?? 'anonymous'}`,
      async () =>
        await this.http.request<{
          networks: NodeNetwork[];
        }>(path, {
          headers: session
            ? await this.signer.headers(session, 'GET', path)
            : undefined,
          method: 'GET',
        }),
    );

    return result.networks;
  }

  public async getPeers(): Promise<Peer[]> {
    const result = await this.http.request<{ peers: Peer[] }>('/peers/');

    return result.peers;
  }

  public async createNetwork(name: string, session?: Session): Promise<void> {
    const path = '/node/networks/';
    const body = {
      id: UUID.generate().toString(),
      key: PrivateKey.generate().toString(),
      name,
    };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: session
        ? await this.signer.headers(session, 'POST', path, body)
        : undefined,
      method: 'POST',
    });
    this.invalidateNetworksCache();
  }

  public async createPublicNetwork(session?: Session): Promise<void> {
    const path = '/node/networks/public/';

    await this.http.request(path, {
      headers: session
        ? await this.signer.headers(session, 'POST', path)
        : undefined,
      method: 'POST',
    });
    this.invalidateNetworksCache();
  }

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
    session?: Session,
  ): Promise<void> {
    const path = '/node/networks/';
    const body = { id, key, name };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: session
        ? await this.signer.headers(session, 'POST', path, body)
        : undefined,
      method: 'POST',
    });
    this.invalidateNetworksCache();
  }

  public async removeNetwork(
    networkId: string,
    session?: Session,
  ): Promise<NodeNetwork[]> {
    const path = `/node/networks/${encodeURIComponent(networkId)}/`;
    const body = {};
    const result = await this.http.request<{ networks: NodeNetwork[] }>(path, {
      headers: session
        ? await this.signer.headers(session, 'DELETE', path, body)
        : undefined,
      method: 'DELETE',
    });

    this.invalidateNetworksCache();

    return result.networks;
  }

  public async getIpfsReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    const path = '/ipfs/replication/status';
    const body = {};

    return await this.http.request<IpfsReplicationStatus>(path, {
      headers: await this.signer.headers(session, 'GET', path, body),
      method: 'GET',
    });
  }
}
