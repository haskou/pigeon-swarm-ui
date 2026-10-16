import type {
  KeyPair,
  SignedHttpRequest,
  SignedHttpRequestBody,
} from '@haskou/pigeon-swarm-crypto';

import {
  PrivateKey,
  SignedHttpRequestSignature,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { Clock } from './Clock';

import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';
import { ApiUrlBuilder } from './ApiUrlBuilder';

export class RequestSigner {
  private readonly pathPrefix: string;

  public constructor(
    private readonly clock: Clock = () => Date.now(),
    pathPrefix = '',
  ) {
    this.pathPrefix = ApiUrlBuilder.normalizePrefix(pathPrefix);
  }

  private static sign(request: SignedHttpRequest, keyPair: KeyPair): string {
    return SignedHttpRequestSignature.sign(
      request,
      new PrivateKey(keyPair.toPrimitives().privateKey),
    ).toString();
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

  /** Raw upload bytes are signed as bytes; anything else as its JSON. */
  private signableBody(body?: unknown): SignedHttpRequestBody {
    if (body instanceof ArrayBuffer) return new Uint8Array(body);

    if (ArrayBuffer.isView(body)) {
      return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    }

    return body as SignedHttpRequestBody;
  }

  private request(
    method: string,
    path: string,
    timestamp: number,
    body?: unknown,
  ): SignedHttpRequest {
    return {
      body: this.signableBody(body),
      method: method.toUpperCase(),
      path: this.signablePath(path),
      timestamp,
    };
  }

  private signedRequest(
    session: Session,
    method: string,
    path: string,
    body: unknown,
  ): { headers: Record<string, string>; request: SignedHttpRequest } {
    const timestamp = this.clock();
    const request = this.request(method, path, timestamp, body);

    return {
      headers: {
        'X-Identity-Id': IdentityId.normalize(session.identity.id),
        'X-Signature': RequestSigner.sign(request, session.keyPair),
        'X-Timestamp': `${timestamp}`,
      },
      request,
    };
  }

  public async headers(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, string>> {
    return this.headersWithDeviceProof(session, method, path, body);
  }

  public headersWithDeviceProof(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const { headers, request } = this.signedRequest(
      session,
      method,
      path,
      body,
    );
    const credential = IdentityId.normalize(
      session.deviceCredentialKeyPair.toPrimitives().publicKey,
    );

    return Promise.resolve({
      ...headers,
      'X-Device-Authorization-Epoch': session.authorizationEpoch.valueOf(),
      'X-Device-Authorization-Revision': `${session.authorizationRevision.valueOf()}`,
      'X-Device-Credential': credential,
      'X-Device-Signature': RequestSigner.sign(
        request,
        session.deviceCredentialKeyPair,
      ),
    });
  }

  public headersWithRecoveryProof(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, string>> {
    const { headers, request } = this.signedRequest(
      session,
      method,
      path,
      body,
    );

    return Promise.resolve({
      ...headers,
      'X-Recovery-Signature': RequestSigner.sign(
        request,
        session.recoveryAuthorityKeyPair,
      ),
    });
  }

  /** The exact content the identity, device and recovery keys sign. */
  public payload(
    method: string,
    path: string,
    timestamp: number,
    body?: unknown,
  ): string {
    return SignedHttpRequestSignature.signingContent(
      this.request(method, path, timestamp, body),
    );
  }
}
