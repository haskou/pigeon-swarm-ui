import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PrivateBlobUploadLedger } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUploadLedger';

describe(PrivateBlobUploadLedger.name, () => {
  const session = {
    identity: { id: 'identity-1' },
    masterKey: {
      decrypt: (payload: { toString: () => string }) => ({
        toString: () =>
          [...payload.toString().replace(/^sealed:/, '')].reverse().join(''),
      }),
      encrypt: (plain: string) => ({
        toString: () => `sealed:${[...plain].reverse().join('')}`,
      }),
    },
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
});
