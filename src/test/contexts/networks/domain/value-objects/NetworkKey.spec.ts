import { NetworkKey } from '../../../../../contexts/networks/domain/value-objects/NetworkKey';

describe(NetworkKey.name, () => {
  it('generates the PEM private key expected by private networks', () => {
    expect(NetworkKey.generate().toString()).toMatch(
      /^-----BEGIN PRIVATE KEY-----/,
    );
  });
});
