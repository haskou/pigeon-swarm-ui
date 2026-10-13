import { Buffer } from 'buffer';

import { GroupMailboxEnvelopeKey } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxEnvelopeKey';
import { GroupMailboxGenerationSecret } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxGenerationSecret';
import { GroupMailboxId } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxId';
import { GroupMailboxOwnerRootKey } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxOwnerRootKey';
import { GroupMailboxPostToken } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxPostToken';
import { GroupMailboxReadToken } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxReadToken';
import { GroupMailboxSlot } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxSlot';
import { GroupMailboxKeySchedule } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMailboxKeySchedule';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import vectors from '../../../../fixtures/group-mailbox-derivation-vectors.json';

// The fixture is generated with node:crypto hkdfSync, independent of this
// implementation. One block per HKDF label, every case in each block.
type Case = (typeof vectors.cases)[number];

function bytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

function generation(vector: Case): GroupMailboxGenerationSecret {
  return GroupMailboxGenerationSecret.fromBytes(
    bytes(vector.input.generationSecret),
  );
}

function slot(vector: Case): GroupMailboxSlot {
  return GroupMailboxKeySchedule.slot(
    generation(vector),
    IdentityId.fromString(vector.input.identityId),
  );
}

describe(GroupMailboxKeySchedule.name, () => {
  describe(vectors.labels.slot, () => {
    it.each(vectors.cases)('derives the member slot for $name', (vector) => {
      expect(
        slot(vector).isEqual(GroupMailboxSlot.fromString(vector.expected.slot)),
      ).toBe(true);
    });

    it('gives the same identity another slot in the next generation', () => {
      const identityId = IdentityId.fromString(
        vectors.cases[0].input.identityId,
      );
      const current = GroupMailboxKeySchedule.slot(
        generation(vectors.cases[0]),
        identityId,
      );
      const next = GroupMailboxKeySchedule.slot(
        generation(vectors.cases[2]),
        identityId,
      );

      expect(current.isEqual(next)).toBe(false);
    });
  });

  describe(vectors.labels.mailboxId, () => {
    it.each(vectors.cases)(
      'derives the mailbox id for $name',
      (vector: Case) => {
        const mailboxId = GroupMailboxKeySchedule.mailboxId(
          generation(vector),
          slot(vector),
        );

        expect(
          mailboxId.isEqual(
            GroupMailboxId.fromString(vector.expected.mailboxId),
          ),
        ).toBe(true);
      },
    );
  });

  describe(vectors.labels.postToken, () => {
    it.each(vectors.cases)(
      'derives the post token for $name',
      (vector: Case) => {
        const postToken = GroupMailboxKeySchedule.postToken(
          generation(vector),
          slot(vector),
        );

        expect(
          postToken.isEqual(
            GroupMailboxPostToken.fromString(vector.expected.postToken),
          ),
        ).toBe(true);
      },
    );
  });

  describe(vectors.labels.envelopeKey, () => {
    it.each(vectors.cases)(
      'derives the envelope key for $name',
      (vector: Case) => {
        const envelopeKey = GroupMailboxKeySchedule.envelopeKey(
          generation(vector),
          slot(vector),
        );

        expect(
          envelopeKey.isEqual(
            GroupMailboxEnvelopeKey.fromBytes(
              bytes(vector.expected.envelopeKey),
            ),
          ),
        ).toBe(true);
      },
    );
  });

  describe(vectors.labels.readToken, () => {
    it.each(vectors.cases)(
      'derives the owner read token for $name',
      (vector: Case) => {
        const readToken = GroupMailboxKeySchedule.readToken(
          GroupMailboxOwnerRootKey.fromBytes(bytes(vector.input.ownerRootKey)),
          GroupMailboxId.fromString(vector.expected.mailboxId),
        );

        expect(
          readToken.isEqual(
            GroupMailboxReadToken.fromString(vector.expected.readToken),
          ),
        ).toBe(true);
      },
    );
  });
});
