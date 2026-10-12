import type { PrivateBlobReservation } from '../../../../../contexts/attachments/application/contracts/PrivateBlobReservation';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { PrivateBlobUploadIncompleteError } from '../../../../../contexts/attachments/domain/errors/PrivateBlobUploadIncompleteError';
import { PrivateBlobReplicator } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobReplicator';
import { PrivateBlobUploadLedger } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUploadLedger';

describe(PrivateBlobReplicator.name, () => {
  const session = {
    identity: { id: 'identity-1' },
    masterKey: {
      decrypt: (payload: { toString: () => string }) => ({
        toString: () => payload.toString().replace(/^sealed:/, ''),
      }),
      encrypt: (plain: string) => ({ toString: () => `sealed:${plain}` }),
    },
  } as unknown as Session;
  const nodeA = 'https://node-a.example';
  const nodeB = 'https://node-b.example';
  const origins = [nodeA, nodeB];

  const reservationFor = (
    blobId: string,
    origin: string,
    expiresAt = 10_000,
  ): PrivateBlobReservation => ({
    blobId,
    downloadToken: `${blobId}-download`,
    expiresAt,
    origin,
    uploadToken: `${blobId}-upload`,
  });

  const reserveEach = () => {
    let next = 0;

    return jest.fn((_session: Session, _size: number, origin: string) =>
      Promise.resolve(reservationFor(`blob-${next++}`, origin)),
    );
  };

  const setup = (
    overrides: Partial<{
      remove: jest.Mock;
      reserve: jest.Mock;
      upload: jest.Mock;
    }> = {},
    windowClosesAt?: number,
  ) => {
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
    const privateBlobs = {
      remove: jest.fn().mockResolvedValue(undefined),
      reserve: reserveEach(),
      upload: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const wait = jest.fn().mockResolvedValue(undefined);
    const replicator = new PrivateBlobReplicator(privateBlobs, ledger, {
      attempts: 3,
      now: () => windowClosesAt ?? 1_000,
      retryDelayMs: 100,
      wait,
    });

    return { ledger, privateBlobs, replicator, wait };
  };

  const parts = [new Uint8Array([1, 2]).buffer, new Uint8Array([3]).buffer];

  it('stores every part on every origin and returns replicas in origin order', async () => {
    const { privateBlobs, replicator } = setup();

    const stored = await replicator.storeParts(
      session,
      parts.length,
      (index) => parts[index]!,
      origins,
    );

    expect(stored.map((replicas) => replicas.map((r) => r.origin))).toEqual([
      origins,
      origins,
    ]);
    expect(privateBlobs.reserve).toHaveBeenCalledWith(session, 2, nodeA);
    expect(privateBlobs.reserve).toHaveBeenCalledWith(session, 1, nodeB);
    expect(privateBlobs.upload).toHaveBeenCalledTimes(4);
  });

  it('keeps a part stored by one origin when another origin keeps failing', async () => {
    const reserve = jest.fn(
      (_session: Session, _size: number, origin: string) =>
        origin === nodeB
          ? Promise.reject(new Error('node down'))
          : Promise.resolve(reservationFor(`blob-${origin}`, origin)),
    );
    const { privateBlobs, replicator, wait } = setup({ reserve });

    const stored = await replicator.storeParts(
      session,
      parts.length,
      (index) => parts[index]!,
      origins,
    );

    expect(stored.map((replicas) => replicas.map((r) => r.origin))).toEqual([
      [nodeA],
      [nodeA],
    ]);
    expect(
      privateBlobs.reserve.mock.calls.filter(
        ([, , origin]) => origin === nodeB,
      ),
    ).toHaveLength(6);
    expect(wait).toHaveBeenCalled();
  });

  it('retries a failed reservation and a failed upload with the same reservation', async () => {
    const reservation = reservationFor('blob-1', nodeA);
    const reserve = jest
      .fn()
      .mockRejectedValueOnce(new Error('reserve failed'))
      .mockResolvedValue(reservation);
    const upload = jest
      .fn()
      .mockRejectedValueOnce(new Error('put failed'))
      .mockResolvedValue(undefined);
    const { privateBlobs, replicator, wait } = setup({ reserve, upload });

    const stored = await replicator.storeParts(session, 1, () => parts[0]!, [
      nodeA,
    ]);

    expect(stored).toEqual([
      [
        {
          blobId: 'blob-1',
          downloadToken: 'blob-1-download',
          expiresAt: 10_000,
          origin: nodeA,
          uploadToken: 'blob-1-upload',
        },
      ],
    ]);
    expect(privateBlobs.reserve).toHaveBeenCalledTimes(2);
    expect(privateBlobs.upload).toHaveBeenCalledTimes(2);
    expect(privateBlobs.upload.mock.calls[1]?.[0]).toBe(reservation);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('reserves again once the reservation window has closed', async () => {
    const reserve = jest
      .fn()
      .mockResolvedValueOnce(reservationFor('blob-expired', nodeA, 500))
      .mockResolvedValueOnce(reservationFor('blob-fresh', nodeA, 10_000));
    const upload = jest
      .fn()
      .mockRejectedValueOnce(new Error('put failed'))
      .mockResolvedValue(undefined);
    const { privateBlobs, replicator } = setup({ reserve, upload }, 1_000);

    const stored = await replicator.storeParts(session, 1, () => parts[0]!, [
      nodeA,
    ]);

    expect(stored[0]?.[0]?.blobId).toBe('blob-fresh');
    expect(privateBlobs.reserve).toHaveBeenCalledTimes(2);
    expect(privateBlobs.upload.mock.calls[1]?.[0]).toEqual(
      reservationFor('blob-fresh', nodeA, 10_000),
    );
  });

  it('fails the send when a part has no stored replica and removes the replicas already stored', async () => {
    const reserve = jest.fn(
      (_session: Session, size: number, origin: string) =>
        size === 1
          ? Promise.reject(new Error('node down'))
          : Promise.resolve(reservationFor(`blob-${origin}`, origin)),
    );
    const { privateBlobs, replicator } = setup({ reserve });

    await expect(
      replicator.storeParts(
        session,
        parts.length,
        (index) => parts[index]!,
        origins,
      ),
    ).rejects.toBeInstanceOf(PrivateBlobUploadIncompleteError);

    expect(privateBlobs.remove).toHaveBeenCalledTimes(2);
    expect(privateBlobs.remove).toHaveBeenCalledWith({
      blobId: `blob-${nodeA}`,
      origin: nodeA,
      uploadToken: `blob-${nodeA}-upload`,
    });
  });

  it('abandon deletes each replica with its upload token and keeps going past failures', async () => {
    const remove = jest
      .fn()
      .mockRejectedValueOnce(new Error('already expired'))
      .mockResolvedValue(undefined);
    const { privateBlobs, replicator } = setup({ remove });
    const stored = await replicator.storeParts(
      session,
      1,
      () => parts[0]!,
      origins,
    );

    await expect(
      replicator.abandon(
        session,
        stored.flat().map((replica) => ({
          blobId: replica.blobId,
          origin: replica.origin,
        })),
      ),
    ).resolves.toBeUndefined();

    expect(privateBlobs.remove).toHaveBeenCalledTimes(2);
    expect(privateBlobs.remove).toHaveBeenLastCalledWith({
      blobId: 'blob-1',
      origin: nodeB,
      uploadToken: 'blob-1-upload',
    });
  });

  it('settle forgets replicas so a later abandon does not delete them', async () => {
    const { privateBlobs, replicator } = setup();
    const stored = await replicator.storeParts(
      session,
      1,
      () => parts[0]!,
      origins,
    );
    const refs = stored.flat().map((replica) => ({
      blobId: replica.blobId,
      origin: replica.origin,
    }));

    await replicator.settle(session, refs);
    await replicator.abandon(session, refs);

    expect(privateBlobs.remove).not.toHaveBeenCalled();
  });

  it('removes a replica it cannot remember and keeps the part stored by another origin', async () => {
    const { ledger, privateBlobs, replicator } = setup();
    const remember = ledger.remember.bind(ledger);

    jest.spyOn(ledger, 'remember').mockImplementation((current, tickets) => {
      if (tickets[0]?.origin === nodeA) throw new Error('storage full');

      remember(current, tickets);
    });

    const stored = await replicator.storeParts(
      session,
      1,
      () => parts[0]!,
      origins,
    );

    expect(stored.map((replicas) => replicas.map((r) => r.origin))).toEqual([
      [nodeB],
    ]);
    expect(privateBlobs.remove).toHaveBeenCalledTimes(1);
    expect(privateBlobs.remove).toHaveBeenCalledWith({
      blobId: 'blob-0',
      origin: nodeA,
      uploadToken: 'blob-0-upload',
    });
  });

  it('fails with no replica left behind when no origin can remember a part', async () => {
    const reserve = jest.fn((_session: Session, size: number, origin: string) =>
      Promise.resolve(reservationFor(`size-${size}-${origin}`, origin)),
    );
    const { ledger, privateBlobs, replicator } = setup({ reserve });
    const remember = ledger.remember.bind(ledger);

    jest.spyOn(ledger, 'remember').mockImplementation((current, tickets) => {
      if (tickets[0]?.blobId.startsWith('size-1-')) {
        throw new Error('storage full');
      }

      remember(current, tickets);
    });

    await expect(
      replicator.storeParts(
        session,
        parts.length,
        (index) => parts[index]!,
        origins,
      ),
    ).rejects.toBeInstanceOf(PrivateBlobUploadIncompleteError);

    expect(
      privateBlobs.remove.mock.calls
        .map(([ticket]: [{ blobId: string }]) => ticket.blobId)
        .sort(),
    ).toEqual([
      `size-1-${nodeA}`,
      `size-1-${nodeB}`,
      `size-2-${nodeA}`,
      `size-2-${nodeB}`,
    ]);
  });
});
