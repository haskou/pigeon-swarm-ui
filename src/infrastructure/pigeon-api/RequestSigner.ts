import { SHA256Hash, UUID } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type { Session } from '../../domain/types';

import { ApiUrlBuilder } from '../http/ApiUrlBuilder';

type Clock = () => number;
type NonceFactory = () => string;

export class RequestSigner {
  public constructor(
    private readonly clock: Clock = () => Date.now(),
    private readonly nonceFactory: NonceFactory = () =>
      UUID.generate().toString(),
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
    return JSON.stringify({
      bodyHash: this.bodyHash(body),
      method: method.toUpperCase(),
      nonce,
      path: ApiUrlBuilder.normalizePath(path.split('?')[0] ?? path),
      timestamp,
    });
  }

  private bodyHash(body?: unknown): string {
    if (body instanceof ArrayBuffer) {
      return SHA256Hash.from(Buffer.from(body)).toString();
    }

    if (ArrayBuffer.isView(body)) {
      return SHA256Hash.from(
        Buffer.from(body.buffer, body.byteOffset, body.byteLength),
      ).toString();
    }

    return SHA256Hash.from(this.bodyToString(body)).toString();
  }

  private bodyToString(body?: unknown): string {
    if (body === undefined || body === null) return JSON.stringify({});

    if (typeof body === 'string') return body;

    return JSON.stringify(body);
  }
}
