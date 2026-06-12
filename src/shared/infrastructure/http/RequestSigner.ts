import { SHA256Hash } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type { Session } from '../../domain/pigeonResources.types';
import type { Clock } from './Clock';

import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';
import { signSessionPayload } from '../crypto/signSessionPayload';
import { ApiUrlBuilder } from './ApiUrlBuilder';

export class RequestSigner {
  public constructor(private readonly clock: Clock = () => Date.now()) {}

  private signablePath(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return ApiUrlBuilder.normalizePath(new URL(path).pathname);
    }

    return ApiUrlBuilder.normalizePath(path.split(/[?#]/)[0] ?? path);
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

  public async headers(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const timestamp = this.clock();
    const signature = await signSessionPayload(
      session,
      this.payload(method, path, timestamp, body),
    );

    return {
      'X-Identity-Id': IdentityId.normalize(session.identity.id),
      'X-Signature': signature.toString(),
      'X-Timestamp': `${timestamp}`,
    };
  }

  public payload(
    method: string,
    path: string,
    timestamp: number,
    body?: unknown,
  ): string {
    return JSON.stringify({
      bodyHash: this.bodyHash(body),
      method: method.toUpperCase(),
      path: this.signablePath(path),
      timestamp,
    });
  }
}
