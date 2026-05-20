import type { Peer } from '../../application/peers/ListPeers';
import type { IpfsReplicationStatus, Session } from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

export class PigeonNodeApi {
  private readonly requestCache = new Map<string, Promise<unknown>>();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async getInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.cachedRequest('GET /node/', () =>
      this.http.request<{ id: string; owner: string | null }>('/node/'),
    );
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

  public async getNetworks(
    session?: Session,
  ): Promise<{ id: string; key?: null | string; name: string }[]> {
    const path = '/node/networks/';
    const result = await this.cachedRequest(
      `GET ${path} ${session?.identity.id ?? 'anonymous'}`,
      async () =>
        await this.http.request<{
          networks: { id: string; key?: null | string; name: string }[];
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
    const result = await this.cachedRequest('GET /peers/', () =>
      this.http.request<{ peers: Peer[] }>('/peers/'),
    );

    return result.peers;
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
}
