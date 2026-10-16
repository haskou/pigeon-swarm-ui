import { InvalidFormatError } from '@haskou/value-objects';

import { GroupMailboxGenerationSecret } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxGenerationSecret';

describe(GroupMailboxGenerationSecret.name, () => {
  const secretBytes = new Uint8Array(32).fill(0x22);
  const encoded = 'IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI';

  it('round-trips 32 bytes through unpadded base64url', () => {
    expect(
      GroupMailboxGenerationSecret.fromBytes(secretBytes).isEqual(
        GroupMailboxGenerationSecret.fromString(encoded),
      ),
    ).toBe(true);
  });

  it('hands the same 32 bytes to the library as a symmetric key', () => {
    expect(
      new Uint8Array(
        GroupMailboxGenerationSecret.fromString(encoded)
          .toSymmetricKey()
          .getBuffer(),
      ),
    ).toEqual(secretBytes);
  });

  it.each([31, 33])('rejects %p bytes', (length) => {
    expect(() =>
      GroupMailboxGenerationSecret.fromBytes(new Uint8Array(length)),
    ).toThrow(InvalidFormatError);
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
    expect(() => GroupMailboxGenerationSecret.fromString(value)).toThrow(
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
});
