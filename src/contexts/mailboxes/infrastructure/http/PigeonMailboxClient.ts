import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { MailboxCreationDifficultyError } from './MailboxCreationDifficultyError';
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

export type MailboxReader = {
  ackedCursor: number;
  readTokenHash: string;
};

export type MailboxReaderSet = {
  maxReaders: number;
  readers: MailboxReader[];
};

/**
 * Wire client for the node mailbox routes. Capabilities travel only as bearer
 * tokens. A 404 means the mailbox does not exist on this node and maps to
 * MailboxUnavailableError. A 400 on create that names `requiredDifficultyBits`
 * maps to MailboxCreationDifficultyError. Other statuses (400, 409, 429)
 * propagate as HttpJsonError.
 */
export class PigeonMailboxClient {
  /**
   * The node's 400 body names the difficulty a creation proof must meet. Only
   * a positive safe integer counts; any other 400 propagates unchanged.
   */
  private static requiredDifficultyBits(error: unknown): number | undefined {
    if (!(error instanceof HttpJsonError) || error.status !== 400) {
      return undefined;
    }

    try {
      const body = JSON.parse(error.bodyText) as {
        requiredDifficultyBits?: unknown;
      } | null;
      const bits = body?.requiredDifficultyBits;

      return typeof bits === 'number' && Number.isSafeInteger(bits) && bits > 0
        ? bits
        : undefined;
    } catch {
      return undefined;
    }
  }

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
    try {
      await this.call(() =>
        this.http.request<void>(`/mailboxes/${mailboxId}`, {
          body: JSON.stringify(creation),
          method: 'PUT',
        }),
      );
    } catch (error: unknown) {
      const requiredDifficultyBits =
        PigeonMailboxClient.requiredDifficultyBits(error);

      if (requiredDifficultyBits === undefined) {
        throw error;
      }

      throw new MailboxCreationDifficultyError(requiredDifficultyBits);
    }
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

  public async readers(
    mailboxId: string,
    token: string,
  ): Promise<MailboxReaderSet> {
    return this.call(() =>
      this.http.request<MailboxReaderSet>(`/mailboxes/${mailboxId}/readers`, {
        headers: PigeonMailboxClient.bearer(token),
      }),
    );
  }

  public async addReader(
    mailboxId: string,
    token: string,
    readTokenHash: string,
  ): Promise<void> {
    await this.call(() =>
      this.http.request<void>(`/mailboxes/${mailboxId}/readers`, {
        body: JSON.stringify({ readTokenHash }),
        headers: PigeonMailboxClient.bearer(token),
        method: 'POST',
      }),
    );
  }

  public async removeReader(
    mailboxId: string,
    token: string,
    readTokenHash: string,
  ): Promise<void> {
    await this.call(() =>
      this.http.request<void>(
        `/mailboxes/${mailboxId}/readers/${readTokenHash}`,
        {
          headers: PigeonMailboxClient.bearer(token),
          method: 'DELETE',
        },
      ),
    );
  }
}
