import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { StickerOwnerId } from '../../../../../contexts/stickers/domain/value-objects/StickerOwnerId';
import { StickerAccessContexts } from '../../../../../contexts/stickers/infrastructure/http/StickerAccessContexts';

describe(StickerAccessContexts.name, () => {
  it('keeps browser sessions at the infrastructure boundary', () => {
    const contexts = new StickerAccessContexts();
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;

    contexts.register(session);

    expect(contexts.find(StickerOwnerId.fromString('identity-a'))).toBe(
      session,
    );
    expect(() => contexts.find(StickerOwnerId.fromString('missing'))).toThrow(
      'Sticker access context is not registered.',
    );
  });
});
