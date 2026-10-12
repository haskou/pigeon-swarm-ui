import { PrivateBlobPartHasNoReplicaError } from '../../../../contexts/attachments/domain/errors/PrivateBlobPartHasNoReplicaError';
import { PrivateBlobReplicaPolicy } from '../../../../contexts/attachments/domain/PrivateBlobReplicaPolicy';

type Replica = { blobId: string; origin?: string };

describe(PrivateBlobReplicaPolicy.name, () => {
  describe('plannedOrigins', () => {
    it('keeps candidate order, drops undefined and duplicates', () => {
      expect(
        PrivateBlobReplicaPolicy.plannedOrigins([
          'https://node-a.example',
          undefined,
          'https://node-b.example',
          'https://node-a.example',
        ]),
      ).toEqual(['https://node-a.example', 'https://node-b.example']);
    });

    it('caps the planned origins at three', () => {
      expect(
        PrivateBlobReplicaPolicy.plannedOrigins([
          'https://node-a.example',
          'https://node-b.example',
          'https://node-c.example',
          'https://node-d.example',
        ]),
      ).toEqual([
        'https://node-a.example',
        'https://node-b.example',
        'https://node-c.example',
      ]);
    });

    it('plans nothing when every candidate is undefined', () => {
      expect(PrivateBlobReplicaPolicy.plannedOrigins([undefined])).toEqual([]);
    });
  });

  describe('everyPartStored', () => {
    it('is true when every part has a replica', () => {
      expect(PrivateBlobReplicaPolicy.everyPartStored([[{}], [{}, {}]])).toBe(
        true,
      );
    });

    it('is false when any part has no replica', () => {
      expect(PrivateBlobReplicaPolicy.everyPartStored([[{}], []])).toBe(false);
    });
  });

  describe('split', () => {
    it('takes the first replica as primary and keeps origin-named alternates in order, capped at two', () => {
      const replicas: Replica[] = [
        { blobId: 'blob-1', origin: 'https://node-a.example' },
        { blobId: 'blob-2', origin: 'https://node-b.example' },
        { blobId: 'blob-3' },
        { blobId: 'blob-4', origin: 'https://node-c.example' },
        { blobId: 'blob-5', origin: 'https://node-d.example' },
      ];

      const split = PrivateBlobReplicaPolicy.split(replicas);

      expect(split.primary.blobId).toBe('blob-1');
      expect(split.alternates.map((alternate) => alternate.blobId)).toEqual([
        'blob-2',
        'blob-4',
      ]);
    });

    it('returns no alternates when no other replica names an origin', () => {
      const replicas: Replica[] = [{ blobId: 'blob-1' }, { blobId: 'blob-2' }];

      expect(PrivateBlobReplicaPolicy.split(replicas).alternates).toEqual([]);
    });

    it('rejects a part without any replica', () => {
      expect(() => PrivateBlobReplicaPolicy.split<Replica>([])).toThrow(
        PrivateBlobPartHasNoReplicaError,
      );
    });
  });
});
