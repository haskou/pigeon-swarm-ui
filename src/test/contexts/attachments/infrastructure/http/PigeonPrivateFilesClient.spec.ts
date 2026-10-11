import { PigeonPrivateFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateFilesClient';

describe(PigeonPrivateFilesClient.name, () => {
  it('fetches a legacy attachment through its encoded external identifier', async () => {
    const content = {
      cid: 'external/id',
      contentType: 'application/octet-stream',
      encrypted: true as const,
      encryptedData: 'AQID',
      filename: 'attachment.bin',
      size: 3,
    };
    const http = { request: jest.fn().mockResolvedValue(content) };
    const client = new PigeonPrivateFilesClient(http);

    await expect(client.fetch('external/id')).resolves.toBe(content);
    expect(http.request).toHaveBeenCalledWith('/ipfs/external%2Fid');
  });
});
