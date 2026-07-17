import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonPrivateFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateFilesClient';

describe(PigeonPrivateFilesClient.name, () => {
  it('fetches an attachment through its encoded external identifier', async () => {
    const content = {
      cid: 'external/id',
      contentType: 'application/octet-stream',
      encrypted: true as const,
      encryptedData: 'AQID',
      filename: 'attachment.bin',
      size: 3,
    };
    const http = { request: jest.fn().mockResolvedValue(content) };
    const client = new PigeonPrivateFilesClient(http, { headers: jest.fn() });

    await expect(client.fetch('external/id')).resolves.toBe(content);
    expect(http.request).toHaveBeenCalledWith('/ipfs/external%2Fid');
  });

  it('signs the exact private-network upload path', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const session = {} as Session;
    const upload = {
      cid: 'external-1',
      contentType: 'application/octet-stream',
      encrypted: true as const,
      filename: 'attachment.bin',
      size: 3,
    };
    const http = { request: jest.fn().mockResolvedValue(upload) };
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signature' }),
    };
    const client = new PigeonPrivateFilesClient(http, signer);

    await expect(
      client.upload(session, 'private/network', bytes, 'attachment.bin'),
    ).resolves.toBe(upload);
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/private%2Fnetwork',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/ipfs/private%2Fnetwork',
      expect.objectContaining({ body: bytes, method: 'POST' }),
    );
  });
});
