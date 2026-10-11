import type { Session } from '../../domain/pigeonResources.types';

import { HttpJsonClient } from '../http/HttpJsonClient';
import { RequestSigner } from '../http/RequestSigner';
import { RealtimeConnectionUrl } from './RealtimeConnectionUrl';

const ticketsPath = '/realtime/v1/tickets';
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

export class RealtimeTicketIssuer {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly connection: RealtimeConnectionUrl,
  ) {}

  public async issue(session: Session): Promise<string> {
    const body = JSON.stringify({});
    const response = await this.http.request<{ ticket?: unknown } | null>(
      ticketsPath,
      {
        body,
        headers: await this.signer.headers(
          session,
          'POST',
          this.connection.path(ticketsPath),
          body,
        ),
        method: 'POST',
      },
    );
    const ticket = response?.ticket;

    if (typeof ticket !== 'string' || !base64UrlPattern.test(ticket)) {
      throw new Error('Realtime ticket response is invalid');
    }

    return ticket;
  }
}
