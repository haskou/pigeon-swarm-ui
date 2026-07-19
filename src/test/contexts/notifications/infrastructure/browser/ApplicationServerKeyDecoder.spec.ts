import { ApplicationServerKeyDecoder } from '../../../../../contexts/notifications/infrastructure/browser/ApplicationServerKeyDecoder';

describe(ApplicationServerKeyDecoder.name, () => {
  it('decodes a base64url server key', () => {
    expect([...new ApplicationServerKeyDecoder().decode('AQID')]).toEqual([
      1, 2, 3,
    ]);
  });
});
