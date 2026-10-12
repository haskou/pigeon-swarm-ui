import type { MessageResource } from '../http/MessageResource';

export function hasEncryptedPayload(message: MessageResource): boolean {
  return Boolean(message.encryptedPayload ?? message.payload);
}
