import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

export function hasEncryptedPayload(message: MessageResource): boolean {
  return Boolean(message.encryptedPayload ?? message.payload);
}
