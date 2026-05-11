import type {
  IdentityResource,
  PendingMessageAttachment,
  Session,
} from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

import { AttachmentCipher } from '../../domain/attachments/AttachmentCipher';
import { PigeonApiGateway } from './PigeonApiGateway';

describe(PigeonApiGateway.name, () => {
  it('loads node networks anonymously when no session is available', async () => {
    const response = {
      networks: [{ id: 'network-1', key: null, name: 'Public Swarm' }],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn(),
    } as unknown as RequestSigner;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.getNodeNetworks()).resolves.toBe(response.networks);

    expect(signer.headers).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith('/node/networks/', {
      headers: undefined,
      method: 'GET',
    });
  });

  it('loads node networks with signed identity headers when a session is available', async () => {
    const response = {
      networks: [{ id: 'network-1', key: 'network-key', name: 'Private' }],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.getNodeNetworks(session)).resolves.toBe(
      response.networks,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/node/networks/',
    );
    expect(http.request).toHaveBeenCalledWith('/node/networks/', {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'GET',
    });
  });

  it('does not project deleted messages when loading conversation messages', async () => {
    const http = {
      request: jest.fn().mockResolvedValue({
        messages: [
          { id: 'deleted-message', type: 'deleted' },
          {
            authorIdentityId: 'identity-1',
            content: 'visible',
            id: 'sent-message',
            type: 'sent',
          },
        ],
        nextBeforeMessageId: null,
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const messages = {
      list: jest.fn((value: unknown) => value as never),
      toChatMessage: jest.fn().mockResolvedValue({
        authorIdentityId: 'identity-1',
        content: 'visible',
        encrypted: false,
        id: 'sent-message',
        mine: true,
        raw: { id: 'sent-message' },
        timestamp: 1,
      }),
    };
    const session = { identity: { id: 'identity-1' } } as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      messages as never,
    );

    await expect(
      gateway.loadMessages(session, 'conversation-1'),
    ).resolves.toMatchObject({
      messages: [{ id: 'sent-message' }],
    });
    expect(messages.toChatMessage).toHaveBeenCalledTimes(1);
    expect(messages.toChatMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      expect.objectContaining({ id: 'sent-message' }),
    );
  });

  it('refreshes the current identity reference before signing profile updates', async () => {
    const currentIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      id: 'identity/with+symbols=',
      identityExternalIdentifier: 'current-identity-cid',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      signature: 'current-signature',
      timestamp: 1,
      version: 7,
    } satisfies IdentityResource;
    const updatedIdentity = {
      ...currentIdentity,
      identityExternalIdentifier: 'next-identity-cid',
      profile: { biography: 'Hi', handle: 'ada', name: 'Ada Next' },
      version: 8,
    } satisfies IdentityResource;
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(currentIdentity)
        .mockResolvedValueOnce(updatedIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({
          toString: () => 'identity-signature',
        }),
      },
      identity: {
        ...currentIdentity,
        identityExternalIdentifier: undefined,
        previousIdentityExternalIdentifier: undefined,
        version: 1,
      },
      keychain: { conversations: {}, version: 0 },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.updateIdentityProfile(session, {
        biography: 'Hi',
        handle: 'ada',
        name: 'Ada Next',
      }),
    ).resolves.toBe(updatedIdentity);

    expect(http.request).toHaveBeenNthCalledWith(
      1,
      '/identities/identity%2Fwith%2Bsymbols%3D',
    );
    const [, putInit] = (http.request as jest.Mock).mock.calls[1] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(putInit.body as string) as IdentityResource;

    expect(body.previousIdentityExternalIdentifier).toBe(
      'current-identity-cid',
    );
    expect(body.version).toBe(8);
    expect(body.signature).toBe('identity-signature');
    const [signedPayload, signedPassword] = (
      session.encryptedKeyPair.sign as jest.Mock
    ).mock.calls[0] as [string, string];
    const parsedSignedPayload = JSON.parse(
      signedPayload,
    ) as Partial<IdentityResource>;

    expect(parsedSignedPayload).toEqual({
      encryptedKeyPair: currentIdentity.encryptedKeyPair,
      id: currentIdentity.id,
      networks: currentIdentity.networks,
      previousIdentityExternalIdentifier: 'current-identity-cid',
      profile: {
        biography: 'Hi',
        handle: 'ada',
        name: 'Ada Next',
      },
      timestamp: expect.any(Number),
      version: 8,
    });
    expect(signedPassword).toBe(session.password);
  });

  it('uploads public profile files as signed raw bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const upload = {
      cid: 'bafy-avatar',
      contentType: 'image/png',
      filename: 'avatar.png',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(upload),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const file = {
      arrayBuffer: jest.fn().mockResolvedValue(bytes),
      name: 'avatar.png',
      type: 'image/png',
    } as unknown as File;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.uploadPublicFile(session, file)).resolves.toBe(upload);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/public',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith('/ipfs/public', {
      body: bytes,
      headers: {
        'Content-Type': 'image/png',
        'X-Filename': 'avatar.png',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
  });

  it('uploads private attachments as signed encrypted raw bytes', async () => {
    const bytes = new Uint8Array([9, 8, 7]).buffer;
    const upload = {
      cid: 'bafy-attachment',
      contentType: 'application/octet-stream',
      encrypted: true,
      filename: 'encrypted.bin',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(upload),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const attachment = {
      encryptedBytes: bytes,
      metadata: {
        contentType: 'image/png',
        encryption: { algorithm: 'AES-GCM', iv: 'iv', key: 'key' },
        filename: 'photo.png',
        size: 3,
      },
      uploadFilename: 'encrypted.bin',
    } satisfies PendingMessageAttachment;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.uploadPrivateFile(session, attachment)).resolves.toBe(
      upload,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/private',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith('/ipfs/private', {
      body: bytes,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': 'encrypted.bin',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
  });

  it('sends messages with encrypted attachment references', async () => {
    const encryptedBytes = new Uint8Array([9, 8, 7]).buffer;
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({
          cid: 'bafy-attachment',
          contentType: 'application/octet-stream',
          encrypted: true,
          filename: 'encrypted.bin',
          size: 3,
        })
        .mockResolvedValueOnce({
          authorIdentityId: 'identity-1',
          content: 'sent',
          id: 'message-1',
          timestamp: 10,
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const attachmentCipher = {
      encrypt: jest.fn().mockResolvedValue({
        encryptedBytes,
        metadata: {
          contentType: 'image/png',
          encryption: { algorithm: 'AES-GCM', iv: 'iv', key: 'key' },
          filename: 'photo.png',
          size: 10,
        },
        uploadFilename: 'encrypted.bin',
      }),
    } as unknown as AttachmentCipher;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'message-signature',
    });
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          'conversation-1': {
            conversationId: 'conversation-1',
            createdAt: 1,
            peerIdentityId: 'identity-2',
            privateKey: 'private-key',
            publicKey: 'public-key',
          },
        },
        version: 1,
      },
      password: 'secret',
    } as unknown as Session;
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      undefined,
      undefined,
      undefined,
      attachmentCipher,
    );

    await expect(
      gateway.sendMessage(
        session,
        'conversation-1',
        'hello',
        ['previous-message'],
        [file],
        undefined,
        'message-0',
      ),
    ).resolves.toMatchObject({ content: 'sent' });

    const [, messageRequest] = (http.request as jest.Mock).mock.calls[1] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(messageRequest.body as string) as {
      attachmentExternalIdentifiers: string[];
      encryptedPayload: string;
      previousMessageIds: string[];
      replyToMessageId?: string;
      signature: string;
    };
    const [signaturePayload] = sign.mock.calls[0] as [string, string];

    expect(body.attachmentExternalIdentifiers).toEqual(['bafy-attachment']);
    expect(body.previousMessageIds).toEqual(['previous-message']);
    expect(body.replyToMessageId).toBe('message-0');
    expect(body.signature).toBe('message-signature');
    expect(JSON.parse(signaturePayload)).toMatchObject({
      attachmentExternalIdentifiers: ['bafy-attachment'],
      authorId: 'identity-1',
      conversationId: 'conversation-1',
      encryptedPayload: expect.stringContaining('bafy-attachment'),
      previousMessageIds: ['previous-message'],
      replyToMessageId: 'message-0',
      type: 'sent',
    });
    expect(JSON.parse(body.encryptedPayload)).toMatchObject({
      attachments: [
        {
          cid: 'bafy-attachment',
          contentType: 'image/png',
          encryptedSize: 3,
          filename: 'photo.png',
          size: 10,
        },
      ],
      content: 'hello',
    });
  });

  it('deletes messages with a signed tombstone body', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'delete-signature',
    });
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.deleteMessage(
        session,
        'one-to-one:conversation',
        'message/to-delete',
      ),
    ).resolves.toBeUndefined();

    const path =
      '/conversations/one-to-one%3Aconversation/messages/message%2Fto-delete';
    const [, request] = (http.request as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(request.body as string) as {
      createdAt: number;
      id: string;
      signature: string;
    };
    const [signaturePayload] = sign.mock.calls[0] as [string, string];

    expect(http.request).toHaveBeenCalledWith(path, {
      body: expect.any(String),
      headers: { 'X-Signature': 'http-signature' },
      method: 'DELETE',
    });
    expect(signer.headers).toHaveBeenCalledWith(session, 'DELETE', path, body);
    expect(body.signature).toBe('delete-signature');
    expect(JSON.parse(signaturePayload)).toEqual({
      attachmentExternalIdentifiers: [],
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: body.createdAt,
      id: body.id,
      previousMessageIds: ['message/to-delete'],
      targetMessageId: 'message/to-delete',
      type: 'deleted',
    });
  });

  it('loads public IPFS content by encoded cid', async () => {
    const content = {
      cid: 'bafy/avatar',
      contentType: 'image/png',
      data: 'abc',
      filename: 'avatar.png',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(content),
    } as unknown as HttpJsonClient;
    const gateway = new PigeonApiGateway(http);

    await expect(gateway.getPublicFile('bafy/avatar')).resolves.toBe(content);

    expect(http.request).toHaveBeenCalledWith('/ipfs/bafy%2Favatar');
  });

  it('downloads encrypted private attachment content', async () => {
    const encryptedBytes = new Uint8Array([1, 2, 3]);
    const decrypted = new Blob(['clear'], { type: 'image/png' });
    const http = {
      request: jest.fn().mockResolvedValue({
        cid: 'bafy/attachment',
        contentType: 'application/octet-stream',
        encrypted: true,
        encryptedData: 'AQID',
        filename: 'encrypted.bin',
        size: 3,
      }),
    } as unknown as HttpJsonClient;
    const attachmentCipher = {
      base64ToBytes: jest.fn().mockReturnValue(encryptedBytes),
      bytesToArrayBuffer: jest.fn().mockReturnValue(encryptedBytes.buffer),
      decrypt: jest.fn().mockResolvedValue(decrypted),
    } as unknown as AttachmentCipher;
    const gateway = new PigeonApiGateway(
      http,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      attachmentCipher,
    );
    const attachment = {
      cid: 'bafy/attachment',
      contentType: 'image/png',
      encryption: { algorithm: 'AES-GCM', iv: 'iv', key: 'key' },
      filename: 'photo.png',
      size: 3,
    } as const;

    await expect(gateway.downloadAttachment(attachment)).resolves.toBe(
      decrypted,
    );

    expect(http.request).toHaveBeenCalledWith('/ipfs/bafy%2Fattachment');
    expect(attachmentCipher.base64ToBytes).toHaveBeenCalledWith('AQID');
    expect(attachmentCipher.decrypt).toHaveBeenCalledWith(
      attachment,
      encryptedBytes.buffer,
      undefined,
    );
  });
});
