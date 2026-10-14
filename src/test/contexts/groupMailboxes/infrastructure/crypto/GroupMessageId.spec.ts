import { GroupMessageId } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMessageId';

describe(GroupMessageId.name, () => {
  it('makes fresh ids that belong to their author only', () => {
    const id = GroupMessageId.create('alice');

    expect(GroupMessageId.create('alice')).not.toBe(id);
    expect(GroupMessageId.belongsTo(id, 'alice')).toBe(true);
    expect(GroupMessageId.belongsTo(id, 'bob')).toBe(false);
  });

  it('binds the whole author id, separators included', () => {
    const id = GroupMessageId.create('ali');

    expect(GroupMessageId.belongsTo(id, 'ali\u0000')).toBe(false);
    expect(GroupMessageId.belongsTo(id, 'alice')).toBe(false);
  });

  it.each([
    ['a legacy id', 'm1'],
    ['a uuid', '0f8fad5b-d9cb-469f-a165-70867728950e'],
    ['an empty id', ''],
  ])('rejects %s', (_name, id) => {
    expect(GroupMessageId.belongsTo(id, 'alice')).toBe(false);
  });

  it('rejects an id with another tag, a padded part or extra parts', () => {
    const id = GroupMessageId.create('alice');
    const [nonce, tag] = id.split('.');
    const other = tag.startsWith('A') ? `B${tag.slice(1)}` : `A${tag.slice(1)}`;

    expect(GroupMessageId.belongsTo(`${nonce}.${other}`, 'alice')).toBe(false);
    expect(GroupMessageId.belongsTo(`${id}=`, 'alice')).toBe(false);
    expect(GroupMessageId.belongsTo(`${id}.${tag}`, 'alice')).toBe(false);
    expect(GroupMessageId.belongsTo(` ${id}`, 'alice')).toBe(false);
  });

  it('rejects a nonce with non-canonical trailing bits', () => {
    const id = GroupMessageId.create('alice');
    const [nonce] = id.split('.');
    const last = nonce.slice(-1);
    // 22 characters carry 132 bits; the last 4 of 16 bytes must be zero.
    const bumped = String.fromCharCode(last.charCodeAt(0) + 1);

    expect(
      GroupMessageId.belongsTo(
        `${nonce.slice(0, -1)}${bumped}.${id.split('.')[1]}`,
        'alice',
      ),
    ).toBe(false);
  });
});
