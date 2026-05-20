import { SHA256Hash, UUID } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type { Session } from '../../domain/pigeonResources.types';

import { API_SERVER_URL } from '../../../app/API_SERVER_URL';
import { IdentityId } from '../../../modules/identities/domain/value-objects/IdentityId';
import { ApiUrlBuilder } from './ApiUrlBuilder';

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
      'X-Identity-Id': IdentityId.normalize(session.identity.id),
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
      path: this.signablePath(path),
      timestamp,
    });
  }

  private signablePath(path: string): string {
    const requestPath = ApiUrlBuilder.normalizePath(path.split('?')[0] ?? path);
    const routePrefix = this.routePrefix();

    if (
      routePrefix === '/' ||
      requestPath === routePrefix ||
      requestPath.startsWith(`${routePrefix}/`)
    ) {
      return requestPath;
    }

    return `${routePrefix}${requestPath}`;
  }

  private routePrefix(): string {
    if (!API_SERVER_URL) return '/';

    if (/^https?:\/\//i.test(API_SERVER_URL)) {
      const pathname = new URL(API_SERVER_URL).pathname;

      return ApiUrlBuilder.normalizePath(ApiUrlBuilder.trimSlashes(pathname));
    }

    return ApiUrlBuilder.normalizePath(
      ApiUrlBuilder.trimSlashes(API_SERVER_URL),
    );
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
