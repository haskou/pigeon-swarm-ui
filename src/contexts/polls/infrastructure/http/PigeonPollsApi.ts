import type {
  CreatePollInput,
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

export class PigeonPollsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async create(
    session: Session,
    input: CreatePollInput,
  ): Promise<PollResource> {
    const path = '/polls/';
    const body = input;

    return await this.http.request<PollResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async get(session: Session, pollId: string): Promise<PollResource> {
    const path = `/polls/${encodeURIComponent(pollId)}`;

    return await this.http.request<PollResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async vote(
    session: Session,
    pollId: string,
    optionIds: string[],
  ): Promise<PollResource> {
    const path = `/polls/${encodeURIComponent(pollId)}/votes`;
    const body = { optionIds };

    return await this.http.request<PollResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async removeVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    const path = `/polls/${encodeURIComponent(pollId)}/votes/me`;

    return await this.http.request<PollResource>(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async close(session: Session, pollId: string): Promise<PollResource> {
    const path = `/polls/${encodeURIComponent(pollId)}/close`;
    const body = {};

    return await this.http.request<PollResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }
}
