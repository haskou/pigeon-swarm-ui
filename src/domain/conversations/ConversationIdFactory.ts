import { SHA256Hash } from '@haskou/value-objects';

export class ConversationIdFactory {
  public create(
    leftIdentityId: string,
    rightIdentityId: string,
    networkId?: string,
  ): string {
    const sorted = [leftIdentityId, rightIdentityId]
      .filter(Boolean)
      .sort()
      .join(':');

    if (!sorted || !networkId) {
      return `one-to-one:${crypto.randomUUID()}`;
    }

    return `one-to-one:${SHA256Hash.from(`${sorted}:${networkId}`).toString()}`;
  }
}
