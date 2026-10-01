import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { Session } from '../../domain/pigeonResources.types';
import type { Clock } from './Clock';

import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';
import { signSessionPayload } from '../crypto/signSessionPayload';
import { ApiUrlBuilder } from './ApiUrlBuilder';

export class RequestSigner {
  private readonly pathPrefix: string;

  public constructor(
    private readonly clock: Clock = () => Date.now(),
    pathPrefix = '',
  ) {
    this.pathPrefix = ApiUrlBuilder.normalizePrefix(pathPrefix);
  }

  private signablePath(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return ApiUrlBuilder.normalizePath(new URL(path).pathname);
    }

    return this.applyPathPrefix(
      ApiUrlBuilder.normalizePath(path.split(/[?#]/)[0] ?? path),
    );
  }

  private applyPathPrefix(path: string): string {
    if (!this.pathPrefix) return path;

    if (path === this.pathPrefix || path.startsWith(`${this.pathPrefix}/`)) {
      return path;
    }

    return `${this.pathPrefix}${path}`;
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
    return this.headersWithDeviceProof(session, method, path, body);
  }

  public async headersWithDeviceProof(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const request = await this.signedRequest(session, method, path, body);
    const credential = IdentityId.normalize(
      session.deviceCredentialKeyPair.toPrimitives().publicKey,
    );

    return {
      ...request.headers,
      'X-Device-Authorization-Epoch': session.authorizationEpoch.valueOf(),
      'X-Device-Authorization-Revision': `${session.authorizationRevision.valueOf()}`,
      'X-Device-Credential': credential,
      'X-Device-Signature': session.deviceCredentialKeyPair
        .sign(request.payload)
        .toString(),
    };
  }

  public async headersWithRecoveryProof(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const request = await this.signedRequest(session, method, path, body);

    return {
      ...request.headers,
      'X-Recovery-Signature': session.recoveryAuthorityKeyPair
        .sign(request.payload)
        .toString(),
    };
  }

  private async signedRequest(
    session: Session,
    method: string,
    path: string,
    body: unknown,
  ): Promise<{ headers: Record<string, string>; payload: string }> {
    const timestamp = this.clock();
    const payload = this.payload(method, path, timestamp, body);
    const signature = await signSessionPayload(session, payload);

    return {
      headers: {
        'X-Identity-Id': IdentityId.normalize(session.identity.id),
        'X-Signature': signature.toString(),
        'X-Timestamp': `${timestamp}`,
      },
      payload,
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
