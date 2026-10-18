import type { SignedHttpRequest } from '@haskou/pigeon-swarm-crypto';

import {
  KeyPair,
  PublicKey,
  Signature,
  SignedHttpRequestSignature,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

type SigningSession = Session & {
  deviceCredentialKeyPair: KeyPair;
  keyPair: KeyPair;
  recoveryAuthorityKeyPair: KeyPair;
};

async function signingSession(): Promise<SigningSession> {
  const keyPair = await KeyPair.generate();

  return {
    authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
    authorizationRevision: DeviceAuthorizationRevision.initial(),
    deviceCredentialKeyPair: await KeyPair.generate(),
    identity: { id: keyPair.toPrimitives().publicKey },
    keyPair,
    recoveryAuthorityKeyPair: await KeyPair.generate(),
  } as unknown as SigningSession;
}

function publicKeyOf(keyPair: KeyPair): PublicKey {
  return new PublicKey(keyPair.toPrimitives().publicKey);
}

function expectSigned(
  request: SignedHttpRequest,
  signature: string | undefined,
  keyPair: KeyPair,
): void {
  expect(() =>
    SignedHttpRequestSignature.verify(
      request,
      new Signature(signature ?? ''),
      publicKeyOf(keyPair),
    ),
  ).not.toThrow();
}

describe(RequestSigner.name, () => {
  it('signs the library content of the upper-cased method and request path', () => {
    const signer = new RequestSigner(() => 123);
    const body = { conversationId: 'conversation-1' };

    expect(signer.payload('post', '/conversations', 123, body)).toBe(
      SignedHttpRequestSignature.signingContent({
        body,
        method: 'POST',
        path: '/conversations',
        timestamp: 123,
      }),
    );
  });

  it('signs the request path and the raw query string', () => {
    const signer = new RequestSigner(() => 123);

    expect(signer.payload('GET', '/notifications?limit=30', 123)).toBe(
      SignedHttpRequestSignature.signingContent({
        method: 'GET',
        path: '/notifications?limit=30',
        timestamp: 123,
      }),
    );
  });

  it('drops the fragment and keeps the query string under a route prefix', () => {
    const signer = new RequestSigner(() => 123, '/api');

    expect(signer.payload('GET', '/keychains/id?limit=1#top', 123)).toBe(
      SignedHttpRequestSignature.signingContent({
        method: 'GET',
        path: '/api/keychains/id?limit=1',
        timestamp: 123,
      }),
    );
  });

  it('keeps encoded path params', () => {
    const signer = new RequestSigner(() => 123);
    const path = '/keychains/identity%2Fwith%2Fslashes';

    expect(signer.payload('GET', path, 123)).toBe(
      SignedHttpRequestSignature.signingContent({
        method: 'GET',
        path,
        timestamp: 123,
      }),
    );
  });

  it('prefixes relative signed paths when the API is mounted under a route prefix', () => {
    const signer = new RequestSigner(() => 123, '/api');

    expect(signer.payload('GET', '/keychains/id', 123)).toBe(
      SignedHttpRequestSignature.signingContent({
        method: 'GET',
        path: '/api/keychains/id',
        timestamp: 123,
      }),
    );
  });

  it('does not duplicate an API route prefix that is already in the signed path', () => {
    const signer = new RequestSigner(() => 123, '/api');

    expect(signer.payload('GET', '/api/keychains/id', 123)).toBe(
      signer.payload('GET', '/keychains/id', 123),
    );
  });

  it('signs the URL pathname and query when passed an absolute URL, even under a prefix', () => {
    const expected = SignedHttpRequestSignature.signingContent({
      method: 'GET',
      path: '/keychains/id?limit=1',
      timestamp: 123,
    });

    expect(
      new RequestSigner(() => 123).payload(
        'GET',
        'https://example.com/keychains/id?limit=1',
        123,
      ),
    ).toBe(expected);
    expect(
      new RequestSigner(() => 123, '/api').payload(
        'GET',
        'https://example.com/keychains/id?limit=1',
        123,
      ),
    ).toBe(expected);
  });

  it('signs headers with the session identity key', async () => {
    const session = await signingSession();
    const headers = await new RequestSigner(() => 123).headers(
      session,
      'GET',
      '/messages',
    );

    expect(headers).toMatchObject({
      'X-Identity-Id': IdentityId.normalize(session.identity.id),
      'X-Timestamp': '123',
    });
    expect(headers).not.toHaveProperty('X-Nonce');
    expectSigned(
      { method: 'GET', path: '/messages', timestamp: 123 },
      headers['X-Signature'],
      session.keyPair,
    );
  });

  it('binds an authorized device proof to the same signed request', async () => {
    const session = await signingSession();
    const request = {
      method: 'GET',
      path: '/identity-devices/id',
      timestamp: 123,
    };
    const headers = await new RequestSigner(() => 123).headersWithDeviceProof(
      session,
      'GET',
      '/identity-devices/id',
    );

    expect(headers).toMatchObject({
      'X-Device-Authorization-Epoch': 'genesis',
      'X-Device-Authorization-Revision': '0',
      'X-Device-Credential': IdentityId.normalize(
        session.deviceCredentialKeyPair.toPrimitives().publicKey,
      ),
    });
    expectSigned(request, headers['X-Signature'], session.keyPair);
    expectSigned(
      request,
      headers['X-Device-Signature'],
      session.deviceCredentialKeyPair,
    );
  });

  it('binds recovery authority proof to the same signed request', async () => {
    const session = await signingSession();
    const request = {
      method: 'GET',
      path: '/identity-devices/id',
      timestamp: 123,
    };
    const headers = await new RequestSigner(() => 123).headersWithRecoveryProof(
      session,
      'GET',
      '/identity-devices/id',
    );

    expectSigned(request, headers['X-Signature'], session.keyPair);
    expectSigned(
      request,
      headers['X-Recovery-Signature'],
      session.recoveryAuthorityKeyPair,
    );
  });

  it('signs long request bodies', async () => {
    const session = await signingSession();
    const body = { encryptedPayload: 'x'.repeat(6000) };
    const headers = await new RequestSigner(() => 123).headers(
      session,
      'POST',
      '/keychains',
      body,
    );

    expectSigned(
      { body, method: 'POST', path: '/keychains', timestamp: 123 },
      headers['X-Signature'],
      session.keyPair,
    );
  });

  it('hashes raw upload bytes instead of JSON stringifying them', () => {
    const signer = new RequestSigner(() => 123);
    const bytes = new Uint8Array([0, 1, 2, 3, 4]);
    const view = bytes.subarray(1, 4);
    const raw = SignedHttpRequestSignature.signingContent({
      body: Uint8Array.from([1, 2, 3]),
      method: 'POST',
      path: '/ipfs/contents',
      timestamp: 123,
    });

    expect(
      signer.payload(
        'POST',
        '/ipfs/contents',
        123,
        Uint8Array.from([1, 2, 3]).buffer,
      ),
    ).toBe(raw);
    expect(signer.payload('POST', '/ipfs/contents', 123, view)).toBe(raw);
    expect(
      signer.payload(
        'POST',
        '/ipfs/contents',
        123,
        new DataView(bytes.buffer, 1, 3),
      ),
    ).toBe(raw);
    expect(signer.payload('POST', '/ipfs/contents', 123, [1, 2, 3])).not.toBe(
      raw,
    );
  });
});
