import { NetworkInviteCode } from './networkInviteCode';

describe(NetworkInviteCode.name, () => {
  it('encodes and decodes network invite codes', () => {
    const invite = {
      id: 'network-id',
      key: 'private-key',
      name: 'Private Swarm',
    };

    const code = NetworkInviteCode.encode(invite);

    expect(code).toMatch(/^psn1\./);
    expect(NetworkInviteCode.decode(code)).toEqual(invite);
  });

  it('rejects invalid codes', () => {
    expect(() => NetworkInviteCode.decode('nope')).toThrow(
      'Invalid network code.',
    );
  });
});
