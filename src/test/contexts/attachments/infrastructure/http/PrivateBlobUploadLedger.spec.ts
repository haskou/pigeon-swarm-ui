import {
  EncryptedPayload,
  KeyPair,
  PrivateKey,
  PublicKey,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { PrivateBlobUploadRef } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUploadLedger';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { PrivateBlobUploadLedger } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUploadLedger';

describe(PrivateBlobUploadLedger.name, () => {
  const device = new KeyPair(
    new PublicKey('device-a-credential'),
    new PrivateKey('device-a-private'),
  );
  const masterKey = SymmetricKey.generate();
  const session = {
    deviceCredentialKeyPair: device,
    identity: { id: 'identity-1' },
    masterKey,
  } as unknown as Session;
  const nodeA = 'https://node-a.example';
  const nodeB = 'https://node-b.example';
  const ticket = (blobId: string, origin = nodeA) => ({
    blobId,
    origin,
    uploadToken: `${blobId}-upload-token`,
  });

  const setup = () => {
    const items = new Map<string, string>();
    const ledger = new PrivateBlobUploadLedger(
      {
        getItem: (key: string) => items.get(key) ?? null,
        removeItem: (key: string) => {
          items.delete(key);
        },
        setItem: (key: string, value: string) => {
          items.set(key, value);
        },
      },
      () => 'ledger-test-key',
    );

    return { items, ledger };
  };

  const seal = (value: unknown): string =>
    device.encrypt(JSON.stringify(value)).toString();
  const storedTickets = (items: Map<string, string>): unknown =>
    JSON.parse(
      device
        .decrypt(new EncryptedPayload(items.get('ledger-test-key') ?? ''))
        .toString(),
    );
  // Stored values can hold any type, so a malformed entry is reachable only
  // through a ref that mirrors its raw fields.
  const rawRef = (blobId: unknown, origin: unknown) =>
    ({ blobId, origin }) as unknown as PrivateBlobUploadRef;

  it('keeps upload tokens encrypted at rest and returns matching tickets once', () => {
    const { items, ledger } = setup();

    ledger.remember(session, [ticket('blob-1'), ticket('blob-2', nodeB)]);

    expect([...items.values()].join('')).not.toContain('blob-1-upload-token');
    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [ticket('blob-1')],
    );
    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [],
    );
    expect(ledger.take(session, [{ blobId: 'blob-2', origin: nodeB }])).toEqual(
      [ticket('blob-2', nodeB)],
    );
  });

  it("seals the ledger to this device's credential, not the identity root", () => {
    const { items, ledger } = setup();
    const otherDevice = new KeyPair(
      new PublicKey('device-b-credential'),
      new PrivateKey('device-b-private'),
    );

    ledger.remember(session, [ticket('blob-1')]);

    const sealed = new EncryptedPayload(items.get('ledger-test-key') ?? '');

    expect(storedTickets(items)).toEqual([ticket('blob-1')]);
    expect(() => otherDevice.decrypt(sealed)).toThrow();
    expect(() => masterKey.decrypt(sealed)).toThrow();
  });

  it('reads a ledger sealed under the identity root as empty', () => {
    const { items, ledger } = setup();

    items.set(
      'ledger-test-key',
      masterKey.encrypt(JSON.stringify([ticket('blob-1')])).toString(),
    );

    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [],
    );
  });

  it('matches tickets on origin as well as blob id', () => {
    const { ledger } = setup();

    ledger.remember(session, [ticket('blob-1', nodeA)]);

    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeB }])).toEqual(
      [],
    );
    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [ticket('blob-1', nodeA)],
    );
  });

  it('forgets settled tickets so they are never taken for deletion', () => {
    const { ledger } = setup();

    ledger.remember(session, [ticket('blob-1'), ticket('blob-2')]);
    ledger.forget(session, [{ blobId: 'blob-1', origin: nodeA }]);

    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [],
    );
    expect(ledger.take(session, [{ blobId: 'blob-2', origin: nodeA }])).toEqual(
      [ticket('blob-2')],
    );
  });

  it('keeps only the newest tickets', () => {
    const { ledger } = setup();
    const tickets = Array.from({ length: 201 }, (_, index) =>
      ticket(`blob-${index}`),
    );

    ledger.remember(session, tickets);

    expect(ledger.take(session, [{ blobId: 'blob-0', origin: nodeA }])).toEqual(
      [],
    );
    expect(
      ledger.take(session, [{ blobId: 'blob-200', origin: nodeA }]),
    ).toEqual([ticket('blob-200')]);
  });

  it('treats an unreadable ledger as empty and overwrites it', () => {
    const { items, ledger } = setup();

    items.set('ledger-test-key', 'not-sealed');
    ledger.remember(session, [ticket('blob-1')]);

    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [ticket('blob-1')],
    );
  });

  it('treats a non-array ledger as empty and overwrites it', () => {
    const { items, ledger } = setup();

    items.set('ledger-test-key', seal(ticket('blob-1')));

    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [],
    );

    ledger.remember(session, [ticket('blob-2')]);

    expect(storedTickets(items)).toEqual([ticket('blob-2')]);
  });

  it('keeps tickets without an origin', () => {
    const { ledger } = setup();
    const sessionTicket = {
      blobId: 'blob-1',
      uploadToken: 'blob-1-upload-token',
    };

    ledger.remember(session, [sessionTicket]);

    expect(ledger.take(session, [{ blobId: 'blob-1' }])).toEqual([
      sessionTicket,
    ]);
  });

  it('ignores ledger entries missing required ticket fields', () => {
    const { items, ledger } = setup();

    items.set(
      'ledger-test-key',
      seal([ticket('blob-1'), { blobId: 'blob-2', origin: nodeA }]),
    );

    expect(
      ledger.take(session, [
        { blobId: 'blob-1', origin: nodeA },
        { blobId: 'blob-2', origin: nodeA },
      ]),
    ).toEqual([ticket('blob-1')]);
  });

  it('ignores ledger entries with fields of the wrong type', () => {
    const { items, ledger } = setup();

    items.set(
      'ledger-test-key',
      seal([
        { blobId: 'blob-1', origin: nodeA, uploadToken: 1 },
        { blobId: 2, origin: nodeA, uploadToken: 'blob-2-upload-token' },
        { blobId: 'blob-3', origin: 3, uploadToken: 'blob-3-upload-token' },
      ]),
    );

    expect(
      ledger.take(session, [
        { blobId: 'blob-1', origin: nodeA },
        rawRef(2, nodeA),
        rawRef('blob-3', 3),
      ]),
    ).toEqual([]);
  });

  it('ignores ledger entries that are not objects', () => {
    const { items, ledger } = setup();

    items.set('ledger-test-key', seal([null, ticket('blob-1')]));

    expect(ledger.take(session, [{ blobId: 'blob-1', origin: nodeA }])).toEqual(
      [ticket('blob-1')],
    );
  });

  it('keeps valid tickets and drops malformed ones on the next write', () => {
    const { items, ledger } = setup();

    items.set(
      'ledger-test-key',
      seal([
        ticket('blob-1'),
        { blobId: 'blob-2', origin: nodeA },
        { blobId: 'blob-3', origin: nodeA, uploadToken: 3 },
        ticket('blob-4', nodeB),
      ]),
    );

    expect(
      ledger.take(session, [
        { blobId: 'blob-2', origin: nodeA },
        { blobId: 'blob-3', origin: nodeA },
      ]),
    ).toEqual([]);

    ledger.remember(session, [ticket('blob-5')]);

    expect(storedTickets(items)).toEqual([
      ticket('blob-1'),
      ticket('blob-4', nodeB),
      ticket('blob-5'),
    ]);
  });
});
