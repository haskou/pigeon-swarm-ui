jest.mock('../../app/API_SERVER_URL', () => ({
  API_SERVER_URL: '/api/',
}));

import { ipfsUrl } from './ipfsLinks';

describe(ipfsUrl.name, () => {
  const originalLocation = globalThis.location;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: new URL('https://pigeon.futoineko.com/'),
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('builds an absolute backend URL when the configured API URL is relative', () => {
    expect(
      ipfsUrl(
        'bafkreic2zqlwprwv2iofsnh32fc77zqj5eh7vlpjxlsxcfjxv45jcbjfdq',
      ),
    ).toBe(
      'https://pigeon.futoineko.com/api/ipfs/bafkreic2zqlwprwv2iofsnh32fc77zqj5eh7vlpjxlsxcfjxv45jcbjfdq',
    );
  });
});
