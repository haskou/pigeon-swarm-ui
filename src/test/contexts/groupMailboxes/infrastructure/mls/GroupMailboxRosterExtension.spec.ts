import { GroupMailboxRoster } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';
import { GroupMailboxRosterExtension } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxRosterExtension';

const roster = GroupMailboxRoster.of({
  adminIds: ['bob'],
  conversationId: `group:${'A'.repeat(43)}`,
  creatorId: 'alice',
  memberIds: ['carol', 'alice', 'bob'],
  name: 'Team ✓',
  version: GroupMailboxRoster.VERSION,
}) as GroupMailboxRoster;

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);
const textOf = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('GroupMailboxRosterExtension', () => {
  it('uses a private extension type distinct from the community frontier', () => {
    expect(GroupMailboxRosterExtension.EXTENSION_TYPE).toBe(0xf421);
  });

  it('encodes the canonical JSON of the fields, lists sorted', () => {
    expect(textOf(GroupMailboxRosterExtension.encode(roster))).toBe(
      `{"adminIds":["bob"],"conversationId":"group:${'A'.repeat(43)}","creatorId":"alice","memberIds":["alice","bob","carol"],"name":"Team ✓","version":1}`,
    );
  });

  it('decodes what it encodes', () => {
    expect(
      GroupMailboxRosterExtension.decode(
        GroupMailboxRosterExtension.encode(roster),
      )?.toFields(),
    ).toEqual(roster.toFields());
  });

  it.each<[string, (text: string) => string]>([
    [
      'non-canonical key order',
      (text) =>
        text
          .replace('{"adminIds":["bob"],', '{')
          .replace('}', ',"adminIds":["bob"]}'),
    ],
    [
      'unsorted members',
      (text) =>
        text.replace('["alice","bob","carol"]', '["bob","alice","carol"]'),
    ],
    ['whitespace', (text) => text.replace(':', ': ')],
    ['an extra key', (text) => text.replace('{', '{"extra":1,')],
    ['a missing key', (text) => text.replace('"name":"Team ✓",', '')],
    ['a wrong type', (text) => text.replace('"version":1', '"version":"1"')],
    ['another version', (text) => text.replace('"version":1', '"version":2')],
    [
      'a creator who is an admin',
      (text) =>
        text.replace('"adminIds":["bob"]', '"adminIds":["alice","bob"]'),
    ],
    ['not an object', () => '[]'],
    ['not JSON', () => '{'],
  ])('rejects %s', (_, mutate) => {
    const text = textOf(GroupMailboxRosterExtension.encode(roster));

    expect(
      GroupMailboxRosterExtension.decode(bytesOf(mutate(text))),
    ).toBeUndefined();
  });

  it('rejects invalid UTF-8', () => {
    expect(
      GroupMailboxRosterExtension.decode(new Uint8Array([0x7b, 0xff, 0x7d])),
    ).toBeUndefined();
  });

  it('rejects oversized bytes before parsing them', () => {
    expect(
      GroupMailboxRosterExtension.decode(new Uint8Array(1_048_577)),
    ).toBeUndefined();
  });

  it('reads a context holding exactly the roster extension', () => {
    const extensionData = GroupMailboxRosterExtension.encode(roster);
    const extension = {
      extensionData,
      extensionType: GroupMailboxRosterExtension.EXTENSION_TYPE,
    };

    expect(GroupMailboxRosterExtension.read([extension])?.name).toBe('Team ✓');
    expect(GroupMailboxRosterExtension.read([])).toBeUndefined();
    expect(
      GroupMailboxRosterExtension.read([extension, extension]),
    ).toBeUndefined();
    expect(
      GroupMailboxRosterExtension.read([
        { extensionData, extensionType: 0xf420 },
      ]),
    ).toBeUndefined();
  });
});
