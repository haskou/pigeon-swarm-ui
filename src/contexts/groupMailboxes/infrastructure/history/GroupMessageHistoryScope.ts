import { Buffer } from 'buffer';

import type { DeviceRootRowKeys } from '../../../messages/infrastructure/mailbox/DeviceRootRowKeys';
import type { GroupMessageHistoryConversation } from './GroupMessageHistoryConversation';

/**
 * What the group history holds in memory for one identity under one
 * device-sealed root: its keys and its opened conversations.
 */
export class GroupMessageHistoryScope {
  private readonly root: Buffer;

  public readonly conversations = new Map<
    string,
    GroupMessageHistoryConversation
  >();

  public constructor(
    root: Uint8Array,
    public readonly keys: DeviceRootRowKeys,
  ) {
    this.root = Buffer.from(root);
  }

  public opensUnder(root: Uint8Array): boolean {
    return this.root.equals(Buffer.from(root));
  }
}
