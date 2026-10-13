import { InvalidFormatError } from '@haskou/value-objects';

import { GroupMailboxGenerationSecret } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxGenerationSecret';
import { GroupMailboxSlot } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxSlot';

describe(GroupMailboxSlot.name, () => {
  const slotBytes = new Uint8Array(32).fill(0x22);
  const encoded = 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI';

  it('round-trips 32 bytes through unpadded base64url', () => {
    const slot = GroupMailboxSlot.fromBytes(slotBytes);

    expect(slot.isEqual(GroupMailboxSlot.fromString(encoded))).toBe(true);
    expect(slot.getBytes()).toEqual(slotBytes);
  });

  it.each([31, 33])('rejects %p bytes', (length) => {
    expect(() => GroupMailboxSlot.fromBytes(new Uint8Array(length))).toThrow(
      InvalidFormatError,
    );
  });

  it.each([
    ['padded', `${encoded}=`],
    ['standard base64', 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi+'],
    [
      'non-canonical trailing bits',
      'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiJ',
    ],
    ['too short', encoded.slice(1)],
  ])('rejects %s text', (_case, value) => {
    expect(() => GroupMailboxSlot.fromString(value)).toThrow(
      InvalidFormatError,
    );
  });

  it('never echoes the rejected value', () => {
    const secret = 'secret-generation-material';

    let rejection: unknown;

    try {
      GroupMailboxGenerationSecret.fromString(secret);
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(InvalidFormatError);
    expect(String(rejection)).not.toContain(secret);
  });

  it('keeps a slot and a generation secret of the same bytes distinct', () => {
    expect(
      GroupMailboxSlot.fromBytes(slotBytes).isEqual(
        GroupMailboxGenerationSecret.fromBytes(slotBytes),
      ),
    ).toBe(false);
  });
});
