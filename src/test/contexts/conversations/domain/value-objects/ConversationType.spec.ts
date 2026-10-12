import { ValueNotInEnumError } from '@haskou/value-objects';

import { ConversationType } from '../../../../../contexts/conversations/domain/value-objects/ConversationType';

describe(ConversationType.name, () => {
  it('maps a known primitive to its type', () => {
    expect(ConversationType.fromPrimitives('group').isGroup()).toBe(true);
    expect(ConversationType.fromPrimitives('one-to-one').isOneToOne()).toBe(
      true,
    );
  });

  it('rejects an unknown primitive', () => {
    expect(() => ConversationType.fromPrimitives('community-voice')).toThrow(
      ValueNotInEnumError,
    );
  });

  it('maps an unknown primitive to undefined without throwing', () => {
    expect(
      ConversationType.tryFromPrimitives('community-voice'),
    ).toBeUndefined();
    expect(ConversationType.tryFromPrimitives('group')?.isGroup()).toBe(true);
  });

  it('tells a one-to-one conversation apart from a group', () => {
    expect(ConversationType.ONE_TO_ONE.isOneToOne()).toBe(true);
    expect(ConversationType.GROUP.isOneToOne()).toBe(false);
  });
});
