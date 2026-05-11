import type { Session } from '../../domain/types';

import { ApiUrlBuilder } from '../http/ApiUrlBuilder';

type Clock = () => number;
type NonceFactory = () => string;

export class RequestSigner {
  public constructor(
    private readonly clock: Clock = () => Date.now(),
    private readonly nonceFactory: NonceFactory = () => crypto.randomUUID(),
  ) {}

  public async headers(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const timestamp = `${this.clock()}`;
    const nonce = this.nonceFactory();
    const signature = await session.encryptedKeyPair.sign(
      this.payload(method, path, timestamp, nonce, body),
      session.password,
    );

    return {
      'X-Identity-Id': session.identity.id,
      'X-Nonce': nonce,
      'X-Signature': signature.toString(),
      'X-Timestamp': timestamp,
    };
  }

  public payload(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body?: unknown,
  ): string {
    return [
      method.toUpperCase(),
      `/${ApiUrlBuilder.trimSlashes(path)}`,
      timestamp,
      nonce,
      this.bodyToString(body),
    ].join('\n');
  }

  private bodyToString(body?: unknown): string {
    if (body === undefined || body === null) {
      return '';
    }

    if (typeof body === 'string') {
      return body;
    }

    return JSON.stringify(body);
  }
}
