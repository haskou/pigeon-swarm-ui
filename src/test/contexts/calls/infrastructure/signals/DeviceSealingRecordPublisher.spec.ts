import { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { CallSignalSigningBytes } from '../../../../../contexts/calls/infrastructure/signals/CallSignalSigningBytes';
import { DeviceSealingRecordPublisher } from '../../../../../contexts/calls/infrastructure/signals/DeviceSealingRecordPublisher';
import vectors from '../../../../fixtures/device-authorization-transition-log-vectors.json';

const device = KeyPair.fromPrimitives({
  privateKey: vectors.keys.author.privateKeyPem,
  publicKey: vectors.keys.author.publicKeyPem,
});
const session = {
  deviceCredentialKeyPair: device,
  identity: { id: 'alice' },
} as unknown as Session;
let now = Date.UTC(2026, 9, 4, 23, 59, 0);
const build = () => {
  const api = { publishRecord: jest.fn().mockResolvedValue(undefined) };
  const keys = { publicKey: jest.fn().mockResolvedValue('sealing-key') };

  return {
    api,
    publisher: new DeviceSealingRecordPublisher(keys, api, () => now),
  };
};

describe(DeviceSealingRecordPublisher.name, () => {
  beforeEach(() => {
    now = Date.UTC(2026, 9, 4, 23, 59, 0);
  });

  it('publishes today and yesterday, signed by the device credential', async () => {
    const { api, publisher } = build();

    await publisher.publish(session);

    expect(
      api.publishRecord.mock.calls.map(([, r]) => String(r.utcDay)),
    ).toEqual(['2026-10-04', '2026-10-03']);
    const [, record] = api.publishRecord.mock.calls[0];

    expect(record).toMatchObject({
      deviceCredential: vectors.keys.author.publicKeyPem,
      sealingPublicKey: 'sealing-key',
    });
    expect(
      device.isValidSignature(
        CallSignalSigningBytes.sealingRecord({
          deviceCredential: record.deviceCredential,
          identityId: 'alice',
          sealingPublicKey: record.sealingPublicKey,
          utcDay: record.utcDay,
        }),
        new Signature(record.signature),
      ),
    ).toBe(true);
  });

  it('is idempotent within a day and publishes the new day after rollover', async () => {
    const { api, publisher } = build();

    await publisher.publish(session);
    await publisher.publish(session);
    expect(api.publishRecord).toHaveBeenCalledTimes(2);

    now = Date.UTC(2026, 9, 5, 0, 1, 0);
    await publisher.publish(session);

    expect(
      api.publishRecord.mock.calls.map(([, r]) => String(r.utcDay)),
    ).toEqual(['2026-10-04', '2026-10-03', '2026-10-05']);
  });

  it('retries a day whose publication failed', async () => {
    const { api, publisher } = build();

    api.publishRecord.mockRejectedValueOnce(new Error('offline'));
    await expect(publisher.publish(session)).rejects.toThrow('offline');
    await publisher.publish(session);

    expect(
      api.publishRecord.mock.calls.map(([, r]) => String(r.utcDay)),
    ).toEqual(['2026-10-04', '2026-10-04', '2026-10-03']);
  });
});
