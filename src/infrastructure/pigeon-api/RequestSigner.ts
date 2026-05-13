import { SHA256Hash } from '@haskou/value-objects';
import { Buffer } from 'buffer';

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
      await this.asyncPayload(method, path, timestamp, nonce, body),
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

  private async asyncPayload(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body?: unknown,
  ): Promise<string> {
    return JSON.stringify({
      bodyHash: await this.asyncBodyHash(body),
      method: method.toUpperCase(),
      nonce,
      path: ApiUrlBuilder.normalizePath(path.split('?')[0] ?? path),
      timestamp,
    });
  }

  private async asyncBodyHash(body?: unknown): Promise<string> {
    if (body instanceof ArrayBuffer) {
      return await this.sha256Hex(body);
    }

    if (ArrayBuffer.isView(body)) {
      const bytes = new Uint8Array(
        body.buffer,
        body.byteOffset,
        body.byteLength,
      );
      const copy = new Uint8Array(bytes.byteLength);

      copy.set(bytes);

      return await this.sha256Hex(copy.buffer);
    }

    return this.bodyHash(body);
  }

  private async sha256Hex(body: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', body);

    return [...new Uint8Array(hash)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
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
