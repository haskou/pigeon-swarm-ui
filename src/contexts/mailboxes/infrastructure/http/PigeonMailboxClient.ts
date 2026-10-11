import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { MailboxUnavailableError } from './MailboxUnavailableError';

export type MailboxCreation = {
  creationNonce: string;
  postTokenHash: string;
  readTokenHash: string;
};

export type MailboxEnvelopeAppend = {
  body: string;
  envelopeId: string;
};

export type MailboxPageEnvelope = {
  body: string;
  cursor: number;
  envelopeId: string;
};

export type MailboxPage = {
  envelopes: MailboxPageEnvelope[];
  hasMore: boolean;
};

/**
 * Wire client for the node mailbox routes. Capabilities travel only as bearer
 * tokens. A 404 means the mailbox does not exist on this node and maps to
 * MailboxUnavailableError; other statuses (400, 409, 429) propagate as HttpJsonError.
 */
export class PigeonMailboxClient {
  public constructor(private readonly http: Pick<HttpJsonClient, 'request'>) {}

  private static bearer(token: string): HeadersInit {
    return { Authorization: `Bearer ${token}` };
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error: unknown) {
      if (error instanceof HttpJsonError && error.status === 404) {
        throw new MailboxUnavailableError();
      }

      throw error;
    }
  }

  public async create(
    mailboxId: string,
    creation: MailboxCreation,
  ): Promise<void> {
    await this.call(() =>
      this.http.request<void>(`/mailboxes/${mailboxId}`, {
        body: JSON.stringify(creation),
        method: 'PUT',
      }),
    );
  }

  public async append(
    mailboxId: string,
    postToken: string,
    envelope: MailboxEnvelopeAppend,
  ): Promise<{ cursor: number }> {
    return this.call(() =>
      this.http.request<{ cursor: number }>(
        `/mailboxes/${mailboxId}/envelopes`,
        {
          body: JSON.stringify(envelope),
          headers: PigeonMailboxClient.bearer(postToken),
          method: 'POST',
        },
      ),
    );
  }

  public async read(
    mailboxId: string,
    readToken: string,
    after: number,
    limit: number,
  ): Promise<MailboxPage> {
    const query = new URLSearchParams({
      after: String(after),
      limit: String(limit),
    });

    return this.call(() =>
      this.http.request<MailboxPage>(
        `/mailboxes/${mailboxId}/envelopes?${query.toString()}`,
        { headers: PigeonMailboxClient.bearer(readToken) },
      ),
    );
  }

  public async acknowledge(
    mailboxId: string,
    readToken: string,
    upTo: number,
  ): Promise<void> {
    await this.call(() =>
      this.http.request<void>(`/mailboxes/${mailboxId}/ack`, {
        body: JSON.stringify({ upTo }),
        headers: PigeonMailboxClient.bearer(readToken),
        method: 'POST',
      }),
    );
  }
}
