import { NetworkInvite } from '../../../../contexts/networks/domain/NetworkInvite';
import { NetworkInviteCode } from '../../../../contexts/networks/domain/NetworkInviteCode';

describe(NetworkInviteCode.name, () => {
  it('encodes and decodes network invite codes', () => {
    const invite = NetworkInvite.fromPrimitives({
      id: 'network-id',
      key: 'private-key',
      name: 'Private Swarm',
    });

    const code = NetworkInviteCode.encode(invite);

    expect(code).toMatch(/^psn1\./);
    expect(NetworkInviteCode.decode(code).toPrimitives()).toEqual(
      invite.toPrimitives(),
    );
  });

  it('rejects invalid codes', () => {
    expect(() => NetworkInviteCode.decode('nope')).toThrow(
      'Invalid network code.',
    );
  });

  it('maps malformed encoded payloads to the domain error', () => {
    expect(() => NetworkInviteCode.decode('psn1.bm90LWpzb24')).toThrow(
      'Invalid network code.',
    );
  });
});
