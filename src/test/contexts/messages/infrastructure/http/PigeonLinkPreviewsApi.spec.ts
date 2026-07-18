import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonLinkPreviewsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonLinkPreviewsApi';

describe(PigeonLinkPreviewsApi.name, () => {
  it('signs and sends the preview URL', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    const session = { identity: { id: 'identity-a' } } as Session;
    const preview = { title: 'Pigeon' };

    signer.headers.mockResolvedValue({ Authorization: 'signed' });
    http.request.mockResolvedValue(preview);

    await expect(
      new PigeonLinkPreviewsApi(http, signer).create(
        session,
        'https://example.com',
      ),
    ).resolves.toBe(preview);
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/link-previews',
      { url: 'https://example.com' },
    );
    expect(http.request).toHaveBeenCalledWith('/link-previews', {
      body: JSON.stringify({ url: 'https://example.com' }),
      headers: { Authorization: 'signed' },
      method: 'POST',
    });
  });
});
