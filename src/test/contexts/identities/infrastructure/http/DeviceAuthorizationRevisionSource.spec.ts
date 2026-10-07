import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { DeviceAuthorizationRevisionSource } from '../../../../../contexts/identities/infrastructure/http/DeviceAuthorizationRevisionSource';

describe(DeviceAuthorizationRevisionSource.name, () => {
  const sessionAt = (
    enrolledRevision: number,
    identityId = 'identity-1',
    publicKey = 'device-key',
  ): Session =>
    ({
      authorizationRevision: { valueOf: () => enrolledRevision },
      deviceCredentialKeyPair: { toPrimitives: () => ({ publicKey }) },
      identity: { id: identityId },
    }) as unknown as Session;
  const checkpoint = (revision: number) => ({
    getRevision: () => ({ valueOf: () => revision }),
  });

  function build(ttlMs = 5000) {
    const now = { value: 1000 };
    const find = jest.fn();
    const source = new DeviceAuthorizationRevisionSource(
      { find } as never,
      () => now.value,
      ttlMs,
    );

    return { find, now, source };
  }

  it('answers the revision of the node checkpoint', async () => {
    const { find, source } = build();

    find.mockResolvedValue(checkpoint(7));

    await expect(source.current(sessionAt(0))).resolves.toBe(7);
  });

  it('shares one read within the window and reads again once it expires', async () => {
    const { find, now, source } = build(5000);

    find
      .mockResolvedValueOnce(checkpoint(7))
      .mockResolvedValueOnce(checkpoint(9));
    const session = sessionAt(0);

    await expect(source.current(session)).resolves.toBe(7);
    now.value += 4999;
    await expect(source.current(session)).resolves.toBe(7);
    expect(find).toHaveBeenCalledTimes(1);
    now.value += 2;
    await expect(source.current(session)).resolves.toBe(9);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('keeps identities and devices apart', async () => {
    const { find, source } = build();

    find
      .mockResolvedValueOnce(checkpoint(1))
      .mockResolvedValueOnce(checkpoint(2));

    await expect(source.current(sessionAt(0, 'a'))).resolves.toBe(1);
    await expect(source.current(sessionAt(0, 'b'))).resolves.toBe(2);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('never caches a failed read', async () => {
    const { find, source } = build();
    const session = sessionAt(0);

    find
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(checkpoint(3));

    await expect(source.current(session)).rejects.toThrow('offline');
    await expect(source.current(session)).resolves.toBe(3);
  });

  it('never answers below the revision at which this device was enrolled', async () => {
    const { find, source } = build();

    find.mockResolvedValue(checkpoint(2));

    await expect(source.current(sessionAt(6))).resolves.toBe(6);
  });
});
